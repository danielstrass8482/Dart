// Deploy ins neue Projekt:
// firebase use darttrainer-app
// firebase deploy --only functions:dartTTS,dartCoach,budgetCheck
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");
const { randomUUID } = require("crypto");

// Set to true to hard-enforce App Check (after all clients carry tokens).
// 2026-08-17: confirmed via production logs that the real Play Store Android
// app (versionCode 12) gets a 401 on every single dartTTS call — the native
// Play Integrity bridge (MainActivity.getAppCheckToken) never produces a
// token FirebaseAppCheck.verifyToken() accepts, so the request never reaches
// the enthusiasm-tier code below at all and the app silently falls back to
// flat browser/Android TTS (which has zero score-based modulation) for every
// announcement. That's why four rounds of retuning the ElevenLabs voice
// settings never changed what real users heard: the fixed code path was
// never executing. Soft-enforcing until the Play Integrity setup is fixed on
// the Play Console side (needs access this environment doesn't have).
const ENFORCE_APP_CHECK = false;

initializeApp();

const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");

const VOICE_IDS = {
  george: "JBFqnCBsd6RMkjVDRZzb",
  haseeb: "dllHSct4GokGc1AH9JwT",
  jerry:  "zDBYcuJrpuZ6YQ7AgRUw",
  guy:    "34lPwSZ54D8fWbX1aHzk",
};
const DEFAULT_VOICE_ID = VOICE_IDS.george;

const SYSTEM_PROMPT =
  "You are a calm, deep-voiced British darts announcer. " +
  "Speak slowly and clearly with natural pauses. " +
  "Be enthusiastic for high scores, disappointed for bust.";

// Voice settings by enthusiasm tier. Commit 5991b91 pushed the two-tier
// version to its practical extremes (stability 0.15/0.70, style 1.0/0.0) to
// fix a "no audible difference" complaint — but a live A/B test afterwards
// found the result came out sounding REVERSED (a low score sounded
// enthusiastic, a 180 sounded flat). ElevenLabs' own guidance is that
// style=1.0 and stability below ~0.20 push into a range where output
// character/quality can degrade or turn erratic rather than reliably read as
// "more excited" — the most likely explanation for why the extreme dramatic
// setting ended up sounding worse than the plain one. Pulled back to a
// moderate, monotonic three-tier gradient instead of doubling down on more
// extremes:
//   BUSINESSLIKE (<30):   stability 0.75 (steadiest),            style 0.00 (none),  speed 0.90 (slowest)
//   NORMAL       (30-99): stability 0.50 (mid),                  style 0.35 (mid),   speed 1.00 (baseline)
//   ENTHUSIASTIC (>=100): stability 0.30 (least steady/most expressive), style 0.65 (clear but short of ElevenLabs' risky 1.0 ceiling), speed 1.08 (fastest)
// Explicit direction check (do not skip this when touching these values):
//   stability strictly decreases:  0.75 > 0.50 > 0.30  ✓
//   style strictly increases:      0.00 < 0.35 < 0.65  ✓
//   speed strictly increases:      0.90 < 1.00 < 1.08  ✓
// A runtime self-check below throws at cold start if this ever gets
// scrambled again instead of silently shipping a wrong/reversed mapping.
const VOICE_SETTINGS_BUSINESSLIKE = { stability: 0.75, similarity_boost: 0.85, style: 0.00, use_speaker_boost: true, speed: 0.90 };
const VOICE_SETTINGS_NORMAL       = { stability: 0.50, similarity_boost: 0.90, style: 0.35, use_speaker_boost: true, speed: 1.00 };
const VOICE_SETTINGS_ENTHUSIASTIC = { stability: 0.30, similarity_boost: 0.95, style: 0.65, use_speaker_boost: true, speed: 1.08 };

// Non-score keys that always get the enthusiastic treatment (score-based keys
// are judged by scoreValueFromKey/enthusiasmTierForKey below instead).
const ENTHUSIASTIC_EXTRA_KEYS = new Set(["game_on"]);

// Commas/periods create natural pauses for ElevenLabs; no CAPS (causes rushing)
const SPECIAL_TEXTS = {
  score_180:  "One hundred, and eighty!",
  score_180b: "One hundred and eighty!",
  score_171: "One hundred, and seventy one.",
  score_167: "One hundred, and sixty seven.",
  score_160: "One hundred, and sixty.",
  score_140: "One hundred, and forty!",
  score_121: "One hundred, and twenty one!",
  score_100: "One hundred!",
  score_50:  "Bull's Eye!",
  score_26:  "Bed and Breakfast!",
  score_45:  "Forty five.",
  score_0:   "No score.",
  no_score:  "No score.",
  game_on:   "Game on!",
  bust:      "Bust.",
};

// Extracts the numeric turn score from a "score_<n>..." cache key (also
// matches score_50_bull/score_50_norm/score_180b), or null for non-score keys.
function scoreValueFromKey(baseKey) {
  const m = /^score_(\d+)/.exec(baseKey);
  return m ? parseInt(m[1], 10) : null;
}

// Three-tier enthusiasm classification, keyed off the actual numeric score
// rather than a hand-picked allowlist: <30 businesslike, 30-99 normal,
// >=100 enthusiastic. Non-score keys (game_on) count as enthusiastic.
function enthusiasmTierForKey(baseKey) {
  const score = scoreValueFromKey(baseKey);
  if (score !== null) {
    if (score >= 100) return "enthusiastic";
    if (score >= 30) return "normal";
    return "businesslike";
  }
  return ENTHUSIASTIC_EXTRA_KEYS.has(baseKey) ? "enthusiastic" : "normal";
}

function modelForKey(baseKey) {
  return enthusiasmTierForKey(baseKey) === "enthusiastic" ? "eleven_multilingual_v2" : "eleven_turbo_v2_5";
}

function voiceSettingsForKey(baseKey) {
  const tier = enthusiasmTierForKey(baseKey);
  if (tier === "enthusiastic") return VOICE_SETTINGS_ENTHUSIASTIC;
  if (tier === "normal") return VOICE_SETTINGS_NORMAL;
  return VOICE_SETTINGS_BUSINESSLIKE;
}

// ── Cold-start self-check ───────────────────────────────────────────
// Throws (crashing the instance) rather than silently deploying a scrambled
// tier mapping — this is exactly the class of bug that shipped in 5991b91
// undetected until a live listening test caught it.
function assertTier(baseKey, expected) {
  const actual = enthusiasmTierForKey(baseKey);
  if (actual !== expected) {
    throw new Error(`Enthusiasm tier self-check failed: ${baseKey} => ${actual}, expected ${expected}`);
  }
}
assertTier("score_3", "businesslike");
assertTier("score_29", "businesslike");
assertTier("score_30", "normal");
assertTier("score_60", "normal");
assertTier("score_99", "normal");
assertTier("score_100", "enthusiastic");
assertTier("score_180", "enthusiastic");
assertTier("score_180b", "enthusiastic");
assertTier("game_on", "enthusiastic");
if (!(VOICE_SETTINGS_BUSINESSLIKE.stability > VOICE_SETTINGS_NORMAL.stability &&
      VOICE_SETTINGS_NORMAL.stability > VOICE_SETTINGS_ENTHUSIASTIC.stability)) {
  throw new Error("Enthusiasm tier self-check failed: stability must strictly decrease businesslike -> normal -> enthusiastic");
}
if (!(VOICE_SETTINGS_BUSINESSLIKE.style < VOICE_SETTINGS_NORMAL.style &&
      VOICE_SETTINGS_NORMAL.style < VOICE_SETTINGS_ENTHUSIASTIC.style)) {
  throw new Error("Enthusiasm tier self-check failed: style must strictly increase businesslike -> normal -> enthusiastic");
}
if (!(VOICE_SETTINGS_BUSINESSLIKE.speed < VOICE_SETTINGS_NORMAL.speed &&
      VOICE_SETTINGS_NORMAL.speed < VOICE_SETTINGS_ENTHUSIASTIC.speed)) {
  throw new Error("Enthusiasm tier self-check failed: speed must strictly increase businesslike -> normal -> enthusiastic");
}

const TTS_DAILY_LIMIT = 200;

exports.dartTTS = onRequest(
  {
    secrets: [ELEVENLABS_API_KEY],
    region: "europe-west1",
    cors: ["https://danielstrass8482.github.io", "https://darttrainer.app", "https://play.darttrainer.app", "http://localhost", "https://localhost"],
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ── App Check verification ────────────────────────────────────
    const appCheckToken = req.headers["x-firebase-appcheck"];
    if (appCheckToken) {
      try {
        await getAppCheck().verifyToken(appCheckToken);
      } catch (e) {
        if (ENFORCE_APP_CHECK) {
          res.status(401).json({ error: "App Check verification failed" });
          return;
        }
        console.warn("App Check token invalid:", e.message);
      }
    } else if (ENFORCE_APP_CHECK) {
      res.status(401).json({ error: "App Check token required" });
      return;
    }

    // ── Kill-switch ──────────────────────────────────────────────
    try {
      const config = (await getFirestore().collection("dart_config").doc("limits").get()).data();
      if (!config || config.emergencyStop) {
        res.status(503).json({ error: "service_temporarily_unavailable", message: "TTS ist momentan nicht verfügbar." });
        return;
      }
      if (config.ttsEnabled === false) {
        res.status(503).json({ error: "feature_disabled", message: "TTS ist momentan deaktiviert." });
        return;
      }
    } catch (e) {
      console.warn("Config fetch failed, proceeding:", e.message);
    }

    const { key, text: fallbackText, voiceId: reqVoiceId } = req.body;
    if (!key || !fallbackText) {
      res.status(400).json({ error: "key and text required" });
      return;
    }

    const voiceId = reqVoiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
    const bucket = getStorage().bucket(); // uses default bucket — projekt-unabhängig
    const filePath = `dart_voice_el/${voiceId}/${key}.mp3`;
    const file = bucket.file(filePath);

    // Return cached URL if the file already exists (no rate limit consumed)
    const [exists] = await file.exists();
    if (exists) {
      const [meta] = await file.getMetadata();
      const token = meta.metadata?.firebaseStorageDownloadTokens;
      if (token) {
        res.json({ url: buildDownloadURL(bucket.name, filePath, token) });
        return;
      }
    }

    // ── Per-user rate limiting (uncached calls only) ──────────────
    const today = new Date().toISOString().split("T")[0];
    let uid = "anonymous";
    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await getAuth().verifyIdToken(authHeader.split(" ")[1]);
        uid = decoded.uid;
      } catch (e) {}
    }
    const usageRef = getFirestore().collection("dart_usage").doc(`${uid}_${today}`);
    try {
      const snap = await usageRef.get();
      const currentCount = snap.exists ? (snap.data().tts || 0) : 0;
      if (currentCount >= TTS_DAILY_LIMIT) {
        res.status(429).json({
          error: "daily_limit_reached",
          message: `Maximale Anzahl von ${TTS_DAILY_LIMIT} TTS-Calls pro Tag erreicht.`,
          limit: TTS_DAILY_LIMIT,
          used: currentCount,
          resetsAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        });
        return;
      }
      await usageRef.set({ tts: currentCount + 1, date: today, lastUpdated: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn("TTS usage tracking failed, proceeding:", e.message);
    }

    // Strip el_ prefix to look up special text / voice category
    const baseKey = key.startsWith("el_") ? key.slice(3) : key;
    const text = SPECIAL_TEXTS[baseKey] ?? fallbackText;
    const voiceSettings = voiceSettingsForKey(baseKey);

    console.log("dartTTS request:", JSON.stringify({
      key, baseKey, score: scoreValueFromKey(baseKey),
      tier: enthusiasmTierForKey(baseKey), model: modelForKey(baseKey), voiceSettings,
    }));

    const elResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY.value(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelForKey(baseKey),
        voice_settings: voiceSettings,
        system_prompt: SYSTEM_PROMPT,
        pronunciation_dictionary_locators: [],
        seed: null,
        previous_text: null,
        next_text: null,
        apply_text_normalization: "auto",
      }),
    });

    if (!elResp.ok) {
      const errBody = await elResp.text();
      console.error("ElevenLabs error:", elResp.status, errBody);
      res.status(502).json({ error: "TTS generation failed" });
      return;
    }

    const audioBuffer = Buffer.from(await elResp.arrayBuffer());
    const token = randomUUID();

    await file.save(audioBuffer, {
      metadata: {
        contentType: "audio/mpeg",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    res.json({ url: buildDownloadURL(bucket.name, filePath, token) });
  }
);

function buildDownloadURL(bucket, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

// Re-export additional functions
Object.assign(exports, require("./dartCoach"));
Object.assign(exports, require("./budgetCheck"));
Object.assign(exports, require("./feedback"));
