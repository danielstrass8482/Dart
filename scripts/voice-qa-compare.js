/**
 * voice-qa-compare.js — tolerant comparison of an STT transcript against the
 * target text of a voice clip. Used by scripts/check-voice-clips.js.
 *
 * Tolerates: digits vs. number words ("Triple 20" = "Triple Twenty",
 * "one hundred and one" = "101"), homophones that STT writes for number words
 * ("won", "for", "ate", "too"), case, punctuation, "check out"/"checkout",
 * "bull's eye"/"bullseye", "10%"/"ten percent", compounds written apart
 * ("mad house"), filler sounds ("uh", "um"). Names are compared phonetically
 * (STT cannot know the spelling of "Jürgen"/"Abbie").
 *
 * Verdict: "ok" | "doubtful" | "error", plus human-readable reasons (German).
 *   error    = different/missing/extra NUMBER, or ≥2 inserted words, or ≥2
 *              missing words — i.e. the announcement says something else.
 *   doubtful = one non-number word differs/is missing/extra — could be an
 *              STT slip, needs a human ear.
 */
"use strict";

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
// STT homophones of number words (only ever mapped TO a number word)
const HOMOPHONES = { won: "one", too: "two", to: "two", for: "four", fore: "four", ate: "eight", fourty: "forty" };
const FILLERS = new Set(["uh", "um", "ah", "eh", "er", "erm", "hmm", "mm", "oh"]);

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
}

/** Lowercase, unify spellings, tokenize; numbers stay as words for now. */
function rawTokens(text) {
  let s = stripDiacritics(String(text || "")).toLowerCase();
  s = s.replace(/(\d)\s*%/g, "$1 percent").replace(/%/g, " percent").replace(/\bper\s*cent\b/g, "percent");
  s = s.replace(/\bbull'?s?[\s-]*eye\b/g, "bullseye");
  s = s.replace(/\bcheck[\s-]*out\b/g, "checkout");
  s = s.replace(/\b([tdTD])(\d{1,2})\b/g, (_, l, n) => (l.toLowerCase() === "t" ? "triple " : "double ") + n);
  s = s.replace(/(\d),(\d{3})/g, "$1$2");
  s = s.replace(/[-–—_/]/g, " ").replace(/[^a-z0-9' ]+/g, " ").replace(/'/g, "");
  return s.split(/\s+/).filter(Boolean).filter(t => !FILLERS.has(t)).map(t => HOMOPHONES[t] || t);
}

/** Collapses number-word runs (and digit tokens) into decimal tokens: "one hundred and one" → "101". */
function foldNumbers(tokens) {
  const out = [];
  let g = null; // { val, hundred, last: 'unit'|'teen'|'tens'|'hundred'|'digits' }
  const flush = () => { if (g) { out.push(String(g.val)); g = null; } };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], next = tokens[i + 1];
    const isNumWord = w => w != null && (w in UNITS || w in TEENS || w in TENS || w === "hundred" || /^\d+$/.test(w));
    if (t === "a" && next === "hundred") { flush(); g = { val: 1, hundred: false, last: "unit" }; continue; }
    if (t === "and" && g && g.hundred && g.val % 100 === 0 && isNumWord(next) && next !== "hundred") continue;
    if (t in UNITS) {
      const u = UNITS[t];
      if (g && ((g.hundred && g.val % 100 === 0) || (g.last === "tens" && g.val % 10 === 0))) { g.val += u; g.last = "unit"; }
      else { flush(); g = { val: u, hundred: false, last: "unit" }; }
    } else if (t in TEENS) {
      if (g && g.hundred && g.val % 100 === 0) { g.val += TEENS[t]; g.last = "teen"; }
      else { flush(); g = { val: TEENS[t], hundred: false, last: "teen" }; }
    } else if (t in TENS) {
      if (g && g.hundred && g.val % 100 === 0) { g.val += TENS[t]; g.last = "tens"; }
      else { flush(); g = { val: TENS[t], hundred: false, last: "tens" }; }
    } else if (t === "hundred") {
      if (g && g.last === "unit" && g.val < 10 && !g.hundred) { g.val *= 100; g.hundred = true; g.last = "hundred"; }
      else { flush(); g = { val: 100, hundred: true, last: "hundred" }; }
    } else if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (g && g.hundred && g.val % 100 === 0 && n < 100) { g.val += n; g.last = "digits"; }
      else { flush(); g = { val: n, hundred: n >= 100, last: "digits" }; }
    } else { flush(); out.push(t); }
  }
  flush();
  return out;
}

function normalizeTokens(text) { return foldNumbers(rawTokens(text)); }

function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d;
}
function strSim(a, b) { const L = Math.max(a.length, b.length); return L ? 1 - lev([...a], [...b])[a.length][b.length] / L : 1; }

/** Token alignment → lists of substitutions, insertions (in transcript only), deletions (missing from transcript). */
function align(exp, got) {
  const d = lev(exp, got), subs = [], ins = [], del = [];
  let i = exp.length, j = got.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (exp[i - 1] === got[j - 1] ? 0 : 1)) {
      if (exp[i - 1] !== got[j - 1]) subs.unshift([exp[i - 1], got[j - 1]]);
      i--; j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) { ins.unshift(got[j - 1]); j--; }
    else { del.unshift(exp[i - 1]); i--; }
  }
  return { subs, ins, del };
}

const isNum = t => /^\d+$/.test(t);

/** Crude phonetic key for first names (spelling-agnostic). */
function nameKey(s) {
  let k = stripDiacritics(s).toLowerCase().replace(/[^a-z]/g, "");
  k = k.replace(/ph/g, "f").replace(/th/g, "t").replace(/ck|q|c/g, "k").replace(/ie\b|ee|ea|y/g, "i")
       .replace(/z/g, "s").replace(/w/g, "v").replace(/(?!^)h/g, "").replace(/(.)\1+/g, "$1").replace(/e$/, "");
  return k;
}

function compareName(expectedText, transcript) {
  const exp = rawTokens(expectedText), got = rawTokens(transcript);
  const reasons = [];
  if (!got.length) return { verdict: "error", reasons: ["kein Wort erkannt"] };
  const extra = got.length - exp.length;
  if (extra >= 2) return { verdict: "error", reasons: [`${extra} zusätzliche Wörter`] };
  const e = exp.join(""), g = got.join("");
  if (e === g || nameKey(e) === nameKey(g)) {
    if (extra === 1) return { verdict: "doubtful", reasons: ["1 zusätzliches Wort"] };
    return { verdict: "ok", reasons };
  }
  const sim = Math.max(strSim(e, g), strSim(nameKey(e), nameKey(g)));
  if (extra === 1) reasons.push("1 zusätzliches Wort");
  if (sim >= 0.75 && !extra) return { verdict: "ok", reasons: [] };
  reasons.push(`Name abweichend erkannt (Ähnlichkeit ${sim.toFixed(2)})`);
  return { verdict: "doubtful", reasons };
}

/**
 * Whisper writes "double eight" as "88" and "triple one" as "111" (phone-
 * number style), and drops separators: "Seven, Double Eight" → "788",
 * "Triple One, Double Eight" → "111E88". Compare such transcripts on their
 * digit string: expected "double N" may appear as N or NN, "triple N" as N,
 * NN or NNN. Returns "ok" (digits match, no foreign words), "ambiguous"
 * (digit garble without foreign words — needs an ear, not an error), or null.
 */
function digitForm(exp, got) {
  const gotDigits = got.join(" ").replace(/[^0-9]/g, "");
  if (!gotDigits || !exp.some(isNum)) return null;
  let re = "";
  for (let i = 0; i < exp.length; i++) {
    if (!isNum(exp[i])) continue;
    const n = exp[i].replace(/[.*+?^${}()|[\]\\]/g, ""), prev = exp[i - 1];
    re += prev === "double" ? `(?:${n}){1,2}` : prev === "triple" ? `(?:${n}){1,3}` : n;
  }
  const allowed = new Set(exp.filter(t => !isNum(t)).concat(["and", "d", "t", "e"]));
  const foreign = got.filter(t => !/\d/.test(t) && !allowed.has(t));
  if (foreign.length) return null;
  if (new RegExp(`^${re}$`).test(gotDigits)) return "ok";
  // Only a MERGED digit run is ambiguous; more/equal separate numbers than
  // expected means a number was actually said differently → normal check.
  const gotNums = got.filter(t => /\d/.test(t)).length, expNums = exp.filter(isNum).length;
  return gotNums < expNums ? "ambiguous" : null;
}

function compareText(expectedText, transcript) {
  const exp = normalizeTokens(expectedText), got = normalizeTokens(transcript);
  if (!got.length) return { verdict: "error", reasons: ["kein Wort erkannt"] };
  if (exp.join(" ") === got.join(" ") || exp.join("") === got.join("")) return { verdict: "ok", reasons: [] };
  const df = digitForm(exp, got);
  if (df === "ok") return { verdict: "ok", reasons: [] };
  if (df === "ambiguous") return { verdict: "doubtful", reasons: [`Zahlen nur als Ziffernfolge erkannt („${got.join(" ")}“) — nachhören`] };
  const { subs, ins, del } = align(exp, got);
  const reasons = [];
  let verdict = "doubtful";
  const numSubs = subs.filter(([a, b]) => isNum(a) || isNum(b));
  const numIns = ins.filter(isNum), numDel = del.filter(isNum);
  if (numSubs.length) { verdict = "error"; reasons.push("falsche Zahl: " + numSubs.map(([a, b]) => `${a}→${b}`).join(", ")); }
  if (numIns.length) { verdict = "error"; reasons.push("zusätzliche Zahl: " + numIns.join(", ")); }
  if (numDel.length) { verdict = "error"; reasons.push("fehlende Zahl: " + numDel.join(", ")); }
  const wIns = ins.filter(t => !isNum(t)), wDel = del.filter(t => !isNum(t)), wSubs = subs.filter(([a, b]) => !isNum(a) && !isNum(b));
  if (wIns.length) { reasons.push(`zusätzlich: „${wIns.join(" ")}“`); if (wIns.length >= 2) verdict = "error"; }
  if (wDel.length) { reasons.push(`fehlt: „${wDel.join(" ")}“`); if (wDel.length >= 2) verdict = "error"; }
  if (wSubs.length) {
    reasons.push("abweichend: " + wSubs.map(([a, b]) => `${a}→${b}`).join(", "));
    if (wSubs.length >= 2 || wSubs.length + wIns.length + wDel.length >= 3) verdict = "error";
  }
  return { verdict, reasons };
}

/** kind: "name" | "vocab" */
function compare(expectedText, transcript, kind) {
  return kind === "name" ? compareName(expectedText, transcript) : compareText(expectedText, transcript);
}

const RANK = { ok: 0, doubtful: 1, error: 2 };

module.exports = { compare, normalizeTokens, rawTokens, nameKey, RANK };
