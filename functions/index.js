const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { randomUUID } = require("crypto");

initializeApp();

const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");

// British male voice – suits dart announcing
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George

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

    const { key, text, voice_id = DEFAULT_VOICE_ID } = req.body;
    if (!key || !text) {
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
        const url = buildDownloadURL(bucket.name, filePath, token);
        res.json({ url });
        return;
      }
    }

    // Generate via ElevenLabs
    const elResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY.value(),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75, speed: 1.05 },
        }),
      }
    );

    if (!elResp.ok) {
      console.error("ElevenLabs error:", elResp.status, await elResp.text());
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
