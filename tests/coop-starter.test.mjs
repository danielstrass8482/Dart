/**
 * coop-starter.test.mjs — Co-op Checkout: the player who STARTS a value
 * rotates with the value (value 1 Player 1, value 2 Player 2, value 3
 * Player 1 …; 3+ players round robin), regardless of who checked out, missed
 * or bust. Undo across a value boundary restores the right starter. The P
 * badge of the active player and the "Player N requires …" call-out match the
 * actual starter.
 *
 *   1. 2 players, 80–83: value 80 P1 starts, P2 checks out · value 81 P2
 *      starts and checks out · value 82 P1 starts, P1 busts, P2 checks out ·
 *      value 83 P2 starts → starters P1, P2, P1, P2
 *   2. 3 players, 2–5: starters P1, P2, P3, P1 (checkers vary)
 *   3. Undo across the boundary 82 → 81 → starter of 81 again, redo the
 *      checkout → 82 starter P1 again
 *
 * Audio stubbed on the media element (each clip "ends" after 15 ms).
 * Usage: python3 -m http.server 8973 &  (repo root), then node tests/coop-starter.test.mjs
 */
import { chromium as _chromium, webkit } from "playwright";
const chromium = process.env.BROWSER === "webkit" ? webkit : _chromium;
const BASE = process.env.BASE || "http://localhost:8973";
const failures = [];
const check = (c, m) => { if (!c) { failures.push(m); console.log("  FAIL", m); } else console.log("  ok  ", m); };

function cfgFor(players, from, to) {
  return {
    mode: "Coop", startScore: 301, coop: { from, to },
    players, playerIds: players.map(() => null), isBot: players.map(() => false),
    totalSets: 1, setsToWin: 1, setWins: players.map(() => 0), currentSet: 1,
    totalLegs: 1, legsToWin: 1, legWins: players.map(() => 0), currentLeg: 1,
    rounds: 20, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual",
    accumulated: { turnScores: players.map(() => []), historicThrows: players.map(() => []), checkoutAttempts: players.map(() => 0),
      checkoutHits: players.map(() => 0), checkoutScores: players.map(() => []), first9: players.map(() => null) },
    legStatsHistory: [],
  };
}

async function openApp(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(/recaptcha/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const errors = [];
  page.on("pageerror", (e) => { if (!/due to access control checks|^no recaptcha$/.test(e.message)) errors.push(e.message); });
  await page.addInitScript(() => {
    localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_lang", "de");
    localStorage.setItem("dart_audio_engine", "element");
    const blobKey = new WeakMap(); window.__urlKey = {}; window.__played = [];
    const of = window.fetch.bind(window);
    window.fetch = async (...a) => {
      const r = await of(...a);
      const m = String(a[0]?.url || a[0]).match(/assets\/voice\/[^/]+\/([^/?]+)\.mp3/);
      if (m) { const ob = r.blob.bind(r); r.blob = async () => { const b = await ob(); blobKey.set(b, m[1]); return b; }; }
      return r;
    };
    const oc = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = oc(b); if (blobKey.has(b)) window.__urlKey[u] = blobKey.get(b); return u; };
    window.Audio = class { constructor(u) { this.src = u; } play() { window.__played.push(window.__urlKey[this.src] || this.src); setTimeout(() => this.onended?.(), 15); return Promise.resolve(); } pause() {} };
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    window.dartDB = { saveGame: async () => {}, saveCoopGame: async () => {}, loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [] };
    window.__x01 = await import("./js/x01.js?v=2");
    window.__state = (await import("./js/state.js")).state;
  });
  return { ctx, page, errors };
}

async function play(page, steps) {
  await page.evaluate(async (steps) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const [k, a, b] of steps) {
      if (k === "h") window.__x01.processX01Hit({ label: a, score: b }, null, null);
      else if (k === "m") window.__x01.processX01Hit({ label: "Miss", score: 0, miss: true }, null, null);
      else if (k === "u") document.getElementById("x01-undo").click();
      else if (k === "w") await sleep(a);
      await sleep(30);
    }
  }, steps);
}
const snap = (page) => page.evaluate(() => {
  const x = window.__state.x01, c = x.coop;
  return { value: c.values[c.idx], idx: c.idx, current: x.current, results: c.results.map((r) => [r.value, r.by]),
    badge: document.querySelector("#score-strip .score-cell.active [data-p-badge]")?.textContent || null };
});
/** "Player N" call-outs played so far (stubbed audio). */
const callouts = (page) => page.evaluate(() => window.__played.filter((k) => /^el_player_\d$/.test(k)));

async function testTwo(browser) {
  console.log("1. two players, 80–83");
  const { ctx, page, errors } = await openApp(browser);
  await page.evaluate(async (cfg) => { window.__state.cfg = cfg; window.__state.allPlayers = []; await window.__x01.startX01(0); }, cfgFor(["Anna", "Ben"], 80, 83));
  await page.waitForTimeout(2200);
  const starters = [], badges = [];
  let s = await snap(page); starters.push(s.current); badges.push(s.badge);
  // 80: P1 scores 60, P2 checks out D10
  await play(page, [["h", "20", 20], ["h", "20", 20], ["h", "20", 20], ["w", 2600], ["h", "D10", 20], ["w", 2600]]);
  s = await snap(page); starters.push(s.current); badges.push(s.badge);
  // 81: P2 (starter) checks out T19 D12
  await play(page, [["h", "T19", 57], ["h", "D12", 24], ["w", 2600]]);
  s = await snap(page); starters.push(s.current); badges.push(s.badge);
  // 82: P1 starts, busts (T20 T20), P2 checks out T14 D20
  await play(page, [["h", "T20", 60], ["h", "T20", 60], ["w", 4000], ["h", "T14", 42], ["h", "D20", 40], ["w", 2600]]);
  s = await snap(page); starters.push(s.current); badges.push(s.badge);
  check(JSON.stringify(starters) === "[0,1,0,1]", `two: starters per value P1,P2,P1,P2 (got ${starters.map((i) => "P" + (i + 1)).join(",")})`);
  check(JSON.stringify(badges) === '["P1","P2","P1","P2"]', `two: active P badge matches the starter (${badges.join(",")})`);
  check(JSON.stringify(s.results) === "[[80,1],[81,1],[82,1]]", `two: checkouts by P2, P2, P2 (${JSON.stringify(s.results)})`);
  const c = await callouts(page);
  // value starts: Player 1 (80), Player 2 (81), Player 1 (82), Player 2 (83); plus P2 on 20 and after P1's bust
  check(c[0] === "el_player_1" && c.includes("el_player_2"), `two: call-outs ${c.join(" ")}`);
  const played = await page.evaluate(() => window.__played.join(" "));
  check(/el_player_2 el_requires el_num_81/.test(played) && /el_player_1 el_requires el_num_82/.test(played) && /el_player_2 el_requires el_num_83/.test(played),
    `two: "Player N requires <value>" names the starter of 81/82/83`);
  // 3. Undo across the boundary 83 → back into 82 (P2's finishing visit), redo → 83 starter P2 again
  await play(page, [["u"], ["w", 300]]);
  s = await snap(page);
  check(s.value === 82 && s.current === 1, `undo: back in 82 with the finisher P2 (${JSON.stringify(s)})`);
  await play(page, [["h", "D20", 40], ["w", 600]]);
  s = await snap(page);
  check(s.value === 83 && s.current === 1 && s.badge === "P2", `undo + redo: 83 started by P2 again (${JSON.stringify(s)})`);
  // Undo twice across 82 → 81: back to P2's checkout visit of 81, redo → 82 starter P1
  await play(page, [["u"], ["u"], ["u"], ["u"], ["u"], ["u"], ["w", 300]]);
  s = await snap(page);
  check(s.value === 81 && s.current === 1, `undo ×6: back in 81 (P2's visit) (${JSON.stringify(s)})`);
  await play(page, [["h", "D12", 24], ["w", 600]]);
  s = await snap(page);
  check(s.value === 82 && s.current === 0 && s.badge === "P1", `redo 81 → 82 starter P1 (${JSON.stringify(s)})`);
  check(!errors.length, `two: no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

async function testThree(browser) {
  console.log("2. three players, 2–5");
  const { ctx, page, errors } = await openApp(browser);
  await page.evaluate(async (cfg) => { window.__state.cfg = cfg; window.__state.allPlayers = []; await window.__x01.startX01(0); }, cfgFor(["Anna", "Ben", "Cleo"], 2, 5));
  await page.waitForTimeout(2200);
  const starters = [];
  let s = await snap(page); starters.push(s.current);
  await play(page, [["h", "D1", 2], ["w", 400]]);                                         // 2: P1 checks out
  s = await snap(page); starters.push(s.current);
  await play(page, [["m"], ["m"], ["m"], ["w", 2400], ["h", "1", 1], ["h", "D1", 2], ["w", 400]]); // 3: P2 misses, P3 checks out
  s = await snap(page); starters.push(s.current);
  await play(page, [["h", "D2", 4], ["w", 400]]);                                          // 4: P3 checks out
  s = await snap(page); starters.push(s.current);
  check(JSON.stringify(starters) === "[0,1,2,0]", `three: starters P1,P2,P3,P1 (got ${starters.map((i) => "P" + (i + 1)).join(",")})`);
  check(s.badge === "P1", `three: badge P1 on value 5 (${s.badge})`);
  check(!errors.length, `three: no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

const browser = await chromium.launch();
try { await testTwo(browser); await testThree(browser); } finally { await browser.close(); }
if (failures.length) { console.error("\nFAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("\ncoop-starter: all assertions passed");
