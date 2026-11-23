/**
 * coop-stats.live.mjs — A Co-op Checkout game against the REAL Firestore
 * (darttrainer-app-fed88) must appear in the game history and its own stats
 * section, but NEVER as an X01 leg: not in dartDB.loadStats(), not in the
 * persistent statistics cache (js/gamesCache.js, IndexedDB "dt-games-cache"),
 * not in the X01 KPIs (games, average, checkout %, Ø darts per leg).
 *
 * Signs in as a fresh guest, seeds 1 player + 1 X01 leg (avg 50, 1/2
 * checkouts, 15 darts), plays a co-op game 80–81 (2 players, real modules,
 * real dartDB), then checks Firestore, the cache and the rendered stats page.
 * Finally deletes the guest's data + account (window.deleteUserAccount, which
 * also removes the guest's dart_coop_games docs).
 *
 * Usage:
 *   node tests/coop-stats.live.mjs                        # live site
 *   BASE=http://localhost:8973 node tests/coop-stats.live.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://play.darttrainer.app";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.addInitScript(() => { localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_lang", "de"); localStorage.setItem("dart_tts_enabled", "false"); });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/AppCheck|recaptcha/i.test(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.signInAsGuest, null, { timeout: 30000 });
  await page.evaluate(() => window.splashPromise);
  await page.evaluate(() => window.signInAsGuest());
  await page.waitForFunction(() => window.dartDB && window.currentUser, null, { timeout: 30000 });

  const failures = [];
  const check = (c, m) => { if (!c) failures.push(m); };
  let out = {};
  try {
    out = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const { state } = await import("./js/state.js");
      const x01 = await import("./js/x01.js?v=2");
      const pid = (await window.dartDB.savePlayer("ZZ Coop")).id;
      await window.dartDB.saveGame({ ts: Date.now() - 60000, mode: "501", rounds: 5, winner: "ZZ Coop", winnerId: pid, playerIds: [pid],
        players: [{ name: "ZZ Coop", id: pid, avg3: 50, best3: 60, checkoutAtt: 2, checkoutHit: 1, first9: 50, doubleStats: {}, scatter: [], winner: true, darts: 15 }],
        durationSec: 60, context: "casual", tournamentId: null, tournamentName: null });
      const before = (await window.dartDB.loadStats()).length; // also fills the IndexedDB cache

      // capture the (fire-and-forget) co-op save
      const origSave = window.dartDB.saveCoopGame.bind(window.dartDB);
      let savePromise = null;
      window.dartDB.saveCoopGame = (d) => (savePromise = origSave(d));
      window.dartDB.saveGame = ((orig) => (d) => { window.__x01Saves = (window.__x01Saves || 0) + 1; return orig(d); })(window.dartDB.saveGame.bind(window.dartDB));

      state.allPlayers = await window.dartDB.loadPlayers();
      state.cfg = { mode: "Coop", coop: { from: 80, to: 81 }, startScore: 501, players: ["ZZ Coop", "Gast"], playerIds: [pid, null], isBot: [false, false],
        totalSets: 1, setsToWin: 1, setWins: [0, 0], currentSet: 1, totalLegs: 1, legsToWin: 1, legWins: [0, 0], currentLeg: 1, rounds: 20,
        currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual",
        accumulated: { turnScores: [[], []], historicThrows: [[], []], checkoutAttempts: [0, 0], checkoutHits: [0, 0], checkoutScores: [[], []], first9: [null, null] }, legStatsHistory: [] };
      await x01.startX01(0);
      const h = (l, s) => x01.processX01Hit({ label: l, score: s }, null, null);
      h("20", 20); h("20", 20); h("20", 20); await sleep(1000);   // 80 → 20
      h("D10", 20); await sleep(50);                               // Gast checks 80 (4 darts)
      h("T19", 57); h("D12", 24); await sleep(300);                // ZZ Coop checks 81 (2 darts)
      await savePromise;

      const stats = await window.dartDB.loadStats();
      const cache = await new Promise((res) => {
        const rq = indexedDB.open("dt-games-cache", 1);
        rq.onsuccess = () => { const g = rq.result.transaction("byUid").objectStore("byUid").get(window.currentUser.uid); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); };
        rq.onerror = () => res(null);
      });
      const cacheGames = cache?.docs || [];
      const coopDocs = await window.dartDB.loadCoopGames();

      // stats page (Alles / alle Spieler / alle Kontexte)
      window.showScreen("setup");
      document.querySelector('.time-btn[data-range="all"]')?.click();
      const statsMod = await import("./js/stats.js");
      statsMod.setStatsSelectedPlayer?.(null);
      await statsMod.loadAndRenderStats();
      const box = document.getElementById("stats-content");
      const card = (label) => [...box.querySelectorAll(".stat-card")].find((c) => c.querySelector(".s-label")?.textContent.trim() === label)?.querySelector(".s-value")?.textContent;
      const x01Title = [...box.querySelectorAll(".stats-section-title")].find((e) => e.textContent.includes("501 / 301"));
      const x01Grid = x01Title?.nextElementSibling;
      const x01Cards = x01Grid ? [...x01Grid.querySelectorAll(".stat-card")].map((c) => [c.querySelector(".s-label").textContent.trim(), c.querySelector(".s-value").textContent.trim(), c.querySelector(".s-sub")?.textContent.trim() || ""]) : null;
      return {
        before, after: stats.length, afterModes: stats.map((g) => g.mode), x01Saves: window.__x01Saves || 0,
        cacheModes: cacheGames.map((g) => g.mode), cacheCount: cacheGames.length,
        coopDocs: coopDocs.map((d) => ({ mode: d.mode, from: d.from, to: d.to, totalDarts: d.totalDarts, values: d.values.map((v) => [v.value, v.darts]), players: d.players.map((p) => [p.name, p.darts, p.checkouts]), userId: d.userId === window.currentUser.uid })),
        x01Cards,
        headline: box.querySelector(".stats-section-title")?.textContent,
        coopSection: box.querySelector("[data-coop-stats]")?.dataset.coopStats ?? null,
        historyCoopRows: box.querySelectorAll("[data-coop-history]").length,
        historyText: [...box.querySelectorAll(".history-row")].map((r) => r.innerText.replace(/\s+/g, " ")).filter((t) => /Co-op/.test(t)),
      };
    });
    check(out.before === 1 && out.after === 1 && out.afterModes.every((m) => m === "501"), `loadStats must still return only the X01 leg: ${JSON.stringify([out.before, out.after, out.afterModes])}`);
    check(out.x01Saves === 0, `co-op must not call saveGame (dart_games): ${out.x01Saves}`);
    check(out.cacheCount === 1 && !out.cacheModes.includes("Coop"), `IndexedDB stats cache must not contain the co-op game: ${JSON.stringify(out.cacheModes)}`);
    check(out.coopDocs.length === 1 && out.coopDocs[0].userId && out.coopDocs[0].totalDarts === 6
      && JSON.stringify(out.coopDocs[0].values) === JSON.stringify([[80, 4], [81, 2]])
      && JSON.stringify(out.coopDocs[0].players) === JSON.stringify([["ZZ Coop", 5], ["Gast", 1]].map(([n, d], i) => [n, d, 1])),
    `co-op doc in dart_coop_games: ${JSON.stringify(out.coopDocs)}`);
    const cards = Object.fromEntries((out.x01Cards || []).map(([l, v, s]) => [l.toUpperCase(), [v, s]]));
    check(cards["SPIELE"]?.[0] === "1", `X01 "Spiele" must stay 1: ${JSON.stringify(out.x01Cards)}`);
    check(cards["AVERAGE"]?.[0] === "50" || cards["Ø AUFNAHME"]?.[0] === "50" || (out.x01Cards || []).some(([l, v]) => /avg|average|aufnahme/i.test(l) && v === "50"), `X01 average must stay 50: ${JSON.stringify(out.x01Cards)}`);
    check((out.x01Cards || []).some(([l, v, s]) => /checkout/i.test(l) && v === "50%" && s === "1/2"), `X01 checkout quote must stay 50% (1/2): ${JSON.stringify(out.x01Cards)}`);
    check((out.x01Cards || []).some(([l, v, s]) => /darts/i.test(l) && v === "15" && /1 von 1/.test(s)), `X01 Ø darts per leg must stay 15 (1 of 1 legs): ${JSON.stringify(out.x01Cards)}`);
    check(/1 Spiele/.test(out.headline || ""), `headline game count must stay 1: ${out.headline}`);
    check(out.coopSection === "1" && out.historyCoopRows === 1 && /Co-op 80–81/.test(out.historyText[0] || "") && /\b6\b/.test(out.historyText[0] || ""),
      `co-op game must appear in history + co-op section: ${JSON.stringify([out.coopSection, out.historyCoopRows, out.historyText])}`);
  } finally {
    const cleanup = await page.evaluate(async () => {
      try {
        await window.deleteUserAccount();
        return "guest data + account deleted";
      } catch (e) { return "cleanup failed: " + e.message; }
    });
    console.log(cleanup);
    check(/deleted/.test(cleanup), cleanup);
  }
  const relevant = consoleErrors.filter((e) => /index|FAILED_PRECONDITION|permission/i.test(e));
  if (relevant.length) failures.push("console errors: " + relevant.join(" | "));
  await browser.close();
  console.log(JSON.stringify({ x01Cards: out.x01Cards, coop: out.coopDocs, history: out.historyText }, null, 1));
  if (failures.length) { console.log("FAILED\n" + failures.join("\n")); process.exit(1); }
  console.log(`${BASE}: co-op game in history/co-op section only — X01 stats, loadStats() and the IndexedDB cache unchanged`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
