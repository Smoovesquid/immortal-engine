/**
 * Pass CM3 — Dice expression parser and roller.
 *
 * Pure function. All randomness comes from the seeded rng parameter.
 *
 * rollDice(expression, rng) -> { total, rolls, modifier }
 */

// Matches: '2d8+4', '1d6', '3d6+2', '1d10', '8d6', '5', '2d8-1'
const DICE_REGEX = /^(\d+)d(\d+)([+-]\d+)?$/;

/**
 * rollDice(expression, rng)
 *
 * Parses a dice expression and rolls using seeded RNG.
 * Supports: 'NdS', 'NdS+M', 'NdS-M', plain number 'N'.
 * Returns { total, rolls, modifier }.
 */
export function rollDice(expression, rng) {
  if (expression == null || expression === '') {
    return { total: 0, rolls: [], modifier: 0 };
  }

  const expr = String(expression).trim();

  // Plain number (no 'd')
  if (!expr.includes('d')) {
    const n = Math.trunc(Number(expr));
    const val = Number.isFinite(n) ? n : 0;
    return { total: val, rolls: [], modifier: val };
  }

  const match = expr.match(DICE_REGEX);
  if (!match) {
    return { total: 0, rolls: [], modifier: 0 };
  }

  const count = Math.max(0, Math.min(100, parseInt(match[1], 10)));
  const sides = Math.max(1, parseInt(match[2], 10));
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rng.int(1, sides));
  }

  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  return { total, rolls, modifier };
}
