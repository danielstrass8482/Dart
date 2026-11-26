/**
 * checkout.js — the ONE checkout logic of the app (double-out). Used by the
 * X01 display + board highlight (incl. tournament/online), the spoken
 * checkout path, Co-op Checkout, Checkout-Training and the bot.
 *
 * Path notation: S<n> single, T<n> treble, D<n> double, "S25" outer bull
 * (single bull, 25), "Bull" double bull (50, written D25 on the poster).
 *
 * Rules (2026-11-26, Daniel):
 *  1. 3 darts left and 41–170: exactly POSTER_TABLE (DARTCOACH poster,
 *     4 arithmetic errors corrected by Daniel). Bogeys 159/162/163/165/166/
 *     168/169 have no checkout.
 *  2. Rest ≤ 40 (any darts left): even → the double straight away (32: D16);
 *     odd → one single onto a common double, preferring D20, D16, D8, then
 *     D4, D2, D1 (35: S3 D16). Needs 2 darts.
 *  3. 2 darts left, 41–110: the poster path if it has ≤ 2 darts, otherwise
 *     the solver below. 1 dart left: only a single double (≤ 40 even, Bull).
 *  4. Setup (non-final) darts: a single whenever a single does the job —
 *     never a double where a single works (old table: 56 → D8 D20).
 *  5. Mid-turn: if the darts thrown so far followed the turn's path, the
 *     rest of that path is kept (139: T19 → 82 stays T14 D20, it does NOT
 *     switch to 82's own path Bull D16) — see getTurnCheckoutPath().
 *
 * Only the turn-start path (3 darts) is ever SPOKEN (clip el_co_<rest>,
 * see scripts/build-vocabulary.js); 2-/1-dart paths are display-only.
 */

/** Poster table, 41–170, 3 darts left. [d1, d2, d3?] — last dart is a double / D25. */
const POSTER_TABLE = {
  170:"T20 T20 D25", 167:"T20 T19 D25", 164:"T20 T18 D25", 161:"T20 T17 D25",
  160:"T20 T20 D20", 158:"T20 T20 D19", 157:"T20 T19 D20", 156:"T20 T20 D18",
  155:"T20 T19 D19", 154:"T20 T18 D20", 153:"T20 T19 D18", 152:"T20 T20 D16",
  151:"T20 T17 D20", 150:"T20 T18 D18", 149:"T20 T19 D16", 148:"T20 T16 D20",
  147:"T20 T17 D18", 146:"T19 T19 D16", 145:"T19 T20 D14", 144:"T20 T20 D12",
  143:"T20 T17 D16", 142:"T18 T20 D14", 141:"T20 T19 D12", 140:"T20 T20 D10",
  139:"T19 T14 D20", 138:"T20 T18 D12", 137:"T20 T15 D16", 136:"T20 T20 D8",
  135:"S25 T20 D25", 134:"T20 T14 D16", 133:"T20 T11 D20", 132:"D25 T14 D20",
  131:"T20 T13 D16", 130:"T20 T20 D5",  129:"T19 T16 D12", 128:"T18 T14 D16",
  127:"T20 T17 D8",  126:"T19 T19 D6",  125:"D25 T17 D12", 124:"T20 T16 D8",
  123:"T19 T16 D9",  122:"T18 T18 D7",  121:"T20 T11 D14", 120:"T20 S20 D20",
  119:"T19 T12 D13", 118:"T20 S18 D20", 117:"T20 S17 D20", 116:"T20 S16 D20",
  115:"T20 S15 D20", 114:"T20 S14 D20", 113:"T19 S16 D20", 112:"T20 S12 D20",
  111:"T20 S11 D20", 110:"T20 S10 D20", 109:"T20 S9 D20",  108:"T20 S16 D16",
  107:"T19 S18 D16", 106:"T20 S14 D16", 105:"T20 S13 D16", 104:"T18 S18 D16",
  103:"T19 S14 D16", 102:"T20 S10 D16", 101:"T20 S9 D16",  100:"T20 D20",
  99:"T19 S10 D16",  98:"T20 D19",  97:"T19 D20",  96:"T20 D18",  95:"T19 D19",
  94:"T18 D20",  93:"T19 D18",  92:"T20 D16",  91:"T17 D20",  90:"T20 D15",
  89:"T19 D16",  88:"T20 D14",  87:"T17 D18",  86:"T18 D16",  85:"T15 D20",
  84:"T20 D12",  83:"T17 D16",  82:"D25 D16",  81:"T19 D12",  80:"T20 D10",
  79:"T19 D11",  78:"T18 D12",  77:"T19 D10",  76:"T20 D8",   75:"T17 D12",
  74:"T14 D16",  73:"T19 D8",   72:"T16 D12",  71:"T13 D16",  70:"T18 D8",
  69:"T15 D12",  68:"T20 D4",   67:"T17 D8",   66:"T10 D18",  65:"T11 D16",
  64:"T16 D8",   63:"T13 D12",  62:"T10 D16",  61:"T15 D8",   60:"S20 D20",
  59:"S19 D20",  58:"S18 D20",  57:"S17 D20",  56:"S16 D20",  55:"S15 D20",
  54:"S14 D20",  53:"S13 D20",  52:"S12 D20",  51:"S19 D16",  50:"S18 D16",
  49:"S9 D20",   48:"S16 D16",  47:"S15 D16",  46:"S14 D16",  45:"S13 D16",
  44:"S12 D16",  43:"S11 D16",  42:"S10 D16",  41:"S9 D16",
};

export const BOGEYS = [159, 162, 163, 165, 166, 168, 169];

/** Score of one path part ("T20", "S25", "Bull", "D25", "16"). */
export function partValue(p) {
  if (p === "Bull" || p === "D25") return 50;
  const m = /^([SDT]?)(\d+)$/.exec(p);
  if (!m) return NaN;
  const n = +m[2];
  return n * (m[1] === "T" ? 3 : m[1] === "D" ? 2 : 1);
}
/** True for a legal finishing dart (D1…D20 or Bull). */
export const isFinishPart = p => p === "Bull" || /^D([1-9]|1\d|20)$/.test(p);
const norm = p => (p === "D25" ? "Bull" : p);

// Odd rest ≤ 40: single onto one of these doubles (first that works).
const SETUP_DOUBLES = [20, 16, 8, 4, 2, 1];
// Solver (only reached for 2 darts and 101–110): finishing doubles in this
// order, setup darts single > treble > outer bull > double > bull.
const FINISH_ORDER = [20, 16, 8, 4, 2, 10, 12, 14, 18, 6, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map(n => `D${n}`).concat(["Bull"]);
const SETUP_ORDER = [
  ...Array.from({ length: 20 }, (_, i) => `S${20 - i}`),
  ...Array.from({ length: 20 }, (_, i) => `T${20 - i}`),
  "S25",
  ...Array.from({ length: 20 }, (_, i) => `D${20 - i}`),
  "Bull",
];

function solve(rest, darts, finishes = FINISH_ORDER) {
  for (const f of finishes) if (partValue(f) === rest) return [f];
  if (darts < 2) return null;
  for (const f of finishes) {
    const s = SETUP_ORDER.find(p => partValue(p) === rest - partValue(f));
    if (s) return [s, f];
  }
  if (darts < 3) return null;
  for (const f of finishes) for (const a of SETUP_ORDER) {
    const s = SETUP_ORDER.find(p => partValue(p) === rest - partValue(f) - partValue(a));
    if (s) return [a, s, f];
  }
  return null;
}

/** Fresh path (array of parts) for `rest` with `dartsLeft` darts, or null. */
function freshPath(rest, dartsLeft) {
  if (!Number.isInteger(rest) || rest < 2 || rest > 170 || dartsLeft < 1) return null;
  if (rest <= 40) {
    if (rest % 2 === 0) return [`D${rest / 2}`];
    if (dartsLeft < 2) return null;
    for (const d of SETUP_DOUBLES) {
      const s = rest - 2 * d;
      if (s >= 1 && s <= 20) return [`S${s}`, `D${d}`];
    }
    return null;
  }
  const poster = POSTER_TABLE[rest]?.split(" ").map(norm) || null;
  if (dartsLeft >= 3) return poster;
  if (poster && poster.length <= dartsLeft) return poster;
  return solve(rest, dartsLeft);
}

/**
 * Checkout path for `remaining` with `dartsLeft` darts (1–3), ignoring what
 * was thrown earlier in the turn. null = no checkout possible.
 * @returns {string|null} e.g. "T20 T20 Bull"
 */
export function getCheckoutPath(remaining, dartsLeft = 3) {
  const p = freshPath(remaining, dartsLeft);
  return p ? p.join(" ") : null;
}

/**
 * Path for the rest of the CURRENT turn: starts from the turn-start path and
 * keeps its remainder as long as every dart so far scored what that path
 * planned; after a deviation it re-plans for the new rest and darts left.
 * @param {number} turnStart remaining score at the start of the turn
 * @param {Array<{score:number}>} throws darts of this turn so far (misses/bouncers score 0)
 * @returns {string|null}
 */
export function getTurnCheckoutPath(turnStart, throws = []) {
  let rest = turnStart, left = 3;
  let plan = freshPath(rest, left);
  for (const t of throws.slice(0, 3)) {
    const v = +t?.score || 0;
    rest -= v; left--;
    if (plan && plan.length > 1 && partValue(plan[0]) === v) plan = plan.slice(1);
    else plan = freshPath(rest, left);
  }
  if (left < 1 || rest < 2) return null;
  return plan ? plan.join(" ") : null;
}

/**
 * Same dart count as the standard path, but finishing on one of the
 * player's preferred doubles (player profile, display only). Same setup
 * rule (singles first, never a double as setup dart). null if none / no
 * preference.
 */
export function getPreferredCheckoutPath(remaining, dartsLeft, prefDoubles) {
  if (!prefDoubles?.length) return null;
  const std = freshPath(remaining, dartsLeft);
  if (!std) return null;
  const finishes = prefDoubles.map(n => (n === 25 ? "Bull" : `D${n}`));
  if (finishes.includes(std[std.length - 1])) return null;   // standard already ends there
  const p = solve(remaining, std.length, finishes);
  // never trade the standard path for one with a double as setup dart
  if (!p || p.length !== std.length || p.slice(0, -1).some(x => x === "Bull" || x[0] === "D")) return null;
  return p.join(" ");
}

/**
 * CHECKOUT_TABLE[remaining] = {darts, path}: the turn-start (3-dart) path for
 * every remaining 2–170 that has one (= the spoken el_co_<remaining> clip).
 */
export const CHECKOUT_TABLE = Object.fromEntries(
  Array.from({ length: 169 }, (_, i) => i + 2)
    .map(r => [r, freshPath(r, 3)])
    .filter(([, p]) => p)
    .map(([r, p]) => [r, { darts: p.length, path: p.join(" ") }])
);
