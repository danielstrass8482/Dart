/**
 * party-docs-stats.live.mjs — Party/training games written to dart_games by
 * OLD app versions (before 1.3.0) never reach X01 numbers:
 *   - AtC/Shanghai/… docs carrying the previous X01 game's numbers,
 *   - "Bob27"/"CheckoutTraining" docs (mislabeled 501 legs).
 * Real DB, fresh guest account. Seeds 2 real 501 legs + 1 Cricket leg for one
 * player and 4 such docs with absurd numbers (avg 999, best 180, …), then:
 *   1. dartDB.loadStats(): only the 3 real legs (first load = Firestore) …
 *   2. … and again from the IndexedDB cache (second load)
 *   3. statistics screen: games / Ø / highscore from the real legs only
 *   4. coach prompt (buildCoachPrompt over the stats cache): no 999/180
 *   5. player profile (updateAllPlayerStats → dart_players.stats)
 * Cleans up with deleteUserAccount().
 * Usage: node tests/party-docs-stats.live.mjs   (BASE=http://localhost:8973 for local)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "https://play.darttrainer.app";
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.addInitScript(() => { localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_tts_enabled", "false"); });
await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.signInAsGuest, null, { timeout: 30000 });
await page.evaluate(() => window.signInAsGuest());
await page.waitForFunction(() => window.dartDB && window.currentUser, null, { timeout: 30000 });

try {
  const seeded = await page.evaluate(async () => {
    const now = Date.now(), name = "ZZ Partytest";
    const pid = (await window.dartDB.savePlayer(name)).id;
    const x01 = (ts, avg3, best3, mode = "501") => ({ ts, mode, rounds: 8, winner: name, winnerId: pid, playerIds: [pid],
      players: [{ name, id: pid, avg3, best3, checkoutAtt: 2, checkoutHit: 1, first9: avg3, doubleStats: {}, scatter: [], winner: true, darts: 24 }],
      durationSec: 300, context: "casual", tournamentId: null, tournamentName: null });
    await window.dartDB.saveGame(x01(now - 5 * 60000, 50, 60));
    await window.dartDB.saveGame(x01(now - 4 * 60000, 60, 60));
    await window.dartDB.saveGame({ ts: now - 3 * 60000, mode: "Cricket", rounds: 10, winner: name, winnerId: pid, playerIds: [pid],
      players: [{ name, id: pid, points: 0, winner: true, scatter: [], cricketAvgMarks: 2.5, cricketClosed: [], cricketRounds: 10, durationSec: 0 }],
      durationSec: 0, context: "casual", tournamentId: null, tournamentName: null });
    // what old app versions wrote for party/training games
    for (const [i, mode] of ["AtC", "Shanghai", "Bob27", "CheckoutTraining"].entries()) await window.dartDB.saveGame(x01(now - (2 - i * 0.1) * 60000, 999, 180, mode));
    return { pid };
  });

  // 1 + 2: loadStats, first from Firestore, then from the IndexedDB cache
  const load = () => page.evaluate(async () => { const g = await window.dartDB.loadStats(); return { modes: g.map((x) => x.mode).sort(), info: window.dartDB.lastStatsLoad }; });
  const l1 = await load();
  check(JSON.stringify(l1.modes) === JSON.stringify(["501", "501", "Cricket"]), `loadStats (Firestore): only the real legs (${l1.modes}), excluded ${l1.info?.excluded}`);
  check(l1.info?.excluded === 4, `4 party/training docs excluded (${l1.info?.excluded})`);
  // new session: page reload → IndexedDB copy (+ 7-day top-up)
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.dartDB && window.currentUser, null, { timeout: 30000 });
  const l2 = await load();
  check(JSON.stringify(l2.modes) === JSON.stringify(["501", "501", "Cricket"]) && l2.info?.excluded === 4 && l2.info?.mode !== "full", `after reload (${JSON.stringify(l2.info)}): still only the real legs`);
  const cached = await page.evaluate(() => new Promise((res) => {
    const q = indexedDB.open("dt-games-cache"); q.onerror = () => res(null);
    q.onsuccess = () => { try { const db = q.result; const st = db.transaction(db.objectStoreNames[0]).objectStore(db.objectStoreNames[0]); const r = st.getAll(); r.onsuccess = () => res(JSON.stringify(r.result).match(/"mode":"(AtC|Shanghai|Bob27|CheckoutTraining)"/g)?.length ?? 0); r.onerror = () => res(null); } catch (e) { res(null); } };
  }));
  console.log(`  (raw IndexedDB cache still holds ${cached} party docs — filtered on output)`);

  // 3: statistics screen
  const st = await page.evaluate(async () => {
    const { state } = await import("./js/state.js");
    state.allPlayers = await window.dartDB.loadPlayers();
    const stats = await import("./js/stats.js");
    stats.renderStatsPlayerBar();
    document.querySelector('.time-btn[data-range="all"]')?.click();
    await stats.loadAndRenderStats();
    const cards = [...document.querySelectorAll("#stats-content .stat-card")].map((c) => [c.querySelector(".s-label")?.textContent?.trim(), c.querySelector(".s-value")?.textContent?.trim()]);
    return { cards, text: document.getElementById("stats-content").innerText, cacheModes: stats.allGamesCache.map((g) => g.mode) };
  });
  check(!/999|180/.test(st.text), `statistics screen shows no 999/180 (cards ${JSON.stringify(st.cards.slice(0, 6))})`);
  check(st.cards.some(([l, v]) => /spiele|games/i.test(l || "") && v === "2"), `X01 games = 2 (${JSON.stringify(st.cards.slice(0, 3))})`);
  check(st.cards.some(([, v]) => v === "55" || v === "55.0" || v === "55,0"), "Ø = 55 from the two real legs");
  check(!st.cacheModes.some((m) => !["501", "301", "Cricket"].includes(m)), `stats cache (coach input) holds no party docs (${st.cacheModes})`);

  // 4: coach prompt
  const prompt = await page.evaluate(async (pid) => {
    const { buildCoachPrompt } = await import("./js/coach.js");
    const stats = await import("./js/stats.js");
    return buildCoachPrompt(null, null, stats.allGamesCache, pid, null);
  }, seeded.pid);
  check(typeof prompt === "string" && prompt.length > 50 && !/999/.test(prompt), `coach prompt has no 999 (${prompt.length} chars)`);

  // 5: player profile
  const prof = await page.evaluate(async (pid) => {
    const { state } = await import("./js/state.js");
    const { updateAllPlayerStats } = await import("./js/setup.js");
    state.cfg = { ...state.cfg, players: ["ZZ Partytest"], playerIds: [pid] };
    await updateAllPlayerStats();
    return (await window.dartDB.loadPlayers()).find((p) => p.id === pid)?.stats;
  }, seeded.pid);
  check(prof && prof.games === 3 && prof.avgPerTurn === 55 && prof.highscore === 60 && prof.cricketGames === 1, `player profile: 3 games, Ø 55, highscore 60, 1 cricket (${JSON.stringify(prof)})`);
} finally {
  const cleanup = await page.evaluate(async () => { try { await window.deleteUserAccount(); return "guest data + account deleted"; } catch (e) { return "cleanup failed: " + e.message; } });
  console.log(cleanup);
  if (!/deleted/.test(cleanup)) failures.push(cleanup);
  await browser.close();
}
console.log(failures.length ? `\n${BASE}: FAILED (${failures.length}):\n - ` + failures.join("\n - ") : `\n${BASE}: ALL PASSED`);
process.exit(failures.length ? 1 : 0);
