/**
 * voiceClips.js — Local-first playback source for ALL pre-produced
 * (fixed-vocabulary) audio clips. Replaces runtime ElevenLabs/dartTTS calls for
 * everything that used to go through speakElevenLabs()/fetchTTSUrl().
 *
 * Two sources, tried in this order, NEVER falling through to a live TTS
 * call or the browser voice for a clip that simply isn't available yet:
 *   1. The active voice's locally bundled/cached clip (IndexedDB blob, or a
 *      same-origin static file: the default voice everywhere, on the web
 *      every voice — see servedSameOrigin()).
 *   2. A one-time download of that single clip from the pre-produced
 *      package in Firebase Storage (dart_voice_pkg/<voice>/<key>.mp3),
 *      cached into IndexedDB so it's never fetched again.
 * Players are announced as "Player 1…8" (el_player_<n>), never by name.
 * If neither produces audio (fully offline + never cached, or a genuinely
 * missing vocabulary clip), playback of THAT item is simply
 * skipped — see js/audio.js's queueAudio()/playAudioQueue().
 *
 * Freshness (clips are regenerated under the SAME file name): every voice
 * publishes an index (assets/voice/<v>/index.json, mirrored to
 * dart_voice_pkg/<v>/index.json) with a content hash per clip. A clip's
 * identity is (voice, key, hash):
 *   - bundled clips are requested as <key>.mp3?h=<hash> — a new hash is a
 *     new URL, so neither the HTTP cache (force-cache) nor the service
 *     worker's cache-first clip cache can answer with the old bytes, while
 *     an unchanged clip is still served from cache without any request;
 *   - IndexedDB copies store the hash they were downloaded with; a copy
 *     whose hash no longer matches the index is replaced on its next play
 *     (only that clip — not the whole voice);
 *   - downloads are hashed on arrival, so a copy only counts as current if
 *     its bytes really are the published ones.
 * The index is read once per session (revalidated, normally a 304). Offline
 * or without an index, whatever is stored locally is played — a stale clip
 * beats silence, and it is replaced on the next online session.
 */

// Mirrors data/voices.json — duplicated here (not imported) so this module
// has no build step / JSON-import-assertion dependency across browsers.
// Keep in sync if voices are added/changed.
export const VOICES = [
  { id: "george", elevenLabsId: "JBFqnCBsd6RMkjVDRZzb", free: true },
  { id: "haseeb", elevenLabsId: "dllHSct4GokGc1AH9JwT", free: true },
  { id: "jerry",  elevenLabsId: "zDBYcuJrpuZ6YQ7AgRUw", free: false },
  { id: "guy",    elevenLabsId: "34lPwSZ54D8fWbX1aHzk", free: false },
];
export const DEFAULT_VOICE_ID = "george";

/** Capacitor app (ships only the default voice) vs. web/PWA (serves every voice same-origin). */
const isNative = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

/**
 * Whether this voice's clips are served next to the app: the default voice
 * everywhere (bundled in the Android package too); on the web every voice,
 * because the GitHub Pages deploy contains assets/voice/<v>/ for all four.
 * Same-origin never depends on Firebase Storage (auth, CORS — until
 * 2026-11-25 the bucket had no CORS rule, so every Storage download failed
 * in the browser and non-default voices were silent on the web).
 */
function servedSameOrigin(voiceId) { return voiceId === DEFAULT_VOICE_ID || !isNative(); }

// Firebase Storage URL lookups (getDownloadURL) wait for the App Check
// token; on the web that means reCAPTCHA, whose script can hang for 30 s+ on
// a bad connection (measured 2026-11-25: getDownloadURL never returned while
// reCAPTCHA hung, and the old code waited on it for EVERY clip → silent game
// until reCAPTCHA loaded). Announcements must not depend on App Check: each
// lookup gets a short limit, and after a timeout Storage is skipped for a
// while so the next clips don't each wait again.
const STORAGE_TIMEOUT_MS = 4000, STORAGE_BACKOFF_MS = 60000;
let storageDownUntil = 0;
async function storageURL(lookup, what) {
  if (Date.now() < storageDownUntil) return null;
  let timer;
  try {
    return await Promise.race([lookup(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`timed out after ${STORAGE_TIMEOUT_MS} ms`)), STORAGE_TIMEOUT_MS); })]);
  } catch (e) {
    storageDownUntil = Date.now() + STORAGE_BACKOFF_MS;
    console.warn(`voice package (Storage) ${what}: ${e.message} — Storage skipped for ${STORAGE_BACKOFF_MS / 1000} s`);
    return null;
  } finally { clearTimeout(timer); }
}

/** Maps the ElevenLabs voice id (as stored in dart_active_voice_id) to our short voice key. */
export function voiceKeyFor(elevenLabsId) {
  return VOICES.find(v => v.elevenLabsId === elevenLabsId)?.id || DEFAULT_VOICE_ID;
}

// ── IndexedDB blob cache (persists across sessions/offline; survives a
// browser restart unlike an in-memory Map) ──────────────────────────────
const DB_NAME = "dart_voice_cache", DB_VERSION = 1, STORE = "clips";
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  return dbPromise;
}
async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}
/** Stored clip → { blob, h } (h = content hash; null for copies stored before hashes existed). */
function asEntry(v) {
  if (!v) return null;
  if (v instanceof Blob) return { blob: v, h: null };
  return v.blob ? { blob: v.blob, h: v.h || null } : null;
}
async function idbPut(key, blob, h) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ blob, h: h || null }, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* IndexedDB unavailable (private mode etc.) — caller re-fetches next time */ }
}

/** First 10 hex chars of SHA-1 over the bytes (same as scripts/voice-format.js clipHash). */
async function hashBlob(blob) {
  try {
    const buf = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
    return Array.from(new Uint8Array(buf).slice(0, 5), b => b.toString(16).padStart(2, "0")).join("");
  } catch (e) { return null; } // no WebCrypto (insecure context) — can't verify
}

// ── Per-voice clip index (key → content hash), loaded once per session ──
const indexMemo = {};      // voiceId -> Promise<index|null> (only successful loads stay memoized)
const indexRetryAt = {};   // voiceId -> earliest next attempt after a failed load
const INDEX_TIMEOUT_MS = 4000, INDEX_RETRY_MS = 15000;

async function fetchJSON(url, init) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), INDEX_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctl?.signal });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; } finally { if (timer) clearTimeout(timer); }
}

async function loadIndex(voiceId) {
  // Storage package index (uploaded after the clips → authoritative for
  // clips downloaded from there; needs a signed-in user).
  const pkgIndex = async () => {
    if (voiceId === DEFAULT_VOICE_ID || !window.dartDB?.getVoicePkgFileURL) return null;
    const url = await storageURL(() => window.dartDB.getVoicePkgFileURL(voiceId, "index.json").catch(() => null), `${voiceId}/index.json`);
    const idx = url && await fetchJSON(url, { cache: "no-store" });
    return idx?.hashes ? idx : null;
  };
  // Same-origin index (bundled with the app / next to it on the web):
  // revalidated, normally a 304.
  const localIndex = async () => {
    const idx = await fetchJSON(`assets/voice/${voiceId}/index.json`, { cache: "no-cache" });
    return idx?.keys ? idx : null;
  };
  // The index must describe the source the clips come from (see servedSameOrigin).
  return servedSameOrigin(voiceId) ? ((await localIndex()) || (await pkgIndex())) : ((await pkgIndex()) || (await localIndex()));
}

/**
 * The voice's published clip index ({keys, hashes, rev}), or null if it
 * can't be loaded right now (offline, signed out, …). Successful loads are
 * kept for the session; failures are retried after a short pause.
 * @param {string} voiceId
 */
export function voiceIndex(voiceId) {
  if (indexMemo[voiceId]) return indexMemo[voiceId];
  if (indexRetryAt[voiceId] && Date.now() < indexRetryAt[voiceId]) return Promise.resolve(null);
  const p = loadIndex(voiceId).catch(() => null).then(idx => {
    if (!idx) { delete indexMemo[voiceId]; indexRetryAt[voiceId] = Date.now() + INDEX_RETRY_MS; }
    return idx;
  });
  indexMemo[voiceId] = p;
  return p;
}

/** URL of a bundled clip; with its content hash when known (cache key = content). */
function bundledClipURL(voiceId, key, h) {
  return `assets/voice/${voiceId}/${key}.mp3` + (h ? `?h=${h}` : "");
}

// In-memory object-URL cache so repeated plays of the same clip within a
// session don't re-read IndexedDB or re-create blob URLs.
const objectUrlCache = {}; // `${voiceId}::${key}` -> blob: URL
const notBundled = new Set(); // `${voiceId}::${key}` the bundle answered 404 for

/**
 * Resolves a playable URL for (voiceId, key), trying local bundle → cached
 * download, in that order. Returns
 * null if nothing is available (caller must skip this clip, never fall back
 * to a live TTS call or the browser voice).
 * @param {string} voiceId short voice key, e.g. "george" (see voiceKeyFor())
 * @param {string} key clip key, e.g. "el_score_100" or "el_player_1"
 * @returns {Promise<string|null>}
 */
export async function resolveClipURL(voiceId, key) {
  const cacheKey = `${voiceId}::${key}`;
  if (objectUrlCache[cacheKey]) return objectUrlCache[cacheKey];

  const index = await voiceIndex(voiceId);
  const want = index?.hashes?.[key] || null; // null: unknown (no index)
  const remember = (blob) => { const url = URL.createObjectURL(blob); objectUrlCache[cacheKey] = url; return url; };
  /** Stores a downloaded clip with the hash of its ACTUAL bytes; false if they aren't the published ones. */
  const store = async (blob) => {
    const got = await hashBlob(blob);
    await idbPut(cacheKey, blob, got || want);
    return !want || !got || got === want;
  };

  // 1) IndexedDB (downloaded earlier on this device, any time, offline-safe)
  const cached = asEntry(await idbGet(cacheKey));
  if (cached && (!want || cached.h === want)) return remember(cached.blob);
  // cached but outdated → try to replace it below; play the old copy only if that fails

  // 2) Same-origin clip: the default voice is bundled with the app (inside
  // the Android package / next to the web app), on the web every voice is
  // (see servedSameOrigin). The ?h= URL is immutable per content, so
  // force-cache can never return a superseded version; the service worker
  // keeps played clips for offline use.
  if (servedSameOrigin(voiceId) && !notBundled.has(cacheKey)) {
    const url = bundledClipURL(voiceId, key, want);
    try {
      const resp = await fetch(url, { cache: want ? "force-cache" : "no-cache" });
      if (resp.status === 404) { notBundled.add(cacheKey); console.warn(`voice clip ${voiceId}/${key}: not in the bundle (404)`); } // don't ask again this session
      if (resp.ok) {
        const blob = await resp.blob();
        if (!(await store(blob))) {
          // Bytes don't match the index (deploy still propagating): don't let
          // the service worker keep them under the new URL; retried next session.
          try { if (typeof caches !== "undefined") await (await caches.open(VOICE_CACHE)).delete(new URL(url, location.href).href); } catch (e) {}
        }
        return remember(blob);
      }
    } catch (e) { console.warn(`voice clip ${voiceId}/${key}: bundle fetch failed:`, e.message); } // offline + not cached — fall through
  }

  if (!navigator.onLine) return cached ? remember(cached.blob) : null;

  // 3) Non-default voice (or default-voice fallback): one-time download from
  // the pre-produced package in Firebase Storage, then cache locally.
  // no-store: the copy lives in IndexedDB, the HTTP cache must never answer.
  try {
    if (window.dartDB?.getVoicePkgURL) {
      const url = await storageURL(() => window.dartDB.getVoicePkgURL(voiceId, key), `${voiceId}/${key}`);
      if (url) {
        const resp = await fetch(url, { cache: "no-store" });
        if (resp.ok) {
          const blob = await resp.blob();
          await store(blob);
          return remember(blob);
        }
        console.warn(`voice clip ${voiceId}/${key}: package download HTTP ${resp.status}`);
      } else console.warn(`voice clip ${voiceId}/${key}: no package URL (not in the package, not signed in or Storage unreachable)`);
    }
  } catch (e) { console.warn(`voice clip ${voiceId}/${key}: package download failed:`, e.message); } // e.g. CORS/offline — fall through

  if (cached) return remember(cached.blob); // outdated, but better than silence

  return null;
}

// ── Web/PWA offline warm-up (never runs in the Capacitor app) ─────────────
// The default voice is bundled with the app, but on the web "bundled" only
// means "same origin" — without this, a clip is only available offline once
// it has actually been played. After the app is usable (js/pwa.js) the
// default voice's clips are fetched in the background, a couple at a time,
// through the service worker, which stores them in its clip cache. Nothing
// here blocks startup or a game: it starts late, runs with low concurrency,
// stops when the device goes offline, and resumes (skipping cached clips)
// on the next start.

const VOICE_CACHE = "dt-voice-v1"; // must match sw.js

/**
 * Drops service-worker clip-cache entries that are no longer current: a
 * superseded ?h= version or a pre-hash URL. Keeps the offline cache from
 * growing with every regeneration.
 */
async function pruneVoiceCache(currentUrls) {
  try {
    const c = await caches.open(VOICE_CACHE);
    const keep = new Set(currentUrls);
    let removed = 0;
    for (const req of await c.keys()) {
      if (req.url.includes(`/assets/voice/${DEFAULT_VOICE_ID}/`) && !keep.has(req.url)) { await c.delete(req); removed++; }
    }
    return removed;
  } catch (e) { return 0; }
}

// Announcement-critical clips first, then the rest (checkout paths, …).
function warmPriority(key) {
  if (/^el_(score_|game_on|bust|no_score|game_shot|requires|player_)/.test(key)) return 0;
  return 1;
}

export const warmStatus = { state: "idle", total: 0, cached: 0, fetched: 0, failed: 0, pruned: 0, ms: 0 };
if (typeof window !== "undefined") window.__voiceWarm = warmStatus;

/**
 * Background-fills the service worker's clip cache with every clip of the
 * default voice (current version, ?h= URLs) and removes superseded versions.
 * Requires an active service-worker controller (otherwise the downloads
 * would only land in the HTTP cache and not survive offline).
 * @param {{concurrency?:number}} [opts]
 */
export async function warmDefaultVoice({ concurrency = 2 } = {}) {
  if (warmStatus.state === "running") return warmStatus;
  if (!navigator.serviceWorker?.controller || typeof caches === "undefined") { warmStatus.state = "skipped"; return warmStatus; }
  if (navigator.connection?.saveData) { warmStatus.state = "skipped-savedata"; return warmStatus; }
  const t0 = performance.now();
  Object.assign(warmStatus, { state: "running", total: 0, cached: 0, fetched: 0, failed: 0, pruned: 0, ms: 0 });
  const index = await voiceIndex(DEFAULT_VOICE_ID);
  if (!index?.keys?.length) { warmStatus.state = "no-index"; return warmStatus; }
  const urls = index.keys.slice()
    .sort((a, b) => warmPriority(a) - warmPriority(b))
    .map(k => new URL(bundledClipURL(DEFAULT_VOICE_ID, k, index.hashes?.[k]), location.href).href);
  warmStatus.total = urls.length;
  if (index.hashes) warmStatus.pruned = await pruneVoiceCache(urls);
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      if (!navigator.onLine) return;
      const u = urls[i++];
      try {
        if (await caches.match(u)) { warmStatus.cached++; continue; }
        const r = await fetch(u);           // SW (cache-first) stores it
        if (r.ok) { await r.arrayBuffer(); warmStatus.fetched++; } else warmStatus.failed++;
      } catch (e) { warmStatus.failed++; }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  warmStatus.ms = Math.round(performance.now() - t0);
  warmStatus.state = (warmStatus.cached + warmStatus.fetched === warmStatus.total) ? "done" : "partial";
  return warmStatus;
}
