/**
 * sw.js — Offline support for the WEB/PWA build only (never registered inside
 * the Capacitor Android app, which ships the default voice in its bundle —
 * see js/pwa.js).
 *
 * Design goal: the first visit is exactly as fast as without a service
 * worker. Registration happens only after the app is usable (js/pwa.js),
 * install precaches nothing large, and the default voice's clips are warmed
 * into VOICE_CACHE afterwards, in the background, by the page
 * (js/voiceClips.js warmDefaultVoice()).
 *
 * Strategies:
 *   - App shell (same-origin html/js/css/json/icons): network-first with
 *     forced revalidation (cache: "no-cache" → 304 when unchanged), cache
 *     fallback → online always the current deploy, never a copy from the
 *     browser's HTTP cache (GitHub Pages sends max-age=600, which used to
 *     mix old and new modules for up to 10 minutes after a deploy); offline
 *     the last-seen version is served.
 *   - Voice clips (same-origin assets/voice/**.mp3): cache-first, keyed by
 *     the full URL. The app requests <key>.mp3?h=<content hash> (from the
 *     voice's index.json), so a regenerated clip is a new URL and never hits
 *     an old entry; js/voiceClips.js warmDefaultVoice() prunes superseded ones.
 *   - Pinned CDN libs (Firebase SDK, Google Fonts, lucide): stale-while-revalidate.
 *   - Everything else (Firestore, Storage, Cloud Functions, auth, POSTs,
 *     media Range requests, /qa/, /tests/): not touched at all.
 */
// Bump SW_VERSION with every deploy that changes app code: a byte change in
// this file is what makes browsers install the new worker, and js/pwa.js
// reloads an idle app (home screen) once the new worker has taken over.
const SW_VERSION = "2026-11-26.5";
const SHELL_CACHE = "dt-shell-v1";
const CDN_CACHE = "dt-cdn-v1";
const VOICE_CACHE = "dt-voice-v1";
const KEEP = [SHELL_CACHE, CDN_CACHE, VOICE_CACHE];
const CDN_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(["./", "./index.html"])).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("dt-") && !KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

function kindOf(url) {
  if (url.origin === self.location.origin) {
    const scopePath = new URL(self.registration.scope).pathname;
    const rel = url.pathname.startsWith(scopePath) ? url.pathname.slice(scopePath.length) : url.pathname;
    if (rel.startsWith("qa/") || rel.startsWith("tests/") || rel === "sw.js") return null;
    if (rel.startsWith("assets/voice/") && rel.endsWith(".mp3")) return "voice";
    return "shell";
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    if (url.hostname === "www.gstatic.com" && !url.pathname.startsWith("/firebasejs/")) return null;
    return "cdn";
  }
  return null;
}

async function put(cacheName, req, resp) {
  // Opaque (no-cors, status 0) responses are only OK for the CDN cache (lucide <script>).
  if (resp && (resp.ok || (resp.type === "opaque" && cacheName === CDN_CACHE))) {
    try { await (await caches.open(cacheName)).put(req, resp); } catch (e) { /* quota — just don't cache */ }
  }
}

async function networkFirst(req) {
  try {
    // Navigations keep their own request (mode "navigate" can't be re-created).
    const resp = await fetch(req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" }));
    if (resp.ok) put(SHELL_CACHE, req, resp.clone());
    return resp;
  } catch (e) {
    const c = await caches.open(SHELL_CACHE);
    return (await c.match(req)) || (await c.match(req, { ignoreSearch: true }))
      || (req.mode === "navigate" ? (await c.match("./index.html")) || (await c.match("./")) : undefined)
      || Response.error();
  }
}

async function cacheFirst(req) {
  const c = await caches.open(VOICE_CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const resp = await fetch(req);
  if (resp.ok) await put(VOICE_CACHE, req, resp.clone());
  return resp;
}

async function staleWhileRevalidate(event) {
  const c = await caches.open(CDN_CACHE);
  const hit = await c.match(event.request);
  const refresh = fetch(event.request).then(r => { put(CDN_CACHE, event.request, r.clone()); return r; });
  if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  const kind = kindOf(url);
  if (kind === "shell") event.respondWith(networkFirst(req));
  else if (kind === "voice") event.respondWith(cacheFirst(req));
  else if (kind === "cdn") event.respondWith(staleWhileRevalidate(event));
});

// The first visit's resources load BEFORE this worker controls the page, so
// the page hands over its resource list once (js/pwa.js) and they are copied
// into the caches here — normally straight from the browser's HTTP cache.
// "clear-voice" wipes the clip cache (sent by app versions before the
// per-clip ?h= URLs; kept so an old open tab still works with this worker).
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "cache-urls" && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      for (const u of msg.urls) {
        let url; try { url = new URL(u); } catch (e) { continue; }
        const kind = kindOf(url);
        if (kind !== "shell" && kind !== "cdn") continue;
        const name = kind === "shell" ? SHELL_CACHE : CDN_CACHE;
        if (await (await caches.open(name)).match(u)) continue;
        try {
          let resp;
          try { resp = await fetch(u, { mode: kind === "shell" ? "same-origin" : "cors" }); }
          catch (e) { resp = await fetch(u, { mode: "no-cors" }); }
          await put(name, u, resp);
        } catch (e) { /* skip */ }
      }
      event.ports[0]?.postMessage({ ok: true });
    })());
  } else if (msg.type === "skip-waiting") {
    // Belt and braces next to skipWaiting() in install: js/pwa.js asks an
    // installed-but-waiting update to take over (harmless if already active).
    self.skipWaiting();
  } else if (msg.type === "version") {
    event.ports[0]?.postMessage({ version: SW_VERSION });
  } else if (msg.type === "clear-voice") {
    event.waitUntil(caches.delete(VOICE_CACHE).then(() => event.ports[0]?.postMessage({ ok: true })));
  }
});
