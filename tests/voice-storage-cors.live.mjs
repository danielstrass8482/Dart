/**
 * voice-storage-cors.live.mjs — the voice package in Firebase Storage
 * (dart_voice_pkg/<voice>/…) can be fetched by the app's origins.
 *
 * Until 2026-11-25 the bucket had no CORS rule: every fetch() of a Storage
 * download URL failed in the browser ("access control checks") and the
 * non-default voices (Haseeb, Jerry B, Guy) announced nothing in games —
 * on the web (which now loads them same-origin) and in the Android app
 * (origin https://localhost, still loads them from Storage). Rule:
 * storage.cors.json, applied with
 *   gcloud storage buckets update gs://darttrainer-app-fed88.firebasestorage.app --cors-file=storage.cors.json
 *
 * Signs in as a fresh guest (WebKit), resolves the download URL of one
 * clip + the index for each non-default voice, fetches them in the page
 * (real CORS check for the page's origin), checks the
 * Access-Control-Allow-Origin answer for every other app origin from Node,
 * then deletes the guest account.
 *
 * Usage: node tests/voice-storage-cors.live.mjs   (BASE=http://localhost:8973 for local)
 */
import { webkit } from "playwright";

const BASE = process.env.BASE || "https://play.darttrainer.app";
const ORIGINS = ["https://play.darttrainer.app", "https://danielstrass8482.github.io", "https://localhost", "capacitor://localhost"];
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); };

const browser = await webkit.launch();
const page = await browser.newPage();
try {
  await page.addInitScript(() => { localStorage.setItem("dart_onboarding_done", "true"); localStorage.setItem("dart_tts_enabled", "false"); });
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.signInAsGuest, null, { timeout: 60000 });
  await page.evaluate(() => window.splashPromise);
  await page.evaluate(() => window.signInAsGuest());
  await page.waitForFunction(() => window.dartDB?.getVoicePkgURL && window.currentUser, null, { timeout: 60000 });
  const res = await page.evaluate(async () => {
    const out = [];
    for (const v of ["haseeb", "jerry", "guy"]) {
      for (const [kind, url] of [["clip", await window.dartDB.getVoicePkgURL(v, "el_player_1")], ["index", await window.dartDB.getVoicePkgFileURL(v, "index.json")]]) {
        let status = null, bytes = 0, err = null;
        try { const r = await fetch(url, { cache: "no-store" }); status = r.status; bytes = (await r.arrayBuffer()).byteLength; } catch (e) { err = e.message; }
        out.push({ v, kind, url, status, bytes, err });
      }
    }
    return out;
  });
  for (const r of res) check(r.status === 200 && r.bytes > 100, `${r.v} ${r.kind}: fetch() from ${BASE} → ${r.status ?? r.err} (${r.bytes} bytes)`);
  const url = res.find((r) => r.kind === "clip")?.url;
  for (const o of ORIGINS) {
    const r = await fetch(url, { headers: { Origin: o } });
    const acao = r.headers.get("access-control-allow-origin");
    check(r.ok && (acao === o || acao === "*"), `origin ${o}: Access-Control-Allow-Origin = ${acao}`);
  }
  console.log(await page.evaluate(async () => { try { await window.deleteUserAccount(); return "guest account deleted"; } catch (e) { return "guest delete failed: " + e.message; } }));
} finally { await browser.close(); }
if (failures.length) { console.error("\nFAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("\nvoice-storage-cors: all assertions passed");
