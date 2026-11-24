#!/usr/bin/env node
/**
 * build-vocabulary.js — Enumerates the app's ENTIRE fixed TTS vocabulary
 * (every score announcement, every fixed phrase, every checkout-path
 * sentence) and writes it to data/vocabulary.json.
 *
 * This is the single source of truth for "which clips must exist locally
 * for the app to never need a runtime TTS call". It is derived directly
 * from the app's own code (js/audio.js's numToWords + js/checkout.js's
 * CHECKOUT_TABLE) rather than hand-typed, so it can never drift from what
 * the app actually requests.
 *
 * Run with: node scripts/build-vocabulary.js
 * Writes: data/vocabulary.json, docs/voice-vocabulary.md
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

// audio.js is a browser ES module that touches `window` once at module
// top-level (to resolve AudioContext) — stub just enough for Node to import
// it for its pure numToWords()/numToWordsDe() helpers.
globalThis.window = globalThis.window || { AudioContext: function () {}, webkitAudioContext: function () {} };
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };

async function main() {
  const { numToWords } = await import(require("url").pathToFileURL(path.join(ROOT, "js", "audio.js")));
  const { CHECKOUT_TABLE } = await import(require("url").pathToFileURL(path.join(ROOT, "js", "checkout.js")));

  const entries = []; // {key, text, category}
  const seen = new Set();
  function add(key, text, category) {
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ key, text, category });
  }

  // ── 1) Turn-score announcements (exclamatory), every reachable 3-dart
  // turn total 1-180 except the 9 unreachable bogey totals. Mirrors
  // scoreAnnouncement() in js/audio.js exactly, including the special-cased
  // pause phrasing for numbers ElevenLabs historically mispronounced
  // (carried over from functions/index.js SPECIAL_TEXTS).
  const UNREACHABLE_SCORES = new Set([179, 178, 176, 175, 173, 172, 169, 166, 163]);
  const SPECIAL_SCORE_TEXT = {
    180: "One hundred and eighty!", // el_score_180b
    171: "One hundred, and seventy one!",
    167: "One hundred, and sixty seven!",
    160: "One hundred, and sixty!",
    140: "One hundred, and forty!",
    121: "One hundred, and twenty one!",
    100: "One hundred!",
    26: "Twenty, six!", // "Bed and Breakfast" slang covers the common case, this is the plain fallback
    45: "Forty five!",
  };
  for (let score = 1; score <= 180; score++) {
    if (UNREACHABLE_SCORES.has(score)) continue;
    if (score === 50) {
      add("el_score_50_bull", "Bull's Eye!", "score");
      add("el_score_50_norm", "Fifty!", "score");
      continue;
    }
    const key = score === 180 ? "el_score_180b" : `el_score_${score}`;
    const text = SPECIAL_SCORE_TEXT[score] || (numToWords(score) + "!");
    add(key, text, "score");
  }

  // ── 2) Plain (neutral, non-exclamatory) number words 2-170, used when
  // composing "{name} requires {number}." out of pre-generated clips
  // (name clip + static "requires" clip + this number clip) — see
  // announceRequires() in js/speech.js. Deliberately a separate, calmer
  // recording from the "!" score announcements above.
  for (let score = 2; score <= 170; score++) {
    add(`el_num_${score}`, numToWords(score) + ".", "requires_number");
  }
  add("el_requires", "Requires", "requires_number");

  // ── 3) Fixed keyed phrases (game flow) ──────────────────────────────
  // Text matches the ElevenLabs-proven phrasing from functions/index.js
  // SPECIAL_TEXTS where one existed (periods, not exclamation marks — that
  // phrasing was tuned specifically for calm/clear pronunciation).
  add("el_game_on", "Game on!", "fixed");
  add("el_bust", "Bust.", "fixed");
  add("el_no_score", "No score.", "fixed");

  // ── 4) Dart slang (optional "dart_slang_enabled" setting) ───────────
  const slang = [
    "Bed and Breakfast!", "Fish and Chips!", "Richmond!",
    "Slightly more than breakfast!", "Three in a Bed!", "Shanghai!",
    "Ton!", "Good Darts!",
  ];
  for (const s of slang) add(`el_slang_${s.replace(/[\s!]/g, "_").toLowerCase()}`, s, "slang");
  // 140 with slang on: spoken like the plain 140 score announcement (the old
  // slang phrase was misheard/mispronounced, 2026-11-24). The key keeps its
  // historic name so cached copies are replaced via the content hash and
  // older app versions fetching this key from Storage get the new take too.
  // Must match SLANG_KEY_OVERRIDE in js/audio.js.
  add("el_slang_ton_forty_", "One hundred, and forty!", "slang");
  add("el_slang_madhouse_", "Madhouse!", "slang");
  add("el_slang_double_top_game_shot_", "Double Top! Game Shot!", "slang");
  add("el_slang_game_shot_", "Game Shot!", "slang");

  // ── 5) Party-mode fixed phrases ─────────────────────────────────────
  add("el_shanghai_win", "Shanghai!", "party");
  add("el_killer", "Killer!", "party");
  add("el_out", "Out!", "party");
  add("el_eliminated", "Eliminated!", "party");
  add("el_party_checkout", "Checkout!", "party");
  add("el_bob27_over", "Game Over!", "party");

  // Checkout-training percentage, composed from two local clips played back
  // to back (not a runtime call): a neutral "{N} percent." clip (reusing
  // the plain number style) + one static "Training complete." clip.
  for (let pct = 0; pct <= 100; pct++) add(`el_pct_${pct}`, `${numToWords(pct)} percent.`, "training_pct");
  add("el_training_complete", "Training complete.", "training_pct");

  // ── 6) Checkout-path announcements — FULL SENTENCES, one per standard
  // table entry (never composed from segment building-blocks at runtime).
  function partToReadable(part) {
    if (part === "Bull") return "Bullseye";
    if (part === "D25") return "Double Bull";
    const isT = part.startsWith("T"), isD = part.startsWith("D");
    const n = parseInt(part.replace(/[TDS]/, ""));
    return (isT ? "Triple " : isD ? "Double " : "") + numToWords(n);
  }
  for (const [remaining, e] of Object.entries(CHECKOUT_TABLE)) {
    const readable = e.path.split(" ").map(partToReadable).join(", ");
    add(`el_co_${remaining}`, `Checkout: ${readable}.`, "checkout_path");
  }

  // ── Write outputs ────────────────────────────────────────────────────
  entries.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
  fs.writeFileSync(path.join(ROOT, "data", "vocabulary.json"), JSON.stringify(entries, null, 2));

  const byCategory = {};
  let totalChars = 0;
  for (const e of entries) {
    byCategory[e.category] = byCategory[e.category] || [];
    byCategory[e.category].push(e);
    totalChars += e.text.length;
  }

  const md = [];
  md.push("# Voice vocabulary — fixed TTS clips");
  md.push("");
  md.push("GENERATED FILE — do not hand-edit. Regenerate with `node scripts/build-vocabulary.js`.");
  md.push("");
  md.push(`Total entries: **${entries.length}**, total characters (per voice): **${totalChars}**.`);
  md.push("");
  md.push("Every entry here must exist as a local audio clip for every bundled voice");
  md.push("before the app ever needs it — see scripts/gen-voice-assets.js.");
  md.push("");
  for (const cat of Object.keys(byCategory).sort()) {
    const list = byCategory[cat];
    md.push(`## ${cat} (${list.length} entries, ${list.reduce((s, e) => s + e.text.length, 0)} chars)`);
    md.push("");
    md.push("| key | text |");
    md.push("|---|---|");
    for (const e of list) md.push(`| \`${e.key}\` | ${e.text.replace(/\|/g, "\\|")} |`);
    md.push("");
  }
  fs.writeFileSync(path.join(ROOT, "docs", "voice-vocabulary.md"), md.join("\n"));

  console.log("Entries:", entries.length, "| total chars/voice:", totalChars);
  for (const cat of Object.keys(byCategory).sort()) {
    console.log(" -", cat, ":", byCategory[cat].length, "entries,", byCategory[cat].reduce((s, e) => s + e.text.length, 0), "chars");
  }
}

main();
