/**
 * util.js — Shared helper functions.
 */

/**
 * Escapes a string for safe insertion into innerHTML / template literals.
 * Prevents XSS via user-controlled values (player names, nicknames, emails,
 * online opponent names, tournament names, etc.).
 * @param {*} s
 * @returns {string}
 */
export function escapeHtml(s){
  if(s==null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Throwing-order badge (P1…P8) shown next to a player's name during a game.
 * The voice announces players only by this number ("Player 1 requires …",
 * js/speech.js announceRequires()), never by name — the badge is what lets
 * players map the announcement to a person. Names stay displayed unchanged.
 * @param {number} i player index in state.cfg.players (= throwing order)
 * @returns {string} HTML
 */
export function playerBadge(i){
  return `<span class="p-badge" data-p-badge="${i+1}">P${i+1}</span>`;
}
