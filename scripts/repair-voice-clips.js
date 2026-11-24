#!/usr/bin/env node
/**
 * repair-voice-clips.js — check → regenerate failing clips → re-check, until
 * a voice is clean or a clip has used up its attempts.
 *
 *   ELEVENLABS_API_KEY=… node scripts/repair-voice-clips.js --voice=haseeb
 *        [--max-attempts=4] [--include-doubtful] [--dry-run]
 *        [--only=k1,k2]   check + regenerate ONLY these keys (other flagged
 *                         clips of the voice stay untouched)
 *        [--force-regen]  with --only: regenerate the listed keys in round 1
 *                         even if the check doesn't flag them (a mistake the
 *                         ear caught but the STT excuses, e.g. a digit run),
 *                         then continue with the normal check loop
 *
 * Per round: scripts/check-voice-clips.js (cached by SHA-1 → only changed
 * clips are transcribed again), then every clip with status "error" (and with
 * --include-doubtful also "doubtful", except clips whose ONLY findings are
 * STT limits — a name Whisper spells differently, or numbers it merged into
 * a digit run — which a new take can't resolve) is regenerated via scripts/gen-voice-assets.js with the next
 * attempt number (= new seed). Attempts + the transcript of each replaced
 * take are kept per clip in qa/voice-qa.json (`attempts`, `history`), so the
 * loop is idempotent: re-running continues where it stopped, and a clip
 * that already used --max-attempts is reported as stuck instead of being
 * regenerated again.
 */
"use strict";
const path = require("path");
const { spawnSync } = require("child_process");
const { runCheck, writeResults, summarize, loadJSON, RESULTS_PATH } = require("./check-voice-clips");

const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const MAX = parseInt(args["max-attempts"] || "4", 10);
const INCLUDE_DOUBTFUL = !!args["include-doubtful"];
const DRY = !!args["dry-run"];
const voices = String(args.voice || "").split(",").filter(Boolean);
if (!voices.length) { console.error("--voice=<id>[,<id>] required"); process.exit(1); }
const ONLY = args.only ? new Set(String(args.only).split(",").map(s => s.trim()).filter(Boolean)) : null;
const FORCE = !!args["force-regen"];
if (FORCE && !ONLY) { console.error("--force-regen needs --only=<keys>"); process.exit(1); }

function needsRegen(c) {
  if (c.status === "error") return true;
  if (!INCLUDE_DOUBTFUL || c.status !== "doubtful") return false;
  // Findings a new take can't resolve for the STT (it can't spell unusual
  // names; it writes "seven double eight" as "788") → human ear, not credits.
  const sttLimit = (c.reasons || []).every(r => r.startsWith("Name abweichend") || r.startsWith("Zahlen nur als Ziffernfolge"));
  return !sttLimit;
}

async function main() {
  for (const voice of voices) {
    for (let round = 1; ; round++) {
      await runCheck(ONLY ? { voice, only: [...ONLY].join(",") } : { voice });
      const results = loadJSON(RESULTS_PATH, { voices: {} });
      const clips = results.voices[voice].clips;
      const failing = Object.entries(clips).filter(([k, c]) => (!ONLY || ONLY.has(k)) && ((FORCE && round === 1) || needsRegen(c)));
      const stuck = failing.filter(([, c]) => (c.attempts || 0) >= MAX).map(([k]) => k);
      const todo = failing.filter(([, c]) => (c.attempts || 0) < MAX);
      const s = summarize(Object.values(clips));
      console.log(`[${voice}] Runde ${round}: ok ${s.ok}, zweifelhaft ${s.doubtful}, fehlerhaft ${s.error} — neu erzeugen: ${todo.length}, ausgeschöpft: ${stuck.length}`);
      if (!todo.length) { if (stuck.length) console.log(`[${voice}] nach ${MAX} Versuchen weiter auffällig: ${stuck.join(", ")}`); break; }
      if (DRY) { console.log(todo.map(([k, c]) => `  ${k} (${c.status}, Versuch ${(c.attempts || 0) + 1}): ${c.reasons.join("; ")}`).join("\n")); break; }

      // Remember what the replaced take sounded like, then bump the attempt.
      const byAttempt = new Map();
      for (const [k, c] of todo) {
        const next = (c.attempts || 0) + 1;
        c.history = (c.history || []).concat([{ attempt: next - 1, sha1: c.sha1, status: c.status, stt: c.stt, reasons: c.reasons }]);
        c.attempts = next;
        if (!byAttempt.has(next)) byAttempt.set(next, []);
        byAttempt.get(next).push(k);
      }
      writeResults(results);
      for (const [attempt, keys] of byAttempt) {
        const r = spawnSync(process.execPath, [path.join(__dirname, "gen-voice-assets.js"), `--voice=${voice}`, `--only=${keys.join(",")}`, "--force", `--attempt=${attempt}`], { stdio: ["ignore", "inherit", "inherit"] });
        if (r.status !== 0) { console.error(`gen-voice-assets.js exit ${r.status} — stopping`); process.exit(2); }
      }
    }
  }
}

main().catch(e => { console.error(e.stack || e.message); process.exit(2); });
