#!/usr/bin/env node
/**
 * gen-checkout-table.js — Regenerates js/checkout.js (the canonical darts
 * checkout table) from first principles. Run with `node scripts/gen-checkout-table.js`
 * whenever the generation rules below change; it overwrites js/checkout.js.
 *
 * Rules (standard double-out professional convention):
 *  - The last dart of a checkout must land on a double (D1..D20) or Bull (50,
 *    i.e. the double-bull). Single-bull (25) is never a legal finishing dart.
 *  - Earlier dart(s) may be any legal single-dart score: single 1-20, outer
 *    bull single (25), double 2-40, or treble 3-60. Bull (50) is never used
 *    as a non-final dart — wasting the only 50 on a scoring (non-checkout)
 *    dart is never standard play.
 *  - Preferred finishing doubles, checked in this priority order: D20, D16,
 *    D8, D4, D2, D10, D12, D14, D18, D6, D1, D3, D5, D7, D9, D11, D13, D15,
 *    D17, D19, then Bull as the last resort (only reached when no finish via
 *    a plain double exists, e.g. 170/167/164/161/139/101/104/107/110 etc.).
 *  - For a given finishing double, the lead-in dart(s) are chosen preferring
 *    Treble > outer-Bull(25) > Double > Single, and the highest number within
 *    each category — i.e. "throw the biggest scoring dart that still leaves
 *    an exact route to the finish".
 *  - Shortest path wins: a 1-dart finish beats a 2-dart finish beats a
 *    3-dart finish for the same remaining score. This is the single
 *    canonical path per remaining score (2-170); "darts remaining in the
 *    turn" never changes the path itself, it only gates whether that path
 *    still fits (see getCheckoutPath() in js/checkout.js) — a 3-dart path is
 *    simply unavailable once only 1-2 darts are left in the turn.
 *
 * Remaining scores for which no path exists within 3 darts (the classic
 * "bogey numbers") are omitted entirely: 169,168,166,165,163,162,159 are the
 * only ones below 170, and this generator re-derives that list from the
 * combinatorics rather than hard-coding it — see the console check below.
 */
"use strict";

const DOUBLES = [];
for (let n = 1; n <= 20; n++) DOUBLES.push({ v: n * 2, label: `D${n}`, n });
const BULL = { v: 50, label: "Bull", n: 25 };

const FINISH_PRIORITY_NUMS = [20, 16, 8, 4, 2, 10, 12, 14, 18, 6, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const FINISH_ORDER = FINISH_PRIORITY_NUMS.map(n => DOUBLES.find(d => d.n === n)).concat([BULL]);

function allLeadInOptions() {
  const opts = [];
  for (let n = 1; n <= 20; n++) opts.push({ v: n * 3, label: `T${n}`, kind: 0, n });
  opts.push({ v: 25, label: "S25", kind: 1, n: 25 });
  for (let n = 1; n <= 20; n++) opts.push({ v: n * 2, label: `D${n}`, kind: 2, n });
  for (let n = 1; n <= 20; n++) opts.push({ v: n, label: `S${n}`, kind: 3, n });
  opts.sort((a, b) => (a.kind - b.kind) || (b.n - a.n));
  return opts;
}
const LEAD_IN = allLeadInOptions();

function findPath(R) {
  for (const f of FINISH_ORDER) if (f.v === R) return [f.label];
  for (const f of FINISH_ORDER) {
    const need = R - f.v;
    if (need < 1) continue;
    const d1 = LEAD_IN.find(o => o.v === need);
    if (d1) return [d1.label, f.label];
  }
  for (const f of FINISH_ORDER) {
    const need = R - f.v;
    if (need < 2) continue;
    for (const d1 of LEAD_IN) {
      if (d1.v >= need) continue;
      const need2 = need - d1.v;
      const d2 = LEAD_IN.find(o => o.v === need2);
      if (d2) return [d1.label, d2.label, f.label];
    }
  }
  return null;
}

const table = {};
for (let R = 2; R <= 170; R++) {
  const path = findPath(R);
  if (path) table[R] = { darts: path.length, path: path.join(" ") };
}

// Self-check against the well-known bogey list before writing anything.
const KNOWN_BOGEYS = [159, 162, 163, 165, 166, 168, 169];
const computedBogeys = [];
for (let R = 2; R <= 170; R++) if (!table[R]) computedBogeys.push(R);
const bogeysMatch = JSON.stringify(computedBogeys) === JSON.stringify(KNOWN_BOGEYS);
console.log("Computed bogeys 2-170:", computedBogeys.join(","));
console.log("Matches known bogey list:", bogeysMatch);
if (!bogeysMatch) {
  console.error("ABORTING — computed bogeys don't match the known list, refusing to write js/checkout.js");
  process.exit(1);
}

const fs = require("fs");
const path = require("path");

const lines = [];
lines.push("/**");
lines.push(" * checkout.js — Canonical darts checkout table (standard double-out).");
lines.push(" * GENERATED FILE — do not hand-edit. Regenerate with:");
lines.push(" *   node scripts/gen-checkout-table.js");
lines.push(" * See that script for the generation rules (preferred finishing doubles");
lines.push(" * D20/D16/D8/…, shortest-path-wins, no single-bull finishes).");
lines.push(" *");
lines.push(" * CHECKOUT_TABLE[remaining] = {darts, path} for every remaining score");
lines.push(" * 2-170 that has a valid checkout within 3 darts. Scores with no entry");
lines.push(` * (the "bogey numbers" ${KNOWN_BOGEYS.join(",")}, plus 1 and anything >170)`);
lines.push(" * have no possible checkout at all and must not announce or display one.");
lines.push(" */");
lines.push("");
// `table` was built by iterating R=2..170 in ascending order, so plain
// JSON.stringify already emits keys in that order (insertion order).
lines.push("export const CHECKOUT_TABLE = " + JSON.stringify(table, null, 2).replace(/"(\d+)":/g, "$1:") + ";");
lines.push("");
lines.push("/**");
lines.push(" * Returns the standard checkout path for `remaining`, or null if either");
lines.push(" * no checkout exists at all, or it exists but needs more darts than are");
lines.push(" * actually left in the current turn (`dartsLeft`, 1-3). The path itself");
lines.push(" * never changes with dartsLeft — only whether it still fits does.");
lines.push(" * @param {number} remaining");
lines.push(" * @param {number} [dartsLeft] darts still available this turn (1-3), default 3 (start of turn)");
lines.push(" * @returns {string|null} e.g. \"T20 T20 Bull\"");
lines.push(" */");
lines.push("export function getCheckoutPath(remaining, dartsLeft = 3) {");
lines.push("  const e = CHECKOUT_TABLE[remaining];");
lines.push("  if (!e || e.darts > dartsLeft) return null;");
lines.push("  return e.path;");
lines.push("}");
lines.push("");

const outPath = path.join(__dirname, "..", "js", "checkout.js");
fs.writeFileSync(outPath, lines.join("\n"));
console.log("Wrote", outPath, "with", Object.keys(table).length, "entries.");
