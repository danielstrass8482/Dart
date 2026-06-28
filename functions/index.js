// Deploy ins neue Projekt:
// firebase use darttrainer-app
// firebase deploy --only functions:dartTTS,dartCoach,budgetCheck
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { randomUUID } = require("crypto");

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

// Voice settings by category
const VOICE_SETTINGS_DRAMATIC = { stability: 0.20, similarity_boost: 0.95, style: 0.85, use_speaker_boost: true };
const VOICE_SETTINGS_NEUTRAL  = { stability: 0.45, similarity_boost: 0.90, style: 0.50, use_speaker_boost: true };

// Keys using eleven_multilingual_v2 (higher quality for dramatic moments)
const MULTILINGUAL_KEYS = new Set(["score_180", "score_180b", "score_171", "score_167", "score_160", "score_140", "score_121", "game_on"]);
const DRAMATIC_KEYS = new Set(["score_180", "score_180b", "score_171", "score_167", "score_160", "score_140", "game_on"]);

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

function modelForKey(baseKey) {
  return MULTILINGUAL_KEYS.has(baseKey) ? "eleven_multilingual_v2" : "eleven_turbo_v2_5";
}

function voiceSettingsForKey(baseKey) {
  if (DRAMATIC_KEYS.has(baseKey)) return VOICE_SETTINGS_DRAMATIC;
  return VOICE_SETTINGS_NEUTRAL;
}

const TTS_DAILY_LIMIT = 200;

exports.dartTTS = onRequest(
  {
    secrets: [ELEVENLABS_API_KEY],
    region: "europe-west1",
    cors: ["https://danielstrass8482.github.io", "https://darttrainer.app", "http://localhost", "https://localhost"],
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
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
