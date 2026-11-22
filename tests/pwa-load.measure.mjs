/**
 * pwa-load.measure.mjs — Measures first-visit startup of the web build on a
 * weak connection (Chrome DevTools "Slow 3G" values: 2000 ms RTT,
 * 400 kbit/s down/up), fresh browser profile each run.
 *
 *   node tests/pwa-load.measure.mjs cdp    <baseUrl> [runs]
 *     Throttling via CDP on the page (like DevTools). Reports time until the
 *     app is usable (splash gone, all modules incl. Firebase loaded, start/
 *     login screen active) and how many KB / voice-clip requests happened
 *     before that point. NOTE: CDP throttling does not apply to requests a
 *     service worker makes itself — use `origin` mode for the warm-up.
 *
 *   node tests/pwa-load.measure.mjs origin <rootDir> [port]
 *     Serves <rootDir> through a built-in throttled server (2000 ms latency
 *     per request, ONE shared 400 kbit/s downlink for all connections — so
 *     the service worker's background downloads are throttled too). Reports
 *     time to usable, the latency of an announcement for a clip the warm-up
 *     has not reached yet (i.e. competing with it), and warm-up duration.
 */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [MODE, TARGET, EXTRA] = process.argv.slice(2);
const usable = () => {
  const sp = document.getElementById("splash-screen");
  return sp && sp.style.display === "none" && typeof window.showScreen === "function"
    && typeof window.signInAsGuest === "function" && !!document.querySelector(".screen.active");
};
async function freshPage(browser) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem("dart_onboarding_done", "true"); } catch (e) {} });
  return { ctx, page: await ctx.newPage() };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdpRun(base) {
  const browser = await chromium.launch();
  const { ctx, page } = await freshPage(browser);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 50000 });
  let ready = false, bytes = 0, clips = 0;
  page.on("requestfinished", async r => { if (ready) return; try { const s = await r.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; if (r.url().includes("/assets/voice/")) clips++; } catch (e) {} });
  const t0 = Date.now();
  await page.goto(`${base}/index.html`, { waitUntil: "commit", timeout: 300000 });
  await page.waitForFunction(usable, null, { timeout: 300000, polling: 100 });
  const usableMs = Date.now() - t0; ready = true;
  await browser.close();
  return { usableMs, kbBeforeUsable: Math.round(bytes / 1024), clipRequestsBeforeUsable: clips };
}

function throttledServer(root, port) {
  const RATE = 50000, CHUNK = 2500; let nextSlot = Date.now();
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".webp": "image/webp" };
  return http.createServer(async (req, res) => {
    let p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (p.endsWith("/")) p += "index.html";
    await sleep(2000);
    let body; try { body = fs.readFileSync(p); } catch { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream", "content-length": body.length, "cache-control": "no-cache" });
    for (let i = 0; i < body.length; i += CHUNK) {
      const slot = Math.max(nextSlot, Date.now()); nextSlot = slot + (CHUNK / RATE) * 1000;
      await sleep(slot - Date.now()); res.write(body.subarray(i, i + CHUNK));
    }
    res.end();
  }).listen(port);
}

async function originRun(root, port) {
  const server = throttledServer(root, port);
  const base = `http://localhost:${port}`;
  const browser = await chromium.launch();
  const { page } = await freshPage(browser);
  const t0 = Date.now();
  await page.goto(`${base}/index.html`, { waitUntil: "commit", timeout: 300000 });
  await page.waitForFunction(usable, null, { timeout: 300000, polling: 100 });
  const usableMs = Date.now() - t0;
  await page.waitForTimeout(10000); // warm-up (if any) is in full swing now
  // Announcement needed right now for a clip the warm-up hasn't reached (names are warmed last):
  const announceMs = await page.evaluate(async () => {
    const vc = await import("./js/voiceClips.js");
    const t = performance.now(); const u = await vc.resolveClipURL("george", "name_yvonne");
    return u ? Math.round(performance.now() - t) : null;
  });
  let warm = null, warmDoneS = null;
  const hasWarm = await page.evaluate(() => !!window.__voiceWarm);
  if (hasWarm) {
    await page.waitForFunction(() => ["done", "partial", "skipped", "no-index"].includes(window.__voiceWarm.state), null, { timeout: 1800000, polling: 1000 });
    warm = await page.evaluate(() => ({ ...window.__voiceWarm }));
    warmDoneS = Math.round((Date.now() - t0) / 1000);
  }
  await browser.close(); server.close();
  return { usableMs, announceUncachedClipMs: announceMs, warm, warmCompleteAtS: warmDoneS };
}

if (MODE === "cdp") {
  const runs = [];
  for (let i = 0; i < (+EXTRA || 3); i++) runs.push(await cdpRun(TARGET));
  const med = k => runs.map(r => r[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  console.log(JSON.stringify({ mode: "cdp", base: TARGET, runs, medianUsableMs: med("usableMs") }));
} else if (MODE === "origin") {
  console.log(JSON.stringify({ mode: "origin", root: TARGET, ...(await originRun(TARGET, +EXTRA || 8990)) }));
} else {
  console.error("usage: node tests/pwa-load.measure.mjs cdp <baseUrl> [runs] | origin <rootDir> [port]"); process.exit(2);
}
