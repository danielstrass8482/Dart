#!/usr/bin/env node
/**
 * test-checkout-table.js — checks js/checkout.js (the one checkout logic).
 * Run: node scripts/test-checkout-table.js
 *  - every rest 2–170 × 1/2/3 darts left: sum, double/Bull finish, fits the
 *    darts, null exactly when no checkout exists in those darts
 *  - no double as setup dart where a single does the job (a path of the same
 *    length without double setup that uses a single) — except where the poster table is binding
 *  - 3 darts + 41–170 = poster table (data/checkout-poster.csv), bogeys none
 *  - concrete cases + mid-turn "keep the path" rule
 */
"use strict";
const fs = require("fs"), path = require("path");
const { pathToFileURL } = require("url");

(async () => {
  const C = await import(pathToFileURL(path.join(__dirname, "..", "js", "checkout.js")));
  const { getCheckoutPath, getTurnCheckoutPath, CHECKOUT_TABLE, partValue, isFinishPart, BOGEYS } = C;
  let pass = 0, fail = 0;
  const check = (desc, cond) => { if (cond) pass++; else { fail++; console.error("FAIL:", desc); } };

  // Every single dart that exists.
  const ALL = ["S25", "Bull"];
  for (let n = 1; n <= 20; n++) ALL.push(`S${n}`, `D${n}`, `T${n}`);
  const FIN = ALL.filter(isFinishPart);
  const isDbl = p => /^D\d+$/.test(p) || p === "Bull";
  // all paths with exactly k darts for rest r
  function paths(r, k) {
    if (k === 1) return FIN.filter(f => partValue(f) === r).map(f => [f]);
    const out = [];
    for (const a of ALL) { const v = partValue(a); if (v < r) for (const p of paths(r - v, k - 1)) out.push([a, ...p]); }
    return out;
  }
  const minDarts = r => [1, 2, 3].find(k => paths(r, k).length) || null;

  // Poster table from the CSV (source of truth copied from Daniel's order).
  const poster = {};
  for (const line of fs.readFileSync(path.join(__dirname, "..", "data", "checkout-poster.csv"), "utf8").trim().split("\n")) {
    if (line.startsWith("#") || line.startsWith("score")) continue;
    const [s, ...parts] = line.split(",");
    poster[+s] = parts.filter(Boolean).map(p => (p === "D25" ? "Bull" : p)).join(" ");
  }
  check("poster has 123 rows", Object.keys(poster).length === 123);
  for (const [s, p] of Object.entries(poster)) {
    const parts = p.split(" ");
    check(`poster ${s}: sum`, parts.reduce((a, x) => a + partValue(x), 0) === +s);
    check(`poster ${s}: finish`, isFinishPart(parts[parts.length - 1]));
  }

  const tableDoubleSetups = [];
  for (let r = 2; r <= 170; r++) for (const d of [1, 2, 3]) {
    const p = getCheckoutPath(r, d);
    const md = minDarts(r);
    const possible = md != null && md <= d;
    check(`${r}/${d}: null iff impossible (got ${p})`, !!p === possible);
    if (!p) continue;
    const parts = p.split(" ");
    check(`${r}/${d} ${p}: sum`, parts.reduce((a, x) => a + partValue(x), 0) === r);
    check(`${r}/${d} ${p}: finish`, isFinishPart(parts[parts.length - 1]));
    check(`${r}/${d} ${p}: fits`, parts.length <= d);
    const binding = d === 3 && r >= 41;
    if (binding) check(`${r}/3 = poster (${poster[r]}) got ${p}`, p === poster[r]);
    if (parts.slice(0, -1).some(isDbl)) {
      // alternative of the same length without a double setup that uses a single instead
      const singleAlt = paths(r, parts.length).some(q => !q.slice(0, -1).some(isDbl) && q.slice(0, -1).some(x => x[0] === "S"));
      if (binding) { if (singleAlt) tableDoubleSetups.push(`${r}: ${p}`); }
      else check(`${r}/${d} ${p}: double setup although a single works`, !singleAlt);
    }
    if (r <= 40) {
      if (r % 2 === 0) check(`${r}/${d}: even ≤40 = D${r / 2}`, p === `D${r / 2}`);
      else check(`${r}/${d}: odd ≤40 = single + D20/D16/D8 first`, /^S\d+ D\d+$/.test(p) &&
        (+p.split(" D")[1] === [20, 16, 8, 4, 2, 1].find(n => r - 2 * n >= 1 && r - 2 * n <= 20)));
    }
  }
  for (const b of BOGEYS) for (const d of [1, 2, 3]) check(`bogey ${b}/${d}: none`, getCheckoutPath(b, d) === null && !CHECKOUT_TABLE[b]);
  check("CHECKOUT_TABLE has 162 entries", Object.keys(CHECKOUT_TABLE).length === 162);

  // Concrete cases from the order.
  check("48 / 2 darts = S16 D16", getCheckoutPath(48, 2) === "S16 D16");
  check("32 = D16 (3/2/1)", [3, 2, 1].every(d => getCheckoutPath(32, d) === "D16"));
  check("124 = T20 T16 D8", getCheckoutPath(124, 3) === "T20 T16 D8");
  check("139 = T19 T14 D20", getCheckoutPath(139, 3) === "T19 T14 D20");
  check("153 = T20 T19 D18", getCheckoutPath(153, 3) === "T20 T19 D18");
  check("56 / 2 darts = S16 D20 (not D8 D20)", getCheckoutPath(56, 2) === "S16 D20");
  check("50 / 1 dart = Bull, 3 darts = S18 D16", getCheckoutPath(50, 1) === "Bull" && getCheckoutPath(50, 3) === "S18 D16");
  check("110 / 2 darts = T20 Bull", getCheckoutPath(110, 2) === "T20 Bull");
  check("35 = S3 D16", getCheckoutPath(35, 3) === "S3 D16");
  check("35 / 1 dart = none", getCheckoutPath(35, 1) === null);

  // Mid-turn: keep the turn's path while the darts follow it.
  const T = (s, ...labels) => getTurnCheckoutPath(s, labels.map(l => ({ score: l === "M" ? 0 : partValue(l) })));
  check("139: T19 → keeps T14 D20 (not Bull D16)", T(139, "T19") === "T14 D20");
  check("139: T19 T14 → D20", T(139, "T19", "T14") === "D20");
  check("124: T20 → T16 D8", T(124, "T20") === "T16 D8");
  check("132: Bull → T14 D20", T(132, "Bull") === "T14 D20");
  check("135: S25 → T20 Bull", T(135, "S25") === "T20 Bull");
  check("139: S19 (deviation) → 120 has no 2-dart path", T(139, "S19") === null);
  check("100: miss → T20 D20 with 2 darts", T(100, "M") === "T20 D20");
  check("100: S20 → 80 re-planned T20 D10", T(100, "S20") === "T20 D10");
  check("64: miss miss → none (1 dart)", T(64, "M", "M") === null);
  check("48: S8 (deviation) → 40 = D20", T(48, "S8") === "D20");
  check("turn path with no throws = getCheckoutPath(…,3)", Array.from({ length: 169 }, (_, i) => i + 2).every(r => T(r) === getCheckoutPath(r, 3)));
  // Every reachable mid-turn path also obeys the base rules (sum/finish/fit).
  let midOk = true;
  for (let r = 2; r <= 170; r++) {
    const p0 = getCheckoutPath(r, 3); if (!p0) continue;
    const first = p0.split(" ")[0];
    const p = T(r, first); if (!p) continue;
    const parts = p.split(" ");
    if (parts.reduce((a, x) => a + partValue(x), 0) !== r - partValue(first) || !isFinishPart(parts[parts.length - 1]) || parts.length > 2) { midOk = false; console.error("mid", r, p); }
  }
  check("all kept mid-turn paths valid", midOk);

  // Preferred doubles (player profile, display only): same length, preferred finish, never a double setup.
  let prefOk = true;
  for (let r = 2; r <= 170; r++) for (const d of [1, 2, 3]) for (const pref of [[16], [8], [20, 16], [25]]) {
    const q = C.getPreferredCheckoutPath(r, d, pref); if (!q) continue;
    const parts = q.split(" "), std = getCheckoutPath(r, d).split(" ");
    const fin = parts[parts.length - 1];
    if (parts.length !== std.length || parts.reduce((a, x) => a + partValue(x), 0) !== r || !pref.map(n => n === 25 ? "Bull" : `D${n}`).includes(fin) || parts.slice(0, -1).some(isDbl)) { prefOk = false; console.error("pref", r, d, pref, q); }
  }
  check("preferred-double paths: same length, preferred finish, no double setup", prefOk);
  check("preferred 56/2 with D16 = T8 D16", C.getPreferredCheckoutPath(56, 2, [16]) === "T8 D16");

  console.log("Poster rows with a double-bull setup although an outer-bull/single path exists (poster is binding):", tableDoubleSetups.join(" · ") || "none");
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
