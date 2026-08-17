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
// the TTS generation code below at all and the app silently falls back to
// flat browser/Android TTS for every announcement. Soft-enforcing until the
// Play Integrity setup is fixed on the Play Console side (needs access this
// environment doesn't have).
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
  "Speak slowly and clearly with natural pauses.";

// ── Score-based enthusiasm modulation: RETIRED 2026-08-17 ──────────────────
// Six iterations (swapped tier mapping, too-extreme then too-narrow value
// spreads, stale cache serving pre-fix audio for the exact test scores,
// a cache-hit path that never re-ran the tier logic at all) never produced
// reliably-correct live behavior, and each fix that looked right in isolation
// kept getting undone by the next layer of the same problem. Daniel decided
// to drop the feature entirely in favor of stability: every score now gets
// the same single voice profile, and there is deliberately no score-keyed
// branch left anywhere in this file for a future change to scramble. If
// per-score modulation is ever wanted again, treat it as a new feature with
// its own live-audio verification loop, not a revival of this one.
const VOICE_SETTINGS = { stability: 0.50, similarity_boost: 0.90, style: 0.35, use_speaker_boost: true, speed: 1.00 };
const MODEL_ID = "eleven_turbo_v2_5";

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

    // Return cached URL if the file already exists (no rate limit consumed).
    // NOTE: this returns *whatever audio was baked in when the file was first
    // generated* — it does NOT re-run any settings computed below, so a future
    // voice-settings change never touches already-cached clips until they're
    // purged. That silence (no log line at all on a cache hit) previously hid
    // a real bug: two scores (3 and 180) kept serving 2026-08-13 audio through
    // 2026-08-17 while every other score got regenerated under later fixes,
    // and nobody could see it because this path never logged anything.
    // Logging the cache hit (with the file's own age) makes that class of
    // staleness visible instead of silent.
    const baseKeyForLog = key.startsWith("el_") ? key.slice(3) : key;
    const [exists] = await file.exists();
    if (exists) {
      const [meta] = await file.getMetadata();
      const token = meta.metadata?.firebaseStorageDownloadTokens;
      if (token) {
        console.log("dartTTS cache hit:", JSON.stringify({
          key, baseKey: baseKeyForLog, cachedSince: meta.timeCreated,
        }));
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

    console.log("dartTTS request:", JSON.stringify({ key, baseKey, voiceSettings: VOICE_SETTINGS }));

    const elResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY.value(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
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
