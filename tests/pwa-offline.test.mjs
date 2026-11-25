/**
 * pwa-offline.test.mjs — Proves the web/PWA build is fully usable offline
 * after ONE online visit, without the user ever waiting for the voice clips:
 *
 *   1. Fresh profile, online: app becomes usable; the service worker
 *      registers only afterwards and the default voice warms in the
 *      background (js/pwa.js, js/voiceClips.js warmDefaultVoice()).
 *   2. Warm-up finishes: all clips of the default voice are in the SW cache.
 *   3. IndexedDB clip cache is deleted (so only the SW cache can serve),
 *      network goes OFFLINE, page is RELOADED from scratch.
 *   4. App boots offline (shell + Firebase SDK from cache), every one of the
 *      default voice's clips resolves to playable audio, and an X01 leg
 *      plays its announcements — zero failed requests to our origin, zero
 *      browser-voice (speechSynthesis) fallback.
 *
 * Usage (same setup as tests/offline-leg.test.mjs):
 *   python3 -m http.server 8973 &   # serve the repo root
 *   node tests/pwa-offline.test.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8973";
const ready = () => {
  const sp = document.getElementById("splash-screen");
  return sp && sp.style.display === "none" && typeof window.showScreen === "function"
    && typeof window.signInAsGuest === "function" && !!document.querySelector(".screen.active");
};

async function run() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    try { localStorage.setItem("dart_onboarding_done", "true"); } catch (e) {}
    window.__speechCalls = []; window.__played = [];
    const ss = window.speechSynthesis;
    if (ss) { const o = ss.speak.bind(ss); ss.speak = (u) => { window.__speechCalls.push(u?.text); return o(u); }; }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); return play.call(this); };
  });
  const page = await ctx.newPage();
  const result = { ok: false };

  // ── 1+2: first visit online
  const t0 = Date.now();
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(ready, null, { timeout: 120000 });
  result.firstVisitReadyMs = Date.now() - t0;
  result.controlledAtReady = await page.evaluate(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(() => ["done", "partial", "no-index", "skipped"].includes(window.__voiceWarm?.state), null, { timeout: 600000, polling: 500 });
  result.warm = await page.evaluate(() => ({ ...window.__voiceWarm }));
  result.voiceCacheEntries = await page.evaluate(async () => (await (await caches.open("dt-voice-v1")).keys()).length);

  // ── 3: wipe IndexedDB clips, go offline, reload from scratch
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase("dart_voice_cache"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await ctx.setOffline(true);
  const failed = [];
  page.on("requestfailed", r => { if (r.url().startsWith(BASE)) failed.push(r.url()); });
  const t1 = Date.now();
  await page.reload();
  await page.waitForFunction(ready, null, { timeout: 60000 });
  result.offlineReloadReadyMs = Date.now() - t1;

  // ── 4: every default-voice clip resolves offline; play a leg
  result.offlineClips = await page.evaluate(async () => {
    const vc = await import("./js/voiceClips.js");
    const { keys } = await (await fetch("assets/voice/george/index.json")).json();
    let okCount = 0; const missing = [];
    for (const k of keys) { (await vc.resolveClipURL("george", k)) ? okCount++ : missing.push(k); }
    // decode-check a sample: real audio with a sane duration
    const sample = ["el_score_180b", "el_game_on", "el_bust", "el_co_170", "el_player_1"];
    const durations = {};
    for (const k of sample) {
      const url = await vc.resolveClipURL("george", k);
      durations[k] = await new Promise(res => { const a = new Audio(url); a.onloadedmetadata = () => res(+a.duration.toFixed(2)); a.onerror = () => res(null); });
    }
    return { total: keys.length, resolved: okCount, missing: missing.slice(0, 10), durations };
  });
  await page.evaluate(async () => {
    const players = ["Daniel", "Tom"];
    window.__played = []; window.__speechCalls = [];
    const { state } = await import("./js/state.js");
    const x01 = await import("./js/x01.js");
    state.cfg = { mode: "501", startScore: 140, players, playerIds: [null, null], isBot: [false, false],
      totalSets: 1, setsToWin: 1, setWins: [0, 0], currentSet: 1, totalLegs: 1, legsToWin: 1, legWins: [0, 0], currentLeg: 1,
      rounds: 8, healthData: null, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual", tournamentId: null, tournamentName: null };
    state.allPlayers = [];
    await x01.startX01(0);
    const hit = (label, score) => x01.processX01Hit({ label, score, svgX: null, svgY: null });
    hit("Miss", 0); hit("Miss", 0); hit("Miss", 0);
    await new Promise(r => setTimeout(r, 5500));
    hit("20", 20); hit("20", 20); hit("20", 20);
    await new Promise(r => setTimeout(r, 5500));
  });
  result.offlineLeg = await page.evaluate(() => ({ clipsPlayed: window.__played.length, speechSynthesisCalls: window.__speechCalls.length }));
  result.failedOwnOriginRequestsOffline = failed;

  result.ok = result.warm.state === "done" && result.voiceCacheEntries === result.warm.total
    && result.offlineClips.resolved === result.offlineClips.total
    && Object.values(result.offlineClips.durations).every(d => d > 0.2)
    && result.offlineLeg.clipsPlayed >= 3 && result.offlineLeg.speechSynthesisCalls === 0
    && failed.length === 0;
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.ok ? 0 : 1);
}

run();
