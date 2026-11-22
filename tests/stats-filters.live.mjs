/**
 * stats-filters.live.mjs — Statistics filters against the REAL Firestore
 * (project darttrainer-app-fed88), through the real UI buttons.
 *
 * Signs in as a fresh guest (anonymous auth), seeds 1 player + 6 X01 games
 * (different ages and contexts), then clicks every combination of
 *   player  (all / the seeded player)
 *   period  (Alles / Heute / 7 Tage / Monat / 3 Monate / 6 Monate)
 *   context (Alle / Training / Casual / Turnier)
 * = 48 combinations. Each one must: run the Firestore query without error
 * (no "requires an index" / FAILED_PRECONDITION), keep the chosen period AND
 * context highlighted, and show exactly the expected number of games.
 * Finally deletes the guest's data and the guest account (window.deleteUserAccount).
 *
 * Usage:
 *   node tests/stats-filters.live.mjs                      # live site
 *   BASE=http://localhost:8973 node tests/stats-filters.live.mjs
 * Exit 0 = all 48 combinations passed.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://play.darttrainer.app";
const DAY = 86400000;
// [age in days, context, belongs to seeded player?]
const SEED = [
  [0, "training", true], [3, "casual", true], [20, "tournament", true],
  [60, "training", false], [150, "casual", true], [400, undefined, true],
];
const RANGES = { all: Infinity, today: "today", "7d": 7, "30d": 30, "90d": 90, "180d": 180 };
const CTXS = ["all", "training", "casual", "tournament"];

function expected(now, player, range, ctx) {
  const startToday = new Date(now).setHours(0, 0, 0, 0);
  return SEED.filter(([age, c, mine]) => {
    const ts = now - age * DAY - 60000;
    const lim = RANGES[range];
    if (lim === "today" ? ts < startToday : ts < now - lim * DAY) return false;
    if (player === "one" && !mine) return false;
    if (ctx !== "all" && !(c === ctx || (ctx === "casual" && !c))) return false;
    return true;
  }).length;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.signInAsGuest, null, { timeout: 30000 });
  await page.evaluate(() => window.signInAsGuest());
  await page.waitForFunction(() => window.dartDB && window.currentUser, null, { timeout: 30000 }); // dartDB is created on sign-in

  const seeded = await page.evaluate(async ({ seed, DAY }) => {
    const now = Date.now();
    const pid = (await window.dartDB.savePlayer("ZZ Filtertest")).id;
    for (const [age, ctx, mine] of seed) {
      const g = { ts: now - age * DAY - 60000, mode: "501", rounds: 5, winner: "ZZ Filtertest", winnerId: mine ? pid : null,
        playerIds: mine ? [pid] : [], players: [{ name: "ZZ Filtertest", id: mine ? pid : null, avg3: 50, best3: 60, checkoutAtt: 1, checkoutHit: 1, first9: 50, doubleStats: {}, scatter: [], winner: true, darts: 15 }],
        durationSec: 60, tournamentId: null, tournamentName: null };
      if (ctx) g.context = ctx;
      await window.dartDB.saveGame(g);
    }
    return { now, pid };
  }, { seed: SEED, DAY });

  const failures = [];
  const results = [];
  try {
    await page.evaluate(async () => {
      const { state } = await import("./js/state.js");
      state.allPlayers = await window.dartDB.loadPlayers();
      const stats = await import("./js/stats.js");
      // count every real Firestore query + its outcome
      const orig = window.dartDB.loadStats.bind(window.dartDB);
      window.__q = [];
      window.dartDB.loadStats = async () => { try { const r = await orig(); window.__q.push({ ok: true, n: r.length }); return r; } catch (e) { window.__q.push({ ok: false, err: e.code + " " + e.message }); throw e; } };
      stats.renderStatsPlayerBar();
    });

    for (const player of ["all", "one"]) {
      for (const range of Object.keys(RANGES)) {
        for (const ctx of CTXS) {
          const r = await page.evaluate(async ({ player, range, ctx, pid }) => {
            const click = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error("missing " + sel); el.click(); };
            const q0 = window.__q.length;
            click(`#stats-player-bar .stats-player-btn[data-pid="${player === "all" ? "all" : pid}"]`);
            click(`.time-btn[data-range="${range}"]`);
            click(`#context-filter-bar .time-btn[data-ctx="${ctx}"]`);
            const stats = await import("./js/stats.js");
            await stats.loadAndRenderStats(); // settle: the last render reflects all three filters
            const box = document.getElementById("stats-content");
            const first = box.querySelector(".stat-card .s-value");
            return {
              shown: first ? Number(first.textContent) : 0,
              boxText: box.innerText.slice(0, 120),
              queries: window.__q.slice(q0),
              activeRange: document.querySelector(".time-btn[data-range].active")?.dataset.range ?? null,
              activeCtx: document.querySelector("#context-filter-bar .time-btn.active")?.dataset.ctx ?? null,
            };
          }, { player, range, ctx, pid: seeded.pid });
          const exp = expected(seeded.now, player, range, ctx);
          const qErr = r.queries.filter((q) => !q.ok);
          const ok = qErr.length === 0 && r.queries.length > 0 && r.shown === exp && r.activeRange === range && r.activeCtx === ctx
            && !/index|fehler|error/i.test(r.boxText);
          results.push({ player, range, ctx, expected: exp, shown: r.shown, queries: r.queries.length, ok });
          if (!ok) failures.push(`${player}/${range}/${ctx}: expected ${exp}, shown ${r.shown}, active ${r.activeRange}/${r.activeCtx}, queryErrors ${JSON.stringify(qErr)}, box "${r.boxText}"`);
        }
      }
    }
  } finally {
    const cleanup = await page.evaluate(async () => { try { await window.deleteUserAccount(); return "guest data + account deleted"; } catch (e) { return "cleanup failed: " + e.message; } });
    console.log(cleanup);
  }
  const indexErrors = consoleErrors.filter((e) => /index|FAILED_PRECONDITION/i.test(e));
  if (indexErrors.length) failures.push("console index errors: " + indexErrors.join(" | "));
  await browser.close();
  console.log(`${BASE}: ${results.filter((r) => r.ok).length}/${results.length} combinations OK, Firestore queries: ${results.reduce((a, r) => a + r.queries, 0)}`);
  if (failures.length) { console.log("FAILED\n" + failures.join("\n")); process.exit(1); }
  process.exit(0);
}

run();
