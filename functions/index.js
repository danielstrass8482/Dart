const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const textToSpeech = require("@google-cloud/text-to-speech");
const { randomUUID } = require("crypto");

initializeApp();

const ttsClient = new textToSpeech.TextToSpeechClient();

// SSML overrides for special announcements (keyed without el_ prefix)
const SSML_MAP = {
  score_180: '<speak><prosody rate="0.75" pitch="+3st" volume="x-loud"><emphasis level="strong">One Hundred</emphasis> and <emphasis level="strong">Eighty!</emphasis></prosody></speak>',
  score_140: '<speak><prosody rate="0.8" pitch="+2st" volume="loud"><emphasis level="strong">One Hundred</emphasis> and <emphasis level="strong">Forty!</emphasis></prosody></speak>',
  score_100: '<speak><prosody rate="0.8" pitch="+2st" volume="loud"><emphasis level="strong">One Hundred!</emphasis></prosody></speak>',
  score_50:  '<speak><prosody rate="0.85" pitch="+2st" volume="loud"><emphasis level="strong">Bull\'s Eye!</emphasis></prosody></speak>',
  score_0:   '<speak><prosody rate="0.9" pitch="-1st">No Score!</prosody></speak>',
  no_score:  '<speak><prosody rate="0.9" pitch="-1st">No Score!</prosody></speak>',
  game_on:   '<speak><prosody rate="0.85" pitch="+2st" volume="loud"><emphasis level="strong">Game</emphasis> <emphasis level="strong">On!</emphasis></prosody></speak>',
  bust:      '<speak><prosody rate="0.9" pitch="-2st" volume="loud"><emphasis level="strong">Bust!</emphasis></prosody></speak>',
};

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

    // Strip el_ prefix to look up SSML (frontend always sends el_<key>)
    const ssmlKey = key.startsWith("el_") ? key.slice(3) : key;
    const ssml = SSML_MAP[ssmlKey];

    const synthesisInput = ssml ? { ssml } : { text };
    const audioConfig = ssml
      ? { audioEncoding: "MP3", volumeGainDb: 2.0 }
      : { audioEncoding: "MP3", speakingRate: 0.90, pitch: -2.0, volumeGainDb: 2.0 };

    const [response] = await ttsClient.synthesizeSpeech({
      input: synthesisInput,
      voice: { languageCode: "en-GB", name: "en-GB-Neural2-B" },
      audioConfig,
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
