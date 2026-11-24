/**
 * appcheck-gate.live.mjs — Live proof for functions/appCheckGate.js against
 * the deployed functions (project darttrainer-app-fed88):
 *   1. A real App Check token (temporary debug token of the WEB app,
 *      exchanged at the App Check API) → "valid", platform from the token.
 *   2. Garbage token → "invalid"; no token → "missing" (still 200: off).
 *   3. Enforcement switched ON for dartAppCheckPing in Firestore
 *      dart_config/appcheck (no deploy) → missing/invalid get 401, valid 200;
 *      switched OFF again → missing gets 200. Real functions are never touched.
 *   4. Counters land in dart_appcheck_stats/<today>.dartAppCheckPing.test.*
 *      (platform "test" = X-DT-Client "test", excluded from the report).
 * Cleans up: debug token deleted, enforce flag restored to false.
 * Needs: gcloud auth login (project owner). Usage: node tests/appcheck-gate.live.mjs
 */
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const P = "darttrainer-app-fed88", PN = "875969093013";
const WEB = "1:875969093013:web:55414edcd3751c99cd2a9c";
const PING = "https://europe-west1-darttrainer-app-fed88.cloudfunctions.net/dartAppCheckPing";
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const T = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const G = { Authorization: `Bearer ${T}`, "x-goog-user-project": P, "Content-Type": "application/json" };
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the web app's public API key (same as index.html firebaseConfig.apiKey)
const html = await (await fetch("https://play.darttrainer.app/index.html")).text();
const apiKey = html.match(/apiKey:\s*"([^"]+)"/)[1];

async function setEnforce(on) {
  const r = await fetch(`${FS}/dart_config/appcheck?updateMask.fieldPaths=enforce.dartAppCheckPing`, {
    method: "PATCH", headers: G,
    body: JSON.stringify({ fields: { enforce: { mapValue: { fields: { dartAppCheckPing: { booleanValue: on } } } } } }),
  });
  if (!r.ok) throw new Error("config write " + r.status + " " + await r.text());
}
async function ping(headers) {
  const r = await fetch(PING, { method: "POST", headers: { "X-DT-Client": "test", ...headers } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function counters() {
  const d = new Date().toISOString().slice(0, 10);
  const j = await (await fetch(`${FS}/dart_appcheck_stats/${d}`, { headers: G })).json();
  const f = j.fields?.dartAppCheckPing?.mapValue?.fields?.test?.mapValue?.fields || {};
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v.integerValue)]));
}

let debugName = null;
try {
  // 1. real token via a temporary debug token
  const dbg = crypto.randomUUID();
  const cr = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${P}/apps/${WEB}/debugTokens`, { method: "POST", headers: G, body: JSON.stringify({ displayName: "appcheck-gate.live test (auto-deleted)", token: dbg }) });
  const crj = await cr.json(); debugName = crj.name;
  check(cr.ok, `temporary debug token created (${cr.status})`);
  const ex = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${PN}/apps/${WEB}:exchangeDebugToken?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ debugToken: dbg }) });
  const { token } = await ex.json();
  check(ex.ok && !!token, `exchanged for an App Check token (${ex.status})`);

  const before = await counters();
  let r = await ping({ "X-Firebase-AppCheck": token });
  check(r.status === 200 && r.body?.status === "valid", `valid token → 200 valid (${JSON.stringify(r)})`);
  r = await ping({ "X-Firebase-AppCheck": "eyJhbGciOi.garbage.token" });
  check(r.status === 200 && r.body?.status === "invalid", `garbage token → 200 invalid while off (${JSON.stringify(r)})`);
  r = await ping({});
  check(r.status === 200 && r.body?.status === "missing", `no token → 200 missing while off (${JSON.stringify(r)})`);
  const after = await counters();
  check((after.valid || 0) - (before.valid || 0) === 1 && (after.invalid || 0) - (before.invalid || 0) === 1 && (after.missing || 0) - (before.missing || 0) === 1,
    `counters +1 each (valid/invalid/missing: ${JSON.stringify(before)} → ${JSON.stringify(after)})`);

  // 3. switch ON without deploy
  await setEnforce(true);
  console.log("  … enforcement ON for dartAppCheckPing, waiting 65 s for the config cache");
  await sleep(65000);
  r = await ping({});
  check(r.status === 401, `ON: no token → 401 (${r.status})`);
  r = await ping({ "X-Firebase-AppCheck": "eyJhbGciOi.garbage.token" });
  check(r.status === 401, `ON: garbage token → 401 (${r.status})`);
  r = await ping({ "X-Firebase-AppCheck": token });
  check(r.status === 200 && r.body?.status === "valid", `ON: valid token → 200 (${r.status})`);
  await setEnforce(false);
  console.log("  … enforcement OFF again, waiting 65 s");
  await sleep(65000);
  r = await ping({});
  check(r.status === 200, `OFF again: no token → 200 (${r.status})`);
} finally {
  await setEnforce(false).catch((e) => failures.push("restore enforce=false: " + e.message));
  if (debugName) {
    const d = await fetch(`https://firebaseappcheck.googleapis.com/v1/${debugName}`, { method: "DELETE", headers: G });
    check(d.ok, `debug token deleted (${d.status})`);
  }
}
console.log(failures.length ? `\nFAILED (${failures.length}):\n - ` + failures.join("\n - ") : "\nALL PASSED");
process.exit(failures.length ? 1 : 0);
