/**
 * voiceClips.js — Local-first playback source for ALL fixed-vocabulary and
 * player-name audio clips. Replaces runtime ElevenLabs/dartTTS calls for
 * everything that used to go through speakElevenLabs()/fetchTTSUrl().
 *
 * Three sources, tried in this order, NEVER falling through to a live TTS
 * call or the browser voice for a clip that simply isn't available yet:
 *   1. The active voice's locally bundled/cached clip (IndexedDB blob, or —
 *      for the default voice — a static file shipped with the app).
 *   2. A one-time download of that single clip from the pre-produced
 *      package in Firebase Storage (dart_voice_pkg/<voice>/<key>.mp3),
 *      cached into IndexedDB so it's never fetched again.
 *   3. For NAME clips only, not already in the pre-produced library: the
 *      dartVoiceName Cloud Function (central cache keyed by normalized
 *      name — see functions/voiceName.js), also cached into IndexedDB.
 * If none of these produce audio (fully offline + never-seen-before name,
 * or a genuinely missing vocabulary clip), playback of THAT item is simply
 * skipped — see js/audio.js's queueAudio()/playAudioQueue().
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

/** Maps the ElevenLabs voice id (as stored in dart_active_voice_id) to our short voice key. */
export function voiceKeyFor(elevenLabsId) {
  return VOICES.find(v => v.elevenLabsId === elevenLabsId)?.id || DEFAULT_VOICE_ID;
}

const NAME_VOICE_FN_URL = "https://europe-west1-darttrainer-app-fed88.cloudfunctions.net/dartVoiceName";

/**
 * Normalizes a player-entered name for lookup against the pre-produced
 * library / the central generated-names store: lowercase, trimmed, internal
 * whitespace collapsed, umlauts folded to ASCII digraphs, ß folded to ss —
 * so "Jürgen", "JÜRGEN", " juergen ", "Juergen" all resolve to one clip.
 * Mirrors scripts/build-names.js normalizeName() and functions/voiceName.js.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeName(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

/** @param {string} name @returns {string} the clip key for this normalized name */
export function nameClipKey(name) { return `name_${normalizeName(name)}`; }

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
async function idbPut(key, blob) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* IndexedDB unavailable (private mode etc.) — caller re-fetches next time */ }
}

// In-memory object-URL cache so repeated plays of the same clip within a
// session don't re-read IndexedDB or re-create blob URLs.
const objectUrlCache = {}; // `${voiceId}::${key}` -> blob: URL

/**
 * Resolves a playable URL for (voiceId, key), trying local bundle → cached
 * download → (name clips only) central generation, in that order. Returns
 * null if nothing is available (caller must skip this clip, never fall back
 * to a live TTS call or the browser voice).
 * @param {string} voiceId short voice key, e.g. "george" (see voiceKeyFor())
 * @param {string} key clip key, e.g. "el_score_100" or "name_daniel"
 * @param {{isName?:boolean, rawName?:string}} [opts]
 * @returns {Promise<string|null>}
 */
export async function resolveClipURL(voiceId, key, opts = {}) {
  const cacheKey = `${voiceId}::${key}`;
  if (objectUrlCache[cacheKey]) return objectUrlCache[cacheKey];

  // 1) IndexedDB (downloaded/generated earlier this device, any time, offline-safe)
  const cached = await idbGet(cacheKey);
  if (cached) {
    const url = URL.createObjectURL(cached);
    objectUrlCache[cacheKey] = url;
    return url;
  }

  // 2) Default voice ships its clips as static files bundled with the app —
  // zero network, works offline by construction (same origin as the app
  // itself / inside the Android package).
  if (voiceId === DEFAULT_VOICE_ID) {
    try {
      const resp = await fetch(`assets/voice/${voiceId}/${key}.mp3`, { cache: "force-cache" });
      if (resp.ok) {
        const blob = await resp.blob();
        idbPut(cacheKey, blob);
        const url = URL.createObjectURL(blob);
        objectUrlCache[cacheKey] = url;
        return url;
      }
    } catch (e) { /* offline + not yet cached locally — fall through */ }
  }

  if (!navigator.onLine) return null;

  // 3) Non-default voice (or default-voice fallback): one-time download from
  // the pre-produced package in Firebase Storage, then cache locally.
  try {
    if (window.dartDB?.getVoicePkgURL) {
      const url = await window.dartDB.getVoicePkgURL(voiceId, key);
      if (url) {
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
          idbPut(cacheKey, blob);
          const objUrl = URL.createObjectURL(blob);
          objectUrlCache[cacheKey] = objUrl;
          return objUrl;
        }
      }
    }
  } catch (e) { /* not in the package (e.g. a not-yet-seeded name) — fall through */ }

  // 4) Name clips only: not in the pre-produced library — generate once,
  // cache centrally server-side (by normalized name, not uid), cache
  // locally here too so this device never asks again.
  if (opts.isName && opts.rawName) {
    try {
      let authToken = "anonymous";
      try { const user = window.fbAuth?.currentUser; if (user) authToken = await user.getIdToken(); } catch (e) {}
      const elevenLabsId = VOICES.find(v => v.id === voiceId)?.elevenLabsId;
      const resp = await fetch(NAME_VOICE_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
        body: JSON.stringify({ name: opts.rawName, voiceId }),
      });
      if (resp.ok) {
        const { url } = await resp.json();
        if (url) {
          const audioResp = await fetch(url);
          if (audioResp.ok) {
            const blob = await audioResp.blob();
            idbPut(cacheKey, blob);
            const objUrl = URL.createObjectURL(blob);
            objectUrlCache[cacheKey] = objUrl;
            return objUrl;
          }
        }
      }
    } catch (e) { console.warn("dartVoiceName:", e.message); }
  }

  return null;
}
