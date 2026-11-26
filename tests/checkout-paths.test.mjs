/**
 * checkout-paths.test.mjs — the new checkout logic (js/checkout.js) as the
 * player sees and hears it, REAL playback (Chromium; BROWSER=webkit for WebKit):
 *
 *   1. X01, rest 139 (path changed by the poster table): "Player 2 requires
 *      139 · Checkout: Triple Nineteen, Triple Fourteen, Double Twenty" —
 *      el_co_139 played from the NEW clip (?h= = current index hash, ≠ the
 *      hash before this change); display shows T19 T14 D20; after T19 the
 *      path is kept (T14 D20, not 82's own Bull D16); after a miss with one
 *      dart left: no path
 *   2. 2 darts left: 48 → S16 D16, 56 → S16 D20 (setup single, not D8)
 *   3. Co-op 56–57: "Player 1 requires 56 · Checkout: Sixteen, Double Twenty"
 *      (el_co_56 new) and the same path on screen
 *
 * Usage: python3 -m http.server 8973 &  (repo root), then
 *   PLAYWRIGHT_BROWSERS_PATH=/var/tmp/pw [BROWSER=webkit] node tests/checkout-paths.test.mjs
 */
import fs from "fs";
import { execFileSync } from "child_process";
import { chromium, webkit } from "playwright";

const BROWSER = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const BASE = process.env.BASE || "http://localhost:8973";
const failures = [];
const check = (c, m) => { if (!c) { failures.push(m); console.log("  FAIL", m); } else console.log("  ok  ", m); };
const idx = JSON.parse(fs.readFileSync("assets/voice/george/index.json", "utf8"));
const oldIdx = (() => { try { return JSON.parse(execFileSync("git", ["show", "d86e24a:assets/voice/george/index.json"], { encoding: "utf8" })); } catch (e) { return null; } })();

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
async function openApp(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(/recaptcha/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const errors = [];
  page.on("pageerror", (e) => { if (!/due to access control checks|^no recaptcha$/.test(e.message)) errors.push(e.message); });
  await page.addInitScript(() => { localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_lang", "de"); });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    window.dartDB = { saveGame: async () => {}, saveCoopGame: async () => {}, loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [] };
    window.__x01 = await import("./js/x01.js?v=2");
    window.__state = (await import("./js/state.js")).state;
  });
  await page.mouse.click(5, 5);
  return { ctx, page, errors };
}
const start = (page, cfg) => page.evaluate(async (cfg) => { window.__state.cfg = cfg; window.__state.allPlayers = []; await window.__x01.startX01(0); }, cfg);
const hit = (page, label, score) => page.evaluate(([l, s]) => window.__x01.processX01Hit(l === "M" ? { label: "Miss", score: 0, miss: true } : { label: l, score: s }, null, null), [label, score]);
async function idle(page, max = 20000) {
  const t0 = Date.now(); let since = null;
  while (Date.now() - t0 < max) {
    if (await page.evaluate(() => window.__dtAudioIdle())) { since ??= Date.now(); if (Date.now() - since > 3500) return; } else since = null;
    await page.waitForTimeout(100);
  }
}
const shown = (page) => page.evaluate(() => document.querySelector("#x01-checkout-row span")?.textContent || document.querySelector("#lp-checkout")?.childNodes[0]?.textContent || "");
const trace = (page) => page.evaluate(() => window.__dtVoiceTrace.map((e) => ({ key: e.key, url: e.url, mode: e.mode })));
const hashOf = (u) => (u || "").match(/[?&]h=([0-9a-f]+)/)?.[1] || null;
/** URL the app resolved for a clip (blob: in the trace) → the bundled ?h= URL it was fetched from */
const fetchedUrls = [];

async function testX01(browser) {
  console.log(`\n[${BROWSER}] 1./2. X01`);
  const { ctx, page, errors } = await openApp(browser);
  page.on("request", (r) => { if (/assets\/voice\/george\/el_co_/.test(r.url())) fetchedUrls.push(r.url()); });
  await start(page, cfgFor("301", ["Anna", "Ben"], { startScore: 139 }));
  await page.waitForTimeout(1500);
  check((await shown(page)) === "T19 T14 D20", `x01 139: display T19 T14 D20 (${await shown(page)})`);
  await hit(page, "M"); await hit(page, "M"); await hit(page, "M");
  await idle(page);
  const k = (await trace(page)).map((e) => e.key).join(" ");
  check(/el_player_2 el_requires el_num_139 el_co_139/.test(k), `x01 139: "Player 2 requires 139" + path announced (${k})`);
  const u139 = fetchedUrls.find((u) => /el_co_139\.mp3/.test(u));
  check(hashOf(u139) === idx.hashes.el_co_139 && (!oldIdx || oldIdx.hashes.el_co_139 !== idx.hashes.el_co_139),
    `x01 139: new clip played (h=${hashOf(u139)}, index ${idx.hashes.el_co_139}, before ${oldIdx?.hashes.el_co_139})`);
  check((await page.evaluate(() => window.__dtVoiceTrace.find((e) => e.key === "el_co_139")?.mode)) === "webaudio", "x01 139: played via Web Audio");
  check((await shown(page)) === "T19 T14 D20", `x01 P2 139 display (${await shown(page)})`);
  await hit(page, "T19", 57);
  check((await shown(page)) === "T14 D20", `x01 139 after T19: path kept T14 D20 (${await shown(page)})`);
  const hl = await page.evaluate(() => document.querySelectorAll("#board-svg-checkout > *").length);
  check(hl === 2, `x01 139 after T19: board highlights 2 segments (${hl})`);
  await hit(page, "M");
  check((await shown(page)) === "", `x01 82 with 1 dart: no path shown (${await shown(page)})`);
  await ctx.close();

  const c2 = await openApp(browser);
  await start(c2.page, cfgFor("301", ["Anna", "Ben"], { startScore: 48 }));
  await c2.page.waitForTimeout(1200);
  await hit(c2.page, "M");
  check((await shown(c2.page)) === "S16 D16", `x01 48 with 2 darts: S16 D16 (${await shown(c2.page)})`);
  await c2.ctx.close();
  const c3 = await openApp(browser);
  await start(c3.page, cfgFor("301", ["Anna", "Ben"], { startScore: 56 }));
  await c3.page.waitForTimeout(1200);
  await hit(c3.page, "M");
  check((await shown(c3.page)) === "S16 D20", `x01 56 with 2 darts: S16 D20, not D8 D20 (${await shown(c3.page)})`);
  check(!errors.length && !c2.errors.length && !c3.errors.length, `x01: no page errors ${[...errors, ...c2.errors, ...c3.errors].join(" | ")}`);
  await c3.ctx.close();
}

async function testCoop(browser) {
  console.log(`\n[${BROWSER}] 3. Co-op`);
  const { ctx, page, errors } = await openApp(browser);
  const urls = [];
  page.on("request", (r) => { if (/assets\/voice\/george\/el_co_56/.test(r.url())) urls.push(r.url()); });
  await start(page, cfgFor("Coop", ["Anna", "Ben"], { coop: { from: 56, to: 57 } }));
  await page.waitForTimeout(1500);
  await idle(page);
  const k = (await trace(page)).map((e) => e.key).join(" ");
  check(/el_player_1 el_requires el_num_56 el_co_56/.test(k), `coop 56: "Player 1 requires 56" + path (${k})`);
  check(hashOf(urls[0]) === idx.hashes.el_co_56 && (!oldIdx || oldIdx.hashes.el_co_56 !== idx.hashes.el_co_56), `coop 56: new clip (h=${hashOf(urls[0])})`);
  check((await shown(page)) === "S16 D20", `coop 56: display S16 D20 (${await shown(page)})`);
  check(!errors.length, `coop: no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

const browser = await (BROWSER === "webkit" ? webkit : chromium).launch();
try { await testX01(browser); await testCoop(browser); } finally { await browser.close(); }
if (failures.length) { console.error(`\nFAILED [${BROWSER}]:\n - ` + failures.join("\n - ")); process.exit(1); }
console.log(`\ncheckout-paths [${BROWSER}]: all assertions passed (${BASE})`);
