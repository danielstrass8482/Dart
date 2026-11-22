/**
 * leg-darts.test.mjs — Darts thrown per leg in the leg-result overlay and in
 * the match overlay's TOTAL / LEG n chip views.
 *
 * Plays one best-of-3 match (2 players, start 100) through the real x01
 * module + the real Undo/Bouncer buttons:
 *   Leg 1 "normal":  P0 20,20,20 | P1 miss x3 | P0 D20            → P0 4, P1 3
 *   Leg 2 "bouncer": P1 starts: bouncer,20,20 (bouncer counts as thrown dart)
 *                    | P0 miss x3 | P1 20,D20                       → P1 5, P0 3
 *   Leg 3 "undo":    P0 20,(5 undone),20,20 | P1 bouncer,(undone),miss x3
 *                    | P0 bust 50 (1 dart) | P1 miss x3 | P0 20,D10  → P0 6, P1 6
 * Undone darts must not count; a bust counts the darts actually thrown.
 * Plus (iPad landscape) a solo training leg with bouncer + undo → 5 darts.
 * Match TOTAL: P0 4+3+6=13 (Ø 4.3), P1 3+5+6=14 (Ø 4.7).
 *
 * Also records layout metrics (mini-board size/position, chip bar / tab
 * geometry) per viewport so a before/after comparison shows nothing moved.
 *
 * Usage: python3 -m http.server 8973 &  (repo root), then
 *   node tests/leg-darts.test.mjs            → exit 0 = all assertions passed
 *   node tests/leg-darts.test.mjs --layout   → also print layout metrics JSON
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:8973"; // BASE=https://play.darttrainer.app for the live site
const VIEWPORTS = [
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
];

function buildCfg() {
  const players = ["Anna", "Ben"];
  return {
    mode: "501", startScore: 100,
    players, playerIds: players.map(() => null), isBot: players.map(() => false),
    totalSets: 1, setsToWin: 1, setWins: [0, 0], currentSet: 1,
    totalLegs: 3, legsToWin: 2, legWins: [0, 0], currentLeg: 1,
    rounds: 20, healthData: null,
    currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0,
    context: "casual", tournamentId: null, tournamentName: null,
    accumulated: {
      turnScores: [[], []], historicThrows: [[], []], checkoutAttempts: [0, 0],
      checkoutHits: [0, 0], checkoutScores: [[], []], first9: [null, null],
    },
  };
}

const LEGS = [
  [["h", "20", 20], ["h", "20", 20], ["h", "20", 20], ["w", 1200],
   ["m"], ["m"], ["m"], ["w", 1200],
   ["h", "D20", 40]],
  [["b"], ["h", "20", 20], ["h", "20", 20], ["w", 1200],
   ["m"], ["m"], ["m"], ["w", 1200],
   ["h", "20", 20], ["h", "D20", 40]],
  [["h", "20", 20], ["h", "5", 5], ["u"], ["h", "20", 20], ["h", "20", 20], ["w", 1200],
   ["b"], ["u"], ["m"], ["m"], ["m"], ["w", 1200],
   ["h", "50", 50], ["w", 1900],
   ["m"], ["m"], ["m"], ["w", 1200],
   ["h", "20", 20], ["h", "D10", 20]],
];
const EXPECT_LEG = [[4, 3], [3, 5], [6, 6]];

async function playMatch(page) {
  return page.evaluate(async ({ cfg, legs }) => {
    const { state } = await import("./js/state.js");
    const x01 = await import("./js/x01.js?v=2"); // same module instance as js/app.js
    window.__saved = [];
    window.dartDB = { saveGame: async (d) => { window.__saved.push(JSON.parse(JSON.stringify(d))); }, loadStats: async () => [] };
    state.cfg = cfg; state.allPlayers = [];
    await x01.startX01(0);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const errors = [];
    window.addEventListener("error", (e) => errors.push(String(e.message)));
    const legTexts = [];
    const legLayout = [];
    for (let li = 0; li < legs.length; li++) {
      for (const [k, a, b] of legs[li]) {
        try {
          if (k === "h") x01.processX01Hit({ label: a, score: b }, null, null);
          else if (k === "m") x01.processX01Hit({ label: "Miss", score: 0, miss: true }, null, null);
          else if (k === "b") document.getElementById("bottom-bouncer").click();
          else if (k === "u") document.getElementById("x01-undo").click();
          else if (k === "w") await sleep(a);
        } catch (e) { errors.push(`${k}: ${e.message}`); }
        await sleep(30);
      }
      await sleep(400);
      const legOv = document.getElementById("leg-overlay");
      if (legOv.classList.contains("visible")) {
        const d = document.querySelector("#leg-stats-summary .tv-result-darts");
        legTexts.push(d ? { left: d.dataset.left, right: d.dataset.right } : null);
        const b = legOv.querySelector(".tv-mini-board")?.getBoundingClientRect();
        const tb = legOv.querySelector(".winner-tab-btn")?.getBoundingClientRect();
        legLayout.push({ boardSizeVar: legOv.style.getPropertyValue("--winner-board-size"),
          board: b ? [Math.round(b.top), Math.round(b.height)] : null,
          tabs: tb ? [Math.round(tb.top), Math.round(tb.height)] : null });
        document.getElementById("btn-next-leg").click();
        await sleep(600);
      } else {
        legTexts.push(null);
      }
    }
    return { legTexts, legLayout, errors, saved: window.__saved.map((g) => g.players.map((p) => p.darts)) };
  }, { cfg: buildCfg(), legs: LEGS });
}

/** Darts (left, right) shown in the winner overlay's 2-player header. */
async function winnerDarts(page) {
  return page.evaluate(() => {
    const d = document.querySelector("#winner-summary .tv-result-darts");
    return d ? { left: d.dataset.left, right: d.dataset.right, text: d.innerText.replace(/\s+/g, " ").trim() } : null;
  });
}

async function layoutMetrics(page, overlayId) {
  return page.evaluate((id) => {
    const ov = document.getElementById(id);
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.height)]; };
    return {
      boardSizeVar: ov.style.getPropertyValue("--winner-board-size"),
      board: r(ov.querySelector(".tv-mini-board")),
      chipBar: r(ov.querySelector("#winner-leg-selector")),
      tabs: r(ov.querySelector(".winner-tab-btn")),
    };
  }, overlayId);
}

async function run() {
  const wantLayout = process.argv.includes("--layout");
  const browser = await chromium.launch();
  const failures = [];
  const layout = {};
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const res = await playMatch(page);
    await page.waitForTimeout(500);
    const tag = (m) => `[${vp.name}] ${m}`;
    if (res.errors.length) failures.push(tag(`page errors: ${res.errors.join(" | ")}`));

    res.legTexts.slice(0, 2).forEach((row, li) => {
      const [a, b] = EXPECT_LEG[li];
      if (!row || row.left !== String(a) || row.right !== String(b))
        failures.push(tag(`leg overlay ${li + 1}: expected DARTS ${a}:${b}, got ${JSON.stringify(row)}`));
    });

    const winnerVisible = await page.evaluate(() => document.getElementById("winner-overlay").classList.contains("visible"));
    if (!winnerVisible) { failures.push(tag("match winner overlay not shown")); await page.close(); continue; }
    const tot = await winnerDarts(page);
    if (!tot || tot.left !== "13 (Ø 4.3)" || tot.right !== "14 (Ø 4.7)")
      failures.push(tag(`TOTAL: expected 13 (Ø 4.3) : 14 (Ø 4.7), got ${JSON.stringify(tot)}`));
    layout[vp.name] = { legOverlay1: res.legLayout[0], matchTotal: await layoutMetrics(page, "winner-overlay") };

    const chips = await page.$$("#winner-leg-selector .winner-leg-chip");
    if (chips.length !== 4) failures.push(tag(`expected 4 chips (TOTAL + 3 legs), got ${chips.length}`));
    for (let li = 0; li < 3 && chips[li + 1]; li++) {
      await chips[li + 1].evaluate((el) => el.click()); // onboarding overlay may sit on top in a fresh profile
      await page.waitForTimeout(150);
      const row = await winnerDarts(page);
      const [a, b] = EXPECT_LEG[li];
      if (!row || row.left !== String(a) || row.right !== String(b))
        failures.push(tag(`chip LEG ${li + 1}: expected DARTS ${a}:${b}, got ${JSON.stringify(row)}`));
      if (li === 0) layout[vp.name].matchLeg1 = await layoutMetrics(page, "winner-overlay");
    }

    if (vp.name === "ipad-landscape") {
      // Solo (training) leg: darts sit in a badge next to WINNER. P0: 20,20,
      // bouncer | 20,(miss undone),D20 → 3 + 2 = 5 darts.
      const solo = await page.evaluate(async () => {
        const { state } = await import("./js/state.js");
        const x01 = await import("./js/x01.js?v=2");
        document.getElementById("winner-overlay").classList.remove("visible");
        state.cfg = { mode: "501", startScore: 100, players: ["Anna"], playerIds: [null], isBot: [false],
          totalSets: 1, setsToWin: 1, setWins: [0], currentSet: 1, totalLegs: 1, legsToWin: 1, legWins: [0], currentLeg: 1,
          rounds: 20, currentLegStarter: 0, nextLegStarter: 0, firstLegStarter: 0, context: "training",
          accumulated: { turnScores: [[]], historicThrows: [[]], checkoutAttempts: [0], checkoutHits: [0], checkoutScores: [[]], first9: [null] } };
        await x01.startX01(0);
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        x01.processX01Hit({ label: "20", score: 20 }); x01.processX01Hit({ label: "20", score: 20 });
        document.getElementById("bottom-bouncer").click(); await sleep(1200);
        x01.processX01Hit({ label: "20", score: 20 });
        x01.processX01Hit({ label: "Miss", score: 0, miss: true }); document.getElementById("x01-undo").click();
        x01.processX01Hit({ label: "D20", score: 40 }); await sleep(500);
        return document.querySelector("#winner-summary .tv-darts-badge")?.dataset.darts ?? null;
      });
      if (solo !== "5") failures.push(tag(`solo leg: expected 5 darts badge, got ${solo}`));
    }

    const savedOk = JSON.stringify(res.saved.slice(0, 3)) === JSON.stringify(EXPECT_LEG);
    if (!savedOk) failures.push(tag(`saved per-leg darts: expected ${JSON.stringify(EXPECT_LEG)}, got ${JSON.stringify(res.saved)}`));
    await page.close();
  }
  await browser.close();
  if (wantLayout) console.log(JSON.stringify(layout, null, 1));
  if (failures.length) { console.log("FAILED\n" + failures.join("\n")); process.exit(1); }
  console.log("leg-darts: all assertions passed (3 viewports × normal / bouncer / undo legs, TOTAL, chips, saved docs)");
  process.exit(0);
}

run();
