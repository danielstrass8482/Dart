#!/usr/bin/env node
/**
 * check-central-names.js — same content QA as check-voice-clips.js, for the
 * on-demand name clips dartVoiceName generated and cached centrally in
 * Storage (dart_voice_names/<voice>/<normalizedName>.mp3).
 *
 *   node scripts/check-central-names.js [--voice=george] [--delete-bad]
 *
 * Downloads the clips to /var/tmp/voice-central (not /home — small disk),
 * transcribes + compares them (target text = the normalized name, which is
 * all Storage knows; "juergen" still matches a spoken "Jürgen"), writes
 * docs/voice-qa/report-central-names.md and prints the result.
 * --delete-bad removes clips judged "error" from Storage, so the next player
 * with that name triggers a fresh generation (with the stable profile).
 * Does not touch qa/voice-qa.json (library clips only).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { runCheck } = require("./check-voice-clips");

const BUCKET = "darttrainer-app-fed88.firebasestorage.app";
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const TMP = "/var/tmp/voice-central";

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  let listing = "";
  try { listing = execFileSync("gcloud", ["storage", "ls", `gs://${BUCKET}/dart_voice_names/**`], { encoding: "utf8" }); }
  catch (e) { if (!/matched no objects|One or more URLs matched no objects/.test(String(e.stderr))) throw e; }
  const objs = listing.split("\n").map(s => s.trim()).filter(s => s.endsWith(".mp3"))
    .map(u => { const m = u.match(/dart_voice_names\/([^/]+)\/(.+)\.mp3$/); return m && { url: u, voice: m[1], norm: m[2] }; })
    .filter(o => o && (!args.voice || o.voice === args.voice));
  if (!objs.length) { console.log("Keine zentralen Namens-Clips gefunden."); return; }
  const byVoice = {};
  for (const o of objs) (byVoice[o.voice] = byVoice[o.voice] || []).push(o);
  for (const [v, list] of Object.entries(byVoice)) {
    fs.mkdirSync(path.join(TMP, v), { recursive: true });
    execFileSync("gcloud", ["storage", "cp", ...list.map(o => o.url), path.join(TMP, v) + "/"], { stdio: "ignore" });
    for (const o of list) fs.renameSync(path.join(TMP, v, `${o.norm}.mp3`), path.join(TMP, v, `name_${o.norm}.mp3`));
  }
  const { checked } = await runCheck({
    dir: TMP, voice: Object.keys(byVoice).join(","), "no-save": true,
    entries: vid => (byVoice[vid] || []).map(o => ({ key: `name_${o.norm}`, text: o.norm.charAt(0).toUpperCase() + o.norm.slice(1) + ".", kind: "name", category: "name" })),
  });
  const L = ["# Voice-QA: zentrale Namens-Clips (dart_voice_names/)", "", `Stand: ${new Date().toISOString()} — ${checked.length} Clips`, "", "| Stimme | Name | Status | erkannt | Grund |", "|---|---|---|---|---|"];
  for (const c of checked) {
    L.push(`| ${c.voice} | ${c.key.slice(5)} | ${c.status} | ${Object.values(c.stt || {}).join(" / ")} | ${(c.reasons || []).join("; ")} |`);
    console.log(`${c.voice}/${c.key.slice(5)}: ${c.status} ${JSON.stringify(c.stt)} ${(c.reasons || []).join("; ")}`);
    if (c.status === "error" && args["delete-bad"]) {
      execFileSync("gcloud", ["storage", "rm", `gs://${BUCKET}/dart_voice_names/${c.voice}/${c.key.slice(5)}.mp3`], { stdio: "inherit" });
      console.log("  → gelöscht, wird beim nächsten Abruf neu erzeugt");
    }
  }
  fs.mkdirSync(path.join(__dirname, "..", "docs", "voice-qa"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "docs", "voice-qa", "report-central-names.md"), L.join("\n") + "\n");
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exitCode = checked.some(c => c.status === "error") ? 1 : 0;
}
main().catch(e => { console.error(e.stack || e.message); process.exit(2); });
