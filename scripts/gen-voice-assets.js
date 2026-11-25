#!/usr/bin/env node
/**
 * gen-voice-assets.js — ONE-TIME generation of every pre-produced voice clip
 * (fixed vocabulary, data/vocabulary.json) directly against the ElevenLabs API.
 *
 * This does NOT go through the app, the dartTTS Cloud Function, or the
 * app's per-user daily TTS quota (dart_usage/TTS_DAILY_LIMIT=200) — it's a
 * standalone script run once (and re-run per-key for QA fixes) by whoever
 * holds the ElevenLabs key, producing the files that ship inside the app.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/gen-voice-assets.js [options]
 *     --dry-run            only print the character budget, generate nothing
 *     --voice=<id>          only this voice (id from data/voices.json), default: all
 *     --only=<key1,key2>    only these vocabulary keys (QA single-clip regen)
 *     --force               regenerate even if the local file already exists
 *     --from-qa[=error,doubtful]  only keys the last QA run (qa/voice-qa.json,
 *                          scripts/check-voice-clips.js) marked with these statuses
 *                          (default: error) — implies --force
 *     --upgrade-profile    regenerate every clip whose manifest entry was NOT made with the
 *                          current data/tts-settings.json profile (full re-generation of a
 *                          voice that is resumable: already-upgraded clips are skipped)
 *     --attempt=<n>        regeneration attempt number → different ElevenLabs seed
 *                          (attempt 0 = first generation); scripts/repair-voice-clips.js
 *                          passes this so a retry never reproduces the same bad take
 *
 * Model + voice settings: data/tts-settings.json (stable short-text profile,
 * see docs/voice-qa/README.md). Every generated clip records model, profile,
 * seed and attempt in assets/voice/manifest.json.
 *
 * After any (re)generation run: node scripts/check-voice-clips.js --voice=<id>
 *
 * Numbers are always sent to ElevenLabs as written-out words (via
 * numToWords() in data/vocabulary.json),
 * never digits, for stable pronunciation.
 *
 * Output: assets/voice/<voiceId>/<key>.mp3, plus
 * assets/voice/manifest.json recording what was generated, when, and how
 * many characters each voice actually consumed (for cost auditing).
 *
 * Every clip is transcoded right after generation from ElevenLabs'
 * mp3_44100_128 to the delivery format in data/voice-format.json (mono
 * 24 kHz VBR MP3, ~1/3 the size) — needs ffmpeg, see scripts/voice-format.js.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const { FORMAT, findFfmpeg, transcode, writeVoiceIndex } = require("./voice-format");

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const DRY_RUN = !!args["dry-run"];
const ONLY_VOICE = args.voice || null;
const ONLY_KEYS = args.only ? String(args.only).split(",").map(s => s.trim()) : null;
const FORCE = !!args.force;
const FROM_QA = args["from-qa"] ? (args["from-qa"] === true ? ["error"] : String(args["from-qa"]).split(",")) : null;
const ATTEMPT = parseInt(args.attempt || "0", 10) || 0;
const UPGRADE = !!args["upgrade-profile"];

const voicesCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "voices.json"), "utf8"));
const ttsCfg = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tts-settings.json"), "utf8"));
const vocabulary = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vocabulary.json"), "utf8"));

let voicesToRun = voicesCfg.voices;
if (ONLY_VOICE) {
  voicesToRun = voicesCfg.voices.filter(v => v.id === ONLY_VOICE || v.elevenLabsId === ONLY_VOICE);
  if (!voicesToRun.length) { console.error("Unknown --voice:", ONLY_VOICE); process.exit(1); }
}

function buildJobs() {
  let jobs = vocabulary.map(v => ({ key: v.key, text: v.text, file: `${v.key}.mp3` }));
  if (ONLY_KEYS) jobs = jobs.filter(j => ONLY_KEYS.includes(j.key));
  return jobs;
}
const jobs = buildJobs();

/** Keys a voice needs regenerated according to the last QA run. */
function qaKeysFor(voiceId) {
  if (!FROM_QA) return null;
  const qa = JSON.parse(fs.readFileSync(path.join(ROOT, "qa", "voice-qa.json"), "utf8"));
  const clips = (qa.voices[voiceId] && qa.voices[voiceId].clips) || {};
  return new Set(Object.entries(clips).filter(([, c]) => FROM_QA.includes(c.status)).map(([k]) => k));
}

/** Deterministic per key + attempt (reproducible, but every retry is a new take). */
function seedFor(key, attempt) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h + attempt * 7919) % 4294967295;
}

// ── Character budget (printed before any network call, per task spec) ──
const totalCharsPerVoice = jobs.reduce((s, j) => s + j.text.length, 0);
console.log(`Jobs per voice: ${jobs.length}, characters per voice: ${totalCharsPerVoice}`);
console.log(`Voices in this run: ${voicesToRun.map(v => v.name).join(", ")} (${voicesToRun.length})`);
console.log(`Total characters across all voices in this run: ${totalCharsPerVoice * voicesToRun.length}`);

if (DRY_RUN) { console.log("--dry-run: stopping before any ElevenLabs call."); process.exit(0); }

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("ELEVENLABS_API_KEY env var not set."); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Shells out to `curl` rather than using Node's built-in fetch: fetch
// (undici) was observed to develop severe, steadily-worsening per-request
// latency in this environment after a couple dozen sequential calls (10s,
// then 16s, 29s, 60s, 120s...) while plain `curl` to the exact same
// endpoint stayed consistently under 0.4s throughout, including while that
// slow Node process was still running. Cause not fully diagnosed (looked
// like undici connection-pool/keep-alive misbehavior rather than an actual
// ElevenLabs-side slowdown), but curl is simply reliable here, so use it.
const { execFile } = require("child_process");
function generateOne(voice, job, seed) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      text: job.text,
      model_id: ttsCfg.modelId,
      voice_settings: ttsCfg.voiceSettings,
      seed,
      apply_text_normalization: "auto",
      ...(ttsCfg.languageCode ? { language_code: ttsCfg.languageCode } : {}),
    });
    execFile("curl", [
      "-sS", "--max-time", "30",
      "-o", "-", "-w", "\n__HTTP_STATUS__:%{http_code}",
      "-X", "POST", `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenLabsId}`,
      "-H", `xi-api-key: ${API_KEY}`,
      "-H", "Content-Type: application/json",
      "-H", "Accept: audio/mpeg",
      "-d", body,
    ], { maxBuffer: 50 * 1024 * 1024, encoding: "buffer" }, (err, stdout) => {
      if (err) { resolve({ ok: false, status: 0, body: err.message }); return; }
      const marker = Buffer.from("\n__HTTP_STATUS__:");
      const idx = stdout.lastIndexOf(marker);
      if (idx === -1) { resolve({ ok: false, status: 0, body: "no status marker in curl output" }); return; }
      const status = parseInt(stdout.slice(idx + marker.length).toString("utf8").trim());
      const payload = stdout.slice(0, idx);
      if (status >= 200 && status < 300) resolve({ ok: true, buf: payload });
      else resolve({ ok: false, status, body: payload.toString("utf8").slice(0, 500) });
    });
  });
}

async function main() {
  const ffmpeg = DRY_RUN ? null : findFfmpeg(); // fail fast, before spending any characters
  const manifestPath = path.join(ROOT, "assets", "voice", "manifest.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { voices: {} };

  for (const voice of voicesToRun) {
    const dir = path.join(ROOT, "assets", "voice", voice.id);
    fs.mkdirSync(dir, { recursive: true });
    manifest.voices[voice.id] = manifest.voices[voice.id] || { name: voice.name, generatedAt: null, charsSent: 0, files: {} };
    const vman = manifest.voices[voice.id];

    let done = 0, skipped = 0, failed = 0, charsSent = 0;
    const t0 = Date.now();
    console.log(`\n=== Voice: ${voice.name} (${voice.id}) ===`);

    const qaKeys = qaKeysFor(voice.id);
    let voiceJobs = qaKeys ? jobs.filter(j => qaKeys.has(j.key)) : jobs;
    if (UPGRADE) {
      voiceJobs = voiceJobs.filter(j => (vman.files[j.key] || {}).profile !== ttsCfg.profile);
      console.log(`  --upgrade-profile: ${voiceJobs.length} clips not yet on profile ${ttsCfg.profile}, ${voiceJobs.reduce((s, j) => s + j.text.length, 0)} characters`);
    }
    if (qaKeys) console.log(`  --from-qa=${FROM_QA.join(",")}: ${voiceJobs.length} keys, ${voiceJobs.reduce((s, j) => s + j.text.length, 0)} characters`);
    for (const job of voiceJobs) {
      const outPath = path.join(dir, job.file);
      // Idempotent resume: skip anything already generated (and non-empty —
      // a 0-byte file means a previous run was killed mid-write, so that one
      // key gets regenerated instead of silently shipping silence).
      if (!FORCE && !qaKeys && !UPGRADE && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) { skipped++; continue; }

      const seed = seedFor(job.key, ATTEMPT);
      const result = await generateOne(voice, job, seed);
      if (!result.ok) {
        failed++;
        console.error(`  FAILED [${job.key}] status=${result.status}: ${result.body.slice(0, 300)}`);
        if (result.status === 401 || result.status === 429 || result.status === 402) {
          console.error(`  Stopping this voice — looks like a quota/auth limit, not a per-clip issue.`);
          break;
        }
        continue;
      }
      let clip;
      try { clip = await transcode(result.buf, ffmpeg); }
      catch (e) { failed++; console.error(`  FAILED [${job.key}] transcode: ${e.message}`); continue; }
      fs.writeFileSync(outPath, clip);
      vman.files[job.key] = { bytes: clip.length, sourceBytes: result.buf.length, chars: job.text.length, generatedAt: new Date().toISOString(),
        model: ttsCfg.modelId, profile: ttsCfg.profile, seed, attempt: ATTEMPT };
      vman.format = FORMAT.id;
      charsSent += job.text.length;
      done++;
      vman.generatedAt = new Date().toISOString();
      vman.charsSent = (vman.charsSent || 0) + job.text.length;
      // Write the manifest after EVERY file (not just at voice-end) so a kill
      // at any point (quota, session limit, crash) leaves a complete, usable
      // audit trail and nothing is lost — resuming just re-runs this script.
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  [${done + skipped + failed}/${voiceJobs.length}] done=${done} skipped=${skipped} failed=${failed} elapsed=${elapsed}s key=${job.key}`);
      await sleep(120); // stay well under ElevenLabs' concurrent-request cap
    }

    if (done) writeVoiceIndex(dir);
    console.log(`  Voice ${voice.name}: ${done} generated, ${skipped} skipped (already existed), ${failed} failed. Characters sent this run: ${charsSent}.`);
  }
}

main();
