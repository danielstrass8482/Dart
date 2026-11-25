/**
 * player-callout.test.mjs — players are announced by throwing order
 * ("Player 1" … "Player 8", clips el_player_<n>), never by name, and every
 * player carries a visible P1…P8 badge next to the unchanged name.
 *
 *   1. X01 301 with 3 players (Anna, Ben, Cleo): after round 1 everyone is
 *      on 121 → "Player 1 requires 121", "Player 2 …", "Player 3 …" in that
 *      order (each followed by "requires" + the number); badges P1/P2/P3
 *      visible in the landscape panel, names unchanged.
 *   2. Co-op Checkout 80–82 with 3 players on a phone in portrait:
 *      "Player 1 requires 80" → "Player 2 requires 60" → "Player 3 requires
 *      40"; badges visible in the portrait score strip.
 *   3. Never a name clip, never a request to a Cloud Function / Storage /
 *      ElevenLabs for audio; bundled clips are requested with the content
 *      hash from assets/voice/george/index.json (?h=); no page errors.
 *
 * Audio playback is stubbed (each clip "ends" after 15 ms) and every played
 * clip is mapped back to its key (fetch → blob → object URL → Audio), so the
 * check covers the real playback order, repeats included. Service worker
 * blocked → no background warm-up requests. The UI currently allows at most
 * 2 selected players, so the 3-player games are started through the game
 * engine directly (same as tests/coop.test.mjs).
 *
 * Usage: python3 -m http.server 8973 &  (repo root), then
 *   node tests/player-callout.test.mjs
 *   BASE=https://play.darttrainer.app node tests/player-callout.test.mjs   (live)
 * Exit 0 = all assertions passed. SHOTS=<dir> writes screenshots.
 */
import { chromium as _chromium, webkit } from "playwright";
// BROWSER=webkit runs the same test in the Safari engine (Chromium-only launch args are dropped).
const chromium = process.env.BROWSER === "webkit" ? { launch: (o = {}) => webkit.launch({ ...o, args: undefined }) } : _chromium;

const BASE = process.env.BASE || "http://localhost:8973";
const SHOTS = process.env.SHOTS || null;
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); else console.log("  ok ", msg.split(":")[0]); };
const PLAYERS = ["Anna", "Ben", "Cleo"];

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

async function openApp(browser, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(/recaptcha/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" })); // irrelevant here; its script can hang and hold back "load"
  const requests = [], foreign = [], errors = [];
  page.on("pageerror", (e) => { if (!/due to access control checks|^no recaptcha$/.test(e.message)) errors.push(e.message); }); // WebKit reports blocked/cancelled loads (local AppCheck ping) as page errors
  page.on("request", (r) => {
    const u = r.url();
    if (/\/assets\/voice\/[^/]+\/[^/?]+\.mp3/.test(u)) requests.push(u);
    else if (/cloudfunctions|run\.app|firebasestorage|elevenlabs/.test(u) && /mp3|dartTTS|darttts|Voice|voice/.test(u)) foreign.push(u);
  });
  await page.addInitScript(() => {
    localStorage.setItem("dart_onboarding_done", "true");
    localStorage.setItem("dart_lang", "de");
    const blobKey = new WeakMap();
    window.__urlKey = {}; window.__played = [];
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...a) => {
      const r = await origFetch(...a);
      const m = String(a[0]?.url || a[0]).match(/(?:^|\/)assets\/voice\/[^/]+\/([^/?]+)\.mp3/);
      if (m) { const ob = r.blob.bind(r); r.blob = async () => { const b = await ob(); blobKey.set(b, m[1]); return b; }; }
      return r;
    };
    const oc = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = oc(b); if (blobKey.has(b)) window.__urlKey[u] = blobKey.get(b); return u; };
    window.Audio = class {
      constructor(u) { this.src = u; }
      play() { window.__played.push(window.__urlKey[this.src] || this.src); setTimeout(() => this.onended?.(), 15); return Promise.resolve(); }
      pause() {}
    };
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForFunction(() => document.querySelector(".screen.active")?.id === "auth-screen", null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    window.dartDB = { saveGame: async () => {}, saveCoopGame: async () => {}, loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [] };
    window.__x01 = await import("./js/x01.js?v=2");
    window.__state = (await import("./js/state.js")).state;
  });
  return { ctx, page, requests, foreign, errors };
}

async function start(page, cfg) {
  await page.evaluate(async (cfg) => {
    window.__state.cfg = cfg; window.__state.allPlayers = [];
    await window.__x01.startX01(0);
  }, cfg);
}

/** ["h",label,score] hit, ["m"] miss, ["w",ms] wait */
async function play(page, steps) {
  await page.evaluate(async (steps) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const [k, a, b] of steps) {
      if (k === "h") window.__x01.processX01Hit({ label: a, score: b }, null, null);
      else if (k === "m") window.__x01.processX01Hit({ label: "Miss", score: 0, miss: true }, null, null);
      else if (k === "w") await sleep(a);
      await sleep(25);
    }
  }, steps);
}

/** Badges inside `sel`: text, visible (non-empty box inside the viewport), and the name next to it. */
async function badges(page, sel) {
  return page.evaluate((sel) => [...document.querySelectorAll(`${sel} [data-p-badge]`)].map((b) => {
    const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const vis = r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth
      && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.3;
    return { text: b.textContent, vis, line: b.parentElement.textContent.trim() };
  }), sel);
}

const callouts = (played) => played.filter((k) => /^el_player_|^name_/.test(k));
/** "Player N" must be immediately followed by "requires" and a number clip. */
const wellFormed = (played) => played.every((k, i) => !k.startsWith("el_player_") || (played[i + 1] === "el_requires" && /^el_num_\d+$/.test(played[i + 2] || "")));

async function checkHashes(page, requests, label) {
  const idx = await page.evaluate(async () => (await fetch("assets/voice/george/index.json", { cache: "no-cache" })).json());
  const bad = requests.filter((u) => { const m = u.match(/\/([^/?]+)\.mp3\?h=([0-9a-f]+)/); return !m || idx.hashes[m[1]] !== m[2]; });
  check(bad.length === 0, `${label} hash URLs: every clip requested as <key>.mp3?h=<index hash> (bad: ${bad.join(", ")})`);
  const players = requests.filter((u) => /el_player_/.test(u));
  check(players.length > 0 && players.every((u) => /\/assets\/voice\/george\/el_player_[1-3]\.mp3\?h=/.test(u)),
    `${label} player clips come from the bundled George voice: ${players.map((u) => u.split("/").pop()).join(", ")}`);
}

async function testX01(browser) {
  console.log("X01 301, 3 players, iPad landscape");
  const { ctx, page, requests, foreign, errors } = await openApp(browser, { width: 1180, height: 820 });
  await start(page, cfgFor("301", PLAYERS));
  await page.waitForTimeout(1500);
  const T = [["h", "T20", 60], ["h", "T20", 60], ["h", "T20", 60]];
  await play(page, [...T, ["w", 3500], ...T, ["w", 3500], ...T, ["w", 4000], // all on 121 → Player 1 requires 121
    ["h", "20", 20], ["m"], ["m"], ["w", 4000],                                // → Player 2 requires 121
    ["h", "20", 20], ["m"], ["m"], ["w", 4000]]);                              // → Player 3 requires 121
  const played = await page.evaluate(() => window.__played);
  check(JSON.stringify(callouts(played)) === JSON.stringify(["el_player_1", "el_player_2", "el_player_3"]),
    `x01 call-out order: expected Player 1 → 2 → 3, got ${callouts(played).join(" → ")}`);
  check(wellFormed(played) && played.filter((k) => k === "el_num_121").length === 3,
    `x01 "Player N requires 121" ×3: ${played.join(" ")}`);
  const b = await badges(page, "#lp-players");
  check(JSON.stringify(b.map((x) => x.text)) === JSON.stringify(["P1", "P2", "P3"]) && b.every((x) => x.vis),
    `x01 badges P1/P2/P3 visible in the landscape panel: ${JSON.stringify(b)}`);
  check(b.every((x, i) => x.line.includes(PLAYERS[i])), `x01 names unchanged next to the badges: ${b.map((x) => x.line).join(" | ")}`);
  const strip = await page.evaluate(() => [...document.querySelectorAll("#score-strip [data-p-badge]")].map((x) => x.textContent));
  check(JSON.stringify(strip) === JSON.stringify(["P1", "P2", "P3"]), `x01 badges in the portrait score strip too: ${strip.join(",")}`);
  await checkHashes(page, requests, "x01");
  check(foreign.length === 0, `x01 no audio from Functions/Storage/ElevenLabs: ${foreign.join(", ")}`);
  check(errors.length === 0, `x01 no page errors: ${errors.join(" | ")}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/player-callout-x01-landscape.png` });
  await ctx.close();
}

async function testCoop(browser) {
  console.log("Co-op Checkout 80–82, 3 players, phone portrait");
  const { ctx, page, requests, foreign, errors } = await openApp(browser, { width: 390, height: 844 });
  await start(page, cfgFor("Coop", PLAYERS, { coop: { from: 80, to: 82 } }));
  await page.waitForTimeout(3500);                         // Player 1 requires 80
  await play(page, [["h", "20", 20], ["m"], ["m"], ["w", 3500],   // rest 60 → Player 2 requires 60
                    ["h", "20", 20], ["m"], ["m"], ["w", 3500]]); // rest 40 → Player 3 requires 40
  const played = await page.evaluate(() => window.__played);
  check(JSON.stringify(callouts(played)) === JSON.stringify(["el_player_1", "el_player_2", "el_player_3"]),
    `coop call-out order: expected Player 1 → 2 → 3, got ${callouts(played).join(" → ")}`);
  const seq = played.filter((k) => /^el_player_|^el_num_/.test(k)).join(" ");
  check(wellFormed(played) && seq === "el_player_1 el_num_80 el_player_2 el_num_60 el_player_3 el_num_40",
    `coop "Player 1 requires 80", "Player 2 requires 60", "Player 3 requires 40": ${played.join(" ")}`);
  const b = await badges(page, "#score-strip");
  check(JSON.stringify(b.map((x) => x.text)) === JSON.stringify(["P1", "P2", "P3"]) && b.every((x) => x.vis),
    `coop badges P1/P2/P3 visible in the portrait strip: ${JSON.stringify(b)}`);
  check(b.every((x, i) => x.line.includes(PLAYERS[i])), `coop names unchanged next to the badges: ${b.map((x) => x.line).join(" | ")}`);
  await checkHashes(page, requests, "coop");
  check(foreign.length === 0, `coop no audio from Functions/Storage/ElevenLabs: ${foreign.join(", ")}`);
  check(errors.length === 0, `coop no page errors: ${errors.join(" | ")}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/player-callout-coop-portrait.png` });
  await ctx.close();
}

const browser = await chromium.launch();
try {
  await testX01(browser);
  await testCoop(browser);
} finally { await browser.close(); }
if (failures.length) { console.error(`\nFAILED (${BASE}):\n - ` + failures.join("\n - ")); process.exit(1); }
console.log(`\nplayer-callout: all assertions passed (${BASE})`);
