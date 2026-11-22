/**
 * stats-many-legs.live.mjs — "Alles" must cover ALL legs (not the last 200),
 * measured against the REAL Firestore (darttrainer-app-fed88).
 *
 * A fresh guest gets N=650 X01 legs spread over ~400 days (batched writes);
 * the newest 250 carry players[].darts, the older 400 don't (pre-2026-11-22
 * shape). Then, through the real stats UI:
 *   1. first load ("Alles")        → shows 650, exact Ø darts over the 250
 *   2. same session, filter clicks  → 0 Firestore reads (in-memory)
 *   3. new session (page reload)    → IndexedDB copy + 7-day top-up only
 *   4. "7 Tage"                      → only the last-7-day legs, exact Ø darts
 * Prints reads + load time per step. Finally deletes the guest's data and
 * account (window.deleteUserAccount) and prints the uid so leftovers can be
 * checked: no dart_games with that userId may remain.
 *
 * Usage: BASE=http://localhost:8973 node tests/stats-many-legs.live.mjs   (default: live site)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://play.darttrainer.app";
const N = 650, WITH_DARTS = 250, DAY = 86400000;

function seedPlan(now) {
  // newest first; i-th leg is i*15h old → spans ~406 days
  return Array.from({ length: N }, (_, i) => {
    const ts = now - i * 15 * 3600000 - 60000;
    return { ts, darts: i < WITH_DARTS ? 12 + (i % 13) : null, ctx: ["training", "casual", "tournament"][i % 3] };
  });
}

async function statsView(page, range) {
  return page.evaluate(async (range) => {
    document.querySelector(`.time-btn[data-range="${range}"]`).click();
    const stats = await import("./js/stats.js");
    const t0 = performance.now();
    await stats.loadAndRenderStats();
    const ms = Math.round(performance.now() - t0);
    const box = document.getElementById("stats-content");
    const kpi = box.querySelector('[data-kpi="darts-per-leg"]');
    return {
      games: Number(box.querySelector(".stat-card .s-value")?.textContent || 0),
      dartsVal: kpi?.querySelector(".s-value")?.textContent ?? null,
      dartsSub: kpi?.querySelector(".s-sub")?.textContent ?? null,
      load: window.dartDB.lastStatsLoad, renderMs: ms,
    };
  }, range);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const failures = [];
  const check = (cond, msg) => { if (!cond) failures.push(msg); };
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.signInAsGuest, null, { timeout: 30000 });
  await page.evaluate(() => window.signInAsGuest());
  await page.waitForFunction(() => window.dartDB && window.currentUser, null, { timeout: 30000 });

  const now = Date.now();
  const plan = seedPlan(now);
  const uid = await page.evaluate(async ({ plan }) => {
    const fs = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js");
    const db = fs.getFirestore();
    const uid = window.currentUser.uid;
    const pid = (await window.dartDB.savePlayer("ZZ Vielspieler")).id;
    window.__pid = pid;
    for (let off = 0; off < plan.length; off += 400) {
      const b = fs.writeBatch(db);
      for (const g of plan.slice(off, off + 400)) {
        const p = { name: "ZZ Vielspieler", id: pid, avg3: 50, best3: 60, checkoutAtt: 1, checkoutHit: 1, first9: 50, doubleStats: {}, scatter: [], winner: true };
        if (g.darts != null) p.darts = g.darts;
        b.set(fs.doc(fs.collection(db, "dart_games")), { userId: uid, ts: g.ts, mode: "501", rounds: 7, winner: p.name, winnerId: pid,
          playerIds: [pid], players: [p], durationSec: 60, context: g.ctx, tournamentId: null, tournamentName: null });
      }
      await b.commit();
    }
    return uid;
  }, { plan });
  console.log(`seeded ${N} legs for guest ${uid}`);

  const exactAvg = (rows) => { const d = rows.filter((g) => g.darts != null).map((g) => g.darts); return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length * 10) / 10 : null; };
  const report = {};
  try {
    // 1. first load on this device
    const first = await statsView(page, "all");
    report.firstLoad = first;
    check(first.games === N, `Alles: expected ${N} legs, shown ${first.games}`);
    // pages of 500; an empty last page is billed as 1 read
    check(first.load?.mode === "full" && first.load.reads === N + (N % 500 === 0 ? 1 : 0), `first load: expected full load with ~${N} reads, got ${JSON.stringify(first.load)}`);
    check(first.dartsVal === String(exactAvg(plan)), `Ø darts: expected ${exactAvg(plan)}, got ${first.dartsVal}`);
    check(/250/.test(first.dartsSub) && new RegExp(String(N)).test(first.dartsSub), `darts sub-label should name 250 of ${N}: "${first.dartsSub}"`);

    // 2. same session: switching filters costs no reads
    const again = await statsView(page, "90d");
    report.sameSession = again;
    check(again.load?.reads === 0 && again.load.mode === "memory", `same session: expected 0 reads, got ${JSON.stringify(again.load)}`);

    // 3. new session: IndexedDB copy + top-up of the last 7 days only
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.dartDB && window.currentUser, null, { timeout: 30000 });
    const reopened = await statsView(page, "all");
    report.newSession = reopened;
    const last7 = plan.filter((g) => g.ts >= plan[0].ts - 7 * DAY).length;
    check(reopened.games === N, `new session Alles: expected ${N}, shown ${reopened.games}`);
    check(reopened.load?.mode === "topup" && reopened.load.reads === last7, `new session: expected top-up with ${last7} reads, got ${JSON.stringify(reopened.load)}`);

    // 4. 7 days filter
    const week = await statsView(page, "7d");
    report.sevenDays = week;
    const wk = plan.filter((g) => g.ts >= now - 7 * DAY);
    check(week.games === wk.length, `7 Tage: expected ${wk.length}, shown ${week.games}`);
    check(week.dartsVal === String(exactAvg(wk)), `7 Tage Ø darts: expected ${exactAvg(wk)}, got ${week.dartsVal}`);
  } finally {
    const cleanup = await page.evaluate(async () => { try { await window.deleteUserAccount(); return "guest data + account deleted"; } catch (e) { return "cleanup failed: " + e.message; } });
    console.log(cleanup);
  }
  console.log(JSON.stringify(report, null, 1));
  console.log(`uid=${uid}`);
  await browser.close();
  if (failures.length) { console.log("FAILED\n" + failures.join("\n")); process.exit(1); }
  console.log("stats-many-legs: all assertions passed");
  process.exit(0);
}

run();
