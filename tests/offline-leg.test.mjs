/**
 * offline-leg.test.mjs — Proves the core requirement of the TTS rebuild:
 * once a leg's clips have been resolved once (online), the same leg replays
 * fully offline with zero network requests to Storage/ElevenLabs/the
 * dartVoiceName function and zero browser-speechSynthesis fallback, for
 * both a name from the library (data/names.json) and a name that is NOT in
 * it (announced without the name, per spec, never via the browser voice).
 *
 * Usage:
 *   npm install playwright --no-save   # one-time, not a runtime dependency
 *   npx playwright install chromium --with-deps   # one-time
 *   python3 -m http.server 8973 &      # serve the repo root
 *   node tests/offline-leg.test.mjs
 *
 * Exit code 0 = passed (no offline network requests beyond a harmless local
 * 404 attempt for the never-generated unknown name, no speechSynthesis
 * calls). Exit code 1 = failed, with the offending requests/calls printed.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8973";
const KNOWN_NAME = "Daniel";
const UNKNOWN_NAME = "Zbigniewxyzunseen";

function buildCfg() {
  const players = [KNOWN_NAME, UNKNOWN_NAME];
  return {
    mode: "501", startScore: 140,
    players, playerIds: players.map(() => null), isBot: players.map(() => false),
    totalSets: 1, setsToWin: 1, setWins: players.map(() => 0), currentSet: 1,
    totalLegs: 1, legsToWin: 1, legWins: players.map(() => 0), currentLeg: 1,
    rounds: 8, healthData: null,
    currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0,
    context: "casual", tournamentId: null, tournamentName: null,
  };
}

// player0 (KNOWN_NAME) misses 3x -> advance to player1 (UNKNOWN_NAME,
// remaining 140) -> fires requires+checkout-path for the UNKNOWN name.
// player1 scores 60 (20,20,20) -> advance back to player0 (remaining still
// 140, untouched) -> fires requires+checkout-path for the KNOWN name, and
// the 60-score announcement fires for player1's turn too.
async function playLeg(page) {
  await page.evaluate(async () => {
    const { state } = await import("./js/state.js");
    const x01 = await import("./js/x01.js");
    state.cfg = window.__cfg;
    state.allPlayers = [];
    await x01.startX01(0);

    const throwHit = (label, score) => x01.processX01Hit({ label, score, svgX: null, svgY: null });
    throwHit("Miss", 0); throwHit("Miss", 0); throwHit("Miss", 0); // player0: No Score -> advance
    // Real play is never faster than ~1.5-2.5s between darts; the
    // requires/checkout-path announcement for the player just advanced to
    // is scheduled 1.5s/2.5s out and reads state.x01.current live when it
    // fires — advancing again before it fires would misattribute it to
    // whoever is current BY THEN, so wait for it to actually finish first.
    await new Promise(r => setTimeout(r, 5500));
    throwHit("20", 20); throwHit("20", 20); throwHit("20", 20); // player1: scores 60 -> advance
    await new Promise(r => setTimeout(r, 5500));
  });
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let currentPass = "init";
  const requestsByPass = { online: [], offline: [] };
  page.on("request", (req) => { if (requestsByPass[currentPass]) requestsByPass[currentPass].push(req.url()); });

  await page.addInitScript(() => {
    window.__speechCalls = [];
    const ss = window.speechSynthesis;
    if (ss) {
      const origSpeak = ss.speak.bind(ss);
      ss.speak = (utt) => { if (utt && utt.text) window.__speechCalls.push(utt.text); return origSpeak(utt); };
    }
  });

  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.evaluate((cfg) => { window.__cfg = cfg; }, buildCfg());

  // ── Pass 1: ONLINE — warms IndexedDB for every clip this leg needs.
  currentPass = "online";
  await playLeg(page);

  // ── Pass 2: OFFLINE — replay the identical leg; everything must resolve
  // from IndexedDB with zero network activity and zero browser-voice calls.
  await page.context().setOffline(true);
  await page.evaluate(() => { window.__speechCalls = []; });
  currentPass = "offline";
  const t0 = Date.now();
  await playLeg(page);
  const elapsedMs = Date.now() - t0;

  const speechCallsOffline = await page.evaluate(() => window.__speechCalls);
  const offlineNetwork = requestsByPass.offline.filter(u => !u.startsWith("blob:"));

  console.log(JSON.stringify({
    onlineRequestCount: requestsByPass.online.length,
    onlineClipUrls: requestsByPass.online.filter(u => u.includes("/assets/voice/")),
    offlineRealNetworkRequests: offlineNetwork,
    offlineElapsedMs: elapsedMs,
    speechSynthesisCallsOffline: speechCallsOffline,
  }, null, 2));

  await browser.close();
  process.exit(offlineNetwork.length === 0 && speechCallsOffline.length === 0 ? 0 : 1);
}

run();
