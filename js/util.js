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
