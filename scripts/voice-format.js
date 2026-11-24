/**
 * voice-format.js — Shared helper for the voice-clip delivery format
 * (data/voice-format.json): locate ffmpeg, transcode a buffer, and detect
 * whether an MP3 buffer is already in the target format (idempotency).
 *
 * ffmpeg lookup order: $FFMPEG, the optional `ffmpeg-static` npm package
 * (resolvable from scripts/ or the repo root), then `ffmpeg` on $PATH.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execFileSync } = require("child_process");

const FORMAT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "voice-format.json"), "utf8"));

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const p = require("ffmpeg-static"); if (p && fs.existsSync(p)) return p; } catch (e) {}
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return "ffmpeg"; } catch (e) {}
  throw new Error("ffmpeg not found — set FFMPEG=/path/to/ffmpeg or `npm i ffmpeg-static` in scripts/");
}

/**
 * Output goes to a temp FILE, not a pipe: ffmpeg can only fill in the
 * Xing/LAME header (exact VBR duration + encoder-delay/padding for gapless
 * trimming) by seeking back after encoding, which a pipe doesn't allow.
 * @param {Buffer} input any audio ElevenLabs returns @returns {Promise<Buffer>} clip in FORMAT
 */
function transcode(input, ffmpeg = findFfmpeg()) {
  const tmp = path.join(os.tmpdir(), `vf-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ["-v", "error", "-y", "-i", "pipe:0", ...FORMAT.ffmpegArgs, "-f", "mp3", tmp]);
    const err = [];
    p.stderr.on("data", d => err.push(d));
    p.on("error", reject);
    p.on("close", code => {
      let buf = null;
      try { buf = fs.readFileSync(tmp); fs.unlinkSync(tmp); } catch (e) {}
      if (code === 0 && buf && buf.length > 0) resolve(buf);
      else reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
    });
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

/** Reads the first MPEG audio frame header → { sampleRate, channels } or null. */
function mp3Info(buf) {
  let i = 0;
  if (buf.slice(0, 3).toString("latin1") === "ID3") {
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  }
  const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  for (; i < buf.length - 4; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const ver = (buf[i + 1] >> 3) & 3, layer = (buf[i + 1] >> 1) & 3, sr = (buf[i + 2] >> 2) & 3;
    if (ver === 1 || layer !== 1 || sr === 3) continue; // need valid Layer III
    return { sampleRate: RATES[ver][sr], channels: ((buf[i + 3] >> 6) & 3) === 3 ? 1 : 2 };
  }
  return null;
}

function isTargetFormat(buf) {
  const info = mp3Info(buf);
  return !!info && info.sampleRate === FORMAT.sampleRate && info.channels === FORMAT.channels;
}

/**
 * (Re)writes assets/voice/<voice>/index.json: the clip key list, a content
 * hash per clip (`hashes`, first 10 hex chars of SHA-1 over the file bytes)
 * and a content revision over all of them (`rev`, kept for older app
 * versions). The app treats (voice, key, hash) as a clip's identity: bundled
 * clips are requested as <key>.mp3?h=<hash>, locally stored copies carry the
 * hash they were downloaded with — so a regenerated clip (same file name,
 * new bytes) can never be answered from a stale cache. See js/voiceClips.js.
 */
function clipHash(buf) {
  return require("crypto").createHash("sha1").update(buf).digest("hex").slice(0, 10);
}
function writeVoiceIndex(voiceDir) {
  const crypto = require("crypto");
  const keys = fs.readdirSync(voiceDir).filter(f => f.endsWith(".mp3")).map(f => f.slice(0, -4)).sort();
  const h = crypto.createHash("sha1");
  const hashes = {};
  for (const k of keys) {
    const buf = fs.readFileSync(path.join(voiceDir, k + ".mp3"));
    h.update(k).update(crypto.createHash("sha1").update(buf).digest());
    hashes[k] = clipHash(buf);
  }
  const index = { format: FORMAT.id, rev: h.digest("hex").slice(0, 16), keys, hashes };
  fs.writeFileSync(path.join(voiceDir, "index.json"), JSON.stringify(index) + "\n");
  return index;
}

module.exports = { FORMAT, findFfmpeg, transcode, mp3Info, isTargetFormat, writeVoiceIndex, clipHash };
