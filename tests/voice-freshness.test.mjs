/**
 * voice-freshness.test.mjs — A regenerated voice clip (same file name, new
 * bytes) is played after the next reload, everywhere a clip can be cached,
 * without re-downloading unchanged clips and without losing offline play.
 *
 * Serves a temporary copy of the app from its own static server with GitHub
 * Pages-like headers (Cache-Control: max-age=600 + ETag), so the browser's
 * HTTP cache really is in play. A fake Storage package (/pkg/<voice>/…) stands
 * in for dart_voice_pkg/ for the non-default voice.
 *
 *   Phase 1  web/PWA, default voice "george": first visit, service worker
 *            warms all clips; el_bust plays version A. Additionally the state
 *            an OLDER app version leaves behind is planted: a hash-less
 *            IndexedDB copy of another clip, an unversioned SW-cache entry and
 *            an HTTP-cache (force-cache) copy of the unversioned URL.
 *   Publish  el_bust.mp3 (george + haseeb package) and el_party_checkout (george)
 *            get new bytes B under the same file name; index.json rewritten.
 *   Phase 2  reload → the app's real audio queue plays B for el_bust (george
 *            and haseeb) and for the legacy-cached clip; exactly ONE download
 *            per changed clip, ZERO for unchanged clips; superseded SW-cache
 *            entries are pruned.
 *   Phase 3  reload again → still B, no further download.
 *   Phase 4  offline reload → still B (offline capability kept).
 *   Phase 5  "native" path (no service worker, like the Capacitor app):
 *            old IndexedDB copy + publish → reload → B.
 *
 * Usage: node tests/voice-freshness.test.mjs      (no external server needed)
 *        SRC=<dir> to serve another checkout's js/ (e.g. to show the old code fails)
 */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.SRC || ROOT;
const { writeVoiceIndex } = require(path.join(ROOT, "scripts", "voice-format.js"));

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`); };
const h10 = (buf) => crypto.createHash("sha1").update(buf).digest("hex").slice(0, 10);

// ── temp copy of the app ────────────────────────────────────────────────
const WEB = fs.mkdtempSync(path.join(os.tmpdir(), "voice-fresh-"));
for (const f of ["index.html", "manifest.webmanifest", "sw.js"]) fs.copyFileSync(path.join(SRC, f), path.join(WEB, f));
for (const d of ["js", "css", "icons", "data"]) fs.cpSync(path.join(SRC, d), path.join(WEB, d), { recursive: true });
fs.cpSync(path.join(ROOT, "assets", "voice", "george"), path.join(WEB, "assets", "voice", "george"), { recursive: true });
fs.cpSync(path.join(ROOT, "assets", "voice", "haseeb"), path.join(WEB, "pkg", "haseeb"), { recursive: true });
const G = path.join(WEB, "assets", "voice", "george"), HP = path.join(WEB, "pkg", "haseeb");

// ── static server with GitHub-Pages-like caching + request log ──────────
const hits = [];
let offline = false;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (offline) { req.socket.destroy(); return; }
  hits.push(u.pathname + u.search);
  const p = path.join(WEB, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
  if (!p.startsWith(WEB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  const buf = fs.readFileSync(p);
  const etag = `"${h10(buf)}"`;
  const headers = { "Cache-Control": "max-age=600", ETag: etag, "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" };
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); res.end(); return; }
  res.writeHead(200, { ...headers, "Content-Length": buf.length });
  res.end(buf);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
// "localhost" (not 127.0.0.1) = secure context → service worker + WebCrypto, like https
const BASE = `http://localhost:${server.address().port}`;
const countHits = (needle) => hits.filter((h) => h.includes(needle)).length;

const OLD = h10(fs.readFileSync(path.join(G, "el_bust.mp3")));
const OLD_SHOT = h10(fs.readFileSync(path.join(G, "el_party_checkout.mp3")));
const OLD_HASEEB = h10(fs.readFileSync(path.join(HP, "el_bust.mp3")));

function publish() {
  // new bytes under the same names (as a regeneration does)
  fs.copyFileSync(path.join(G, "el_no_score.mp3"), path.join(G, "el_bust.mp3"));
  fs.copyFileSync(path.join(G, "el_game_on.mp3"), path.join(G, "el_party_checkout.mp3"));
  fs.copyFileSync(path.join(HP, "el_no_score.mp3"), path.join(HP, "el_bust.mp3"));
  writeVoiceIndex(G); writeVoiceIndex(HP);
  return { NEW: h10(fs.readFileSync(path.join(G, "el_bust.mp3"))), NEW_SHOT: h10(fs.readFileSync(path.join(G, "el_party_checkout.mp3"))), NEW_HASEEB: h10(fs.readFileSync(path.join(HP, "el_bust.mp3"))) };
}

const ready = () => {
  const sp = document.getElementById("splash-screen");
  return sp && sp.style.display === "none" && typeof window.showScreen === "function" && !!document.querySelector(".screen.active");
};

async function newContext(browser, { sw }) {
  const ctx = await browser.newContext({ serviceWorkers: sw ? "allow" : "block" });
  await ctx.addInitScript((base) => {
    try { localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_tts_enabled", "true"); } catch (e) {}
    window.__played = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); return play.call(this); };
    // Fake Storage package for non-default voices (dart_voice_pkg/<voice>/…)
    const pkg = {
      getVoicePkgURL: async (v, k) => `${base}/pkg/${v}/${k}.mp3`,
      getVoicePkgFileURL: async (v, f) => `${base}/pkg/${v}/${f}`,
    };
    let real;
    Object.defineProperty(window, "dartDB", { configurable: true, get: () => real, set: (v) => { real = Object.assign(v || {}, pkg); } });
    window.dartDB = {};
  }, BASE);
  return ctx;
}

async function load(page) {
  await page.waitForFunction(ready, null, { timeout: 120000 });
}

/** Plays a clip through the app's real audio queue; returns the hash of the bytes the <audio> element got. */
async function playAndHash(page, voiceElevenLabsId, key) {
  return page.evaluate(async ({ vid, key }) => {
    localStorage.setItem("dart_active_voice_id", vid);
    const audio = await import("./js/audio.js");
    window.__played = [];
    await new Promise((res) => { audio.queueAudio(key, key, null); const t0 = Date.now(); (function w() { if (window.__played.length || Date.now() - t0 > 15000) res(); else setTimeout(w, 50); })(); });
    const src = window.__played[0];
    if (!src) return null;
    const buf = await (await fetch(src)).arrayBuffer();
    const d = new Uint8Array(await crypto.subtle.digest("SHA-1", buf));
    return Array.from(d.slice(0, 5), (b) => b.toString(16).padStart(2, "0")).join("");
  }, { vid: voiceElevenLabsId, key });
}
const GEORGE = "JBFqnCBsd6RMkjVDRZzb", HASEEB = "dllHSct4GokGc1AH9JwT";

async function swVoiceEntries(page, key) {
  return page.evaluate(async (key) => (await (await caches.open("dt-voice-v1")).keys()).map((r) => r.url).filter((u) => u.includes(`/${key}.mp3`)).map((u) => u.replace(/^.*\/assets/, "assets")), key);
}

async function run() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

  // ── Phase 1: first visit (web/PWA)
  console.log(`Phase 1 — first visit, version A (george el_bust ${OLD}, haseeb ${OLD_HASEEB})`);
  const ctx = await newContext(browser, { sw: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`);
  await load(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60000 });
  await page.waitForFunction(() => ["done", "partial", "no-index", "skipped"].includes(window.__voiceWarm?.state), null, { timeout: 300000, polling: 500 });
  const warm1 = await page.evaluate(() => ({ ...window.__voiceWarm }));
  check(warm1.state === "done", `warm-up filled the offline clip cache (${warm1.state}, ${warm1.fetched + warm1.cached}/${warm1.total})`);
  check(await playAndHash(page, GEORGE, "el_bust") === OLD, "george el_bust plays version A");
  check(await playAndHash(page, HASEEB, "el_bust") === OLD_HASEEB, "haseeb el_bust plays version A (from the package)");
  // Plant what an older app version leaves behind for el_party_checkout: a
  // hash-less IndexedDB blob, an unversioned SW-cache entry, an HTTP-cache copy.
  await page.evaluate(async () => {
    const r = await fetch("assets/voice/george/el_party_checkout.mp3", { cache: "force-cache" });
    const blob = await r.clone().blob();
    await (await caches.open("dt-voice-v1")).put(new URL("assets/voice/george/el_party_checkout.mp3", location.href).href, r);
    await new Promise((res, rej) => { const q = indexedDB.open("dart_voice_cache", 1); q.onsuccess = () => { const tx = q.result.transaction("clips", "readwrite"); tx.objectStore("clips").put(blob, "george::el_party_checkout"); tx.oncomplete = res; tx.onerror = rej; }; q.onerror = rej; });
  });
  check(await playAndHash(page, GEORGE, "el_party_checkout") === OLD_SHOT, "legacy-cached el_party_checkout plays version A");

  // ── Publish version B
  const { NEW, NEW_SHOT, NEW_HASEEB } = publish();
  console.log(`Publish — el_bust ${OLD}→${NEW}, el_party_checkout ${OLD_SHOT}→${NEW_SHOT}, haseeb el_bust ${OLD_HASEEB}→${NEW_HASEEB}`);
  const before = { bust: countHits("/george/el_bust.mp3"), shot: countHits("/george/el_party_checkout.mp3"), gameOn: countHits("/george/el_game_on.mp3"), haseeb: countHits("/pkg/haseeb/el_bust.mp3"), all: hits.filter((h) => h.endsWith(".mp3") || h.includes(".mp3?")).length };

  // ── Phase 2: reload
  console.log("Phase 2 — reload after publish");
  await page.reload();
  await load(page);
  check(await playAndHash(page, GEORGE, "el_bust") === NEW, "george el_bust now plays version B");
  check(await playAndHash(page, GEORGE, "el_party_checkout") === NEW_SHOT, "legacy-cached el_party_checkout now plays version B");
  check(await playAndHash(page, HASEEB, "el_bust") === NEW_HASEEB, "haseeb el_bust (IndexedDB package copy) now plays version B");
  check(await playAndHash(page, GEORGE, "el_game_on") === h10(fs.readFileSync(path.join(G, "el_game_on.mp3"))), "unchanged el_game_on still plays");
  await page.waitForFunction(() => ["done", "partial"].includes(window.__voiceWarm?.state), null, { timeout: 120000, polling: 300 });
  const warm2 = await page.evaluate(() => ({ ...window.__voiceWarm }));
  check(countHits("/george/el_bust.mp3") - before.bust === 1, `george el_bust downloaded exactly once (${countHits("/george/el_bust.mp3") - before.bust})`);
  check(countHits("/george/el_party_checkout.mp3") - before.shot === 1, `el_party_checkout downloaded exactly once (${countHits("/george/el_party_checkout.mp3") - before.shot})`);
  check(countHits("/pkg/haseeb/el_bust.mp3") - before.haseeb === 1, `haseeb el_bust downloaded exactly once (${countHits("/pkg/haseeb/el_bust.mp3") - before.haseeb})`);
  check(countHits("/george/el_game_on.mp3") === before.gameOn, "unchanged clip not downloaded again");
  const mp3After = hits.filter((h) => h.endsWith(".mp3") || h.includes(".mp3?")).length - before.all;
  check(mp3After === 3, `only the 3 changed clips were requested after publish (${mp3After} mp3 requests, warm-up fetched ${warm2.fetched}, cached ${warm2.cached})`);
  const swBust = await swVoiceEntries(page, "el_bust"), swShot = await swVoiceEntries(page, "el_party_checkout");
  check(swBust.length === 1 && swBust[0].endsWith(`?h=${NEW}`), `SW clip cache holds only the new el_bust (${swBust})`);
  check(swShot.length === 1 && swShot[0].endsWith(`?h=${NEW_SHOT}`), `superseded/unversioned el_party_checkout entries pruned (${swShot})`);

  // ── Phase 3: reload again — no re-download
  console.log("Phase 3 — second reload");
  const b3 = countHits(".mp3");
  await page.reload();
  await load(page);
  check(await playAndHash(page, GEORGE, "el_bust") === NEW, "george el_bust still version B");
  check(await playAndHash(page, HASEEB, "el_bust") === NEW_HASEEB, "haseeb el_bust still version B");
  await page.waitForTimeout(500);
  check(countHits(".mp3") === b3, `no clip downloaded again (${countHits(".mp3") - b3} requests)`);

  // ── Phase 4: offline
  console.log("Phase 4 — offline reload");
  await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase("dart_voice_cache"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  offline = true; await ctx.setOffline(true);
  await page.reload();
  await load(page);
  check(await playAndHash(page, GEORGE, "el_bust") === NEW, "offline (IndexedDB wiped, only SW cache): el_bust plays version B");
  check(await playAndHash(page, GEORGE, "el_score_100") !== null, "offline: other clips still play");
  offline = false;
  await ctx.close();

  // ── Phase 5: native-like (no service worker), old IndexedDB copy
  console.log("Phase 5 — no service worker (Capacitor-like path)");
  const ctx5 = await newContext(browser, { sw: false });
  const p5 = await ctx5.newPage();
  await p5.goto(`${BASE}/index.html`);
  await load(p5);
  const before5 = h10(fs.readFileSync(path.join(G, "el_bust.mp3")));
  check(await playAndHash(p5, GEORGE, "el_bust") === before5, "plays the current version");
  fs.copyFileSync(path.join(G, "el_score_100.mp3"), path.join(G, "el_bust.mp3"));
  writeVoiceIndex(G);
  const NEW5 = h10(fs.readFileSync(path.join(G, "el_bust.mp3")));
  await p5.reload();
  await load(p5);
  check(await playAndHash(p5, GEORGE, "el_bust") === NEW5, `after the next publish + reload: new version (${before5}→${NEW5})`);
  await ctx5.close();

  await browser.close();
  server.close();
  fs.rmSync(WEB, { recursive: true, force: true });
  console.log(failures.length ? `\nFAILED (${failures.length}):\n - ` + failures.join("\n - ") : "\nALL PASSED");
  process.exit(failures.length ? 1 : 0);
}

run().catch((e) => { console.error(e); server.close(); fs.rmSync(WEB, { recursive: true, force: true }); process.exit(1); });
