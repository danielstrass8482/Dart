/**
 * voiceName.js — On-demand generation + CENTRAL caching of a single player's
 * first-name clip, for names that aren't already in the pre-produced name
 * library (data/names.json, shipped with the app / voice packages).
 *
 * Central cache key is the NORMALIZED NAME ONLY (never uid/device), stored at
 * dart_voice_names/{voiceId}/{normalizedName}.mp3 — so once any player named
 * "Zbigniew" triggers a generation, every later player with that same name
 * (any device, any account) reuses the exact same clip and never regenerates
 * it. This is intentionally NOT coupled to the existing TTS_DAILY_LIMIT /
 * dart_usage quota (that one is for the retired live-announcement path) —
 * instead it has its own much smaller per-uid daily cap (NAME_GEN_DAILY_LIMIT)
 * plus input validation, since a cache-miss here is a real (if cheap)
 * ElevenLabs call and must stay abuse-resistant without punishing normal use
 * (most names hit the cache after the very first player with that name).
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getStorage } = require("firebase-admin/storage");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { randomUUID } = require("crypto");

const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");

// Mirrors VOICE_IDS in functions/index.js — keep both in sync if voices change.
const VOICE_IDS = {
  george: "JBFqnCBsd6RMkjVDRZzb",
  haseeb: "dllHSct4GokGc1AH9JwT",
  jerry:  "zDBYcuJrpuZ6YQ7AgRUw",
  guy:    "34lPwSZ54D8fWbX1aHzk",
};
const DEFAULT_VOICE = "george";
const MODEL_ID = "eleven_turbo_v2_5";
const VOICE_SETTINGS = { stability: 0.50, similarity_boost: 0.90, style: 0.35, use_speaker_boost: true, speed: 1.00 };
const SYSTEM_PROMPT = "You are a calm, deep-voiced British darts announcer. Speak slowly and clearly with natural pauses.";

const NAME_GEN_DAILY_LIMIT = 20; // per uid/device per day — independent of TTS_DAILY_LIMIT

/** Mirrors normalizeName() in js/names.js and scripts/build-names.js. */
function normalizeName(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

// Letters (incl. accented/Unicode), spaces, hyphens, apostrophes, dots only;
// 1-30 chars. Blocks digits/symbols/control chars — a name is never a
// vector for arbitrary free-text TTS generation.
const VALID_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'\-.]{0,29}$/u;

function buildDownloadURL(bucket, filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

exports.dartVoiceName = onRequest(
  {
    secrets: [ELEVENLABS_API_KEY],
    region: "europe-west1",
    cors: ["https://danielstrass8482.github.io", "https://darttrainer.app", "https://play.darttrainer.app", "http://localhost", "https://localhost"],
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    try {
      const config = (await getFirestore().collection("dart_config").doc("limits").get()).data();
      if (!config || config.emergencyStop) {
        res.status(503).json({ error: "service_temporarily_unavailable" });
        return;
      }
    } catch (e) { console.warn("Config fetch failed, proceeding:", e.message); }

    const { name, voiceId: reqVoiceId } = req.body || {};
    if (!name || typeof name !== "string") { res.status(400).json({ error: "name_required" }); return; }
    const trimmed = name.trim();
    if (!VALID_NAME_RE.test(trimmed)) { res.status(400).json({ error: "invalid_name" }); return; }

    const voiceKey = VOICE_IDS[reqVoiceId] ? reqVoiceId : DEFAULT_VOICE;
    const elevenLabsVoiceId = VOICE_IDS[voiceKey];
    const norm = normalizeName(trimmed);
    const filePath = `dart_voice_names/${voiceKey}/${norm}.mp3`;
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);

    // Central cache hit — free, no rate limit consumed, available to anyone.
    const [exists] = await file.exists();
    if (exists) {
      const [meta] = await file.getMetadata();
      const token = meta.metadata?.firebaseStorageDownloadTokens;
      if (token) {
        res.json({ url: buildDownloadURL(bucket.name, filePath, token), cached: true });
        return;
      }
    }

    // Per-uid/device daily cap on actual generations (cache misses only).
    const today = new Date().toISOString().split("T")[0];
    let uid = "anonymous";
    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      try { uid = (await getAuth().verifyIdToken(authHeader.split(" ")[1])).uid; } catch (e) {}
    }
    const usageRef = getFirestore().collection("dart_name_gen_usage").doc(`${uid}_${today}`);
    try {
      const snap = await usageRef.get();
      const count = snap.exists ? (snap.data().count || 0) : 0;
      if (count >= NAME_GEN_DAILY_LIMIT) {
        res.status(429).json({ error: "daily_name_limit_reached", limit: NAME_GEN_DAILY_LIMIT });
        return;
      }
      await usageRef.set({ count: count + 1, date: today, lastUpdated: FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) { console.warn("Name-gen usage tracking failed, proceeding:", e.message); }

    const text = trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + ".";
    const elResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY.value(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS, system_prompt: SYSTEM_PROMPT, apply_text_normalization: "auto" }),
    });
    if (!elResp.ok) {
      const errBody = await elResp.text();
      console.error("ElevenLabs error (name):", elResp.status, errBody);
      res.status(502).json({ error: "name_generation_failed" });
      return;
    }

    const audioBuffer = Buffer.from(await elResp.arrayBuffer());
    const token = randomUUID();
    await file.save(audioBuffer, { metadata: { contentType: "audio/mpeg", metadata: { firebaseStorageDownloadTokens: token } } });

    res.json({ url: buildDownloadURL(bucket.name, filePath, token), cached: false });
  }
);
