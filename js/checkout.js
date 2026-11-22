/**
 * checkout.js — Canonical darts checkout table (standard double-out).
 * GENERATED FILE — do not hand-edit. Regenerate with:
 *   node scripts/gen-checkout-table.js
 * See that script for the generation rules (preferred finishing doubles
 * D20/D16/D8/…, shortest-path-wins, no single-bull finishes).
 *
 * CHECKOUT_TABLE[remaining] = {darts, path} for every remaining score
 * 2-170 that has a valid checkout within 3 darts. Scores with no entry
 * (the "bogey numbers" 159,162,163,165,166,168,169, plus 1 and anything >170)
 * have no possible checkout at all and must not announce or display one.
 */

export const CHECKOUT_TABLE = {
  2: {
    "darts": 1,
    "path": "D1"
  },
  3: {
    "darts": 2,
    "path": "S1 D1"
  },
  4: {
    "darts": 1,
    "path": "D2"
  },
  5: {
    "darts": 2,
    "path": "S1 D2"
  },
  6: {
    "darts": 1,
    "path": "D3"
  },
  7: {
    "darts": 2,
    "path": "T1 D2"
  },
  8: {
    "darts": 1,
    "path": "D4"
  },
  9: {
    "darts": 2,
    "path": "S1 D4"
  },
  10: {
    "darts": 1,
    "path": "D5"
  },
  11: {
    "darts": 2,
    "path": "T1 D4"
  },
  12: {
    "darts": 1,
    "path": "D6"
  },
  13: {
    "darts": 2,
    "path": "S5 D4"
  },
  14: {
    "darts": 1,
    "path": "D7"
  },
  15: {
    "darts": 2,
    "path": "S7 D4"
  },
  16: {
    "darts": 1,
    "path": "D8"
  },
  17: {
    "darts": 2,
    "path": "S1 D8"
  },
  18: {
    "darts": 1,
    "path": "D9"
  },
  19: {
    "darts": 2,
    "path": "T1 D8"
  },
  20: {
    "darts": 1,
    "path": "D10"
  },
  21: {
    "darts": 2,
    "path": "S5 D8"
  },
  22: {
    "darts": 1,
    "path": "D11"
  },
  23: {
    "darts": 2,
    "path": "S7 D8"
  },
  24: {
    "darts": 1,
    "path": "D12"
  },
  25: {
    "darts": 2,
    "path": "T3 D8"
  },
  26: {
    "darts": 1,
    "path": "D13"
  },
  27: {
    "darts": 2,
    "path": "S11 D8"
  },
  28: {
    "darts": 1,
    "path": "D14"
  },
  29: {
    "darts": 2,
    "path": "S13 D8"
  },
  30: {
    "darts": 1,
    "path": "D15"
  },
  31: {
    "darts": 2,
    "path": "T5 D8"
  },
  32: {
    "darts": 1,
    "path": "D16"
  },
  33: {
    "darts": 2,
    "path": "S1 D16"
  },
  34: {
    "darts": 1,
    "path": "D17"
  },
  35: {
    "darts": 2,
    "path": "T1 D16"
  },
  36: {
    "darts": 1,
    "path": "D18"
  },
  37: {
    "darts": 2,
    "path": "S5 D16"
  },
  38: {
    "darts": 1,
    "path": "D19"
  },
  39: {
    "darts": 2,
    "path": "S7 D16"
  },
  40: {
    "darts": 1,
    "path": "D20"
  },
  41: {
    "darts": 2,
    "path": "S1 D20"
  },
  42: {
    "darts": 2,
    "path": "D1 D20"
  },
  43: {
    "darts": 2,
    "path": "T1 D20"
  },
  44: {
    "darts": 2,
    "path": "D2 D20"
  },
  45: {
    "darts": 2,
    "path": "S5 D20"
  },
  46: {
    "darts": 2,
    "path": "T2 D20"
  },
  47: {
    "darts": 2,
    "path": "S7 D20"
  },
  48: {
    "darts": 2,
    "path": "D4 D20"
  },
  49: {
    "darts": 2,
    "path": "T3 D20"
  },
  50: {
    "darts": 1,
    "path": "Bull"
  },
  51: {
    "darts": 2,
    "path": "S11 D20"
  },
  52: {
    "darts": 2,
    "path": "T4 D20"
  },
  53: {
    "darts": 2,
    "path": "S13 D20"
  },
  54: {
    "darts": 2,
    "path": "D7 D20"
  },
  55: {
    "darts": 2,
    "path": "T5 D20"
  },
  56: {
    "darts": 2,
    "path": "D8 D20"
  },
  57: {
    "darts": 2,
    "path": "S17 D20"
  },
  58: {
    "darts": 2,
    "path": "T6 D20"
  },
  59: {
    "darts": 2,
    "path": "S19 D20"
  },
  60: {
    "darts": 2,
    "path": "D10 D20"
  },
  61: {
    "darts": 2,
    "path": "T7 D20"
  },
  62: {
    "darts": 2,
    "path": "D11 D20"
  },
  63: {
    "darts": 2,
    "path": "T13 D12"
  },
  64: {
    "darts": 2,
    "path": "T8 D20"
  },
  65: {
    "darts": 2,
    "path": "S25 D20"
  },
  66: {
    "darts": 2,
    "path": "D13 D20"
  },
  67: {
    "darts": 2,
    "path": "T9 D20"
  },
  68: {
    "darts": 2,
    "path": "D14 D20"
  },
  69: {
    "darts": 2,
    "path": "T15 D12"
  },
  70: {
    "darts": 2,
    "path": "T10 D20"
  },
  71: {
    "darts": 2,
    "path": "T13 D16"
  },
  72: {
    "darts": 2,
    "path": "D16 D20"
  },
  73: {
    "darts": 2,
    "path": "T11 D20"
  },
  74: {
    "darts": 2,
    "path": "D17 D20"
  },
  75: {
    "darts": 2,
    "path": "T17 D12"
  },
  76: {
    "darts": 2,
    "path": "T12 D20"
  },
  77: {
    "darts": 2,
    "path": "T15 D16"
  },
  78: {
    "darts": 2,
    "path": "D19 D20"
  },
  79: {
    "darts": 2,
    "path": "T13 D20"
  },
  80: {
    "darts": 2,
    "path": "D20 D20"
  },
  81: {
    "darts": 2,
    "path": "T19 D12"
  },
  82: {
    "darts": 2,
    "path": "T14 D20"
  },
  83: {
    "darts": 2,
    "path": "T17 D16"
  },
  84: {
    "darts": 2,
    "path": "T20 D12"
  },
  85: {
    "darts": 2,
    "path": "T15 D20"
  },
  86: {
    "darts": 2,
    "path": "T18 D16"
  },
  87: {
    "darts": 2,
    "path": "T17 D18"
  },
  88: {
    "darts": 2,
    "path": "T16 D20"
  },
  89: {
    "darts": 2,
    "path": "T19 D16"
  },
  90: {
    "darts": 2,
    "path": "T18 D18"
  },
  91: {
    "darts": 2,
    "path": "T17 D20"
  },
  92: {
    "darts": 2,
    "path": "T20 D16"
  },
  93: {
    "darts": 2,
    "path": "T19 D18"
  },
  94: {
    "darts": 2,
    "path": "T18 D20"
  },
  95: {
    "darts": 2,
    "path": "T19 D19"
  },
  96: {
    "darts": 2,
    "path": "T20 D18"
  },
  97: {
    "darts": 2,
    "path": "T19 D20"
  },
  98: {
    "darts": 2,
    "path": "T20 D19"
  },
  99: {
    "darts": 3,
    "path": "T19 D1 D20"
  },
  100: {
    "darts": 2,
    "path": "T20 D20"
  },
  101: {
    "darts": 2,
    "path": "T17 Bull"
  },
  102: {
    "darts": 3,
    "path": "T20 D1 D20"
  },
  103: {
    "darts": 3,
    "path": "T20 T1 D20"
  },
  104: {
    "darts": 2,
    "path": "T18 Bull"
  },
  105: {
    "darts": 3,
    "path": "T20 S5 D20"
  },
  106: {
    "darts": 3,
    "path": "T20 T2 D20"
  },
  107: {
    "darts": 2,
    "path": "T19 Bull"
  },
  108: {
    "darts": 3,
    "path": "T20 D4 D20"
  },
  109: {
    "darts": 3,
    "path": "T20 T3 D20"
  },
  110: {
    "darts": 2,
    "path": "T20 Bull"
  },
  111: {
    "darts": 3,
    "path": "T20 S11 D20"
  },
  112: {
    "darts": 3,
    "path": "T20 T4 D20"
  },
  113: {
    "darts": 3,
    "path": "T20 S13 D20"
  },
  114: {
    "darts": 3,
    "path": "T20 D7 D20"
  },
  115: {
    "darts": 3,
    "path": "T20 T5 D20"
  },
  116: {
    "darts": 3,
    "path": "T20 D8 D20"
  },
  117: {
    "darts": 3,
    "path": "T20 S17 D20"
  },
  118: {
    "darts": 3,
    "path": "T20 T6 D20"
  },
  119: {
    "darts": 3,
    "path": "T20 S19 D20"
  },
  120: {
    "darts": 3,
    "path": "T20 D10 D20"
  },
  121: {
    "darts": 3,
    "path": "T20 T7 D20"
  },
  122: {
    "darts": 3,
    "path": "T20 D11 D20"
  },
  123: {
    "darts": 3,
    "path": "T19 D13 D20"
  },
  124: {
    "darts": 3,
    "path": "T20 T8 D20"
  },
  125: {
    "darts": 3,
    "path": "T20 S25 D20"
  },
  126: {
    "darts": 3,
    "path": "T20 D13 D20"
  },
  127: {
    "darts": 3,
    "path": "T20 T9 D20"
  },
  128: {
    "darts": 3,
    "path": "T20 D14 D20"
  },
  129: {
    "darts": 3,
    "path": "T19 D16 D20"
  },
  130: {
    "darts": 3,
    "path": "T20 T10 D20"
  },
  131: {
    "darts": 3,
    "path": "T19 D17 D20"
  },
  132: {
    "darts": 3,
    "path": "T20 D16 D20"
  },
  133: {
    "darts": 3,
    "path": "T20 T11 D20"
  },
  134: {
    "darts": 3,
    "path": "T20 D17 D20"
  },
  135: {
    "darts": 3,
    "path": "T19 D19 D20"
  },
  136: {
    "darts": 3,
    "path": "T20 T12 D20"
  },
  137: {
    "darts": 3,
    "path": "T19 D20 D20"
  },
  138: {
    "darts": 3,
    "path": "T20 D19 D20"
  },
  139: {
    "darts": 3,
    "path": "T20 T13 D20"
  },
  140: {
    "darts": 3,
    "path": "T20 D20 D20"
  },
  141: {
    "darts": 3,
    "path": "T20 T19 D12"
  },
  142: {
    "darts": 3,
    "path": "T20 T14 D20"
  },
  143: {
    "darts": 3,
    "path": "T20 T17 D16"
  },
  144: {
    "darts": 3,
    "path": "T20 T20 D12"
  },
  145: {
    "darts": 3,
    "path": "T20 T15 D20"
  },
  146: {
    "darts": 3,
    "path": "T20 T18 D16"
  },
  147: {
    "darts": 3,
    "path": "T20 T17 D18"
  },
  148: {
    "darts": 3,
    "path": "T20 T16 D20"
  },
  149: {
    "darts": 3,
    "path": "T20 T19 D16"
  },
  150: {
    "darts": 3,
    "path": "T20 T18 D18"
  },
  151: {
    "darts": 3,
    "path": "T20 T17 D20"
  },
  152: {
    "darts": 3,
    "path": "T20 T20 D16"
  },
  153: {
    "darts": 3,
    "path": "T20 T19 D18"
  },
  154: {
    "darts": 3,
    "path": "T20 T18 D20"
  },
  155: {
    "darts": 3,
    "path": "T20 T19 D19"
  },
  156: {
    "darts": 3,
    "path": "T20 T20 D18"
  },
  157: {
    "darts": 3,
    "path": "T20 T19 D20"
  },
  158: {
    "darts": 3,
    "path": "T20 T20 D19"
  },
  160: {
    "darts": 3,
    "path": "T20 T20 D20"
  },
  161: {
    "darts": 3,
    "path": "T20 T17 Bull"
  },
  164: {
    "darts": 3,
    "path": "T20 T18 Bull"
  },
  167: {
    "darts": 3,
    "path": "T20 T19 Bull"
  },
  170: {
    "darts": 3,
    "path": "T20 T20 Bull"
  }
};

/**
 * Returns the standard checkout path for `remaining`, or null if either
 * no checkout exists at all, or it exists but needs more darts than are
 * actually left in the current turn (`dartsLeft`, 1-3). The path itself
 * never changes with dartsLeft — only whether it still fits does.
 * @param {number} remaining
 * @param {number} [dartsLeft] darts still available this turn (1-3), default 3 (start of turn)
 * @returns {string|null} e.g. "T20 T20 Bull"
 */
export function getCheckoutPath(remaining, dartsLeft = 3) {
  const e = CHECKOUT_TABLE[remaining];
  if (!e || e.darts > dartsLeft) return null;
  return e.path;
}
