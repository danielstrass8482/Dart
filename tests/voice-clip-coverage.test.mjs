/**
 * voice-clip-coverage.test.mjs — every text the announcement logic can say
 * exists as a clip in ALL four voices, with the right words and the published
 * content hash:
 *
 *   - announceable keys = every checkout path the turn start can announce
 *     (el_co_<rest> for each rest 2–170 with a path, js/checkout.js) +
 *     "Player 1…8" + "requires" + el_num_2…170 + every other vocabulary key
 *   - data/vocabulary.json text of el_co_<rest> == "Checkout: " + the path of
 *     getCheckoutPath(rest, 3) spoken (same conversion as js/audio.js)
 *   - assets/voice/<v>/<key>.mp3 exists, its hash == assets/voice/<v>/index.json
 *   - voice QA (qa/voice-qa.json, scripts/check-voice-clips.js) has a result
 *     for exactly these bytes and it is not "error"
 *   - REMOTE=1: Firebase Storage dart_voice_pkg/<v>/ holds the same bytes
 *     (MD5) for every key, and its index.json equals the local one
 *
 * Usage: node tests/voice-clip-coverage.test.mjs     ·    REMOTE=1 node tests/voice-clip-coverage.test.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { clipHash } = require(path.join(ROOT, "scripts", "voice-format.js"));
const { getCheckoutPath, CHECKOUT_TABLE } = await import(pathToFileURL(path.join(ROOT, "js", "checkout.js")));
const BUCKET = "gs://darttrainer-app-fed88.firebasestorage.app";
const VOICES = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "voices.json"), "utf8")).voices.map((v) => v.id);
const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vocabulary.json"), "utf8"));
const text = Object.fromEntries(vocab.map((v) => [v.key, v.text]));
const qa = JSON.parse(fs.readFileSync(path.join(ROOT, "qa", "voice-qa.json"), "utf8"));

let pass = 0; const fails = [];
const check = (c, m) => { if (c) pass++; else fails.push(m); };

// Spoken form — mirrors partToReadable()/numToWords() in js/audio.js.
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const words = (n) => n === 25 ? "Twenty Five" : n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
const spoken = (p) => p === "Bull" || p === "D25" ? "Bullseye" : (p[0] === "T" ? "Triple " : p[0] === "D" ? "Double " : "") + words(parseInt(p.replace(/^[SDT]/, ""), 10));

const announceable = new Set(vocab.map((v) => v.key));
for (let r = 2; r <= 170; r++) {
  const p = getCheckoutPath(r, 3);
  if (p) {
    announceable.add(`el_co_${r}`);
    check(text[`el_co_${r}`] === `Checkout: ${p.split(" ").map(spoken).join(", ")}.`, `el_co_${r}: vocabulary text "${text[`el_co_${r}`]}" ≠ path ${p}`);
  } else check(!text[`el_co_${r}`], `el_co_${r}: clip text exists but rest ${r} has no checkout`);
  announceable.add(`el_num_${r}`);
}
for (let n = 1; n <= 8; n++) announceable.add(`el_player_${n}`);
announceable.add("el_requires");
check(Object.keys(CHECKOUT_TABLE).length === 162, "162 announceable checkout paths");

for (const v of VOICES) {
  const dir = path.join(ROOT, "assets", "voice", v);
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  const clips = qa.voices?.[v]?.clips || {};
  for (const k of announceable) {
    check(!!text[k], `${k}: not in data/vocabulary.json`);
    const f = path.join(dir, `${k}.mp3`);
    if (!fs.existsSync(f)) { check(false, `${v}/${k}.mp3 missing`); continue; }
    const buf = fs.readFileSync(f);
    check(idx.hashes?.[k] === clipHash(buf), `${v}/${k}: index hash ${idx.hashes?.[k]} ≠ file ${clipHash(buf)}`);
    const sha1 = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
    const q = clips[k];
    check(q && q.sha1 === sha1 && q.status !== "error" && q.text === text[k], `${v}/${k}: voice QA ${q ? `${q.status}, sha1 ${q.sha1 === sha1 ? "current" : "STALE"}` : "missing"}`);
  }
  if (process.env.REMOTE) {
    const out = execFileSync("gcloud", ["storage", "objects", "list", `${BUCKET}/dart_voice_pkg/${v}/*.mp3`, "--format=value(name,md5_hash)"], { encoding: "utf8", timeout: 300000 });
    const remote = Object.fromEntries(out.trim().split("\n").map((l) => { const [n, m] = l.split("\t"); return [path.basename(n, ".mp3"), m]; }));
    for (const k of announceable) {
      const f = path.join(dir, `${k}.mp3`);
      if (!fs.existsSync(f)) continue;
      check(remote[k] === crypto.createHash("md5").update(fs.readFileSync(f)).digest("base64"), `${v}/${k}: dart_voice_pkg differs from local (${remote[k] || "missing"})`);
    }
    const rIdx = execFileSync("gcloud", ["storage", "cat", `${BUCKET}/dart_voice_pkg/${v}/index.json`], { timeout: 120000 });
    check(Buffer.compare(rIdx, fs.readFileSync(path.join(dir, "index.json"))) === 0, `${v}: dart_voice_pkg index.json differs from local`);
  }
}

console.log(`${announceable.size} announceable keys × ${VOICES.length} voices${process.env.REMOTE ? " (local + dart_voice_pkg)" : " (local)"}: ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.error(" - " + fails.slice(0, 40).join("\n - ")); process.exit(1); }
