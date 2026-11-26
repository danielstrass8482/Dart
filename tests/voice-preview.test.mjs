/**
 * voice-preview.test.mjs — the voice picker's preview buttons (Profil →
 * Stimme & Sound) play a PRE-PRODUCED clip of that voice — no live TTS, no
 * request to any Cloud Function / Cloud Run / Storage (dartTTS was deleted
 * 2026-11-26). Real playback (no audio stubs), all 4 voices × 3 buttons,
 * via the real buttons; the active voice must not change.
 *
 * Usage: python3 -m http.server 8973 &  (repo root), then
 *   PLAYWRIGHT_BROWSERS_PATH=/var/tmp/pw node tests/voice-preview.test.mjs
 *   BROWSER=webkit PLAYWRIGHT_BROWSERS_PATH=/var/tmp/pw node tests/voice-preview.test.mjs
 *   BASE=https://play.darttrainer.app node tests/voice-preview.test.mjs   (live)
 */
import { chromium, webkit } from "playwright";

const BROWSER = process.env.BROWSER === "webkit" ? "webkit" : "chromium"; // Cloud Shell sets BROWSER=echo
const BASE = process.env.BASE || "http://localhost:8973";
const VOICES = { JBFqnCBsd6RMkjVDRZzb: "george", dllHSct4GokGc1AH9JwT: "haseeb", zDBYcuJrpuZ6YQ7AgRUw: "jerry", "34lPwSZ54D8fWbX1aHzk": "guy" };
const KEYS = ["el_score_180b", "el_game_on", "el_bust"];
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log("  FAIL", msg); } else console.log("  ok  ", msg); };

const browser = await (BROWSER === "webkit" ? webkit : chromium).launch();
console.log(`voice-preview (${BROWSER}, ${BASE})`);
try {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(/recaptcha/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const requests = [];
  page.on("request", (r) => requests.push({ t: Date.now(), url: r.url() }));
  const errors = [];
  page.on("pageerror", (e) => { if (!/due to access control checks|^no recaptcha$/.test(e.message)) errors.push(e.message); });
  await page.addInitScript(() => {
    localStorage.setItem("dart_onboarding_done", "true");
    localStorage.setItem("dart_lang", "de");
    localStorage.setItem("dart_tts_enabled", "false"); // preview must play even with announcements off
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.evaluate(() => window.splashPromise);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.dartDB = { saveUserVoice: async () => {}, loadUserVoice: async () => "JBFqnCBsd6RMkjVDRZzb", loadGlobalVoices: async () => null, loadStats: async () => [], loadCoopGames: async () => [], loadPlayers: async () => [] };
    window.showScreen("setup"); // no login (local, like the other UI tests)
  });
  await page.waitForTimeout(300);
  await page.mouse.click(5, 5); // user gesture → unlockAudio()
  await page.click('.home-tab[data-tab="profil"]');
  // Without a login the profile tab isn't filled — "dbReady" renders the voice picker (app.js) as after a real login.
  await page.evaluate(() => window.dispatchEvent(new Event("dbReady")));
  await page.waitForSelector("#voice-selector-list [data-tv-id]", { timeout: 15000 });
  const activeBefore = await page.evaluate(() => localStorage.getItem("dart_active_voice_id"));
  check(await page.locator("#voice-selector-list [data-tv-id]").count() === 12, "12 preview buttons (4 voices × 3)");
  check(await page.locator("#voice-selector-list [data-tv-text], #voice-selector-list .admin-vid-row").count() === 0, "no live-TTS text attributes / voice-ID editor left");

  for (const [id, voice] of Object.entries(VOICES)) {
    for (const key of KEYS) {
      const t0 = Date.now();
      const n0 = await page.evaluate(() => (window.__dtVoiceTrace || []).length);
      await page.click(`#voice-selector-list [data-tv-id="${id}"][data-tv-key="${key}"]`);
      const ok = await page.waitForFunction(() => window.__dtAudioIdle?.(), null, { timeout: 15000 }).then(() => true, () => false);
      const tr = await page.evaluate((n0) => (window.__dtVoiceTrace || []).slice(n0), n0);
      const clipReq = requests.filter((r) => r.t >= t0 && r.url.includes(`/assets/voice/${voice}/${key}.mp3`));
      const fnReq = requests.filter((r) => r.t >= t0 && /cloudfunctions\.net|run\.app|firebasestorage|elevenlabs|dartTTS|darttts/i.test(r.url));
      check(ok && tr.length === 1 && tr[0].key === key, `${voice} ${key}: played exactly this clip (${tr.map((x) => x.key + "/" + x.mode).join(",") || "nothing"})`);
      check(clipReq.length === 1 || (tr[0]?.url || "").includes(`/assets/voice/${voice}/`) || (tr[0]?.url || "").startsWith("blob:"), `${voice} ${key}: clip of voice ${voice} (same-origin)`);
      check(fnReq.length === 0, `${voice} ${key}: no Function/Storage/ElevenLabs request ${fnReq.map((r) => r.url).join(" ")}`);
    }
  }
  // Clip of the right voice: every same-origin clip request during the run belongs to the clicked voice.
  const voiceReqs = requests.filter((r) => /\/assets\/voice\/[^/]+\/el_(score_180b|game_on|bust)\.mp3/.test(r.url)).map((r) => r.url.match(/assets\/voice\/([^/]+)\//)[1]);
  check(Object.values(VOICES).every((v) => voiceReqs.includes(v)), `clips loaded from all 4 voice folders (${[...new Set(voiceReqs)].join(",")})`);
  check(await page.evaluate(() => localStorage.getItem("dart_active_voice_id")) === activeBefore, "active voice unchanged by previews");
  const anyFn = requests.filter((r) => /dartTTS|darttts|elevenlabs/i.test(r.url));
  check(anyFn.length === 0, "no dartTTS/ElevenLabs request during the whole session");
  check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
  await ctx.close();
} finally {
  await browser.close();
}
console.log(failures.length ? `\n${failures.length} FAILED` : "\nALL PASSED");
process.exit(failures.length ? 1 : 0);
