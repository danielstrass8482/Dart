#!/usr/bin/env node
/**
 * transcode-voice-assets.js — Converts the already-generated voice clips in
 * assets/voice/<voice>/*.mp3 IN PLACE to the delivery format in
 * data/voice-format.json (no new ElevenLabs generation, zero characters).
 * Idempotent: files already in the target format are skipped.
 *
 * Also (re)writes assets/voice/<voice>/index.json — the clip key list the
 * web app uses to warm the default voice into its offline cache in the
 * background (see js/voiceClips.js warmDefaultVoice()).
 *
 * Usage:
 *   FFMPEG=/path/to/ffmpeg node scripts/transcode-voice-assets.js [--voice=<id>] [--concurrency=8]
 * Afterwards: node scripts/upload-voice-assets.js --force --bulk  (Storage packages)
 *             npm run build                                       (www/ + Android bundle)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { FORMAT, findFfmpeg, transcode, isTargetFormat, writeVoiceIndex } = require("./voice-format");

const ROOT = path.join(__dirname, "..");
const VOICE_ROOT = path.join(ROOT, "assets", "voice");
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const CONCURRENCY = parseInt(args.concurrency) || Math.max(2, os.cpus().length);

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function main() {
  const ffmpeg = findFfmpeg();
  const manifestPath = path.join(VOICE_ROOT, "manifest.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { voices: {} };
  const voices = fs.readdirSync(VOICE_ROOT).filter(d => fs.statSync(path.join(VOICE_ROOT, d)).isDirectory() && (!args.voice || d === args.voice));

  for (const voiceId of voices) {
    const dir = path.join(VOICE_ROOT, voiceId);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3"));
    let before = 0, after = 0, converted = 0, skipped = 0, failed = 0;
    const vman = manifest.voices[voiceId] = manifest.voices[voiceId] || { files: {} };
    await pool(files, CONCURRENCY, async (f) => {
      const p = path.join(dir, f), key = f.slice(0, -4);
      const buf = fs.readFileSync(p);
      before += buf.length;
      if (isTargetFormat(buf)) { skipped++; after += buf.length; return; }
      try {
        const out = await transcode(buf, ffmpeg);
        if (!isTargetFormat(out)) throw new Error("output not in target format");
        fs.writeFileSync(p + ".tmp", out); fs.renameSync(p + ".tmp", p);
        after += out.length; converted++;
        const fm = vman.files[key] = vman.files[key] || {};
        if (fm.bytes && !fm.sourceBytes) fm.sourceBytes = fm.bytes;
        fm.bytes = out.length;
      } catch (e) { failed++; after += buf.length; console.error(`  FAILED ${voiceId}/${f}: ${e.message}`); }
    });
    vman.format = FORMAT.id;
    const n = writeVoiceIndex(dir).keys.length;
    console.log(`${voiceId}: ${files.length} files, converted=${converted} skipped=${skipped} failed=${failed}, ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB, index.json keys=${n}`);
    if (failed) process.exitCode = 1;
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
