/**
 * voice-upgrade.webkit.test.mjs — Announcements survive an app upgrade and a
 * missing/broken clip, in WebKit (Safari engine) with REAL audio playback.
 *
 * Background (2026-11-25): on the iPad PWA nothing was announced in games
 * while the settings voice test (live TTS function) worked. Cause: the
 * account's voice is Jerry B; non-default voices were downloaded from
 * Firebase Storage, whose bucket had no CORS rule → every fetch() failed in
 * the browser → every clip was skipped silently. Fixed by (a) a CORS rule
 * on the bucket (storage.cors.json), (b) the web app loading every voice
 * same-origin (assets/voice/<v>/, part of the GitHub Pages deploy), (c) the
 * audio queue logging and skipping single failed/hanging clips.
 *
 * Own static server with GitHub-Pages-like headers (max-age=600 + ETag) so
 * the HTTP cache really is in play, serving a switchable app root:
 *
 *   Phase OLD     app state of 59d68c7 (before "Player 1–8"): old sw.js
 *                 installed + its caches, old JS, voice clips incl. name
 *                 clips, localStorage incl. voice choice, IndexedDB with
 *                 hash-less legacy entries and a name_* clip.
 *   Phase UPGRADE root switched to the current tree → app start (old worker
 *                 still in control) → second app start ("PWA closed and
 *                 reopened"): the new worker and the new modules run.
 *   Phase PLAY    for George, Haseeb, Jerry B and Guy: X01 301 with 2
 *                 players → "Player 1 requires 121" + checkout path,
 *                 "Player 2 requires 121" + checkout path, scores. Every
 *                 clip is fetched from the same origin, mapped back to its
 *                 key and must really play to its end (ended event, no
 *                 media error); no Storage/Function requests for audio.
 *   Phase MIXED   new JS with the OLD index.json (no el_player_* entries):
 *                 call-outs still play.
 *   Phase BROKEN  el_player_2 404, el_requires corrupt bytes, el_co_121
 *                 hangs (no response): each one is skipped with a console
 *                 warning, the rest of the announcement still plays.
 *   Phase UPDATE  another deploy while the app idles on the home screen:
 *                 coming back to the foreground installs it and the page
 *                 reloads itself onto it (js/pwa.js keepCurrent).
 *
 * Usage: node tests/voice-upgrade.webkit.test.mjs   (no external server)
 *        BROWSER=chromium to run the same in Chromium.
 *        Needs the Playwright WebKit build (+ `playwright install-deps webkit`).
 */
import { webkit, chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_COMMIT = process.env.OLD_COMMIT || "59d68c7";
const ENGINE = process.env.BROWSER === "chromium" ? chromium : webkit;
const VOICES = [["george", "JBFqnCBsd6RMkjVDRZzb"], ["haseeb", "dllHSct4GokGc1AH9JwT"], ["jerry", "zDBYcuJrpuZ6YQ7AgRUw"], ["guy", "34lPwSZ54D8fWbX1aHzk"]];

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`); };
const h10 = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);

// ── app roots ───────────────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "voice-upgrade-"));
const OLD = path.join(TMP, "old"), NEW = path.join(TMP, "new");
fs.mkdirSync(OLD);
execSync(`git -C "${ROOT}" archive ${OLD_COMMIT} index.html manifest.webmanifest sw.js js css icons data assets/voice | tar -x -C "${OLD}"`);
function copyTree(dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of ["index.html", "manifest.webmanifest", "sw.js"]) fs.copyFileSync(path.join(ROOT, f), path.join(dst, f));
  for (const d of ["js", "css", "icons", "data", "assets/voice"]) fs.cpSync(path.join(ROOT, d), path.join(dst, d), { recursive: true });
}
copyTree(NEW);

// ── server ──────────────────────────────────────────────────────────────
let WEB = OLD;
const hits = [];
const overrides = new Map(); // pathname → "404" | "hang" | Buffer
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  hits.push(u.pathname + u.search);
  const o = overrides.get(u.pathname) ?? [...overrides].find(([k]) => k.endsWith("*") && u.pathname.startsWith(k.slice(0, -1)))?.[1];
  if (o === "hang") { setTimeout(() => req.socket.destroy(), 20000); return; } // no answer; connection dropped after 20 s
  if (o === "404") { res.writeHead(404); res.end(); return; }
  const p = path.join(WEB, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
  if (!o && (!p.startsWith(WEB) || !fs.existsSync(p) || fs.statSync(p).isDirectory())) { res.writeHead(404); res.end(); return; }
  const buf = Buffer.isBuffer(o) ? o : fs.readFileSync(p);
  const etag = `"${h10(buf)}"`;
  const headers = { "Cache-Control": "max-age=600", ETag: etag, "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" };
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); res.end(); return; }
  res.writeHead(200, { ...headers, "Content-Length": buf.length });
  res.end(buf);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}`; // localhost = secure context (SW, WebCrypto)

// ── browser ─────────────────────────────────────────────────────────────
// Persistent profile, like the home-screen PWA (WebKit's ephemeral contexts
// can't even store Blobs in IndexedDB, so the legacy state couldn't be planted).
const PROFILE = path.join(TMP, "profile");
const ctx = await ENGINE.launchPersistentContext(PROFILE, { serviceWorkers: "allow", viewport: { width: 1180, height: 820 } });
const browser = { close: () => ctx.close() };
const foreign = [];
// Production backends are not part of this test: block them (the old app
// would ask the name function / Storage); audio from there is a failure.
await ctx.route(/cloudfunctions\.net|run\.app|firebasestorage\.googleapis\.com|elevenlabs/, (route) => { foreign.push(route.request().url()); route.abort(); });
// reCAPTCHA (App Check) is irrelevant here and its script sometimes hangs,
// which would hold back the load event.
let recaptchaHangs = false; // Phase APPCHECK: script never arrives (bad connection) → no load event, no App Check token
await ctx.route(/recaptcha/, (route) => { if (!recaptchaHangs) route.fulfill({ status: 200, contentType: "text/javascript", body: "" }); });
await ctx.addInitScript(() => {
  try { localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_lang", "de"); localStorage.setItem("dart_audio_engine", "element"); } catch (e) {} // playback observed on the media element (Web Audio engine: tests/voice-flow.test.mjs)
  // Map every played source back to its clip key and record what the media
  // element really did (play resolved / ended / error).
  const keyOf = new WeakMap();
  window.__urlKey = {}; window.__media = []; window.__warn = [];
  const ow = console.warn.bind(console);
  console.warn = (...a) => { window.__warn.push(a.map(String).join(" ")); ow(...a); };
  const of = window.fetch.bind(window);
  window.fetch = async (...a) => {
    const r = await of(...a);
    const m = String(a[0]?.url || a[0]).match(/assets\/voice\/([^/]+)\/([^/?]+)\.mp3/);
    if (m) { const ob = r.blob.bind(r); r.blob = async () => { const b = await ob(); keyOf.set(b, m[1] + "/" + m[2]); return b; }; }
    return r;
  };
  const oc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { const u = oc(b); if (keyOf.has(b)) window.__urlKey[u] = keyOf.get(b); return u; };
  const op = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const src = this.src, rec = { key: window.__urlKey[src] || (src.startsWith("data:") ? "unlock" : src), ended: false, error: null, dur: null, at: Math.round(performance.now() - (window.__t0 || 0)) };
    window.__media.push(rec);
    const el = this;
    const onEnd = () => { if (el.src === src) { rec.ended = true; rec.dur = el.duration; } };
    const onErr = () => { if (el.src === src) rec.error = el.error?.code || "error"; };
    this.addEventListener("ended", onEnd, { once: true });
    this.addEventListener("error", onErr, { once: true });
    const p = op.call(this);
    p?.catch?.((e) => { rec.error = e.name; });
    return p;
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

const ready = () => {
  const sp = document.getElementById("splash-screen");
  return sp && sp.style.display === "none" && typeof window.showScreen === "function" && !!document.querySelector(".screen.active");
};
async function appStart() {
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(ready, null, { timeout: 60000 });
}
const swVersion = () => page.evaluate(() => new Promise((res) => {
  const c = navigator.serviceWorker.controller; if (!c) return res(null);
  const ch = new MessageChannel(); ch.port1.onmessage = (e) => res(e.data?.version ?? "old");
  c.postMessage({ type: "version" }, [ch.port2]); setTimeout(() => res("old"), 2000);
}));
const runningNewCode = () => page.evaluate(async () => (await import("./js/speech.js")).MAX_ANNOUNCED_PLAYERS === 8);

function cfg(players) {
  return {
    mode: "301", startScore: 301, players, playerIds: players.map(() => null), isBot: players.map(() => false),
    totalSets: 1, setsToWin: 1, setWins: players.map(() => 0), currentSet: 1, totalLegs: 1, legsToWin: 1, legWins: players.map(() => 0), currentLeg: 1,
    rounds: 20, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "casual",
    accumulated: { turnScores: players.map(() => []), historicThrows: players.map(() => []), checkoutAttempts: players.map(() => 0), checkoutHits: players.map(() => 0), checkoutScores: players.map(() => []), first9: players.map(() => null) },
    legStatsHistory: [],
  };
}

/** X01 301, 2 players; both reach 121 → "Player 1 requires 121", then "Player 2 requires 121". */
async function playX01(voiceElevenLabsId, { waitAfter = 12000, pkgHangs = false } = {}) {
  await page.evaluate((vid) => localStorage.setItem("dart_active_voice_id", vid), voiceElevenLabsId);
  await appStart();
  await page.mouse.click(3, 3);                  // the first tap unlocks audio (as on the iPad)
  await page.evaluate(async () => {
    window.__media.length = 0; window.__warn.length = 0;
    window.dartDB = Object.assign(window.dartDB || {}, { saveGame: async () => {}, loadStats: async () => [], loadPlayers: async () => [] });
    window.__t0 = performance.now(); window.__loadedAtStart = document.readyState === "complete";
    window.__x01 = await import("./js/x01.js?v=2");
    window.__state = (await import("./js/state.js")).state;
  });
  if (pkgHangs) await page.evaluate(() => { const never = () => new Promise(() => {}); Object.assign(window.dartDB, { getVoicePkgURL: never, getVoicePkgFileURL: never }); }); // getDownloadURL waiting for an App Check token
  await page.evaluate(async (c) => { window.__state.cfg = c; window.__state.allPlayers = []; await window.__x01.startX01(0); }, cfg(["Anna", "Ben"]));
  await page.waitForTimeout(2500);
  const turn = (steps) => page.evaluate(async (steps) => {
    for (const [l, s] of steps) { window.__x01.processX01Hit(l === "Miss" ? { label: "Miss", score: 0, miss: true } : { label: l, score: s }, null, null); await new Promise((r) => setTimeout(r, 40)); }
  }, steps);
  const T = [["T20", 60], ["T20", 60], ["T20", 60]];
  await turn(T); await page.waitForTimeout(4500);              // P1 180 → 121
  await turn(T); await page.waitForTimeout(12000);             // P2 180 → 121; Player 1 requires 121 + checkout
  await turn([["20", 20], ["Miss"], ["Miss"]]); await page.waitForTimeout(waitAfter); // P1 → 101; Player 2 requires 121 + checkout
  return page.evaluate(() => ({ media: window.__media.filter((m) => m.key !== "unlock"), warn: window.__warn.slice(), loaded: window.__loadedAtStart }));
}
/** Wipes clip caches (SW cache + IndexedDB) from a page without the app, so no open connection blocks the delete. */
async function wipeVoiceStorage() {
  await page.goto(`${BASE}/manifest.webmanifest`);
  const r = await page.evaluate(async () => {
    for (const k of await caches.keys()) if (k.startsWith("dt-voice")) await caches.delete(k);
    return new Promise((res) => { const q = indexedDB.deleteDatabase("dart_voice_cache"); q.onsuccess = () => res("deleted"); q.onerror = () => res("error"); q.onblocked = () => res("blocked"); });
  });
  check(r === "deleted", `clip storage wiped before the phase (${r})`);
}
const keys = (media) => media.map((m) => m.key.split("/").pop());
/** b appears in order inside a (not necessarily adjacent) */
const subseq = (a, b) => { let i = 0; for (const x of a) if (x === b[i]) i++; return i === b.length; };

try {
  // ── Phase OLD ─────────────────────────────────────────────────────────
  console.log(`Phase OLD — app state of ${OLD_COMMIT} (${ENGINE.name()})`);
  await appStart();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  check(!(await runningNewCode()), "old app (no Player call-outs) is running");
  await page.evaluate(async () => {
    localStorage.setItem("dart_active_voice_id", "zDBYcuJrpuZ6YQ7AgRUw"); // Jerry B, as on the reporting account
    localStorage.setItem("dart_checkout_announce", "true");
    localStorage.setItem("dart_tts_enabled", "true");
    // legacy IndexedDB entries: bare Blob (before hashes) + a name clip
    const db = await new Promise((res, rej) => { const r = indexedDB.open("dart_voice_cache", 1); r.onupgradeneeded = () => r.result.createObjectStore("clips"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const put = (k, v) => new Promise((res) => { const tx = db.transaction("clips", "readwrite"); tx.objectStore("clips").put(v, k); tx.oncomplete = res; tx.onerror = res; });
    const blob = await (await fetch("assets/voice/jerry/el_requires.mp3")).blob();
    await put("jerry::el_requires", blob);
    await put("jerry::name_anna", blob);
    await put("george::name_anna", { blob, h: "0000000000" });
    window.__planted = await new Promise((res) => { const q = db.transaction("clips").objectStore("clips").count(); q.onsuccess = () => res(q.result); q.onerror = () => res(-1); });
  });
  const planted = await page.evaluate(() => window.__planted);
  check(planted >= 3, `legacy IndexedDB entries planted (hash-less blob, name clips): ${planted}`);
  // let the old worker cache the shell (handed over after load) and some clips
  await page.waitForTimeout(6000);
  const oldShell = await page.evaluate(async () => (await (await caches.open("dt-shell-v1")).keys()).length);
  check(oldShell > 5, `old service worker cached the app shell (${oldShell} entries)`);

  // ── Phase UPGRADE ─────────────────────────────────────────────────────
  console.log("Phase UPGRADE — deploy current tree");
  WEB = NEW;
  await appStart();                                   // 1st start: old worker still answers
  const first = await runningNewCode();
  await page.waitForFunction(() => navigator.serviceWorker.controller, null);
  await page.waitForTimeout(3000);
  await appStart();                                   // 2nd start (PWA closed + reopened)
  check(await runningNewCode(), `new modules run at the latest on the 2nd app start (1st start: ${first ? "new" : "old"})`);
  const ver = await swVersion();
  check(ver && ver !== "old", `new service worker in control (version ${ver})`);

  // ── Phase PLAY ────────────────────────────────────────────────────────
  for (const [voice, vid] of VOICES) {
    console.log(`Phase PLAY — ${voice}`);
    const { media } = await playX01(vid);
    const k = keys(media);
    check(subseq(k, ["el_game_on", "el_score_180b", "el_score_180b", "el_player_1", "el_requires", "el_num_121", "el_co_121", "el_score_20", "el_player_2", "el_requires", "el_num_121", "el_co_121"]),
      `${voice}: Game on, 180, 180, Player 1 requires 121 + checkout, 20, Player 2 requires 121 + checkout — got ${k.join(" ")}`);
    check(media.length > 0 && media.every((m) => m.key.startsWith(voice + "/")), `${voice}: every clip from the same-origin ${voice} package`);
    const bad = media.filter((m) => !m.ended || m.error || !(m.dur > 0.2));
    check(bad.length === 0, `${voice}: every clip really played to its end (${media.length} clips${bad.length ? "; not: " + JSON.stringify(bad) : ""})`);
  }
  check(foreign.length === 0 || foreign.every((u) => !/\.mp3|dart_voice|Voice|TTS/i.test(u)), `no audio from Storage/Functions: ${foreign.filter((u) => /mp3|voice|tts/i.test(u)).join(", ")}`);

  // ── Phase MIXED ───────────────────────────────────────────────────────
  console.log("Phase MIXED — new JS, old index.json (no el_player_*)");
  await wipeVoiceStorage();
  overrides.set("/assets/voice/guy/index.json", fs.readFileSync(path.join(OLD, "assets/voice/guy/index.json")));
  {
    const { media } = await playX01("34lPwSZ54D8fWbX1aHzk");
    const k = keys(media);
    check(subseq(k, ["el_player_1", "el_requires", "el_num_121", "el_player_2", "el_requires", "el_num_121"]) && media.every((m) => m.ended && !m.error),
      `guy with old index: Player 1/2 requires 121 still played — ${k.join(" ")}`);
  }
  overrides.clear();

  // ── Phase BROKEN ──────────────────────────────────────────────────────
  console.log("Phase BROKEN — one clip missing, one corrupt, one hanging");
  await wipeVoiceStorage();
  // new hashes for the three clips → new ?h= URLs, so neither the HTTP cache
  // nor the service worker can answer with the intact copies from Phase PLAY
  const hIdx = JSON.parse(fs.readFileSync(path.join(NEW, "assets/voice/haseeb/index.json"), "utf8"));
  for (const k of ["el_player_2", "el_requires", "el_co_121"]) hIdx.hashes[k] = "badc0ffee0";
  overrides.set("/assets/voice/haseeb/index.json", Buffer.from(JSON.stringify(hIdx)));
  overrides.set("/assets/voice/haseeb/el_player_2.mp3", "404");
  overrides.set("/assets/voice/haseeb/el_requires.mp3", Buffer.from("this is not an mp3 ".repeat(200)));
  overrides.set("/assets/voice/haseeb/el_co_121.mp3", "hang");
  {
    const { media, warn } = await playX01("dllHSct4GokGc1AH9JwT", { waitAfter: 16000 });
    const k = keys(media), ok = media.filter((m) => m.ended && !m.error).map((m) => m.key.split("/").pop());
    check(!k.includes("el_player_2") && subseq(ok, ["el_player_1", "el_num_121", "el_score_20", "el_num_121"]),
      `rest of the announcement plays around the broken clips — played ok: ${ok.join(" ")}`);
    check(warn.some((w) => /voice clip skipped: el_player_2/.test(w)), `missing el_player_2 logged: ${warn.filter((w) => /player_2/.test(w)).join(" | ")}`);
    check(warn.some((w) => /voice clip skipped: el_requires/.test(w)), `corrupt el_requires logged: ${warn.filter((w) => /el_requires/.test(w)).join(" | ")}`);
    check(warn.some((w) => /voice clip skipped: el_co_121.*timed out/.test(w)), `hanging el_co_121 logged as timeout: ${warn.filter((w) => /el_co_121/.test(w)).join(" | ")}`);
  }
  overrides.clear();

  // ── Phase APPCHECK ────────────────────────────────────────────────────
  console.log("Phase APPCHECK — reCAPTCHA script hangs (no load event, no App Check token)");
  recaptchaHangs = true;
  {
    const { media, loaded } = await playX01("JBFqnCBsd6RMkjVDRZzb");
    const k = keys(media);
    check(!loaded, "condition holds: load event had not fired when the game started");
    check(media[0]?.key.endsWith("/el_game_on") && media[0].at < 3000 && subseq(k, ["el_player_1", "el_requires", "el_num_121", "el_player_2", "el_requires", "el_num_121"]) && media.every((m) => m.ended && !m.error),
      `george announces without load/App Check (Game on after ${media[0]?.at} ms): ${k.join(" ")}`);
  }
  // A voice only available from Storage whose URL lookup waits for App Check
  // (the Android app's path): one lookup may wait 4 s, the rest must not stall.
  await wipeVoiceStorage();
  overrides.set("/assets/voice/guy/*", "404");
  {
    const { warn } = await playX01("34lPwSZ54D8fWbX1aHzk", { pkgHangs: true, waitAfter: 3000 });
    const timeouts = warn.filter((w) => /Storage\).*timed out/.test(w)).length;
    const reached = ["el_game_on", "el_player_1", "el_requires", "el_num_121", "el_co_121", "el_player_2"].every((key) => warn.some((w) => w.includes("voice clip skipped: " + key)));
    check(timeouts === 1 && reached, `Storage waiting for App Check: ${timeouts} lookup(s) timed out, every later clip was reached right away (${reached})`);
  }
  overrides.clear();
  recaptchaHangs = false;

  // ── Phase UPDATE ──────────────────────────────────────────────────────
  console.log("Phase UPDATE — new deploy while idling on the home screen");
  await appStart();
  await page.waitForFunction(() => window.__pwaKeepCurrent, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => { window.showScreen("setup"); window.__marker = 1; });
  const before = await swVersion();
  fs.writeFileSync(path.join(NEW, "sw.js"), fs.readFileSync(path.join(NEW, "sw.js"), "utf8").replace(/const SW_VERSION = "[^"]+"/, 'const SW_VERSION = "test-next"'));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); // app back in the foreground
  await page.waitForFunction(() => !window.__marker, null, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(ready, null, { timeout: 60000 }).catch(() => {});
  const after = await swVersion();
  check(before !== "test-next" && after === "test-next" && !(await page.evaluate(() => window.__marker)),
    `idle app picked up the new deploy by itself (worker ${before} → ${after}, page reloaded)`);

  check(pageErrors.filter((e) => !/due to access control checks|Context is stopped|Load failed|NetworkError|Failed to fetch|appCheck|recaptcha/i.test(e)).length === 0, `no page errors: ${pageErrors.join(" | ")}`);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}
if (failures.length) { console.error(`\nFAILED (${ENGINE.name()}):\n - ` + failures.join("\n - ")); process.exit(1); }
console.log(`\nvoice-upgrade: all assertions passed (${ENGINE.name()})`);
