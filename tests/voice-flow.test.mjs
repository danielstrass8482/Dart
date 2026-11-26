/**
 * voice-flow.test.mjs — announcements sound like one sentence, are not
 * repeated while a player's rest is unchanged, and survive Undo.
 * REAL playback (no audio stubs), Chromium and WebKit:
 *
 *   1. Gap: "Player 1 requires 121 · Checkout: …" — audible gap between the
 *      clips of the announcement (end of audible content of clip i → start of
 *      clip i+1). Measured from the actual output (tap on the app's Web Audio
 *      master bus) and from the schedule; must be < 100 ms. GAP_ONLY=1 only
 *      prints the gaps — also works against the old element-based code
 *      (BASE=<server of d86e24a>), where the gap = trailing silence of clip i
 *      + time from "ended" to "playing" + leading silence of clip i+1.
 *   2. Robustness: el_requires 404, el_num_121 corrupt, el_player_1 hanging
 *      → each skipped with "voice clip skipped: <key>", the rest plays, the
 *      queue carries on.
 *   3. Repeat rule X01 + Co-op: 0 points / bust → no "requires" for that
 *      player next time; points → new "requires" with the new path.
 *   4. Undo while the announcement plays → afterwards "Player 2 requires X"
 *      WITH the complete path; Undo after a completed announcement → the
 *      re-thrown state is announced again, with path.
 *
 * Usage: python3 -m http.server 8973 &  (repo root), then
 *   PLAYWRIGHT_BROWSERS_PATH=/var/tmp/pw node tests/voice-flow.test.mjs        (chromium)
 *   BROWSER=webkit PLAYWRIGHT_BROWSERS_PATH=/var/tmp/pw node tests/voice-flow.test.mjs
 */
import { chromium, webkit } from "playwright";

const BROWSER = process.env.BROWSER === "webkit" ? "webkit" : "chromium"; // Cloud Shell sets BROWSER=echo
const BASE = process.env.BASE || "http://localhost:8973";
const GAP_ONLY = !!process.env.GAP_ONLY;
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log("  FAIL", msg); } else console.log("  ok  ", msg); };

function cfgFor(mode, players, extra = {}) {
  return {
    mode, startScore: 301, ...extra,
    players, playerIds: players.map(() => null), isBot: players.map(() => false),
    totalSets: 1, setsToWin: 1, setWins: players.map(() => 0), currentSet: 1,
    totalLegs: 1, legsToWin: 1, legWins: players.map(() => 0), currentLeg: 1,
    rounds: 20, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual",
    accumulated: { turnScores: players.map(() => []), historicThrows: players.map(() => []), checkoutAttempts: players.map(() => 0),
      checkoutHits: players.map(() => 0), checkoutScores: players.map(() => []), first9: players.map(() => null) },
    legStatsHistory: [],
  };
}

async function openApp(browser, { routes } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(/recaptcha/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  if (routes) await routes(page);
  const warns = [], errors = [];
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "warn") warns.push(m.text()); });
  page.on("pageerror", (e) => { if (!/due to access control checks|^no recaptcha$/.test(e.message)) errors.push(e.message); });
  await page.addInitScript(() => {
    localStorage.setItem("dart_onboarding_done", "true");
    localStorage.setItem("dart_lang", "de");
    // Output tap: the app's first GainNode is its master bus → envelope of what is actually played.
    window.__env = []; window.__mediaEv = [];
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const cg = AC.prototype.createGain;
      AC.prototype.createGain = function () {
        const g = cg.call(this);
        if (!this.__tapped && this.createScriptProcessor) {
          this.__tapped = true;
          const sp = this.createScriptProcessor(1024, 1, 1);
          sp.onaudioprocess = (e) => {
            const d = e.inputBuffer.getChannelData(0), sr = e.inputBuffer.sampleRate;
            for (let o = 0; o < d.length; o += 128) {
              let pk = 0; for (let i = o; i < o + 128 && i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
              window.__env.push([e.playbackTime + o / sr, pk]);
            }
          };
          g.connect(sp); sp.connect(this.destination);
          window.__tapSR = this.sampleRate;
        }
        return g;
      };
    }
    // Old element-based code: when did each clip start/end, and which key is a blob URL?
    window.__urlKey = {};
    const blobKey = new WeakMap(), of = window.fetch.bind(window);
    window.fetch = async (...a) => {
      const r = await of(...a);
      const m = String(a[0]?.url || a[0]).match(/assets\/voice\/[^/]+\/([^/?]+)\.mp3/);
      if (m) { const ob = r.blob.bind(r); r.blob = async () => { const b = await ob(); blobKey.set(b, m[1]); return b; }; }
      return r;
    };
    const oc = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = oc(b); if (blobKey.has(b)) window.__urlKey[u] = blobKey.get(b); return u; };
    const op = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.__hooked) {
        this.__hooked = true;
        for (const ev of ["playing", "ended"]) this.addEventListener(ev, () => window.__mediaEv.push({ ev, t: performance.now(), src: this.currentSrc || this.src }));
      }
      return op.call(this);
    };
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    window.dartDB = { saveGame: async () => {}, saveCoopGame: async () => {}, loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [] };
    window.__x01 = await import("./js/x01.js?v=2");
    window.__state = (await import("./js/state.js")).state;
  });
  await page.mouse.click(5, 5); // user gesture → unlockAudio()
  await page.waitForTimeout(300);
  return { ctx, page, warns, errors };
}

const start = (page, cfg) => page.evaluate(async (cfg) => { window.__state.cfg = cfg; window.__state.allPlayers = []; await window.__x01.startX01(0); }, cfg);
/** ["h",label,score] hit, ["m"] miss, ["w",ms] wait, ["idle"] wait until no announcement is pending, ["undo"] */
async function play(page, steps) {
  for (const st of steps) {
    const [k, a, b] = st;
    if (k === "w") await page.waitForTimeout(a);
    else if (k === "idle") await waitIdle(page, a || 20000);
    else if (k === "undo") await page.evaluate(() => document.getElementById("x01-undo").click());
    else await page.evaluate(([k, a, b]) => {
      if (k === "h") window.__x01.processX01Hit({ label: a, score: b }, null, null);
      else window.__x01.processX01Hit({ label: "Miss", score: 0, miss: true }, null, null);
    }, [k, a, b]);
    await page.waitForTimeout(40);
  }
}
/** Waits until the queue has been idle for 3.5 s (announcements are scheduled up to 1.5 s after a visit, 3 s after a bust). */
async function waitIdle(page, max = 20000) {
  const t0 = Date.now(); let idleSince = null;
  while (Date.now() - t0 < max) {
    const idle = await page.evaluate(() => (window.__dtAudioIdle ? window.__dtAudioIdle() : true));
    if (idle) { idleSince ??= Date.now(); if (Date.now() - idleSince > 3500) return true; } else idleSince = null;
    await page.waitForTimeout(100);
  }
  return false;
}
const keys = (page) => page.evaluate(() => (window.__dtVoiceTrace || []).map((e) => e.key));
const traceLen = (page) => page.evaluate(() => (window.__dtVoiceTrace || []).length);
const keysFrom = async (page, n) => (await keys(page)).slice(n);
const T3 = [["h", "T20", 60], ["h", "T20", 60], ["h", "T20", 60]];

// ── 1. Gap ─────────────────────────────────────────────────────────────
async function testGap(browser) {
  console.log(`\n[${BROWSER}] 1. gap inside one announcement`);
  const { ctx, page } = await openApp(browser);
  await start(page, cfgFor("301", ["Anna", "Ben"]));
  await page.waitForTimeout(1500);
  await play(page, [...T3, ["idle"], ...T3, ["idle"], ["w", GAP_ONLY ? 9000 : 0]]);   // both on 121 → Player 1 requires 121 + path
  const r = await page.evaluate(() => {
    const env = window.__env || [];
    let tr = window.__dtVoiceTrace;
    if (!tr) tr = window.__mediaEv.filter((m) => m.ev === "playing").map((m) => ({ key: window.__urlKey[m.src] || m.src, url: m.src, mode: "element" }));
    const i = tr.findIndex((e) => e.key === "el_player_1");
    const parts = tr.slice(i, i + 4);
    return { parts, env, media: window.__mediaEv, origin: location.origin, tapSR: window.__tapSR };
  });
  const names = r.parts.map((p) => p.key);
  console.log("   announcement:", names.join(" · "));
  let gaps = [];
  if (r.parts[0]?.mode === "webaudio") {
    // schedule: audible end of i (−40 dB) → audible start of i+1
    const sched = r.parts.slice(1).map((p, j) => { const q = r.parts[j]; return ((p.when + (p.cs - p.offset)) - (q.when + (q.ce - q.offset))) * 1000; });
    // output: silent run (peak < 0.01) around each scheduled boundary
    const out = r.parts.slice(1).map((p, j) => {
      const q = r.parts[j], bnd = q.when + q.dur;
      const env = r.env.filter(([t]) => t > bnd - 0.15 && t < bnd + 0.15);
      if (env.length < 10) return null;
      let best = 0, runStart = null;
      for (const [t, pk] of env) {
        if (pk < 0.01) { runStart ??= t; best = Math.max(best, t - runStart + 128 / (r.tapSR || 48000)); }
        else runStart = null;
      }
      return best * 1000;
    });
    gaps = sched.map((s, j) => ({ pair: `${names[j]}→${names[j + 1]}`, scheduled: Math.round(s), output: out[j] == null ? null : Math.round(out[j]) }));
  } else {
    // element path (old code): trailing silence + ended→playing + leading silence
    const silence = await page.evaluate(async (srcs) => {
      const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const res = {};
      for (const s of srcs) {
        try {
          const ab = await (await fetch(s)).arrayBuffer();
          const buf = await new OC(1, 48000, 48000).decodeAudioData(ab);
          const d = buf.getChannelData(0); let a = 0, b = d.length - 1;
          while (a < d.length && Math.abs(d[a]) < 0.01) a++; while (b > a && Math.abs(d[b]) < 0.01) b--;
          res[s] = { lead: a / buf.sampleRate * 1000, trail: (d.length - 1 - b) / buf.sampleRate * 1000 };
        } catch (e) { res[s] = null; }
      }
      return res;
    }, [...new Set(r.media.map((m) => m.src))]);
    const plays = r.media.filter((m) => m.ev === "playing"), ends = r.media.filter((m) => m.ev === "ended");
    const seq = r.parts.map((p) => p.url);
    for (let j = 0; j + 1 < seq.length; j++) {
      const e = ends.find((m) => m.src === seq[j]), p = plays.find((m) => m.src === seq[j + 1] && (!e || m.t >= e.t));
      if (!e || !p) { gaps.push({ pair: `${names[j]}→${names[j + 1]}`, scheduled: null, output: null }); continue; }
      const sil = (silence[seq[j]]?.trail || 0) + (silence[seq[j + 1]]?.lead || 0);
      gaps.push({ pair: `${names[j]}→${names[j + 1]}`, endedToPlaying: Math.round(p.t - e.t), silence: Math.round(sil), output: Math.round(p.t - e.t + sil) });
    }
  }
  console.log("   gaps (ms):", JSON.stringify(gaps));
  console.log("   engine:", r.parts[0]?.mode, "| output samples:", r.env.length);
  if (!GAP_ONLY) {
    check(names.join(" ") === "el_player_1 el_requires el_num_121 el_co_121", `gap: one announcement Player 1 · requires · 121 · checkout (${names.join(" ")})`);
    check(r.parts[0]?.mode === "webaudio", `gap: played via Web Audio (${r.parts[0]?.mode})`);
    check(gaps.length === 3 && gaps.every((g) => g.scheduled != null && g.scheduled < 100), `gap: scheduled audible gaps < 100 ms ${JSON.stringify(gaps.map((g) => g.scheduled))}`);
    const measured = gaps.filter((g) => g.output != null);
    if (measured.length) check(measured.every((g) => g.output < 100), `gap: measured output gaps < 100 ms ${JSON.stringify(gaps.map((g) => g.output))}`);
    else console.log("   (no output samples in this browser — schedule only)");
  }
  await ctx.close();
  return gaps;
}

// ── 2. Robustness ──────────────────────────────────────────────────────
async function testRobust(browser) {
  console.log(`\n[${BROWSER}] 2. missing / corrupt / hanging clip`);
  const { ctx, page, warns } = await openApp(browser, { routes: async (page) => {
    await page.route(/\/assets\/voice\/george\/el_requires\.mp3/, (r) => r.fulfill({ status: 404, body: "" }));
    await page.route(/\/assets\/voice\/george\/el_num_121\.mp3/, (r) => r.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.from("this is not an mp3 ".repeat(200)) }));
    await page.route(/\/assets\/voice\/george\/el_player_1\.mp3/, () => {}); // never answers
  } });
  await start(page, cfgFor("301", ["Anna", "Ben"]));
  await page.waitForTimeout(1500);
  await play(page, [...T3, ["idle"], ...T3]);
  const n0 = await traceLen(page);
  const t0 = await page.evaluate(() => performance.now());     // visit just ended
  await play(page, [["w", 1600], ["idle", 30000]]);
  const k = await keysFrom(page, n0);
  // time from the end of the visit until the last clip of the sentence started:
  // 1.5 s announcement delay + ≤ 1.5 s grace for the hanging first clip (not the 8 s lookup timeout)
  const coAt = await page.evaluate((n0) => (window.__dtVoiceTrace || []).slice(n0).find((e) => e.key === "el_co_121")?.t, n0);
  const ms = coAt != null ? Math.round(coAt - t0) : null;
  check(k.includes("el_co_121") && !k.includes("el_player_1") && !k.includes("el_requires") && !k.includes("el_num_121"),
    `robust: rest of the sentence still plays (${k.join(" ")})`);
  for (const key of ["el_requires", "el_num_121", "el_player_1"])
    check(warns.some((w) => w.includes("voice clip skipped:") && w.includes(key)), `robust: "${key}" skipped with a warning`);
  check(ms != null && ms < 7000, `robust: hanging clip does not stall the sentence (path started ${ms} ms after the visit)`);
  const n1 = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);   // P1 0 points → "No Score!" plays afterwards
  check((await keysFrom(page, n1)).includes("el_no_score"), `robust: later announcements still play (${(await keysFrom(page, n1)).join(" ")})`);
  await ctx.close();
}

// ── 3. Repeat rule ─────────────────────────────────────────────────────
async function testRepeatX01(browser) {
  console.log(`\n[${BROWSER}] 3a. repeat rule X01`);
  const { ctx, page } = await openApp(browser);
  await start(page, cfgFor("301", ["Anna", "Ben"]));
  await page.waitForTimeout(1500);
  await play(page, [...T3, ["idle"], ...T3, ["idle"]]);                 // both on 121; P1's turn → "Player 1 requires 121"
  let k = await keys(page);
  check(k.filter((x) => x === "el_num_121").length === 1 && k.join(" ").includes("el_player_1 el_requires el_num_121 el_co_121"), `x01: P1 first time in range → requires 121 + path (${k.join(" ")})`);
  let n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P1 0 points → P2's first time on 121
  k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_2 el_requires el_num_121 el_co_121"), `x01: P2 first time in range → announced: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P2 0 points → P1 unchanged 121
  k = await keysFrom(page, n);
  check(!k.some((x) => /^el_player_|^el_requires$|^el_num_|^el_co_/.test(x)), `x01: P2 no score → nothing for P1 (unchanged): ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P1 0 points → P2 unchanged 121
  k = await keysFrom(page, n);
  check(!k.some((x) => /^el_player_|^el_requires$|^el_num_|^el_co_/.test(x)), `x01: P1 no score → nothing for P2 (unchanged): ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P2 0 points → P1 unchanged
  k = await keysFrom(page, n);
  check(!k.some((x) => /^el_player_|^el_requires$|^el_num_|^el_co_/.test(x)), `x01: again unchanged → still nothing: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["h", "20", 20], ["m"], ["m"], ["idle"]]);          // P1 → 101, P2 still 121 → nothing
  k = await keysFrom(page, n);
  check(!k.some((x) => /^el_player_|^el_requires$|^el_num_|^el_co_/.test(x)), `x01: P1 scores, P2's rest unchanged → nothing for P2: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["h", "1", 1], ["m"], ["m"], ["idle"]]);            // P2 → 120; P1 101 changed since 121 → announced
  k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_1 el_requires el_num_101 el_co_101"), `x01: P1's rest changed → "Player 1 requires 101" + new path: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["h", "T20", 60], ["h", "T20", 60], ["idle"]]);      // P1 101 → bust; P2 changed 121→120 → announced
  k = await keysFrom(page, n);
  check(k.includes("el_bust") && k.join(" ").includes("el_player_2 el_requires el_num_120 el_co_120"), `x01: P1 bust, P2 120 announced: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P2 0 → P1 still 101 (bust) → nothing
  k = await keysFrom(page, n);
  check(!k.some((x) => /^el_player_|^el_requires$|^el_num_|^el_co_/.test(x)), `x01: after P1's bust, P1's rest unchanged → nothing: ${k.join(" ")}`);
  await ctx.close();
}

async function testRepeatCoop(browser) {
  console.log(`\n[${BROWSER}] 3b. repeat rule Co-op`);
  const { ctx, page } = await openApp(browser);
  await start(page, cfgFor("Coop", ["Anna", "Ben"], { coop: { from: 80, to: 82 } }));
  await play(page, [["w", 1500], ["idle"]]);
  let k = await keys(page);
  check(k.join(" ").includes("el_player_1 el_requires el_num_80 el_co_80"), `coop: start "Player 1 requires 80" + path: ${k.join(" ")}`);
  let n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P1 0 → P2 first time on 80 → announced
  k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_2 el_requires el_num_80 el_co_80"), `coop: P2's first time on 80 → announced: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"], ["idle"]]);                     // P2 0 → P1 unchanged 80 → nothing
  k = await keysFrom(page, n);
  check(!k.some((x) => /^el_player_|^el_requires$|^el_num_|^el_co_/.test(x)), `coop: P2 no score → nothing for P1: ${k.join(" ")}`);
  n = await traceLen(page);
  await play(page, [["h", "20", 20], ["m"], ["m"], ["idle"]]);          // P1 → 60 → P2 changed
  k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_2 el_requires el_num_60 el_co_60"), `coop: points → "Player 2 requires 60" + path: ${k.join(" ")}`);
  await ctx.close();
}

// ── 4. Undo ────────────────────────────────────────────────────────────
async function testUndo(browser) {
  console.log(`\n[${BROWSER}] 4. Undo and announcements`);
  const { ctx, page } = await openApp(browser);
  await start(page, cfgFor("301", ["Anna", "Ben"]));
  await page.waitForTimeout(1500);
  // P1 301 → 121 (announced later), P2 301 → 103 is the target
  await play(page, [...T3, ["idle"], ["h", "T20", 60], ["h", "T20", 60], ["h", "T18", 54], ["idle"]]);  // P2 301-174 = 127
  // bring P2 to exactly 103: P1 scores 0, P2 scores 24
  await play(page, [["m"], ["m"], ["m"], ["idle"], ["h", "T8", 24], ["m"], ["m"], ["idle"]]);
  const sc = await page.evaluate(() => window.__state.x01.scores);
  check(sc[1] === 103, `undo setup: P2 on 103 (${sc})`);
  // a) Undo WHILE "Player 2 requires 103 …" plays
  await play(page, [["h", "20", 20], ["m"], ["m"]]);                     // P1 121 → 101, then P2's turn
  // wait until the P2 sentence has started, then Undo
  const t0 = Date.now();
  let n = await traceLen(page);
  while (Date.now() - t0 < 12000 && !(await keysFrom(page, n)).includes("el_player_2")) await page.waitForTimeout(30);
  await page.waitForTimeout(250);
  // 1st Undo takes back the visit end (P1 with 3 darts), 2nd the 3rd dart
  await play(page, [["undo"], ["w", 200], ["undo"], ["w", 300]]);
  const st = await page.evaluate(() => ({ cur: window.__state.x01.current, th: window.__state.x01.throws.length, ann: window.__state.x01.announced }));
  check(st.cur === 0 && st.th === 2, `undo a: back to P1 with 2 darts (${JSON.stringify(st)})`);
  check(!st.ann.some((a) => a.i === 1 && a.score === 103), `undo a: interrupted announcement does not count as said`);
  n = await traceLen(page);
  await play(page, [["m"], ["idle"]]);                                    // same 3rd dart again
  let k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_2 el_requires el_num_103 el_co_103"), `undo a: afterwards "Player 2 requires 103" WITH path: ${k.join(" ")}`);
  // b) Undo AFTER the announcement completed → re-thrown state announced again with path
  const ann = await page.evaluate(() => window.__state.x01.announced.filter((a) => a.i === 1 && a.score === 103).length);
  check(ann === 1, `undo b: completed announcement recorded (${ann})`);
  n = await traceLen(page);
  await play(page, [["undo"], ["w", 200], ["undo"], ["w", 300], ["m"], ["idle"]]);
  k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_2 el_requires el_num_103 el_co_103"), `undo b: same visit again → "Player 2 requires 103" with path: ${k.join(" ")}`);
  // c) Undo of P2's first dart (announcement complete): back to P2's turn start → not repeated
  n = await traceLen(page);
  await play(page, [["h", "1", 1], ["w", 200], ["undo"], ["w", 400], ["idle"]]);
  k = await keysFrom(page, n);
  check(!k.includes("el_num_103"), `undo c: Undo inside P2's visit (announcement complete) does not repeat it: ${k.join(" ")}`);
  // d) Undo during P2's sentence back into P2's own turn start → announced again completely
  await play(page, [["h", "1", 1], ["m"], ["m"], ["idle"]]);             // P2 103 → 102; P1 101 is announced (new)
  n = await traceLen(page);
  await play(page, [["m"], ["m"], ["m"]]);                                // P1 0 → P2 102 (changed) announced
  const t1 = Date.now();
  while (Date.now() - t1 < 12000 && !(await keysFrom(page, n)).includes("el_requires")) await page.waitForTimeout(30);
  await play(page, [["h", "2", 2], ["undo"], ["w", 300]]);               // P2 throws during the sentence, then Undo of that dart
  n = await traceLen(page);
  await play(page, [["idle"]]);
  k = await keysFrom(page, n);
  check(k.join(" ").includes("el_player_2 el_requires el_num_102 el_co_102"), `undo d: interrupted sentence comes again completely after Undo: ${k.join(" ")}`);
  await ctx.close();
}

const browser = await (BROWSER === "webkit" ? webkit : chromium).launch();
try {
  const gaps = await testGap(browser);
  if (!GAP_ONLY) {
    await testRobust(browser);
    await testRepeatX01(browser);
    await testRepeatCoop(browser);
    await testUndo(browser);
  }
} finally { await browser.close(); }
if (failures.length) { console.error(`\nFAILED [${BROWSER}] (${BASE}):\n - ` + failures.join("\n - ")); process.exit(1); }
console.log(`\nvoice-flow [${BROWSER}]: ${GAP_ONLY ? "gaps printed" : "all assertions passed"} (${BASE})`);
