/**
 * party-modes.test.mjs — "Bob's 27" and "Checkout" (Checkout-Training) under
 * "Weitere Modi" start their OWN game on the #party screen (they used to be
 * missing from the party-mode list and silently started a normal 501).
 *
 * Everything goes through the real UI: setup buttons → btn-start, darts are
 * real mouse clicks on the party board's SVG segments, "next"/undo buttons.
 *   1. Bob's 27 solo: party screen, title, 27 points, target D1; hit/miss
 *      scoring per the in-app rule (+2×field per hit, −field per miss/not
 *      thrown dart); score below 0 = game over → result overlay; nothing is
 *      saved to dart_games.
 *   2. Bob's 27, 2 players: turns alternate, the double only advances after
 *      both; an eliminated player is skipped.
 *   3. Checkout-Training: party screen, 10 targets from the checkout table;
 *      double checkout counts, single to 0 = bust, the "next" button and the
 *      board are locked while the turn ends (no double-advance), undo cancels
 *      a pending end of turn; nothing is saved even after an X01 game.
 *   4. Plain 501 still starts X01 (regression).
 *
 * Usage: python3 -m http.server 8973 &  then  node tests/party-modes.test.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8973";
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); else console.log("  ok  " + msg); };

async function openApp(browser) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.addInitScript(() => {
    localStorage.setItem("dart_onboarding_done", "true");
    localStorage.setItem("dart_lang", "de");
    localStorage.setItem("dart_tts_enabled", "false");
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.__errors = errors;
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForFunction(() => document.querySelector(".screen.active")?.id === "auth-screen", null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    window.__saved = [];
    window.dartDB = {
      saveGame: async (d) => { window.__saved.push(JSON.parse(JSON.stringify(d))); },
      saveCoopGame: async () => {}, loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [],
    };
    const { state } = await import("./js/state.js");
    window.__state = state;
  });
  return page;
}

/** Starts a mode through the real setup UI. */
async function startMode(page, mode, players) {
  await page.evaluate(async ({ mode, players }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.showScreen("setup");
    await sleep(100);
    const extra = document.getElementById("extra-modes");
    if (["501", "301", "Cricket"].includes(mode)) document.querySelector(`#mode-group [data-value="${mode}"], .btn-toggle[data-value="${mode}"]`).click();
    else {
      if (extra.style.display === "none") document.getElementById("btn-extra-modes").click();
      document.querySelector(`#extra-mode-group [data-value="${mode}"]`).click();
    }
    window.__state.selectedPlayers = players.map((name) => ({ id: null, name }));
    document.getElementById("btn-start").click();
    await sleep(700);
    document.getElementById("app-modal-ok")?.click();
    await sleep(400);
  }, { mode, players });
}

/** Client coordinates of a segment on the party board (scans with the app's own hit test). */
async function boardPoint(page, label) {
  return page.evaluate(async (label) => {
    const { hitFromXY, svgCoords } = await import("./js/board.js?v=2");
    const svg = document.getElementById("board-svg-party");
    const r = svg.getBoundingClientRect();
    for (let y = r.top + 4; y < r.bottom; y += 3) for (let x = r.left + 4; x < r.right; x += 3) {
      const h = hitFromXY(...Object.values(svgCoords(svg, { clientX: x, clientY: y })));
      if (h && h.label === label) {
        let x2 = x; while (x2 < r.right) { const q = svgCoords(svg, { clientX: x2 + 3, clientY: y }); const h2 = hitFromXY(q.x, q.y); if (!h2 || h2.label !== label) break; x2 += 3; }
        return { x: (x + x2) / 2, y: y + 4 };
      }
    }
    return null;
  }, label);
}

const pointCache = {};
async function throwAt(page, label) {
  const p = pointCache[label] || (pointCache[label] = await boardPoint(page, label));
  if (!p) throw new Error("segment not found: " + label);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(60);
}
const wait = (page, ms) => page.waitForTimeout(ms);

async function pg(page) {
  return page.evaluate(() => {
    const s = window.__state, p = s.pg;
    return {
      screen: document.querySelector(".screen.active")?.id, title: document.getElementById("party-title").textContent,
      mode: p.mode, current: p.current, throws: p.throws.map((t) => t.label), winner: p.winner,
      bob: [...(p.bob27Score || [])], bobRound: p.bob27Round, bobOut: [...(p.bob27Out || [])],
      coTargets: [...(p.coTargets || [])], coRound: p.coRound, coScore: p.coScore, coHits: p.coHits, coAttempts: p.coAttempts,
      pending: !!p.pendingAdvance, nextVisible: document.getElementById("party-next").style.display !== "none",
      info: document.getElementById("party-info-bar").textContent,
      scoreboard: document.getElementById("party-scoreboard").textContent.replace(/\s+/g, " ").trim(),
      overlay: document.getElementById("winner-overlay").classList.contains("visible"),
      x01Scores: s.x01?.scores ? [...s.x01.scores] : null, saved: window.__saved.length,
    };
  });
}

async function run() {
  const browser = await chromium.launch();

  // ── 1. Bob's 27 solo
  console.log("Bob's 27 solo");
  let page = await openApp(browser);
  await startMode(page, "Bob27", ["Anna"]);
  let s = await pg(page);
  check(s.screen === "party", `Bob27 opens the party screen (got ${s.screen})`);
  check(s.title === "Bob's 27", `title "Bob's 27" (got "${s.title}")`);
  check(s.mode === "Bob27" && s.bob[0] === 27 && s.bobRound === 0, `starts with 27 points on D1 (${s.bob}, round ${s.bobRound})`);
  check(s.x01Scores === null, "no X01 game was started (no 501)");
  check(/D1/.test(s.info) && /D1/.test(s.scoreboard), `info/scoreboard show target D1 ("${s.info}")`);
  await throwAt(page, "D1"); await throwAt(page, "Miss"); await throwAt(page, "Miss");
  await wait(page, 600);
  s = await pg(page);
  check(s.bob[0] === 27 && s.bobRound === 1 && s.throws.length === 0, `D1: 1 hit 2 miss → 27+2−2 = 27, next D2 (${s.bob[0]}, round ${s.bobRound})`);
  await throwAt(page, "D2"); await throwAt(page, "D2");
  await page.click("#party-next"); // third dart not thrown = miss
  await wait(page, 200);
  s = await pg(page);
  check(s.bob[0] === 33 && s.bobRound === 2, `D2: 2 hits + early "next" → 27+8−2 = 33, next D3 (${s.bob[0]}, round ${s.bobRound})`);
  for (const _ of [3, 4]) { await throwAt(page, "Miss"); await throwAt(page, "Miss"); await throwAt(page, "Miss"); await wait(page, 600); }
  s = await pg(page);
  check(s.bob[0] === 33 - 9 - 12 && s.bobRound === 4 && s.winner == null, `D3/D4 all missed → 12, game continues (${s.bob[0]})`);
  // D5: −15 → below zero = game over
  await throwAt(page, "Miss"); await throwAt(page, "Miss"); await throwAt(page, "Miss"); await wait(page, 600);
  s = await pg(page);
  check(s.bob[0] === -3 && s.bobOut[0] === true, `D5 all missed → −3, player out (${s.bob[0]})`);
  check(s.winner === 0 && s.overlay, "game over → result overlay shown");
  // dispatch straight to the board (the result overlay would swallow a real click)
  const p6 = await boardPoint(page, "D6");
  await page.evaluate((p) => document.getElementById("board-svg-party").dispatchEvent(new PointerEvent("pointerup", { clientX: p.x, clientY: p.y, bubbles: true, pointerType: "touch" })), p6);
  const after = await pg(page);
  check(after.throws.join() === s.throws.join() && after.bob[0] === -3, "board locked after game over (winner index 0)");
  check(s.saved === 0, `party game not saved to dart_games (${s.saved} docs)`);
  // undo brings the player back into the game
  await page.evaluate(() => document.getElementById("party-undo").click());
  await wait(page, 100);
  s = await pg(page);
  check(s.winner == null && s.bobOut[0] === false && s.bob[0] === 12 && s.throws.length === 2, `undo reverts game over (${s.bob[0]}, throws ${s.throws})`);
  check(page.__errors.length === 0, `no page errors (${page.__errors.join(" | ")})`);
  await page.close();

  // ── 2. Bob's 27, two players
  console.log("Bob's 27, 2 players");
  page = await openApp(browser);
  await startMode(page, "Bob27", ["Anna", "Ben"]);
  await throwAt(page, "D1"); await throwAt(page, "D1"); await throwAt(page, "D1"); await wait(page, 600);
  s = await pg(page);
  check(s.current === 1 && s.bobRound === 0 && s.bob[0] === 33, `after Anna: Ben's turn, still D1 (current ${s.current}, round ${s.bobRound}, ${s.bob})`);
  await throwAt(page, "Miss"); await throwAt(page, "Miss"); await throwAt(page, "Miss"); await wait(page, 600);
  s = await pg(page);
  check(s.current === 0 && s.bobRound === 1 && s.bob[1] === 24, `after Ben: Anna on D2 (current ${s.current}, round ${s.bobRound}, ${s.bob})`);
  // Drive Ben below zero: skip ahead by playing misses for both
  for (let r = 0; r < 6 && !(await pg(page)).bobOut[1]; r++) {
    for (let k = 0; k < 2; k++) {
      const cur = await pg(page);
      if (cur.bobOut[cur.current] || cur.winner != null) break;
      const field = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10][cur.bobRound];
      if (cur.current === 0) { await throwAt(page, `D${field}`); await throwAt(page, `D${field}`); await throwAt(page, `D${field}`); }
      else { await throwAt(page, "Miss"); await throwAt(page, "Miss"); await throwAt(page, "Miss"); }
      await wait(page, 600);
    }
  }
  s = await pg(page);
  check(s.bobOut[1] === true && s.bobOut[0] === false && s.winner == null, `Ben out, Anna continues (${s.bob}, out ${s.bobOut})`);
  const roundBefore = s.bobRound;
  check(s.current === 0, "turn stays with Anna");
  await throwAt(page, "Miss"); await throwAt(page, "Miss"); await throwAt(page, "Miss"); await wait(page, 600);
  s = await pg(page);
  check(s.current === 0 && s.bobRound === roundBefore + 1, `eliminated Ben skipped, Anna on next double (round ${roundBefore}→${s.bobRound})`);
  check(page.__errors.length === 0, `no page errors (${page.__errors.join(" | ")})`);
  await page.close();

  // ── 3. Checkout-Training (after an X01 game, to prove no stale X01 save)
  console.log("Checkout-Training");
  page = await openApp(browser);
  await startMode(page, "501", ["Anna"]);
  s = await pg(page).catch(() => null);
  const x01 = await page.evaluate(() => ({ screen: document.querySelector(".screen.active")?.id, scores: window.__state.x01?.scores }));
  check(x01.screen === "x01" && x01.scores?.[0] === 501, `501 still starts X01 (${x01.screen}, ${x01.scores})`);
  await startMode(page, "CheckoutTraining", ["Anna"]);
  s = await pg(page);
  const table = await page.evaluate(() => window._CHECKOUTS);
  check(s.screen === "party", `Checkout opens the party screen (got ${s.screen})`);
  check(s.title === "Checkout-Training", `title "Checkout-Training" (got "${s.title}")`);
  check(s.coTargets.length === 10 && s.coTargets.every((v) => v >= 40 && v <= 170 && table[v]), `10 targets from the checkout table (${s.coTargets})`);
  check(s.coScore === s.coTargets[0] && s.coAttempts === 1, "first target active");
  // deterministic targets for the play-through
  await page.evaluate(() => { const p = window.__state.pg; p.coTargets.splice(0, 3, 40, 32, 60); p.coScore = 40; window.__renderParty?.(); });
  await throwAt(page, "D20");
  s = await pg(page);
  check(s.coHits === 1 && s.pending && !s.nextVisible, `40 → D20 = checkout, turn locked (hits ${s.coHits}, next button ${s.nextVisible ? "visible" : "hidden"})`);
  await throwAt(page, "D5");
  s = await pg(page);
  check(s.throws.length === 1, "board ignores darts while the turn ends");
  await wait(page, 1200);
  s = await pg(page);
  check(s.coRound === 1 && s.coScore === 32 && s.coAttempts === 2 && s.throws.length === 0, `next target 32 (round ${s.coRound}, score ${s.coScore})`);
  await throwAt(page, "16"); await throwAt(page, "16");
  s = await pg(page);
  check(s.pending && s.coHits === 1, "32 → 16 + 16 (single to 0) = bust, not a checkout");
  // undo cancels the pending end of turn
  await page.evaluate(() => document.getElementById("party-undo").click());
  await wait(page, 1000);
  s = await pg(page);
  check(s.coRound === 1 && !s.pending && s.throws.length === 1 && s.coScore === 16, `undo cancels the bust (round ${s.coRound}, rest ${s.coScore}, throws ${s.throws})`);
  await throwAt(page, "D8");
  await wait(page, 1200);
  s = await pg(page);
  check(s.coHits === 2 && s.coRound === 2 && s.coScore === 60, `16 → D8 = checkout, next target 60 (hits ${s.coHits})`);
  await throwAt(page, "20"); await throwAt(page, "Miss"); await throwAt(page, "Miss");
  await page.evaluate(() => document.getElementById("party-next").click()); // must not double-advance
  await wait(page, 700);
  s = await pg(page);
  check(s.coRound === 3 && s.coHits === 2, `3 darts without checkout → next target exactly once (round ${s.coRound})`);
  // finish the remaining targets with misses
  for (let r = 3; r < 10; r++) { await throwAt(page, "Miss"); await throwAt(page, "Miss"); await throwAt(page, "Miss"); await wait(page, 600); }
  s = await pg(page);
  check(s.winner === 0 && s.overlay, "training complete → result overlay");
  const summaryHidden = await page.evaluate(() => document.getElementById("winner-summary")?.style.display === "none");
  check(summaryHidden, "result overlay shows no stale X01 stats");
  check(s.saved === 0, `party game not saved to dart_games after an X01 game (${s.saved} docs)`);
  check(page.__errors.length === 0, `no page errors (${page.__errors.join(" | ")})`);
  await page.close();

  await browser.close();
  console.log(failures.length ? `\nFAILED (${failures.length}):\n - ` + failures.join("\n - ") : "\nALL PASSED");
  process.exit(failures.length ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
