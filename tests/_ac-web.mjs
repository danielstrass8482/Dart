import { chromium } from "playwright";
import crypto from "node:crypto";
const BASE = process.env.BASE || "https://play.darttrainer.app";
const b = await chromium.launch(); const page = await b.newPage();
const ex = []; page.on("response", async r => { if (r.url().includes("exchangeRecaptcha")) ex.push(r.status() + " " + (r.status() !== 200 ? (await r.text()).slice(0, 200) : "")); });
await page.goto(BASE + "/index.html"); await page.evaluate(() => window.splashPromise); await page.waitForTimeout(4000);
const tok = await page.evaluate(async () => window.getAppCheckToken ? await window.getAppCheckToken() : "NO_FN");
console.log("exchange:", ex);
if (!tok || tok === "NO_FN") { console.log("kein Token", tok); process.exit(1); }
const [h, p, s] = tok.split(".");
const hdr = JSON.parse(Buffer.from(h, "base64url")), pl = JSON.parse(Buffer.from(p, "base64url"));
const jwks = await (await fetch("https://firebaseappcheck.googleapis.com/v1/jwks")).json();
const jwk = jwks.keys.find(k => k.kid === hdr.kid);
const ok = crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), crypto.createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
console.log(JSON.stringify({ sig: ok, iss: pl.iss, aud: pl.aud, sub: pl.sub, exp: new Date(pl.exp * 1000).toISOString() }));
await b.close();
