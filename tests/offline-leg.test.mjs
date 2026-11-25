/**
 * offline-leg.test.mjs — Proves the core requirement of the TTS rebuild:
 * once a leg's clips have been resolved once (online), the same leg replays
 * fully offline with zero network requests to Storage/ElevenLabs and zero
 * browser-speechSynthesis fallback. Players are announced as "Player 1/2"
 * (el_player_<n>), never by name — any name works offline.
 *
 * Usage:
 *   npm install playwright --no-save   # one-time, not a runtime dependency
 *   npx playwright install chromium --with-deps   # one-time
 *   python3 -m http.server 8973 &      # serve the repo root
 *   node tests/offline-leg.test.mjs
 *
 * Exit code 0 = passed (no offline network requests — responses served from
 * the web build's service-worker cache count as local — and no
 * speechSynthesis calls). Exit code 1 = failed, offending requests printed.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8973";
const NAME_1 = "Daniel";
const NAME_2 = "Zbigniewxyzunseen";

function buildCfg() {
  const players = [NAME_1, NAME_2];
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

// player0 misses 3x -> advance to player1 (remaining 140) -> fires
// "Player Two requires 140" + checkout path.
// player1 scores 60 (20,20,20) -> advance back to player0 (remaining still
// 140, untouched) -> fires "Player One requires 140" + checkout path, and
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
  page.on("request", (req) => { if (requestsByPass[currentPass]) requestsByPass[currentPass].push(req); });
  // Web build: a request answered from the service worker's offline cache
  // never touches the network — that is local playback, not a network call.
  const servedBySW = new Set();
  page.on("requestfinished", async (req) => { try { const r = await req.response(); if (r && r.fromServiceWorker() && r.ok()) servedBySW.add(req); } catch (e) {} });

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
  await page.waitForTimeout(500); // let requestfinished handlers settle
  const offlineServedBySW = requestsByPass.offline.filter(r => servedBySW.has(r)).map(r => r.url());
  const offlineNetwork = requestsByPass.offline.filter(r => !r.url().startsWith("blob:") && !servedBySW.has(r)).map(r => r.url());

  console.log(JSON.stringify({
    onlineRequestCount: requestsByPass.online.length,
    onlineClipRequests: requestsByPass.online.filter(r => r.url().includes("/assets/voice/")).length,
    offlineServedFromServiceWorkerCache: offlineServedBySW,
    offlineRealNetworkRequests: offlineNetwork,
    offlineElapsedMs: elapsedMs,
    speechSynthesisCallsOffline: speechCallsOffline,
  }, null, 2));

  await browser.close();
  process.exit(offlineNetwork.length === 0 && speechCallsOffline.length === 0 ? 0 : 1);
}

run();
