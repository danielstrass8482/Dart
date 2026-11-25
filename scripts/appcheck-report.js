#!/usr/bin/env node
/**
 * appcheck-report.js — Share of valid App Check tokens per function and
 * platform, from the counters functions/appCheckGate.js writes to
 * Firestore dart_appcheck_stats/<YYYY-MM-DD>, plus the go/no-go per function
 * for switching enforcement on (dart_config/appcheck → enforce.<fn> = true).
 *
 * Usage: node scripts/appcheck-report.js [--days=7]
 * Needs: gcloud auth login (uses your access token; nothing is written).
 *
 * Platforms: android = app 1.3.0+ (sends X-DT-Client) · android-old = Play
 * Store app before 1.3.0 · web = browser · unknown = no browser/app at all
 * (scripts, bots — exactly what enforcement is meant to block).
 *
 * Criterion to enforce a function (over the --days window, default 7 days):
 *   1. android and web each: ≥ 98 % valid, from ≥ 30 requests (pings count —
 *      they come from the same token pipeline);
 *   2. android-old makes up < 2 % of THAT function's requests from app/web
 *      users (they can never send a valid token; enforcing cuts them off);
 *   3. no day in the window with valid share < 95 % on android or web.
 */
"use strict";
const { execSync } = require("child_process");

const PROJECT = "darttrainer-app-fed88";
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const DAYS = parseInt(args.days) || 7;
const FNS = ["dartCoach", "dartTTS", "dartAppCheckPing"];
const PLATFORMS = ["android", "web", "android-old", "unknown"];

function fromValue(v) {
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromValue(x)]));
  if (v.integerValue != null) return Number(v.integerValue);
  if (v.doubleValue != null) return v.doubleValue;
  if (v.booleanValue != null) return v.booleanValue;
  return v.stringValue ?? null;
}

async function main() {
  const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
  const H = { Authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT };
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const perDay = {};
  for (const d of days) {
    const r = await fetch(`${base}/dart_appcheck_stats/${d}`, { headers: H });
    if (r.status === 404) { perDay[d] = {}; continue; }
    if (!r.ok) throw new Error(`Firestore ${r.status}: ${await r.text()}`);
    const doc = await r.json();
    perDay[d] = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromValue(v)]));
  }
  const cfgR = await fetch(`${base}/dart_config/appcheck`, { headers: H });
  const enforce = cfgR.ok ? (fromValue({ mapValue: { fields: (await cfgR.json()).fields || {} } }).enforce || {}) : {};

  const sum = (fn, pf, from = days) => from.reduce((a, d) => {
    const c = perDay[d]?.[fn]?.[pf] || {};
    a.valid += c.valid || 0; a.invalid += c.invalid || 0; a.missing += c.missing || 0; return a;
  }, { valid: 0, invalid: 0, missing: 0 });
  const tot = (c) => c.valid + c.invalid + c.missing;
  const pct = (c) => tot(c) ? (100 * c.valid / tot(c)).toFixed(1) + " %" : "—";

  console.log(`App Check ${days[0]} … ${days[days.length - 1]} (${DAYS} Tage)\n`);
  console.log("Function          Plattform     gültig  ungültig  fehlt   Anteil gültig");
  for (const fn of FNS) for (const pf of PLATFORMS) {
    const c = sum(fn, pf); if (!tot(c)) continue;
    console.log(`${fn.padEnd(17)} ${pf.padEnd(12)} ${String(c.valid).padStart(7)} ${String(c.invalid).padStart(9)} ${String(c.missing).padStart(6)}   ${pct(c)}`);
  }

  // Pipeline health per platform across all functions incl. pings
  const pipe = (pf, from) => FNS.reduce((a, fn) => { const c = sum(fn, pf, from); a.valid += c.valid; a.invalid += c.invalid; a.missing += c.missing; return a; }, { valid: 0, invalid: 0, missing: 0 });
  const health = {};
  for (const pf of ["android", "web"]) {
    const c = pipe(pf, days);
    const badDay = days.find(d => { const x = pipe(pf, [d]); return tot(x) >= 5 && x.valid / tot(x) < 0.95; });
    health[pf] = { ok: tot(c) >= 30 && c.valid / tot(c) >= 0.98 && !badDay, c, badDay };
    console.log(`\nToken-Pipeline ${pf}: ${pct(c)} gültig aus ${tot(c)} Anfragen${badDay ? `, schwacher Tag ${badDay}` : ""} → ${health[pf].ok ? "OK" : "noch nicht OK (≥ 98 % aus ≥ 30 nötig)"}`);
  }

  console.log("\nEinschalten (dart_config/appcheck → enforce.<fn> = true)?");
  for (const fn of ["dartCoach", "dartTTS"]) {
    const users = ["android", "web", "android-old"].reduce((a, pf) => a + tot(sum(fn, pf)), 0);
    const old = tot(sum(fn, "android-old"));
    const oldShare = users ? old / users : 0;
    const go = health.android.ok && health.web.ok && oldShare < 0.02;
    console.log(`  ${fn.padEnd(14)} aktuell ${enforce[fn] === true ? "AN " : "aus"} · alte App ${(100 * oldShare).toFixed(1)} % der Nutzeranfragen · ${go ? "JA — Kriterium erfüllt" : "NEIN"}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
