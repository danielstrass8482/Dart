#!/usr/bin/env node
/**
 * check-voice-clips.js — automatic content QA of pre-produced voice clips.
 *
 * Every clip (vocabulary + names, all voices from data/voices.json, or a
 * subset) is transcribed by a local Whisper model (scripts/voice-stt.py) and
 * compared tolerantly with its target text (scripts/voice-qa-compare.js).
 * Clips whose duration deviates strongly from comparable clips of the same
 * voice/category are flagged as well.
 *
 * Two-stage STT: every clip goes through --model (default small.en); only
 * clips that don't match get a second opinion from --second (default
 * medium.en). The better of the two verdicts counts — an STT slip of one
 * model must not condemn a clip, while a real hallucination (extra words/
 * numbers) is heard by both.
 *
 * Results are cached per clip by SHA-1 of the file in qa/voice-qa.json, so a
 * re-run only transcribes clips that changed (e.g. after a regeneration) —
 * costs nothing (local model) and takes seconds for a handful of clips.
 *
 * Usage:
 *   node scripts/check-voice-clips.js [--voice=haseeb] [--only=k1,k2] [--kind=vocab|name]
 *        [--dir=<clip dir with <voice>/<key>.mp3>, default assets/voice]
 *        [--report=<label>]        also write docs/voice-qa/report-<label>.md
 *        [--model=small.en] [--second=medium.en|none] [--workers=2]
 *        [--no-save]               don't update qa/voice-qa.json (e.g. checking
 *                                  a single central name clip from Storage)
 *   Env: VOICE_STT_PYTHON (default /var/tmp/whisper-venv/bin/python), HF_HOME.
 * Exit code: 0 = no "error" clip in the checked set, 1 = at least one error.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { compare, RANK } = require("./voice-qa-compare");

const ROOT = path.join(__dirname, "..");
const RESULTS_PATH = path.join(ROOT, "qa", "voice-qa.json");
const REPORT_DIR = path.join(ROOT, "docs", "voice-qa");
// Append-only transcript cache: one line per finished transcription, written
// immediately — a killed run (session limit, Cloud Shell restart) resumes at
// the next untranscribed clip. Keyed by clip SHA-1 + model, so a regenerated
// clip is never confused with its old take. Lives in the repo dir (/var/tmp
// is wiped on Cloud Shell restarts), gitignored — qa/voice-qa.json is the
// committed result.
const STT_CACHE_PATH = path.join(ROOT, "qa", ".stt-cache.jsonl");

function loadSttCache() {
  const m = new Map();
  let raw = "";
  try { raw = fs.readFileSync(STT_CACHE_PATH, "utf8"); } catch (e) { return m; }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); m.set(`${r.sha1}|${r.model}`, r); } catch (e) { /* torn last line after a kill */ }
  }
  return m;
}
function appendSttCache(entry) { fs.appendFileSync(STT_CACHE_PATH, JSON.stringify(entry) + "\n"); }

function parseArgs(argv) {
  return Object.fromEntries(argv.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
}

function loadJSON(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return fallback; } }

function entriesFor(kind) {
  const vocabulary = loadJSON(path.join(ROOT, "data", "vocabulary.json"), []);
  const names = loadJSON(path.join(ROOT, "data", "names.json"), []);
  let e = [];
  if (kind !== "name") e = e.concat(vocabulary.map(v => ({ key: v.key, text: v.text, kind: "vocab", category: v.category })));
  if (kind !== "vocab") e = e.concat(names.map(n => ({ key: `name_${n.norm}`, text: n.text, kind: "name", category: "name" })));
  return e;
}

function sttPython() {
  if (process.env.VOICE_STT_PYTHON) return process.env.VOICE_STT_PYTHON;
  return fs.existsSync("/var/tmp/whisper-venv/bin/python") ? "/var/tmp/whisper-venv/bin/python" : "python3";
}

/** Runs voice-stt.py over jobs [{id,path}] with N parallel workers → Map id → {text,duration,error}. */
async function transcribe(jobs, model, workers, onProgress, onResult) {
  const results = new Map();
  if (!jobs.length) return results;
  workers = Math.max(1, Math.min(workers, jobs.length));
  const threads = Math.max(1, Math.floor(4 / workers));
  const chunks = Array.from({ length: workers }, () => []);
  jobs.forEach((j, i) => chunks[i % workers].push(j));
  let done = 0;
  await Promise.all(chunks.map(chunk => new Promise((resolve, reject) => {
    const env = { ...process.env, HF_HOME: process.env.HF_HOME || "/var/tmp/hf" };
    const p = spawn(sttPython(), ["-I", path.join(__dirname, "voice-stt.py"), `--model=${model}`, `--threads=${threads}`], { env, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "", errBuf = "";
    p.stdout.on("data", d => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const r = JSON.parse(line); results.set(r.id, r); done++;
        if (onResult) onResult(r);
        if (onProgress) onProgress(done, jobs.length);
      }
    });
    p.stderr.on("data", d => { errBuf = (errBuf + d).slice(-4000); });
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`voice-stt.py exit ${code}: ${errBuf.slice(-800)}`)));
    p.stdin.end(chunk.map(j => JSON.stringify(j)).join("\n") + "\n");
  })));
  return results;
}

function median(a) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

/**
 * Duration outliers per (voice, category). Vocabulary: robust linear model
 * duration ≈ a + b·letters (least squares, then refit without the worst 10 %)
 * — a flat seconds-per-letter ratio wrongly flagged every one-word number,
 * because every clip has a fixed lead-in/out. Names: category median.
 * Flag only if BOTH the ratio (long > 1.6×, names 1.8×; short < 0.55×) and
 * the absolute gap (> 0.5 s) are exceeded — inserted words add ≥ 0.5 s.
 */
function letters(t) { return t.replace(/[^A-Za-z]/g, "").length; }
function fitLine(pts) {
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const b = sxx ? sxy / sxx : 0;
  return [my - b * mx, b];
}
function durationFlags(clips) {
  const byCat = {};
  for (const c of clips) if (c.duration) (byCat[c.category] = byCat[c.category] || []).push(c);
  for (const [cat, list] of Object.entries(byCat)) {
    let predict;
    if (cat === "name" || list.length < 10) {
      const med = median(list.map(c => c.duration));
      predict = () => med;
    } else {
      let pts = list.map(c => [letters(c.text), c.duration]);
      let [a, b] = fitLine(pts);
      pts = pts.map(p => [p, Math.abs(p[1] - (a + b * p[0]))]).sort((x, y) => x[1] - y[1]).slice(0, Math.ceil(pts.length * 0.9)).map(x => x[0]);
      [a, b] = fitLine(pts);
      predict = c => Math.max(0.3, a + b * letters(c.text));
    }
    const hi = cat === "name" ? 1.8 : 1.6;
    for (const c of list) {
      const exp = predict(c), r = c.duration / exp;
      c.expectedDuration = +exp.toFixed(2);
      if (r > hi && c.duration - exp > 0.5) c.durationFlag = `Dauer ${c.duration.toFixed(1)} s statt ~${exp.toFixed(1)} s (×${r.toFixed(1)})`;
      else if (r < 0.55 && exp - c.duration > 0.5) c.durationFlag = `Dauer nur ${c.duration.toFixed(1)} s statt ~${exp.toFixed(1)} s (×${r.toFixed(2)})`;
      else delete c.durationFlag;
    }
  }
}

/** Re-judges a results file from its stored transcripts (no STT) — after a comparator change. */
function reevaluateFile(p) {
  const res = loadJSON(p, null);
  for (const vr of Object.values(res.voices)) {
    const all = Object.values(vr.clips).filter(c => c.duration);
    durationFlags(all);
    for (const c of all) evaluate(c);
    vr.summary = summarize(Object.values(vr.clips));
  }
  return res;
}

function evaluate(c) {
  let best = null;
  for (const [model, text] of Object.entries(c.stt || {})) {
    const r = compare(c.text, text, c.kind);
    r.model = model;
    if (!best || RANK[r.verdict] < RANK[best.verdict]) best = r;
  }
  if (!best) best = { verdict: "error", reasons: ["nicht transkribiert"] };
  let status = best.verdict;
  const reasons = [...best.reasons];
  if (c.durationFlag) { reasons.push(c.durationFlag); if (status === "ok") status = "doubtful"; }
  c.status = status; c.reasons = reasons;
}

async function runCheck(opts = {}) {
  const voicesCfg = loadJSON(path.join(ROOT, "data", "voices.json"), { voices: [] });
  const dir = path.resolve(ROOT, opts.dir || path.join("assets", "voice"));
  const model = opts.model || "small.en";
  const second = opts.second === undefined ? "medium.en" : opts.second;
  const workers = +(opts.workers || 4);
  const onlyKeys = opts.only ? new Set(String(opts.only).split(",").map(s => s.trim())) : null;
  let voices = voicesCfg.voices;
  if (opts.voice) voices = voices.filter(v => String(opts.voice).split(",").includes(v.id));
  const results = loadJSON(RESULTS_PATH, { voices: {} });
  const baseEntries = entriesFor(opts.kind).filter(e => !onlyKeys || onlyKeys.has(e.key));
  const entriesOf = vid => (opts.entries ? opts.entries(vid) : baseEntries);

  const toCheck = []; // per-voice clip records (fresh objects, cached STT reused by sha1)
  for (const v of voices) {
    const prev = (results.voices[v.id] && results.voices[v.id].clips) || {};
    for (const e of entriesOf(v.id)) {
      const file = path.join(dir, v.id, `${e.key}.mp3`);
      const rec = { voice: v.id, key: e.key, text: e.text, kind: e.kind, category: e.category, file };
      if (!fs.existsSync(file)) { rec.missing = true; toCheck.push(rec); continue; }
      rec.sha1 = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
      const old = prev[e.key];
      if (old && old.sha1 === rec.sha1) { rec.stt = { ...old.stt }; rec.duration = old.duration; }
      rec.stt = rec.stt || {};
      rec.attempts = old ? old.attempts : undefined;
      rec.history = old ? old.history : undefined;
      toCheck.push(rec);
    }
  }
  const present = toCheck.filter(r => !r.missing);
  const sttCache = loadSttCache();
  const fromCache = m => { for (const r of present) if (r.stt[m] === undefined) { const c = sttCache.get(`${r.sha1}|${m}`); if (c) { r.stt[m] = c.text; if (c.duration) r.duration = c.duration; } } };
  const persist = m => o => {
    if (o.error) return; // errors are retried next run, not cached
    const r = present.find(x => `${x.voice}/${x.key}` === o.id);
    if (r) appendSttCache({ sha1: r.sha1, model: m, voice: r.voice, key: r.key, text: o.text, duration: o.duration });
  };
  fromCache(model);
  const progress = label => (d, n) => { if (d === n || d % 50 === 0) process.stderr.write(`  ${label}: ${d}/${n}\r${d === n ? "\n" : ""}`); };

  // Stage 1 — primary model on every clip without a cached transcript.
  const need1 = present.filter(r => r.stt[model] === undefined);
  console.error(`STT ${model}: ${need1.length} of ${present.length} clips need transcription (rest cached by SHA-1)`);
  const r1 = await transcribe(need1.map(r => ({ id: `${r.voice}/${r.key}`, path: r.file })), model, workers, progress(model), persist(model));
  for (const r of need1) { const o = r1.get(`${r.voice}/${r.key}`); if (o) { r.stt[model] = o.error ? "" : o.text; if (o.duration) r.duration = o.duration; } }

  // Stage 2 — second opinion for whatever stage 1 didn't accept.
  if (second && second !== "none") {
    fromCache(second);
    const need2 = present.filter(r => r.stt[second] === undefined && compare(r.text, r.stt[model] || "", r.kind).verdict !== "ok");
    console.error(`STT ${second} (second opinion): ${need2.length} clips`);
    const r2 = await transcribe(need2.map(r => ({ id: `${r.voice}/${r.key}`, path: r.file })), second, workers, progress(second), persist(second));
    for (const r of need2) { const o = r2.get(`${r.voice}/${r.key}`); if (o) r.stt[second] = o.error ? "" : o.text; }
  }

  // Duration outliers are judged against the WHOLE voice/category, so use
  // all clips of the voice from the results file, not just this subset.
  for (const v of voices) {
    const prev = (results.voices[v.id] && results.voices[v.id].clips) || {};
    const fresh = toCheck.filter(r => r.voice === v.id && !r.missing);
    const freshKeys = new Set(fresh.map(r => r.key));
    const pool = fresh.concat(Object.entries(prev).filter(([k, c]) => !freshKeys.has(k) && c.duration)
      .map(([k, c]) => ({ ...c, key: k, voice: v.id, _ref: true })));
    durationFlags(pool);
  }
  for (const r of toCheck) {
    if (r.missing) { r.status = "error"; r.reasons = ["Datei fehlt"]; continue; }
    evaluate(r);
  }

  let saved = results;
  if (!opts["no-save"]) {
    // Re-read right before writing and replace only the voices THIS run
    // checked: a concurrent run for another voice (e.g. a repair while a
    // baseline is still going) must not be overwritten by our stale copy.
    saved = loadJSON(RESULTS_PATH, { voices: {} });
    for (const v of voices) {
      const vr = saved.voices[v.id] = saved.voices[v.id] || { clips: {} };
      for (const r of toCheck.filter(x => x.voice === v.id)) {
        const { voice, file, missing, key, ...keep } = r;
        vr.clips[r.key] = missing ? { text: r.text, kind: r.kind, category: r.category, status: "error", reasons: r.reasons } : keep;
      }
      // refresh status of clips not in this subset (duration baseline may have moved)
      const all = Object.values(vr.clips).filter(c => c.duration);
      durationFlags(all);
      for (const c of all) evaluate(c);
      vr.summary = summarize(Object.values(vr.clips));
      vr.checkedAt = new Date().toISOString();
    }
    saved.method = { stt: "faster-whisper (local, int8 CPU)", primary: model, second, compare: "scripts/voice-qa-compare.js" };
    saved.updatedAt = new Date().toISOString();
    writeResults(saved);
  }
  return { results: saved, checked: toCheck };
}

function summarize(clips) {
  const s = { total: clips.length, ok: 0, doubtful: 0, error: 0 };
  for (const c of clips) s[c.status]++;
  return s;
}

/** One clip per line → readable git diffs despite ~3700 entries. */
function writeResults(results) {
  const ordered = { updatedAt: results.updatedAt, method: results.method, voices: {} };
  const lines = ["{", `  "updatedAt": ${JSON.stringify(results.updatedAt)},`, `  "method": ${JSON.stringify(results.method)},`, `  "voices": {`];
  const vids = Object.keys(results.voices);
  vids.forEach((vid, vi) => {
    const vr = results.voices[vid];
    lines.push(`    ${JSON.stringify(vid)}: {`, `      "checkedAt": ${JSON.stringify(vr.checkedAt)},`, `      "summary": ${JSON.stringify(vr.summary)},`, `      "clips": {`);
    const keys = Object.keys(vr.clips).sort();
    keys.forEach((k, ki) => lines.push(`        ${JSON.stringify(k)}: ${JSON.stringify(vr.clips[k])}${ki < keys.length - 1 ? "," : ""}`));
    lines.push("      }", `    }${vi < vids.length - 1 ? "," : ""}`);
  });
  lines.push("  }", "}");
  void ordered;
  fs.writeFileSync(RESULTS_PATH, lines.join("\n") + "\n");
}

function esc(s) { return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " "); }

function writeReport(label, results, voiceIds, extraNote) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const voicesCfg = loadJSON(path.join(ROOT, "data", "voices.json"), { voices: [] });
  const manifest = loadJSON(path.join(ROOT, "assets", "voice", "manifest.json"), { voices: {} });
  // Clips generated before the stable profile carry no model in the manifest.
  const modelsOf = vid => {
    const counts = {};
    const files = (manifest.voices[vid] && manifest.voices[vid].files) || {};
    for (const k of Object.keys(results.voices[vid]?.clips || {})) {
      const m = files[k]?.model || "eleven_turbo_v2_5*";
      counts[m] = (counts[m] || 0) + 1;
    }
    return Object.entries(counts).map(([m, n]) => `${m}: ${n}`).join(", ");
  };
  const L = [`# Voice-QA-Bericht: ${label}`, "", `Stand: ${results.updatedAt}  `,
    `Verfahren: ${results.method.stt}, Erstmodell \`${results.method.primary}\`, Zweitmeinung \`${results.method.second}\` bei Abweichung; Vergleich \`scripts/voice-qa-compare.js\`.  `,
    "Spalte „Modelle“: mit welchem ElevenLabs-Modell die geprüften Clips erzeugt wurden (assets/voice/manifest.json). `*` = altes Profil bis 2026-11-22 (turbo_v2_5, stability 0.50, similarity 0.90, style 0.35), im Manifest noch ohne Modellangabe.", ""];
  if (extraNote) L.push(extraNote, "");
  L.push("| Stimme | Clips | korrekt | zweifelhaft | fehlerhaft | Modelle |", "|---|---:|---:|---:|---:|---|");
  for (const vid of voiceIds) {
    const s = results.voices[vid]?.summary; if (!s) continue;
    const name = voicesCfg.voices.find(v => v.id === vid)?.name || vid;
    L.push(`| ${name} | ${s.total} | ${s.ok} | ${s.doubtful} | ${s.error} | ${modelsOf(vid)} |`);
  }
  L.push("", "**fehlerhaft** = andere/fehlende/zusätzliche Zahl oder ≥ 2 zusätzliche/fehlende Wörter (Ansage sagt inhaltlich etwas anderes). **zweifelhaft** = ein Wort abweichend, Name nicht eindeutig erkannt oder Dauer stark abweichend — nachhören (qa/voice-review.html, Filter „nur auffällige“).", "");
  for (const vid of voiceIds) {
    const vr = results.voices[vid]; if (!vr) continue;
    const bad = Object.entries(vr.clips).filter(([, c]) => c.status !== "ok").sort((a, b) => RANK[b[1].status] - RANK[a[1].status] || a[0].localeCompare(b[0]));
    const name = voicesCfg.voices.find(v => v.id === vid)?.name || vid;
    L.push(`## ${name} — ${bad.length} nicht korrekt`, "");
    if (!bad.length) { L.push("Keine Auffälligkeiten.", ""); continue; }
    L.push("| Status | Key | Soll | erkannt | Grund |", "|---|---|---|---|---|");
    for (const [k, c] of bad) {
      const heard = Object.entries(c.stt || {}).map(([m, t]) => `${m}: ${t || "∅"}`).join(" / ");
      L.push(`| ${c.status === "error" ? "fehlerhaft" : "zweifelhaft"} | \`${k}\` | ${esc(c.text)} | ${esc(heard)} | ${esc((c.reasons || []).join("; "))} |`);
    }
    L.push("");
  }
  const out = path.join(REPORT_DIR, `report-${label}.md`);
  fs.writeFileSync(out, L.join("\n"));
  return out;
}

module.exports = { runCheck, writeReport, writeResults, reevaluateFile, summarize, loadJSON, RESULTS_PATH };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  runCheck(args).then(({ results, checked }) => {
    const voiceIds = [...new Set(checked.map(c => c.voice))];
    for (const vid of voiceIds) {
      const mine = checked.filter(c => c.voice === vid), s = summarize(mine);
      console.log(`${vid}: ${s.total} geprüft — ok ${s.ok}, zweifelhaft ${s.doubtful}, fehlerhaft ${s.error}`);
      if (args.verbose || mine.length <= 20) for (const c of mine.filter(c => c.status !== "ok")) console.log(`  [${c.status}] ${c.key}: "${c.text}" ← ${JSON.stringify(c.stt)} ${c.reasons.join("; ")}`);
    }
    if (args.report && !args["no-save"]) console.log("Bericht:", writeReport(String(args.report), results, voiceIds));
    process.exit(checked.some(c => c.status === "error") ? 1 : 0);
  }).catch(e => { console.error(e.stack || e.message); process.exit(2); });
}
