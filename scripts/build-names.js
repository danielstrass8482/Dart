#!/usr/bin/env node
/**
 * build-names.js — Builds the pre-produced first-name library (data/names.json)
 * and its documentation (docs/voice-names.md).
 *
 * Scope & derivation (see docs/voice-names.md for the full writeup):
 *  - German given names spanning players roughly 18-65 years old in 2026
 *    (birth years ~1961-2008), compiled from aggregated German name-frequency
 *    overviews by decade (familie.de / Knud Bielefeld "beliebte-vornamen.de"
 *    analyses of 1960s-2000s top names) plus well-known evergreen German
 *    names not decade-specific.
 *  - Common English (UK/US) first names spanning the same age range,
 *    compiled from well-established long-term popularity patterns (US SSA /
 *    UK ONS top-name territory) — general knowledge, not a single scraped
 *    dataset.
 *  - Common short forms / nicknames for both languages, added as their own
 *    entries (a nickname is a different *spoken word* from the full name,
 *    e.g. "Mike" vs "Michael", so it needs its own clip, not just an alias).
 *  - This is deliberately a broad-coverage list, not an exhaustive one — any
 *    name not in it is generated once on first use and cached centrally
 *    (see functions/voiceName.js), so coverage gaps are self-healing.
 *
 * Each entry's "say" text is just the name on its own (spoken once, no
 * carrier sentence) so it can be dropped into "{name} requires {number}."
 * by playing [name clip] then the static "requires" clip then the number
 * clip — see announceRequires() in js/speech.js and getNameClipKey() in
 * js/names.js.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

/**
 * Normalizes a player-entered name for lookup against the library / the
 * central generated-names store: lowercase, trimmed, internal whitespace
 * collapsed, umlauts folded to their ASCII digraphs, ß folded to ss.
 * Mirrors js/names.js normalizeName() — kept in sync manually since this
 * script has no browser DOM dependency to share the exact module safely in
 * both Node and the browser without a build step.
 */
function normalizeName(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

const GERMAN_FEMALE = [
  "Ursula","Monika","Renate","Ingrid","Brigitte","Sabine","Susanne","Angelika","Karin","Petra",
  "Birgit","Christiane","Gisela","Elke","Andrea","Martina","Anja","Heike","Kerstin","Bettina",
  "Gabriele","Katrin","Claudia","Cornelia","Marion","Silke","Ute","Annette","Doris","Christa",
  "Nicole","Sandra","Stefanie","Katharina","Julia","Jennifer","Christina","Melanie","Sabrina","Nadine",
  "Vanessa","Jessica","Carina","Tanja","Yvonne","Manuela","Nina","Carolin","Michelle","Jacqueline",
  "Diana","Simone","Daniela","Alexandra","Sonja","Kathrin","Franziska","Steffi",
  "Anna","Lena","Laura","Lisa","Sarah","Lea","Mia","Emma","Hannah","Leonie",
  "Marie","Johanna","Sophie","Lara","Nele","Mila","Emilia","Charlotte","Luisa","Paula",
  "Amelie","Elena","Maja","Clara","Lia","Ella","Marlene","Helene","Frieda"
];
const GERMAN_MALE = [
  "Klaus","Jürgen","Wolfgang","Hans","Werner","Günter","Dieter","Manfred","Uwe","Bernd",
  "Peter","Helmut","Horst","Rolf","Rainer","Norbert","Gerhard","Heinz","Karl","Wilhelm",
  "Michael","Martin","Stefan","Christian","Sebastian","Jan","Kevin","Thomas","Andreas","Markus",
  "Daniel","Alexander","Florian","Tobias","Dennis","Patrick","Marco","Frank","Oliver","Torsten",
  "Marcel","Dirk","Carsten","René","Sven","Ralf","Jörg","Matthias","Holger","Axel",
  "Lukas","Jonas","Finn","Luca","Max","Paul","Ben","Elias","Felix","Niklas",
  "Leon","Noah","Julian","Tim","Nico","David","Simon","Jannik","Moritz","Erik",
  "Lennard","Fabian","Philipp","Maximilian","Tom","Niclas","Jakob","Benjamin"
];
const ENGLISH_MALE = [
  "James","John","Robert","Michael","William","David","Richard","Thomas","Mark","Paul",
  "Andrew","Daniel","Matthew","Christopher","Joshua","Ryan","Jack","Oliver","Liam","Noah",
  "Ethan","Lucas","Mason","Jacob","Alexander","Benjamin","Samuel","Joseph","Henry","Charles",
  "George","Harry","Jake","Luke","Adam","Nathan","Connor","Dylan","Kyle","Sean",
  "Tyler","Brandon","Steven","Kevin","Scott","Gary","Keith","Craig","Ian","Shane","Nicholas"
];
const ENGLISH_FEMALE = [
  "Mary","Patricia","Linda","Barbara","Elizabeth","Jennifer","Susan","Jessica","Sarah","Karen",
  "Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Emily","Emma","Olivia","Sophia",
  "Isabella","Ava","Mia","Charlotte","Amelia","Grace","Chloe","Lucy","Hannah","Megan",
  "Rachel","Laura","Rebecca","Victoria","Amy","Claire","Donna","Carol","Helen","Amanda",
  "Michelle","Kimberly","Tracy","Julie","Katherine","Abigail","Deborah","Natalie","Samantha"
];
// Nicknames/short forms — each a DISTINCT spoken word, own clip.
const NICKNAMES = [
  "Mike","Steffi","Basti","Flo","Tommy","Alex","Addi","Chrissi","Jules","Nici",
  "Benny","Seb","Katha","Steff","Toni","Lissi","Gabi","Susi","Bine","Didi","Manni",
  "Rob","Bobby","Dave","Rick","Tom","Matt","Chris","Josh","Sam","Joe","Will",
  "Charlie","Liz","Jen","Sue","Maggie","Katie","Becky","Vicky","Abbie","Patty",
  "Debbie","Jim","Bill","Nick","Steve","Andy","Beth","Kate","Dan","Alexa"
];

const entries = [];
const seenNorm = new Set();
function addName(name, origin) {
  const norm = normalizeName(name);
  if (seenNorm.has(norm)) return; // avoid duplicate clips for names shared across lists (e.g. "Tom")
  seenNorm.add(norm);
  entries.push({ name, norm, text: name + ".", origin });
}
for (const n of GERMAN_FEMALE) addName(n, "de");
for (const n of GERMAN_MALE) addName(n, "de");
for (const n of ENGLISH_FEMALE) addName(n, "en");
for (const n of ENGLISH_MALE) addName(n, "en");
for (const n of NICKNAMES) addName(n, "nickname");

entries.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(ROOT, "data", "names.json"), JSON.stringify(entries, null, 2));

const totalChars = entries.reduce((s, e) => s + e.text.length, 0);
const byOrigin = {};
for (const e of entries) (byOrigin[e.origin] = byOrigin[e.origin] || []).push(e);

const md = [];
md.push("# Voice name library");
md.push("");
md.push("GENERATED FILE — do not hand-edit. Regenerate with `node scripts/build-names.js`.");
md.push("");
md.push(`Total names: **${entries.length}**, total characters (per voice): **${totalChars}**.`);
md.push("");
md.push("## Scope & derivation");
md.push("");
md.push("- **German given names (~18-65 years old in 2026, i.e. born ~1961-2008):**");
md.push("  compiled from aggregated German name-frequency-by-decade overviews —");
md.push("  [familie.de: häufigste Jungennamen/Mädchennamen 1960er-2000er](https://www.familie.de/schwangerschaft/geboren-in-den-60er-jahren-diese-20-maedchennamen-waren-in-der-brd-am-beliebtesten--01HAYWPR24AFSV53QZXKT45TSC),");
md.push("  [berliner-kurier.de: typische Vornamen Boomer/Millennials/Gen Z (Namensforscher Knud Bielefeld)](https://www.berliner-kurier.de/article/typische-vornamen-boomer-millennials-gen-z-10568069),");
md.push("  plus well-known evergreen German names not tied to one decade.");
md.push("  There is no official German name-frequency statistic (no Standesamt-wide public dataset),");
md.push("  so this is a best-effort aggregate, not an authoritative ranking.");
md.push("- **English (UK/US) given names:** long-established common first names across the same");
md.push("  age range (US Social Security Administration / UK ONS top-name territory for the");
md.push("  relevant decades) — general knowledge, since no single historical top-30-by-decade");
md.push("  dataset for both countries combined was available; the app is used internationally");
md.push("  so both German and English coverage matter.");
md.push("- **Nicknames/short forms:** added as their OWN entries (not aliases) because a nickname");
md.push("  is a different spoken word from the full name (\"Mike\" vs \"Michael\").");
md.push("- **Not exhaustive by design:** any name missing here is generated once on first use and");
md.push("  cached centrally by normalized name (see functions/voiceName.js) — see also js/names.js.");
md.push("");
for (const origin of ["de", "en", "nickname"]) {
  const list = byOrigin[origin] || [];
  md.push(`## ${origin} (${list.length} names)`);
  md.push("");
  md.push(list.map(e => e.name).join(", "));
  md.push("");
}
fs.writeFileSync(path.join(ROOT, "docs", "voice-names.md"), md.join("\n"));

console.log("Names:", entries.length, "| total chars/voice:", totalChars);
for (const origin of Object.keys(byOrigin)) console.log(" -", origin, ":", byOrigin[origin].length);
