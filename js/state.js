/**
 * state.js — Central mutable game state shared across all modules.
 * All modules import { state } from './state.js' instead of using globals.
 */

export const state = {
  /** @type {Object} Current game configuration */
  cfg: {},
  /** @type {Object} X01 game state */
  x01: {},
  /** @type {Object} Cricket game state */
  cr: {},
  /** @type {Object} Party game state */
  pg: {},
  /** @type {Array} All players loaded from Firebase */
  allPlayers: [],
  /** @type {Array} Players selected for next game */
  selectedPlayers: [],
  /** @type {SVGElement|null} Reference to main X01 SVG board */
  boardSVG: null,
};
