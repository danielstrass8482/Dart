/**
 * coop.js — "Co-op Checkout": 2+ players work through a ladder of checkout
 * values together (e.g. 80 → 90). Everyone plays the SAME remaining score;
 * players throw one visit each in turn and the rest carries over to the next
 * player (80: A scores 73 → B has to check out 7). Bust = X01 rule (visit
 * void, rest unchanged, next player). No dart limit per value. After a
 * checkout the next value starts with the player after the finisher.
 *
 * The mode runs on the X01 engine and screen (js/x01.js with
 * state.cfg.coop set): board, keypad/voice input, bouncer, Undo (x01Snapshot
 * carries state.x01.coop), dart counting (turnDarts) and the requires /
 * checkout-path announcements are the X01 ones. This module holds the
 * co-op specific parts: value ladder, checkout transition, render overlays,
 * result screen and saving.
 *
 * Non-checkoutable values (159, 162, 163, 165, 166, 168, 169 — no 3-dart
 * finish exists, see CHECKOUT_TABLE) are never offered as start/end value
 * (the steppers skip them) and are skipped inside the ladder: they are not
 * "checkout values", and keeping them would turn one rung into an ordinary
 * scoring visit before the actual checkout. The setup shows which values are
 * skipped.
 *
 * Saving: co-op games go to their OWN collection `dart_coop_games`, never to
 * `dart_games`. Every X01 consumer (stats.js, gamesCache.js, coach prompts,
 * player-profile stats, and older app versions still in the field) treats any
 * non-Cricket doc in dart_games as an X01 leg, so a separate collection keeps
 * co-op out of averages / checkout % / darts-per-leg by construction.
 */
import { state } from './state.js';
import { CHECKOUT_TABLE } from './checkout.js';
import { t } from './i18n.js?v=3';
import { escapeHtml, playerBadge } from './util.js';
import { queueAudio, invalidateStaleAnnouncements } from './audio.js';
import { clearCheckout, redrawAllHits, disableBoard } from './board.js?v=2';
import { legDarts, recordTurnDarts, scheduleNextPlayerAnnounce } from './x01.js?v=2';

export const COOP_MIN = 2;
export const COOP_MAX = 170;
export const COOP_DEFAULT = { from: 80, to: 90 };

/** True if `v` can be finished in one visit (double-out), i.e. has a CHECKOUT_TABLE entry. */
export function isCheckoutable(v) {
  return Number.isInteger(v) && v >= COOP_MIN && v <= COOP_MAX && !!CHECKOUT_TABLE[v];
}

/** Nearest checkoutable value from `v`, searching in `dir` (+1/-1) first, then the other way. */
export function snapCheckoutable(v, dir = 1) {
  v = Math.round(Number(v));
  if (!Number.isFinite(v)) v = COOP_DEFAULT.from;
  v = Math.min(COOP_MAX, Math.max(COOP_MIN, v));
  for (const d of [dir, -dir]) {
    for (let x = v; x >= COOP_MIN && x <= COOP_MAX; x += d) if (isCheckoutable(x)) return x;
  }
  return COOP_MIN;
}

/** The checkoutable values from..to (inclusive) in ascending order. */
export function coopLadder(from, to) {
  const out = [];
  for (let v = from; v <= to; v++) if (isCheckoutable(v)) out.push(v);
  return out;
}

/** Values inside from..to that are skipped because they cannot be checked out. */
export function coopSkipped(from, to) {
  const out = [];
  for (let v = from; v <= to; v++) if (!isCheckoutable(v)) out.push(v);
  return out;
}

/** Validates a range; returns null if fine, otherwise an i18n key. */
export function coopRangeError(from, to) {
  if (!isCheckoutable(from) || !isCheckoutable(to)) return 'coop_err_wert';
  if (from > to) return 'coop_err_reihenfolge';
  return null;
}

/** Fresh co-op state for state.x01.coop. */
export function createCoopState(cfg, now = Date.now()) {
  const values = coopLadder(cfg.coop.from, cfg.coop.to);
  return {
    from: cfg.coop.from, to: cfg.coop.to, values, idx: 0,
    results: [],                  // [{value, darts, ms, by}] per checked-out value
    checkouts: cfg.players.map(() => 0),
    valueStartDarts: 0, valueStartTs: now, startTs: now, endTs: null,
  };
}

/** Team darts so far (all players, completed visits + the visit in progress). */
export function teamDarts() {
  return state.cfg.players.reduce((s, _, i) => s + (legDarts(i) || 0), 0);
}

/**
 * Called from handleLegWin() when a player checks out in co-op mode (board,
 * keypad and voice input all end there). No Undo snapshot is pushed here:
 * the snapshot taken before the checkout dart already holds the complete
 * pre-checkout state (incl. state.x01.coop), so one Undo takes back the
 * checkout dart AND the switch to the next value.
 */
export function coopOnCheckout(pi) {
  const x = state.x01, c = x.coop;
  const now = Date.now();
  const dartsNow = teamDarts();
  const value = c.values[c.idx];
  c.results.push({ value, darts: dartsNow - c.valueStartDarts, ms: now - c.valueStartTs, by: pi });
  c.checkouts[pi]++;
  const slang = localStorage.getItem("dart_slang_enabled") === "true"; // slang path already queued "Game Shot!"

  if (c.idx >= c.values.length - 1) {          // last value → game over
    x.winner = pi;
    c.endTs = now;
    clearCheckout(state.boardSVG);
    disableBoard(state.boardSVG, true);
    if (!slang) queueAudio("Game Shot!", "el_slang_game_shot_");
    const toast = document.getElementById("coop-toast");
    if (toast) { clearTimeout(toast._t); toast.classList.remove("visible"); }
    saveCoopGame();
    showCoopResult();
    return;
  }

  // Next value: finisher's visit is complete, next player in order starts.
  recordTurnDarts(pi);
  x.lastTurnThrows[pi] = [...x.throws];
  x.historicThrows[pi].push(...x.throws.filter(th => th.svgX != null));
  x.throws = []; x.bust = false; x.winner = null; x.checkoutAttemptThisTurn = false;
  c.idx++;
  c.valueStartDarts = dartsNow;
  c.valueStartTs = now;
  x.scores.fill(c.values[c.idx]);
  const next = (pi + 1) % state.cfg.players.length;
  x.current = next;
  if (next === 0) x.round++;
  invalidateStaleAnnouncements();
  clearCheckout(state.boardSVG);
  redrawAllHits(state.boardSVG, x.historicThrows[next], []);
  if (!slang) queueAudio("Checkout!", "el_party_checkout");
  showCoopToast(value, c.results[c.results.length - 1].darts, c.values[c.idx]);
  scheduleNextPlayerAnnounce(next);
}

function showCoopToast(value, darts, nextValue) {
  const el = document.getElementById("coop-toast");
  if (!el) return;
  el.textContent = t('coop_toast').replace('{v}', value).replace('{d}', darts).replace('{n}', nextValue);
  el.classList.add("visible");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("visible"), 1800);
}

function displayName(i) {
  const pid = state.cfg.playerIds?.[i];
  const p = state.allPlayers?.find(pl => pl.id === pid);
  return escapeHtml(p?.nickname || state.cfg.players[i]);
}

/** mm:ss (or h:mm:ss) */
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = n => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Overrides the X01 per-player parts of renderX01() for co-op: shared rest,
 * target value, progress, darts/checkouts per player, value table.
 * @param {number} remaining shared rest incl. the visit in progress
 */
export function renderCoop(remaining) {
  const x = state.x01, c = x.coop;
  if (!c) return;
  const done = x.winner != null;
  const value = c.values[c.idx];
  const pos = c.idx + 1, total = c.values.length;
  const pct = Math.round(((c.idx + (done ? 1 : 0)) / total) * 100);
  const isCo = remaining <= 170 && remaining > 1 && !x.bust;
  const restStyle = isCo ? "background:var(--dart-gold);color:#000;border-radius:6px;padding:0 6px;" : "";

  // Header title
  const titleEl = document.getElementById("x01-title");
  if (titleEl) titleEl.textContent = `CO-OP · ${c.from}–${c.to}`;

  // Target / progress bar (portrait; landscape shows the same inside the panel)
  const bar = document.getElementById("coop-bar");
  if (bar) {
    bar.style.display = "";
    bar.innerHTML = `
      <div class="coop-bar-row">
        <div class="coop-target"><span class="coop-k">${t('coop_ziel')}</span><span class="coop-v" data-coop="target">${value}</span></div>
        <div class="coop-progress-txt" data-coop="progress">${t('coop_fortschritt').replace('{i}', pos).replace('{n}', total).replace('{from}', c.from).replace('{to}', c.to)}</div>
        <div class="coop-target"><span class="coop-k">${t('coop_darts')}</span><span class="coop-v coop-v-sm" data-coop="value-darts">${teamDarts() - c.valueStartDarts}</span></div>
      </div>
      <div class="coop-progress"><div style="width:${pct}%"></div></div>`;
  }

  // Portrait strip: one cell per player, the active one carries the shared rest.
  const strip = document.getElementById("score-strip");
  if (strip) {
    strip.innerHTML = state.cfg.players.map((_, i) => {
      const active = i === x.current && !done;
      const name = displayName(i);
      const stats = `${legDarts(i) || 0} ${t('darts_kurz')} · ${c.checkouts[i]} CO`;
      return active
        ? `<div class="score-cell active" data-coop-player="${i}">
            <div style="font-size:15px;font-weight:800;color:#FBFBF8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${playerBadge(i)}${name}</div>
            <div style="font-size:10px;font-weight:700;color:#C9A227;letter-spacing:.12em">${t('am_zug')}</div>
            <div class="sc-score" data-coop="rest" style="font-family:'Manrope',sans-serif;font-size:56px;font-weight:800;line-height:.9;letter-spacing:-0.04em;color:#FBFBF8;display:inline-block;${restStyle}">${remaining}</div>
            <div class="coop-pstats">${stats}</div>
          </div>`
        : `<div class="score-cell" data-coop-player="${i}">
            <div style="font-size:13px;font-weight:700;color:#C9C9D1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${playerBadge(i)}${name}</div>
            <div class="coop-pstats">${stats}</div>
          </div>`;
    }).join("");
  }

  // Landscape panel: players + shared rest
  const lp = document.getElementById("lp-players");
  if (lp) {
    lp.innerHTML = state.cfg.players.map((_, i) => {
      const active = i === x.current && !done;
      return `<div class="lp-player${active ? " active" : ""} coop-lp-player" data-coop-player="${i}">
        <div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;min-width:0">
          <div style="font-size:13px;font-weight:800;color:${active ? "#D4AF37" : "#9A9AA2"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${playerBadge(i)}${displayName(i)}</div>
          ${active ? `<div style="font-size:9px;font-weight:700;color:#D4AF37;letter-spacing:.1em">${t('am_zug')}</div>
            <div class="lp-score" style="font-family:'Manrope',sans-serif;font-size:3rem;font-weight:800;line-height:1;letter-spacing:-0.04em;color:#FBFBF8;display:inline-block;${restStyle}">${remaining}</div>` : ""}
          <div class="coop-pstats">${legDarts(i) || 0} ${t('darts_kurz')} · ${c.checkouts[i]} CO</div>
        </div>
      </div>`;
    }).join("");
  }

  // Landscape history: target + progress + per-value table
  const box = document.getElementById("lp-history");
  if (box) {
    const rows = c.results.map(r => `<tr><td>${r.value}</td><td>${r.darts}</td><td>${displayName(r.by)}</td></tr>`).join("");
    const cur = done ? "" : `<tr class="coop-cur"><td>${value}</td><td>${teamDarts() - c.valueStartDarts}</td><td>…</td></tr>`;
    box.innerHTML = `<div class="coop-lp-sticky">
      <div class="coop-lp-head">
        <div><div class="coop-k">${t('coop_ziel')}</div><div class="coop-lp-target" data-coop="lp-target">${done ? "✓" : value}</div></div>
        <div style="text-align:right"><div class="coop-k">${t('coop_wert')}</div><div class="coop-lp-prog">${Math.min(pos, total)} / ${total}</div><div class="coop-k">${c.from}–${c.to}</div></div>
      </div>
      <div class="coop-progress"><div style="width:${pct}%"></div></div></div>
      <table class="coop-table"><thead><tr><th>${t('coop_wert')}</th><th>${t('coop_darts')}</th><th>${t('coop_checkout_von')}</th></tr></thead>
      <tbody>${rows}${cur}</tbody></table>`;
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 30);
  }
}

/** Hides co-op-only UI (called when an ordinary X01 game renders). */
export function hideCoopUI() {
  const bar = document.getElementById("coop-bar");
  if (bar && bar.style.display !== "none") { bar.style.display = "none"; bar.innerHTML = ""; }
}

/** Computes the end-of-game evaluation (pure — used by the overlay, the save and the tests). */
export function coopSummary() {
  const x = state.x01, c = x.coop;
  const totalDarts = c.results.reduce((s, r) => s + r.darts, 0);
  const end = c.endTs || Date.now();
  return {
    from: c.from, to: c.to,
    values: c.results.map(r => ({ value: r.value, darts: r.darts, sec: Math.round(r.ms / 100) / 10, by: state.cfg.players[r.by] })),
    totalDarts,
    avgDarts: c.results.length ? Math.round(totalDarts / c.results.length * 10) / 10 : 0,
    durationSec: Math.round((end - c.startTs) / 1000),
    players: state.cfg.players.map((name, i) => ({ name, id: state.cfg.playerIds?.[i] || null, darts: legDarts(i) || 0, checkouts: c.checkouts[i] })),
  };
}

/** Saves to dart_coop_games (NOT dart_games — see header comment). */
export function saveCoopGame() {
  if (!window.dartDB?.saveCoopGame) return;
  const s = coopSummary();
  const doc = {
    ts: Date.now(), mode: "Coop",
    from: s.from, to: s.to, values: s.values, totalDarts: s.totalDarts, avgDarts: s.avgDarts,
    durationSec: s.durationSec, players: s.players,
    playerIds: (state.cfg.playerIds || []).filter(Boolean),
    context: state.cfg.context || "casual",
  };
  window.dartDB.saveCoopGame(doc).catch(e => {
    console.warn("Co-op save failed:", e);
    window.showToast?.(t('spiel_speichern_fehler'), "error");
  });
}

/** Result overlay. */
export function showCoopResult() {
  const ov = document.getElementById("coop-overlay");
  const box = document.getElementById("coop-summary");
  if (!ov || !box) return;
  const s = coopSummary();
  const maxD = Math.max(1, ...s.values.map(v => v.darts));
  box.innerHTML = `
    <div class="coop-res-title">${t('coop_geschafft')}</div>
    <div class="coop-res-sub">${s.from}–${s.to} · ${s.values.length} ${t('coop_werte')}</div>
    <div class="coop-kpis">
      <div class="coop-kpi"><div class="coop-kpi-v" data-coop-kpi="total">${s.totalDarts}</div><div class="coop-k">${t('coop_darts_gesamt')}</div></div>
      <div class="coop-kpi"><div class="coop-kpi-v" data-coop-kpi="avg">${s.avgDarts}</div><div class="coop-k">${t('coop_darts_pro_wert')}</div></div>
      <div class="coop-kpi"><div class="coop-kpi-v" data-coop-kpi="time" data-sec="${s.durationSec}">${fmtDuration(s.durationSec)}</div><div class="coop-k">${t('coop_spielzeit')}</div></div>
    </div>
    <div class="coop-sec">${t('coop_pro_spieler')}</div>
    <table class="coop-table coop-res-players"><thead><tr><th>${t('coop_spieler')}</th><th>${t('coop_darts')}</th><th>${t('coop_checkouts')}</th></tr></thead>
      <tbody>${s.players.map((p, i) => `<tr data-coop-p="${i}"><td>${displayName(i)}</td><td>${p.darts}</td><td>${p.checkouts}</td></tr>`).join("")}</tbody></table>
    <div class="coop-sec">${t('coop_pro_wert')}</div>
    <table class="coop-table coop-res-values"><thead><tr><th>${t('coop_wert')}</th><th>${t('coop_darts')}</th><th></th><th>${t('coop_checkout_von')}</th></tr></thead>
      <tbody>${s.values.map(v => `<tr data-coop-v="${v.value}" data-darts="${v.darts}"><td>${v.value}</td><td>${v.darts}</td>
        <td style="width:40%"><div class="coop-dbar"><div style="width:${Math.round(v.darts / maxD * 100)}%"></div></div></td>
        <td>${escapeHtml(v.by)}</td></tr>`).join("")}</tbody></table>`;
  ov.classList.add("visible");
}

export function hideCoopResult() {
  document.getElementById("coop-overlay")?.classList.remove("visible");
}
