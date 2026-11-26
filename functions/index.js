// Cloud Functions entry point (project darttrainer-app-fed88, europe-west1).
// Deploy: firebase deploy --only functions:<name>
//
// Live TTS retired 2026-11-26: the former dartTTS function (ElevenLabs proxy
// with Storage cache dart_voice_el/ and a 200/day per-user TTS limit) was
// deleted; the app plays only pre-produced clips (assets/voice/,
// dart_voice_pkg/). Last source: functions/index.js at commit 83af0ea.
// Secret ELEVENLABS_API_KEY still exists with all versions DISABLED (not
// destroyed) — see the header of scripts/gen-voice-assets.js to reactivate.
Object.assign(exports, require("./dartCoach"));
Object.assign(exports, require("./budgetCheck"));
Object.assign(exports, require("./feedback"));
Object.assign(exports, require("./appCheckPing"));
