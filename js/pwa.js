/**
 * pwa.js — Service-worker registration + offline warm-up for the WEB build.
 *
 * Not used inside the Capacitor Android app: there the default voice and the
 * whole app are bundled in the APK/AAB and served locally, so a service
 * worker would only duplicate storage.
 *
 * Order matters for first-visit speed: nothing here starts before the app is
 * usable (splash finished + window load), so the service worker and the
 * ~7 MB default-voice warm-up never compete with the app's own startup
 * downloads. See sw.js for the caching strategies.
 */
import { warmDefaultVoice, syncVoiceRevision, voiceKeyFor, DEFAULT_VOICE_ID } from './voiceClips.js';

const isNative = () => !!window.Capacitor?.isNativePlatform?.();

async function handOverFirstVisitResources() {
  // Resources of THIS page load were fetched before the worker controlled
  // the page — give the worker the list so it can cache the app shell.
  const urls = [location.href, ...performance.getEntriesByType("resource").map(e => e.name)];
  const ctl = navigator.serviceWorker.controller;
  if (!ctl) return;
  await new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = resolve;
    ctl.postMessage({ type: "cache-urls", urls }, [ch.port2]);
    setTimeout(resolve, 60000);
  });
}

function whenControlled() {
  if (navigator.serviceWorker.controller) return Promise.resolve();
  return new Promise(r => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
}

const afterLoad = () => document.readyState === "complete" ? Promise.resolve() : new Promise(r => window.addEventListener("load", r, { once: true }));

export async function initPWA() {
  if (isNative() || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  await Promise.all([afterLoad(), window.splashPromise || Promise.resolve()]);
  try {
    await navigator.serviceWorker.register("sw.js", { scope: "./" });
    await whenControlled();
    await handOverFirstVisitResources();
    // Let the first screen settle before starting the clip downloads.
    setTimeout(() => {
      warmDefaultVoice().catch(e => console.warn("voice warm-up:", e.message));
    }, 3000);
    // Non-default voices are cached clip-by-clip in IndexedDB; drop stale
    // copies there too if that voice's clips were regenerated/re-encoded.
    let active = DEFAULT_VOICE_ID;
    try { active = voiceKeyFor(localStorage.getItem("dart_active_voice_id")); } catch (e) {}
    if (active !== DEFAULT_VOICE_ID) syncVoiceRevision(active).catch(() => {});
    // Resume an interrupted warm-up when the connection comes back.
    window.addEventListener("online", () => setTimeout(() => warmDefaultVoice().catch(() => {}), 3000));
  } catch (e) { console.warn("Service worker:", e.message); }
}
