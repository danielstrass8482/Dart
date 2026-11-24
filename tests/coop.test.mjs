/**
 * coop.test.mjs — "Co-op Checkout" mode (js/coop.js on the X01 engine).
 *
 * Runs against the real app modules + real buttons (Undo, Bouncer, Back,
 * setup steppers/start) with a mocked window.dartDB that records saves:
 *   1. setup UI: mode button, start/end steppers (skip non-checkoutable
 *      values, start ≤ end), hint, "min. 2 players", start through btn-start
 *   2. full run 80–82 with 2 players (one dart via a real board tap):
 *      darts per value 4/3/2, total 9, Ø 3, darts/checkouts per player,
 *      game time, result overlay, saved ONLY via saveCoopGame (never saveGame)
 *   3. rest hand-over 80 → 73 scored → player 2 checks out 7
 *   4. bust (rest 1 and overshoot): visit void, rest unchanged, next player,
 *      bust darts count
 *   5. undo inside a value + undo across a checkout (back to previous value,
 *      finisher, rest, results) and continuing correctly afterwards
 *   6. bouncer counts as a thrown dart (and can be undone)
 *   7. back button asks for confirmation while running, not after the end
 *   8. layout on iPad landscape / iPad portrait / phone: target, rest, player
 *      at the oche and progress visible, inside the viewport, not overlapping
 *      the board; board size reported (SHOTS=<dir> also writes screenshots)
 *
 * Usage: python3 -m http.server 8973 &  (repo root), then
 *   node tests/coop.test.mjs        → exit 0 = all assertions passed
 *   BASE=https://play.darttrainer.app node tests/coop.test.mjs   (live)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8973";
const SHOTS = process.env.SHOTS || null;
const VIEWPORTS = [
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 844, height: 390 },
];
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

async function openApp(browser, vp, lang = "de", tts = false) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript((l) => {
    localStorage.setItem("dart_onboarding_done", "true");
    localStorage.setItem("dart_lang", l.l);
    if (!l.tts) localStorage.setItem("dart_tts_enabled", "false"); // no clip downloads needed for logic tests
  }, { l: lang, tts });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.__errors = errors;
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise); // splash covers the screen for ~2.5 s
  // Let the auth bootstrap settle (it switches to the auth screen once).
  await page.waitForFunction(() => document.querySelector(".screen.active")?.id === "auth-screen", null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    window.__saved = { x01: [], coop: [] };
    window.dartDB = {
      saveGame: async (d) => { window.__saved.x01.push(JSON.parse(JSON.stringify(d))); },
      saveCoopGame: async (d) => { window.__saved.coop.push(JSON.parse(JSON.stringify(d))); },
      loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [],
    };
    const m = await import("./js/x01.js?v=2");
    const { state } = await import("./js/state.js");
    window.__x01 = m; window.__state = state;
  });
  return page;
}

function baseCfg(players, from, to) {
  return {
    mode: "Coop", coop: { from, to }, startScore: 501,
    players, playerIds: players.map(() => null), isBot: players.map(() => false),
    totalSets: 1, setsToWin: 1, setWins: players.map(() => 0), currentSet: 1,
    totalLegs: 1, legsToWin: 1, legWins: players.map(() => 0), currentLeg: 1,
    rounds: 20, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual",
    accumulated: { turnScores: players.map(() => []), historicThrows: players.map(() => []), checkoutAttempts: players.map(() => 0),
      checkoutHits: players.map(() => 0), checkoutScores: players.map(() => []), first9: players.map(() => null) },
    legStatsHistory: [],
  };
}

/** Starts a co-op game directly through startX01 (setup UI is covered separately). */
async function startGame(page, players, from, to) {
  await page.evaluate(async ({ cfg }) => {
    window.__state.cfg = cfg; window.__state.allPlayers = [];
    await window.__x01.startX01(0);
  }, { cfg: baseCfg(players, from, to) });
}

/** Runs a script of actions in the page: ["h",label,score] hit, ["m"] miss, ["b"] bouncer, ["u"] undo, ["w",ms] wait. */
async function play(page, steps) {
  return page.evaluate(async (steps) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const [k, a, b] of steps) {
      if (k === "h") window.__x01.processX01Hit({ label: a, score: b }, null, null);
      else if (k === "m") window.__x01.processX01Hit({ label: "Miss", score: 0, miss: true }, null, null);
      else if (k === "b") document.getElementById("bottom-bouncer").click();
      else if (k === "u") document.getElementById("x01-undo").click();
      else if (k === "w") await sleep(a);
      await sleep(25);
    }
  }, steps);
}

/** Snapshot of the visible co-op state. */
async function snap(page) {
  return page.evaluate(() => {
    const x = window.__state.x01, c = x.coop;
    const spent = x.throws.reduce((s, t) => s + t.score, 0);
    return {
      value: c.values[c.idx], idx: c.idx, current: x.current, scores: [...x.scores],
      rest: Math.max(0, x.scores[x.current] - spent), throws: x.throws.map((t) => t.label),
      results: c.results.map((r) => [r.value, r.darts, r.by]), checkouts: [...c.checkouts],
      darts: window.__state.cfg.players.map((_, i) => window.__x01.legDarts(i)),
      winner: x.winner, bust: x.bust,
      shownRest: document.querySelector('#score-strip [data-coop="rest"]')?.textContent ?? document.querySelector("#lp-players .lp-score")?.textContent,
      shownTarget: document.querySelector('[data-coop="target"]')?.textContent ?? document.querySelector('[data-coop="lp-target"]')?.textContent,
      title: document.getElementById("x01-title").textContent,
      overlay: document.getElementById("coop-overlay").classList.contains("visible"),
    };
  });
}

/** Client coordinates of a board segment (scans the real SVG via the app's own hit test). */
async function boardPoint(page, label) {
  return page.evaluate(async (label) => {
    const { hitFromXY, svgCoords } = await import("./js/board.js?v=2");
    const svg = document.getElementById("board-svg");
    const r = svg.getBoundingClientRect();
    for (let y = r.top + 4; y < r.bottom; y += 3) for (let x = r.left + 4; x < r.right; x += 3) {
      const p = svgCoords(svg, { clientX: x, clientY: y });
      const h = hitFromXY(p.x, p.y);
      if (h && h.label === label) {
        // prefer the middle of the segment: keep scanning a few px further on this row
        let x2 = x; while (x2 < r.right) { const q = svgCoords(svg, { clientX: x2 + 3, clientY: y }); const h2 = hitFromXY(q.x, q.y); if (!h2 || h2.label !== label) break; x2 += 3; }
        return { x: (x + x2) / 2, y: y + 4 };
      }
    }
    return null;
  }, label);
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function testSetupUI(browser) {
  const page = await openApp(browser, VIEWPORTS[0]);
  const r = await page.evaluate(async () => {
    const out = {};
    const { state } = await import("./js/state.js");
    window.showScreen("setup");
    document.getElementById("spielen-cards").style.display = "none";
    document.getElementById("spielen-lokal").classList.add("active");
    document.getElementById("btn-extra-modes").click();
    const btn = document.querySelector('#extra-mode-group [data-value="Coop"]');
    out.hasButton = !!btn;
    btn.click();
    const card = document.querySelector("#spielen-lokal .setup-card");
    out.selectorShown = getComputedStyle(document.getElementById("coop-selector")).display !== "none";
    out.setsHidden = getComputedStyle(document.getElementById("sets-group")).display === "none";
    out.botHidden = getComputedStyle(document.getElementById("bot-group")).display === "none";
    out.coopMode = card.classList.contains("coop-mode");
    const from = document.getElementById("coop-from"), to = document.getElementById("coop-to");
    const hint = () => document.getElementById("coop-range-hint").textContent;
    out.defaults = [from.value, to.value, hint()];
    // typed non-checkoutable value snaps up (159 → 160); end follows start
    from.value = "159"; from.dispatchEvent(new Event("change"));
    out.snap159 = [from.value, to.value];
    // stepping end up from 160 skips 162/163 → 161 → 164
    document.querySelector('[data-coop-step="to"][data-dir="1"]').click();
    document.querySelector('[data-coop-step="to"][data-dir="1"]').click();
    out.stepTo = [from.value, to.value];
    // end below start pulls start down
    to.value = "100"; to.dispatchEvent(new Event("change"));
    out.endBelow = [from.value, to.value];
    // 155–170: shows which values are skipped
    from.value = "155"; from.dispatchEvent(new Event("change"));
    to.value = "170"; to.dispatchEvent(new Event("change"));
    out.hint155 = hint();
    to.value = "999"; to.dispatchEvent(new Event("change"));
    out.clampMax = to.value;
    from.value = "1"; from.dispatchEvent(new Event("change"));
    out.clampMin = from.value;
    // back to 80–82 for the start test
    from.value = "80"; from.dispatchEvent(new Event("change"));
    to.value = "82"; to.dispatchEvent(new Event("change"));
    // 1 player → alert, no game
    state.selectedPlayers = [{ id: null, name: "Anna" }];
    document.getElementById("btn-start").click();
    await new Promise((r) => setTimeout(r, 300));
    out.alert1 = document.getElementById("app-modal-msg")?.textContent || "";
    document.getElementById("app-modal-ok")?.click();
    out.screenAfter1 = document.querySelector(".screen.active")?.id;
    // 2 players → game starts
    state.selectedPlayers = [{ id: null, name: "Anna" }, { id: null, name: "Ben" }];
    document.getElementById("btn-start").click();
    await new Promise((r) => setTimeout(r, 400));
    out.screen = document.querySelector(".screen.active")?.id;
    out.cfg = { mode: state.cfg.mode, coop: state.cfg.coop, players: state.cfg.players, isBot: state.cfg.isBot };
    out.values = state.x01.coop?.values;
    out.scores = state.x01.scores;
    // switching back to 501 hides the co-op options again
    window.showScreen("setup");
    document.querySelector('#mode-group [data-value="501"]').click();
    out.after501 = [getComputedStyle(document.getElementById("coop-selector")).display, card.classList.contains("coop-mode")];
    return out;
  });
  check(r.hasButton, "setup: Co-op button missing");
  check(r.selectorShown && r.coopMode && r.setsHidden && r.botHidden, `setup: co-op options/hiding wrong ${JSON.stringify(r)}`);
  check(eq(r.defaults.slice(0, 2), ["80", "90"]) && /11 Werte/.test(r.defaults[2]), `setup: defaults ${JSON.stringify(r.defaults)}`);
  check(eq(r.snap159, ["160", "160"]), `setup: 159 should snap to 160 (end follows): ${JSON.stringify(r.snap159)}`);
  check(eq(r.stepTo, ["160", "164"]), `setup: stepping end should skip 162/163: ${JSON.stringify(r.stepTo)}`);
  check(eq(r.endBelow, ["100", "100"]), `setup: end below start: ${JSON.stringify(r.endBelow)}`);
  check(/9 Werte/.test(r.hint155) && /159, 162, 163, 165, 166, 168, 169/.test(r.hint155), `setup: hint 155–170: ${r.hint155}`);
  check(r.clampMax === "170" && r.clampMin === "2", `setup: clamp ${r.clampMax}/${r.clampMin}`);
  check(/mindestens 2 Spieler/.test(r.alert1) && r.screenAfter1 === "setup", `setup: 1-player alert ${JSON.stringify([r.alert1, r.screenAfter1])}`);
  check(r.screen === "x01" && r.cfg.mode === "Coop" && eq(r.cfg.coop, { from: 80, to: 82 }) && eq(r.values, [80, 81, 82]) && eq(r.scores, [80, 80]),
    `setup: start ${JSON.stringify(r)}`);
  check(eq(r.after501, ["none", false]), `setup: back to 501 ${JSON.stringify(r.after501)}`);
  check(!page.__errors.length, `setup: page errors ${page.__errors.join(" | ")}`);
  await page.close();
}

async function testFullRun(browser) {
  const page = await openApp(browser, VIEWPORTS[0]);
  await startGame(page, ["Anna", "Ben"], 80, 82);
  const t0 = Date.now();
  const s0 = await snap(page);
  check(s0.value === 80 && s0.current === 0 && s0.shownRest === "80" && s0.shownTarget === "80", `run: start ${JSON.stringify(s0)}`);
  // 80: Anna 20 (real board tap) 20 20 → 20 | Ben D10 → 4 darts
  const pt = await boardPoint(page, "20");
  check(!!pt, "run: could not find segment 20 on the board");
  if (pt) await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(60);
  const tapped = await snap(page);
  check(eq(tapped.throws, ["20"]) && tapped.rest === 60, `run: board tap ${JSON.stringify(tapped)}`);
  await play(page, [["h", "20", 20], ["h", "20", 20], ["w", 1100], ["h", "D10", 20], ["w", 50]]);
  const s1 = await snap(page);
  check(s1.value === 81 && s1.current === 0 && eq(s1.scores, [81, 81]) && eq(s1.results, [[80, 4, 1]]) && s1.shownTarget === "81" && s1.shownRest === "81",
    `run: after 80 (next player after finisher Ben = Anna starts 81) ${JSON.stringify(s1)}`);
  // 81: Anna T19 4 D10 → 3 darts
  await play(page, [["h", "T19", 57], ["h", "4", 4], ["h", "D10", 20], ["w", 50]]);
  const s2 = await snap(page);
  check(s2.value === 82 && s2.current === 1 && eq(s2.results, [[80, 4, 1], [81, 3, 0]]), `run: after 81 ${JSON.stringify(s2)}`);
  await page.waitForTimeout(700); // measurable game time
  // 82: Ben Bull D16 → 2 darts, game over
  await play(page, [["h", "Bull", 50], ["h", "D16", 32], ["w", 300]]);
  const elapsed = (Date.now() - t0) / 1000;
  const s3 = await snap(page);
  check(s3.overlay && s3.winner === 1 && eq(s3.results, [[80, 4, 1], [81, 3, 0], [82, 2, 1]]), `run: end ${JSON.stringify(s3)}`);
  const res = await page.evaluate(() => ({
    total: document.querySelector('[data-coop-kpi="total"]')?.textContent,
    avg: document.querySelector('[data-coop-kpi="avg"]')?.textContent,
    sec: +document.querySelector('[data-coop-kpi="time"]')?.dataset.sec,
    time: document.querySelector('[data-coop-kpi="time"]')?.textContent,
    values: [...document.querySelectorAll(".coop-res-values tr[data-coop-v]")].map((tr) => [tr.dataset.coopV, tr.dataset.darts]),
    players: [...document.querySelectorAll(".coop-res-players tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent)),
    saved: window.__saved,
    boardDisabled: document.getElementById("board-svg").style.pointerEvents,
  }));
  check(res.total === "9" && res.avg === "3", `result: total/avg ${res.total}/${res.avg}`);
  check(eq(res.values, [["80", "4"], ["81", "3"], ["82", "2"]]), `result: per value ${JSON.stringify(res.values)}`);
  check(eq(res.players, [["Anna", "6", "1"], ["Ben", "3", "2"]]), `result: per player ${JSON.stringify(res.players)}`);
  // startTs is taken before the (here silent) Game-on clip; allow ±2 s
  check(Math.abs(res.sec - elapsed) <= 2 && /^\d+:\d\d$/.test(res.time), `result: game time ${res.sec}s (${res.time}) vs measured ${elapsed.toFixed(1)}s`);
  check(res.saved.x01.length === 0, `save: co-op must not use saveGame (dart_games), got ${res.saved.x01.length}`);
  check(res.saved.coop.length === 1, `save: expected 1 saveCoopGame, got ${res.saved.coop.length}`);
  const doc = res.saved.coop[0] || {};
  check(doc.mode === "Coop" && doc.totalDarts === 9 && doc.avgDarts === 3 && eq(doc.values?.map((v) => [v.value, v.darts, v.by]), [[80, 4, "Ben"], [81, 3, "Anna"], [82, 2, "Ben"]])
    && eq(doc.players?.map((p) => [p.name, p.darts, p.checkouts]), [["Anna", 6, 1], ["Ben", 3, 2]]) && Math.abs(doc.durationSec - elapsed) <= 2
    && doc.avg3 === undefined && !doc.players?.some((p) => "avg3" in p || "checkoutAtt" in p),
  `save: doc ${JSON.stringify(doc)}`);
  // back button after the end: no confirmation
  let dialogs = 0; page.on("dialog", (d) => { dialogs++; d.dismiss(); });
  await page.evaluate(() => { document.getElementById("coop-overlay").classList.remove("visible"); document.getElementById("x01-back").click(); });
  await page.waitForTimeout(200);
  check(dialogs === 0 && (await page.evaluate(() => document.querySelector(".screen.active")?.id)) === "setup", "back after end: should leave without confirmation");
  // "play again" restarts the same range
  await page.evaluate(() => { document.getElementById("btn-coop-again").click(); });
  await page.waitForTimeout(400);
  const again = await snap(page);
  check(again.value === 80 && eq(again.results, []) && !again.overlay && again.winner === null, `play again: ${JSON.stringify(again)}`);
  check(!page.__errors.length, `run: page errors ${page.__errors.join(" | ")}`);
  await page.close();
}

async function testHandoverBustUndoBouncer(browser) {
  const page = await openApp(browser, VIEWPORTS[2]);
  await startGame(page, ["Anna", "Ben"], 80, 82);
  // Hand-over: Anna scores 73 (T19 + 16 + miss) → Ben needs 7 → 3, D2
  await play(page, [["h", "T19", 57], ["h", "16", 16], ["m"], ["w", 1000]]);
  const h1 = await snap(page);
  check(h1.current === 1 && h1.rest === 7 && eq(h1.scores, [7, 7]) && h1.shownRest === "7" && h1.value === 80, `handover: Ben must face 7 ${JSON.stringify(h1)}`);
  await play(page, [["h", "3", 3], ["h", "D2", 4], ["w", 50]]);
  const h2 = await snap(page);
  check(eq(h2.results, [[80, 5, 1]]) && h2.value === 81 && h2.current === 0, `handover: checkout 7 ${JSON.stringify(h2)}`);

  // Bust (rest 1): 81 Anna 20,20,20 → 21 | Ben 20 → 1 = bust → rest stays 21, Anna next
  await play(page, [["h", "20", 20], ["h", "20", 20], ["h", "20", 20], ["w", 1000], ["h", "20", 20], ["w", 1800]]);
  const b1 = await snap(page);
  check(b1.current === 0 && b1.rest === 21 && eq(b1.scores, [21, 21]) && b1.value === 81, `bust(1): rest must stay 21 ${JSON.stringify(b1)}`);
  // Bust (overshoot): Anna T20 → bust → Ben with 21
  await play(page, [["h", "T20", 60], ["w", 1800]]);
  const b2 = await snap(page);
  check(b2.current === 1 && b2.rest === 21 && b2.value === 81, `bust(over): ${JSON.stringify(b2)}`);
  // Bust (no double): Ben 1 then 20 → 0 with a single = bust
  await play(page, [["h", "1", 1], ["h", "20", 20], ["w", 1800]]);
  const b3 = await snap(page);
  check(b3.current === 0 && b3.rest === 21, `bust(single out): ${JSON.stringify(b3)}`);
  // Darts so far in 81: Anna 3 + Ben 1 (bust) + Anna 1 (bust) + Ben 2 (bust) = 7
  // Undo inside a value: Anna 5 → undo → rest 21 again, dart not counted
  await play(page, [["h", "5", 5], ["u"]]);
  const u1 = await snap(page);
  check(u1.rest === 21 && eq(u1.throws, []) && u1.current === 0, `undo in value: ${JSON.stringify(u1)}`);
  // Bouncer counts as a dart: Anna bouncer, 1, D10 → checkout 81 with 3 darts this visit
  await play(page, [["b"], ["h", "1", 1], ["h", "D10", 20], ["w", 50]]);
  const c81 = await snap(page);
  check(eq(c81.results, [[80, 5, 1], [81, 10, 0]]) && c81.value === 82 && c81.current === 1 && c81.rest === 82,
    `bouncer + checkout 81 (3+1+1+2+3 = 10 darts) ${JSON.stringify(c81)}`);
  const dartsBefore = c81.darts;
  // Undo across the checkout → back to 81, Anna, rest 20 after bouncer+1, results without 81
  await play(page, [["u"]]);
  const x1 = await snap(page);
  check(x1.value === 81 && x1.current === 0 && x1.rest === 20 && eq(x1.throws, ["↩", "1"]) && eq(x1.results, [[80, 5, 1]]) && eq(x1.checkouts, [0, 1])
    && x1.shownTarget === "81" && x1.shownRest === "20", `undo across checkout: ${JSON.stringify(x1)}`);
  // second undo removes the "1", third the bouncer (bouncer is undoable too)
  await play(page, [["u"], ["u"]]);
  const x2 = await snap(page);
  check(x2.rest === 21 && eq(x2.throws, []) && x2.value === 81, `undo bouncer: ${JSON.stringify(x2)}`);
  // continue: Anna D... 21 → 1, D10 (3 darts: 1, D10 = 2 darts) → 81 needs 7+2 = 9
  await play(page, [["h", "1", 1], ["h", "D10", 20], ["w", 50]]);
  const x3 = await snap(page);
  check(eq(x3.results, [[80, 5, 1], [81, 9, 0]]) && x3.value === 82 && x3.current === 1, `after undo continue: ${JSON.stringify(x3)}`);
  check(x3.darts[0] === dartsBefore[0] - 1, `after undo: Anna darts ${x3.darts[0]} should be one less than ${dartsBefore[0]} (bouncer undone)`);
  // Undo across checkout twice in a row back into the previous value, then redo the checkout
  await play(page, [["h", "Bull", 50], ["h", "D16", 32], ["w", 300]]);
  const end = await snap(page);
  check(end.overlay && eq(end.results, [[80, 5, 1], [81, 9, 0], [82, 2, 1]]), `end: ${JSON.stringify(end)}`);
  const saved = await page.evaluate(() => window.__saved);
  check(saved.x01.length === 0 && saved.coop.length === 1 && saved.coop[0].totalDarts === 16, `save after undo run: ${JSON.stringify(saved.coop[0]?.values)}`);
  check(!page.__errors.length, `handover/bust/undo: page errors ${page.__errors.join(" | ")}`);
  await page.close();
}

async function testBackConfirm(browser) {
  const page = await openApp(browser, VIEWPORTS[0]);
  await startGame(page, ["Anna", "Ben", "Cleo"], 2, 4);
  const msgs = [];
  page.on("dialog", (d) => { msgs.push(d.message()); d.dismiss(); });
  await page.click("#x01-back");
  await page.waitForTimeout(200);
  const stay = await page.evaluate(() => document.querySelector(".screen.active")?.id);
  check(msgs.length === 1 && /verlassen/.test(msgs[0]) && stay === "x01", `back while running: ${JSON.stringify({ msgs, stay })}`);
  // 3 players, value 2: Anna D1 → 3 (next: Ben) → Ben 1, D1 → 4 (Cleo) → Cleo D2
  await play(page, [["h", "D1", 2], ["w", 50], ["h", "1", 1], ["h", "D1", 2], ["w", 50]]);
  const s = await snap(page);
  check(s.value === 4 && s.current === 2 && eq(s.results, [[2, 1, 0], [3, 2, 1]]), `3 players rotation: ${JSON.stringify(s)}`);
  check(!page.__errors.length, `back: page errors ${page.__errors.join(" | ")}`);
  await page.close();
}

async function testLayout(browser) {
  const metrics = {};
  for (const vp of VIEWPORTS) {
    for (const lang of ["de", "en"]) {
      const page = await openApp(browser, vp, lang);
      await startGame(page, ["Anna", "Benedikt", "Cleo", "Dominik"], 80, 90);
      await play(page, [["h", "T19", 57]]);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || r.width === 0 || r.height === 0) return null;
          // really painted there (not clipped by an overflow:hidden/scrolling parent or covered)?
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!top || !(el === top || el.contains(top) || top.contains(el))) return null;
          return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }; };
        const land = getComputedStyle(document.getElementById("landscape-panel")).display !== "none";
        const board = vis(document.getElementById("board-svg"));
        const q = (sel) => [...document.querySelectorAll(sel)].map(vis).find(Boolean) || null;
        return {
          landscape: land, board,
          target: land ? q('[data-coop="lp-target"]') : q('[data-coop="target"]'),
          targetText: (land ? document.querySelector('[data-coop="lp-target"]') : document.querySelector('[data-coop="target"]'))?.textContent,
          rest: land ? q("#lp-players .lp-score") : q('#score-strip [data-coop="rest"]'),
          restText: (land ? document.querySelector("#lp-players .lp-score") : document.querySelector('#score-strip [data-coop="rest"]'))?.textContent,
          active: land ? q("#lp-players .lp-player.active") : q("#score-strip .score-cell.active"),
          activeText: (land ? document.querySelector("#lp-players .lp-player.active") : document.querySelector("#score-strip .score-cell.active"))?.innerText.replace(/\s+/g, " "),
          progress: land ? q(".coop-lp-prog") : q('[data-coop="progress"]'),
          progressText: (land ? document.querySelector(".coop-lp-prog") : document.querySelector('[data-coop="progress"]'))?.textContent,
          checkout: land ? q("#lp-checkout") : q("#x01-checkout-row"),
          checkoutText: (land ? document.getElementById("lp-checkout") : document.getElementById("x01-checkout-row"))?.innerText.replace(/\s+/g, " "),
          bouncer: land ? q("#lp-bouncer") : q("#bottom-bouncer"),
          undo: q("#x01-undo"), back: q("#x01-back"),
          hScroll: document.documentElement.scrollWidth > window.innerWidth,
          rotateOverlay: getComputedStyle(document.getElementById("rotate-overlay")).display,
          vw: window.innerWidth, vh: window.innerHeight,
        };
      });
      const tag = `[layout ${vp.name} ${lang}]`;
      const inside = (r) => r && r.top >= 0 && r.left >= 0 && r.bottom <= m.vh + 1 && r.right <= m.vw + 1;
      const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      for (const k of ["target", "rest", "active", "progress", "checkout", "bouncer", "undo", "back"]) {
        check(inside(m[k]), `${tag} ${k} not visible inside viewport: ${JSON.stringify(m[k])}`);
        if (k !== "undo" && k !== "back") check(!overlap(m[k], m.board), `${tag} ${k} overlaps the board`);
      }
      check(m.targetText === "80" && m.restText === "23" && /Anna/.test(m.activeText || ""), `${tag} texts ${JSON.stringify([m.targetText, m.restText, m.activeText])}`);
      check(lang === "de" ? /1/.test(m.progressText) : /1/.test(m.progressText), `${tag} progress ${m.progressText}`);
      check(/D|Bull|T|\d/.test(m.checkoutText || ""), `${tag} checkout path missing: ${m.checkoutText}`);
      check(!m.hScroll, `${tag} horizontal scroll`);
      check(m.rotateOverlay === "none", `${tag} rotate overlay must not block co-op (portrait allowed): ${m.rotateOverlay}`);
      const minBoard = vp.name === "phone" ? 300 : vp.name === "phone-landscape" ? 0 : 560;
      check(m.board && m.board.w >= minBoard, `${tag} board too small: ${m.board?.w}`);
      metrics[`${vp.name}-${lang}`] = { board: m.board && `${m.board.w}x${m.board.h}@${m.board.left},${m.board.top}`, landscape: m.landscape,
        target: m.targetText, rest: m.restText, progress: m.progressText, checkout: m.checkoutText };
      if (SHOTS && lang === "de") await page.screenshot({ path: `${SHOTS}/coop-${vp.name}.png` });
      check(!page.__errors.length, `${tag} page errors ${page.__errors.join(" | ")}`);
      await page.close();
    }
    if (SHOTS) {
      const page = await openApp(browser, vp, "de");
      await startGame(page, ["Anna", "Ben"], 80, 82);
      await play(page, [["h", "20", 20], ["h", "20", 20], ["h", "20", 20], ["w", 1000], ["h", "D10", 20], ["w", 50],
        ["h", "T19", 57], ["h", "4", 4], ["h", "D10", 20], ["w", 50], ["h", "Bull", 50], ["h", "D16", 32], ["w", 400]]);
      await page.screenshot({ path: `${SHOTS}/coop-result-${vp.name}.png` });
      await page.close();
    }
  }
  return metrics;
}

/**
 * Announcements use only existing, pre-produced clips (no new clips, no live
 * TTS): Game on → "<name> requires 80" + checkout path; rest hand-over →
 * "<name> requires 20" + path; checkout between values → "Checkout!" +
 * "requires 81" + path; end → "Game Shot!". Audio playback is stubbed (ends
 * after 15 ms); which clip files the app loads, in which order, is recorded.
 */
async function testVoice(browser) {
  // No service worker → no background warm-up of all clips; every request seen
  // is a clip the game actually asked for (first use; fresh IndexedDB).
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const clips = [], foreign = [];
  page.on("request", (r) => {
    const u = r.url();
    const m = u.match(/\/assets\/voice\/([^/]+)\/([^/?]+)\.mp3/);
    if (m) clips.push(`${m[1]}/${m[2]}`);
    else if (/cloudfunctions|run\.app|firebasestorage|elevenlabs/.test(u) && !/dartAppCheckPing/.test(u)) foreign.push(u); // App Check measurement ping (js/firebase.js) is not audio
  });
  await page.addInitScript(() => {
    localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_lang", "de");
    window.Audio = class { constructor(u) { this.src = u; } play() { setTimeout(() => this.onended?.(), 15); return Promise.resolve(); } pause() {} };
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    window.dartDB = { saveGame: async () => {}, saveCoopGame: async () => {}, loadStats: async () => [], loadCoopGames: async () => [] };
    window.__x01 = await import("./js/x01.js?v=2"); window.__state = (await import("./js/state.js")).state;
  });
  await startGame(page, ["Anna", "Ben"], 80, 81);
  await page.waitForTimeout(3200);
  await play(page, [["h", "20", 20], ["h", "20", 20], ["h", "20", 20], ["w", 3800], ["h", "D10", 20], ["w", 3500],
    ["h", "T19", 57], ["h", "D12", 24], ["w", 1500]]);
  const keys = clips.filter((c) => c.startsWith("george/")).map((c) => c.slice(7));
  const order = ["el_game_on", "name_anna", "el_requires", "el_num_80", "el_co_80", "el_score_60", "name_ben", "el_num_20", "el_co_20",
    "el_party_checkout", "el_num_81", "el_co_81", "el_slang_game_shot_"];
  const first = order.map((k) => keys.indexOf(k));
  check(first.every((i) => i >= 0) && first.every((i, j) => j === 0 || i > first[j - 1]),
    `voice: expected clip order ${order.join(" → ")}, got ${keys.join(" → ")}`);
  check(foreign.length === 0, `voice: no live TTS / storage requests allowed, got ${foreign.join(", ")}`);
  await ctx.close();
  return keys;
}

/** Regression: ordinary X01 keeps the landscape-only rule (rotate overlay in portrait). */
async function testX01StillLandscapeOnly(browser) {
  const page = await openApp(browser, VIEWPORTS[2]);
  const d = await page.evaluate(async () => {
    const cfg = { mode: "501", startScore: 501, players: ["Anna", "Ben"], playerIds: [null, null], isBot: [false, false], totalSets: 1, setsToWin: 1, setWins: [0, 0], currentSet: 1,
      totalLegs: 1, legsToWin: 1, legWins: [0, 0], currentLeg: 1, rounds: 20, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual",
      accumulated: { turnScores: [[], []], historicThrows: [[], []], checkoutAttempts: [0, 0], checkoutHits: [0, 0], checkoutScores: [[], []], first9: [null, null] } };
    window.__state.cfg = cfg; await window.__x01.startX01(0);
    return { overlay: getComputedStyle(document.getElementById("rotate-overlay")).display, bar: getComputedStyle(document.getElementById("coop-bar")).display };
  });
  check(d.overlay === "flex" && d.bar === "none", `x01 regression: portrait should still show rotate overlay and no co-op bar: ${JSON.stringify(d)}`);
  await page.close();
}

async function run() {
  const browser = await chromium.launch();
  await testSetupUI(browser);
  await testFullRun(browser);
  await testHandoverBustUndoBouncer(browser);
  await testBackConfirm(browser);
  await testX01StillLandscapeOnly(browser);
  const voiceKeys = await testVoice(browser);
  console.log("voice clips:", voiceKeys.join(" → "));
  const metrics = await testLayout(browser);
  await browser.close();
  console.log(JSON.stringify(metrics, null, 1));
  if (failures.length) { console.log("FAILED\n" + failures.join("\n")); process.exit(1); }
  console.log("coop: all assertions passed (setup UI, full run 80–82, hand-over, bust ×3, undo in value + across checkout, bouncer, back confirm, 3 players, layout 3 viewports × DE/EN)");
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
