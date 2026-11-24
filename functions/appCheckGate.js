/**
 * appCheckGate.js — Shared Firebase App Check handling for the HTTP functions
 * (dartCoach, dartVoiceName, dartTTS, dartAppCheckPing).
 *
 * 1. Verifies the X-Firebase-AppCheck header (if any) → status
 *    "valid" | "invalid" | "missing".
 * 2. Platform: from the VERIFIED token's app id (android/web); otherwise from
 *    the client hint header X-DT-Client ("android/1.3.0", "web/…", sent since
 *    1.3.0) or the old Android app's user agent ("DartTrainerApp/…" — vc12
 *    and older send no hint) → "android" | "android-old" | "web" | "unknown".
 * 3. Measurement: one counter increment per request in
 *    dart_appcheck_stats/{YYYY-MM-DD}  field  <fn>.<platform>.<status>
 *    plus one structured log line (jsonPayload.appCheck) for Logs Explorer.
 *    Report: node scripts/appcheck-report.js [--days=14]
 * 4. Enforcement — switchable per function WITHOUT a deploy, in Firestore
 *    dart_config/appcheck:  { enforce: { dartCoach: false, dartVoiceName:
 *    false, dartTTS: false } }. Read with a 60 s in-memory cache, so a
 *    change takes effect within about a minute. Missing doc/field = not
 *    enforced. If the doc can't be read, the last known value is kept.
 *    When enforced, anything but a valid token gets 401.
 *
 * Daily limits, budgetCheck and the kill-switch (dart_config/limits) are
 * separate and unchanged.
 */
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAppCheck } = require("firebase-admin/app-check");

if (!getApps().length) initializeApp();

const APP_IDS = {
  "1:875969093013:android:abbe73b627f0cb06cd2a9c": "android",
  "1:875969093013:web:55414edcd3751c99cd2a9c": "web",
};

const CONFIG_TTL_MS = 60 * 1000;
let configCache = { at: 0, enforce: {} };

async function enforcement() {
  if (Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.enforce;
  try {
    const snap = await getFirestore().collection("dart_config").doc("appcheck").get();
    configCache = { at: Date.now(), enforce: (snap.exists && snap.data().enforce) || {} };
  } catch (e) {
    console.warn("appcheck config read failed, keeping last value:", e.message);
    configCache.at = Date.now();
  }
  return configCache.enforce;
}

function platformHint(req) {
  const hint = String(req.headers["x-dt-client"] || "").toLowerCase();
  if (hint.startsWith("test")) return "test"; // our own live tests — kept out of the report
  if (hint.startsWith("android")) return "android";
  if (hint.startsWith("web")) return "web";
  const ua = String(req.headers["user-agent"] || "");
  if (/DartTrainerApp\//.test(ua)) return "android-old"; // app without X-DT-Client = before 1.3.0
  if (/Mozilla\//.test(ua)) return "web";
  return "unknown";
}

/** Pure classification (exported for tests). */
async function classify(req, verify = (t) => getAppCheck().verifyToken(t)) {
  const token = req.headers["x-firebase-appcheck"];
  let status = "missing", appId = null, error = null;
  if (token) {
    try {
      const r = await verify(token);
      status = "valid"; appId = r.appId;
    } catch (e) { status = "invalid"; error = e.message; }
  }
  const hinted = platformHint(req);
  const platform = hinted === "test" ? "test" : (appId && APP_IDS[appId]) || hinted;
  return { status, platform, appId, error, client: String(req.headers["x-dt-client"] || ""),
    clientError: String(req.headers["x-dt-appcheck-error"] || "").slice(0, 200) || null };
}

async function record(fn, c) {
  const day = new Date().toISOString().slice(0, 10);
  console.log(JSON.stringify({ appCheck: { fn, platform: c.platform, status: c.status, client: c.client || null, error: c.error || undefined, clientError: c.clientError || undefined } }));
  try {
    await getFirestore().collection("dart_appcheck_stats").doc(day)
      .set({ [fn]: { [c.platform]: { [c.status]: FieldValue.increment(1) } } }, { merge: true });
  } catch (e) { console.warn("appcheck stats write failed:", e.message); }
}

/**
 * Runs the gate. Returns true if the request may continue; on false a 401
 * has already been sent.
 * @param {string} fn function name, e.g. "dartCoach"
 */
async function appCheckGate(fn, req, res, out = {}) {
  const c = await classify(req);
  const [enforce] = await Promise.all([enforcement(), record(fn, c)]);
  out.classification = c;
  if (enforce[fn] === true && c.status !== "valid") {
    res.status(401).json({ error: c.status === "missing" ? "App Check token required" : "App Check verification failed" });
    return false;
  }
  return true;
}

module.exports = { appCheckGate, classify, platformHint, APP_IDS };
