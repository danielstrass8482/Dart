#!/usr/bin/env node
/**
 * test-checkout-table.js — Sanity tests for js/checkout.js.
 * Run with: node scripts/test-checkout-table.js
 */
"use strict";
const assert = require("assert");
const { pathToFileURL } = require("url");

(async () => {
  const { CHECKOUT_TABLE, getCheckoutPath } = await import(pathToFileURL(require("path").join(__dirname, "..", "js", "checkout.js")));

  let pass = 0, fail = 0;
  function check(desc, cond) {
    if (cond) { pass++; }
    else { fail++; console.error("FAIL:", desc); }
  }

  // 170 — only reachable with all 3 darts
  check("170 with 3 darts = T20 T20 Bull", getCheckoutPath(170, 3) === "T20 T20 Bull");
  check("170 with 2 darts = null (impossible)", getCheckoutPath(170, 2) === null);
  check("170 with 1 dart = null", getCheckoutPath(170, 1) === null);

  // 100 — reachable with 2 darts, so also fine with 3, not with 1
  check("100 with 3 darts = T20 D20", getCheckoutPath(100, 3) === "T20 D20");
  check("100 with 2 darts = T20 D20", getCheckoutPath(100, 2) === "T20 D20");
  check("100 with 1 dart = null", getCheckoutPath(100, 1) === null);

  // 50 — Bull, 1 dart, works regardless of darts left
  check("50 with 3 darts = Bull", getCheckoutPath(50, 3) === "Bull");
  check("50 with 1 dart = Bull", getCheckoutPath(50, 1) === "Bull");

  // 40 — D20, 1 dart
  check("40 with 1 dart = D20", getCheckoutPath(40, 1) === "D20");

  // 2 — D1, 1 dart
  check("2 with 1 dart = D1", getCheckoutPath(2, 1) === "D1");

  // Bogey numbers — no checkout at all, any darts count
  for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
    check(`${bogey} has no entry in CHECKOUT_TABLE`, CHECKOUT_TABLE[bogey] === undefined);
    check(`${bogey} with 3 darts = null`, getCheckoutPath(bogey, 3) === null);
  }

  // Unreachable / out-of-range remaining scores
  check("171 (>170) = null", getCheckoutPath(171, 3) === null);
  check("1 (no checkout target) = null", getCheckoutPath(1, 3) === null);
  check("0 = null", getCheckoutPath(0, 3) === null);

  // No finishing double ever has "Bull 25" (outer bull) as the last segment —
  // only an actual double (Dn) or the real Bull (50) may end a path.
  for (const [remaining, entry] of Object.entries(CHECKOUT_TABLE)) {
    const parts = entry.path.split(" ");
    const last = parts[parts.length - 1];
    check(`${remaining}: finishes on a double or Bull (got "${last}")`, /^D\d+$/.test(last) || last === "Bull");
    check(`${remaining}: path length matches darts field`, parts.length === entry.darts);
    check(`${remaining}: darts field is 1-3`, entry.darts >= 1 && entry.darts <= 3);
  }

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
