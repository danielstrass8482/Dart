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
import { warmDefaultVoice } from './voiceClips.js';

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

// Screens on which a reload loses nothing (no game in progress).
const IDLE_SCREENS = ["setup", "auth-screen"];
const isIdle = () => IDLE_SCREENS.includes(document.querySelector(".screen.active")?.id || "");

/**
 * Keeps a long-running PWA (iPad home screen: the app often lives for days
 * without a real restart) on the current deploy:
 *   - checks for a new sw.js whenever the app comes back to the foreground
 *     (and hourly), not only on navigations;
 *   - once a NEW worker took over a page that was already controlled, the
 *     page still runs the old modules → reload, but only while idle on the
 *     home/login screen; otherwise as soon as the user is back there.
 */
function keepCurrent(reg) {
  const hadController = !!navigator.serviceWorker.controller;
  let updatePending = false;
  const reloadIfIdle = () => { if (updatePending && isIdle() && document.visibilityState === "visible") location.reload(); };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;           // first install — page is already current
    updatePending = true;
    console.info("App update installed — reloading on the home screen");
    reloadIfIdle();
  });
  // Activate an installed update right away (see "skip-waiting" in sw.js).
  const activateWaiting = () => { if (reg.waiting) reg.waiting.postMessage({ type: "skip-waiting" }); };
  reg.addEventListener("updatefound", () => {
    const w = reg.installing;
    w?.addEventListener("statechange", () => { if (w.state === "installed") activateWaiting(); });
  });
  activateWaiting();
  const check = () => reg.update().then(activateWaiting).catch(() => {});
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { check(); reloadIfIdle(); } });
  setInterval(check, 60 * 60 * 1000);
  window.__pwaKeepCurrent = true;
  // Return to the home screen after a game → apply a pending update there.
  const mo = new MutationObserver(reloadIfIdle);
  document.querySelectorAll(".screen").forEach(el => mo.observe(el, { attributes: true, attributeFilter: ["class"] }));
}

// A hanging third-party script (e.g. reCAPTCHA on a bad connection) can keep
// the load event from ever firing — don't let that stop the worker/updates.
const afterLoad = () => document.readyState === "complete" ? Promise.resolve()
  : new Promise(r => { window.addEventListener("load", r, { once: true }); setTimeout(r, 15000); });

export async function initPWA() {
  if (isNative() || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  await Promise.all([afterLoad(), window.splashPromise || Promise.resolve()]);
  try {
    const reg = await navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" });
    keepCurrent(reg);
    await whenControlled();
    await handOverFirstVisitResources();
    // Let the first screen settle before starting the clip downloads.
    setTimeout(() => {
      warmDefaultVoice().catch(e => console.warn("voice warm-up:", e.message));
    }, 3000);
    // Stale clips of any voice (IndexedDB copies, older ?h= versions) are
    // detected per clip against the voice's index — see js/voiceClips.js.
    // Resume an interrupted warm-up when the connection comes back.
    window.addEventListener("online", () => setTimeout(() => warmDefaultVoice().catch(() => {}), 3000));
  } catch (e) { console.warn("Service worker:", e.message); }
}
