#!/usr/bin/env node
/**
 * upload-voice-assets.js — Uploads generated voice clips (assets/voice/<voice>/*.mp3)
 * to Firebase Storage under dart_voice_pkg/<voice>/<key>.mp3, with a random
 * firebaseStorageDownloadTokens metadata value per file so the client's
 * normal getDownloadURL() (see js/firebase.js getVoicePkgURL()) works exactly
 * like the existing dart_voice/photo sharing pattern already used elsewhere
 * in this app.
 *
 * This uploads EVERY voice's clips, including the default voice — the
 * default voice's clips are ALSO bundled directly in the app/APK (so they
 * work with zero network calls), but having them in Storage too is a cheap
 * fallback for any deployment target that didn't get the latest bundle yet.
 *
 * Requires: `gcloud auth login` done once (uses gcloud storage, not
 * firebase-admin, so no service-account key needs to touch this repo).
 *
 * Usage:
 *   node scripts/upload-voice-assets.js [--voice=<id>] [--force] [--concurrency=5]
 *     --voice=<id>        only this voice (default: all found under assets/voice/)
 *     --force             re-upload even if the object already exists in Storage
 *     --concurrency=<n>   parallel uploads (default 5)
 *     --only=<k1,k2>      only these clip keys (e.g. the few clips a repair run
 *                         regenerated: `git diff --name-only -- assets/voice/<v>/`); always
 *                         overwrites, each with a NEW download token (new URL → no stale HTTP cache)
 *     --bulk              one parallel `gcloud storage cp` per voice (much faster for
 *                         full re-uploads, e.g. after scripts/transcode-voice-assets.js);
 *                         always overwrites, and all clips of a voice share one download
 *                         token (reads are auth-gated by storage.rules regardless).
 *     --index-only        only (re)upload dart_voice_pkg/<voice>/index.json
 *
 * After the clips of a voice, its assets/voice/<voice>/index.json (clip keys +
 * per-clip content hashes) is uploaded LAST as dart_voice_pkg/<voice>/index.json
 * (Cache-Control: no-cache). The app compares its local copies against these
 * hashes (js/voiceClips.js) — uploading the index last means it never points
 * at bytes that aren't in Storage yet.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const BUCKET = "darttrainer-app-fed88.firebasestorage.app";

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const ONLY_VOICE = args.voice || null;
const FORCE = !!args.force;
const CONCURRENCY = parseInt(args.concurrency) || 5;
const BULK = !!args.bulk;
const INDEX_ONLY = !!args["index-only"];
const ONLY = args.only ? new Set(String(args.only).split(",").map(s => s.trim()).filter(Boolean)) : null;

function sh(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    execFile(cmd, cmdArgs, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function remoteExists(voiceId, key) {
  try {
    await sh("gcloud", ["storage", "objects", "describe", `gs://${BUCKET}/dart_voice_pkg/${voiceId}/${key}.mp3`, "--format=value(name)"]);
    return true;
  } catch (e) { return false; }
}

async function uploadOne(voiceId, key, localPath) {
  const token = crypto.randomUUID();
  await sh("gcloud", [
    "storage", "cp", localPath, `gs://${BUCKET}/dart_voice_pkg/${voiceId}/${key}.mp3`,
    "--custom-metadata", `firebaseStorageDownloadTokens=${token}`,
    "--content-type", "audio/mpeg",
  ]);
  return token;
}

async function uploadIndex(voiceId, dir) {
  const p = path.join(dir, "index.json");
  if (!fs.existsSync(p)) { console.warn(`  ${voiceId}: no index.json — run scripts/voice-format.js writeVoiceIndex first`); return; }
  await sh("gcloud", [
    "storage", "cp", p, `gs://${BUCKET}/dart_voice_pkg/${voiceId}/index.json`,
    "--custom-metadata", `firebaseStorageDownloadTokens=${crypto.randomUUID()}`,
    "--content-type", "application/json",
    "--cache-control", "no-cache",
  ]);
  console.log(`  ${voiceId}: index.json uploaded`);
}

async function runPool(items, worker, concurrency) {
  let i = 0, active = 0;
  return new Promise((resolve) => {
    let results = [];
    function next() {
      if (i >= items.length && active === 0) { resolve(results); return; }
      while (active < concurrency && i < items.length) {
        const item = items[i++];
        active++;
        worker(item).then(r => { results.push(r); active--; next(); }).catch(e => { results.push({ error: e.message, item }); active--; next(); });
      }
    }
    next();
  });
}

async function main() {
  const voiceDirs = fs.readdirSync(path.join(ROOT, "assets", "voice")).filter(d => {
    const full = path.join(ROOT, "assets", "voice", d);
    return fs.statSync(full).isDirectory() && (!ONLY_VOICE || d === ONLY_VOICE);
  });

  for (const voiceId of voiceDirs) {
    const dir = path.join(ROOT, "assets", "voice", voiceId);
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".mp3") && (!ONLY || ONLY.has(f.slice(0, -4))));
    console.log(`\n=== ${voiceId}: ${files.length} local files ===`);
    if (INDEX_ONLY) { await uploadIndex(voiceId, dir); continue; }

    if (BULK) {
      const token = crypto.randomUUID();
      const t0 = Date.now();
      await sh("gcloud", [
        "storage", "cp", ...files.map(f => path.join(dir, f)), `gs://${BUCKET}/dart_voice_pkg/${voiceId}/`,
        "--custom-metadata", `firebaseStorageDownloadTokens=${token}`,
        "--content-type", "audio/mpeg",
      ]);
      console.log(`  ${voiceId}: bulk-uploaded ${files.length} files in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      await uploadIndex(voiceId, dir);
      continue;
    }
    const jobs = files.map(f => ({ voiceId, key: f.replace(/\.mp3$/, ""), localPath: path.join(dir, f) }));
    let uploaded = 0, skipped = 0, failed = 0;

    await runPool(jobs, async (job) => {
      if (!FORCE && !ONLY) {
        const exists = await remoteExists(job.voiceId, job.key);
        if (exists) { skipped++; return; }
      }
      try {
        await uploadOne(job.voiceId, job.key, job.localPath);
        uploaded++;
        if ((uploaded + skipped) % 20 === 0) console.log(`  ... uploaded=${uploaded} skipped=${skipped} failed=${failed} / ${jobs.length}`);
      } catch (e) {
        failed++;
        console.error(`  FAILED upload ${job.key}: ${e.message.slice(0, 200)}`);
      }
    }, CONCURRENCY);

    console.log(`  ${voiceId}: uploaded=${uploaded} skipped(existing)=${skipped} failed=${failed}`);
    if (failed) console.warn(`  ${voiceId}: index.json NOT uploaded because uploads failed — rerun`);
    else await uploadIndex(voiceId, dir);
  }
}

main();
