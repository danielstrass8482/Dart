const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { randomUUID } = require("crypto");

initializeApp();

const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George

const SYSTEM_PROMPT =
  "You are a professional darts announcer at the PDC World Championship at Alexandra Palace. " +
  "You sound exactly like a seasoned British caller — deep, authoritative, and full of controlled excitement. " +
  "For high scores like 180, your voice fills with genuine enthusiasm and drama. " +
  "For bust, you sound deeply disappointed. For Game On, you are energetic and commanding. " +
  "You speak with a crisp British accent, confident rhythm, and natural pauses between words for dramatic effect. " +
  "Never robotic, always human and passionate.";

// Voice settings by category
const VOICE_SETTINGS_DRAMATIC = { stability: 0.25, similarity_boost: 0.90, style: 0.80, use_speaker_boost: true };
const VOICE_SETTINGS_NEUTRAL  = { stability: 0.40, similarity_boost: 0.85, style: 0.55, use_speaker_boost: true };
const VOICE_SETTINGS_NEGATIVE = { stability: 0.50, similarity_boost: 0.80, style: 0.40, use_speaker_boost: true };

const DRAMATIC_KEYS = new Set(["score_180", "score_171", "score_167", "game_on"]);
const NEGATIVE_KEYS = new Set(["bust", "no_score", "score_0"]);

// Special announcement texts for certain keys (strip el_ prefix before lookup)
const SPECIAL_TEXTS = {
  score_180: "One Hundred and Eighty!",
  score_171: "One Hundred and Seventy One!",
  score_167: "One Hundred and Sixty Seven!",
  score_160: "One Hundred and Sixty!",
  score_140: "One Hundred and Forty!",
  score_100: "One Hundred!",
  score_50:  "Bull's Eye!",
  score_26:  "Bed and Breakfast!",
  score_45:  "Forty Five!",
  score_0:   "No Score!",
  no_score:  "No Score!",
  game_on:   "Game On!",
  bust:      "Bust!",
};

function voiceSettingsForKey(baseKey) {
  if (DRAMATIC_KEYS.has(baseKey)) return VOICE_SETTINGS_DRAMATIC;
  if (NEGATIVE_KEYS.has(baseKey)) return VOICE_SETTINGS_NEGATIVE;
  return VOICE_SETTINGS_NEUTRAL;
}

exports.dartTTS = onRequest(
  {
    secrets: [ELEVENLABS_API_KEY],
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { key, text: fallbackText } = req.body;
    if (!key || !fallbackText) {
      res.status(400).json({ error: "key and text required" });
      return;
    }

    const bucket = getStorage().bucket("fitness-tracker-c6f97.firebasestorage.app");
    const filePath = `dart_voice_el/${key}.mp3`;
    const file = bucket.file(filePath);

    // Return cached URL if the file already exists
    const [exists] = await file.exists();
    if (exists) {
      const [meta] = await file.getMetadata();
      const token = meta.metadata?.firebaseStorageDownloadTokens;
      if (token) {
        res.json({ url: buildDownloadURL(bucket.name, filePath, token) });
        return;
      }
    }

    // Strip el_ prefix to look up special text / voice category
    const baseKey = key.startsWith("el_") ? key.slice(3) : key;
    const text = SPECIAL_TEXTS[baseKey] ?? fallbackText;
    const voiceSettings = voiceSettingsForKey(baseKey);

    const elResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY.value(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
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
