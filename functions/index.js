const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const textToSpeech = require("@google-cloud/text-to-speech");
const { randomUUID } = require("crypto");

initializeApp();

const ttsClient = new textToSpeech.TextToSpeechClient();

exports.dartTTS = onRequest(
  {
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { key, text } = req.body;
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
        res.json({ url: buildDownloadURL(bucket.name, filePath, token) });
        return;
      }
    }

    // Generate via Google Cloud TTS (ADC — no API key needed)
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "en-GB", name: "en-GB-Neural2-B" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.05 },
    });

    const audioBuffer = Buffer.from(response.audioContent, "binary");
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
