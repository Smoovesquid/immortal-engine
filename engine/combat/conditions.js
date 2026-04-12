/**
 * Pass CM2 — Condition Framework.
 *
 * Pure functions for condition lifecycle: apply, tick, expire, save-to-end,
 * and stacking rules. All RNG is passed in — no Math.random().
 *
 * applyCondition(conditions, newCondition, conditionImmunities) -> conditions
 * tickConditions(conditions, entity, currentTurn, rng)           -> { conditions, tickResults }
 * removeCondition(conditions, name)                              -> conditions
 * removeAllConditions(conditions, name)                          -> conditions
 * hasCondition(conditions, name)                                 -> boolean
 * getCondition(conditions, name)                                 -> condition|null
 * normalizeCondition(raw)                                        -> condition
 */

import { statMod } from '../ruleset/core/stats.js';

const CONDITIONS_CAP = 12;

const VALID_STACK_BEHAVIORS = new Set(['replace', 'stack', 'extend', 'highest']);

// ── normalizeCondition ────────────────────────────────────────────────────

/**
 * Validates and sets defaults for a raw condition object.
 */
export function normalizeCondition(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const name = String(r.name ?? '').trim();
  if (!name) return null;

  const until = normalizeUntil(r.until);
  const source = String(r.source ?? '');
  const severity = clampInt(r.severity ?? 1, 1, 10);

  let saveToEnd = null;
  if (r.saveToEnd && typeof r.saveToEnd === 'object') {
    const stat = String(r.saveToEnd.stat ?? 'GRIT');
    const dc = clampInt(r.saveToEnd.dc ?? 10, 1, 30);
    saveToEnd = { stat, dc };
  }

  const onTick = (typeof r.onTick === 'string' && r.onTick) ? r.onTick : null;
  const stackBehavior = VALID_STACK_BEHAVIORS.has(r.stackBehavior)
    ? r.stackBehavior : 'replace';

  return { name, until, source, severity, saveToEnd, onTick, stackBehavior };
}

function normalizeUntil(u) {
  if (typeof u === 'number' && Number.isFinite(u)) return Math.max(0, Math.trunc(u));
  if (typeof u === 'string') {
    const s = u.trim();
    if (s === 'end_of_next_turn' || s === 'save_ends' || s === 'permanent') return s;
  }
  return 'save_ends';
}

// ── applyCondition ────────────────────────────────────────────────────────

/**
 * Apply a condition to an existing conditions array, respecting immunities
 * and stacking rules.
 */
export function applyCondition(conditions, newCondition, conditionImmunities) {
  const list = Array.isArray(conditions) ? conditions : [];
  const immunities = Array.isArray(conditionImmunities) ? conditionImmunities : [];

  const cond = normalizeCondition(newCondition);
  if (!cond) return list;

  // Immunity check
  if (immunities.includes(cond.name)) return list;

  const existingIdx = list.findIndex(c => c.name === cond.name);

  if (existingIdx === -1) {
    // No existing — just add (cap at 12)
    if (list.length >= CONDITIONS_CAP) return list;
    return [...list, cond];
  }

  const existing = list[existingIdx];

  switch (cond.stackBehavior) {
    case 'stack': {
      const merged = {
        ...existing,
        severity: clampInt(existing.severity + cond.severity, 1, 10)
      };
      return list.map((c, i) => i === existingIdx ? merged : c);
    }
    case 'extend': {
      const merged = {
        ...existing,
        until: longerDuration(existing.until, cond.until)
      };
      return list.map((c, i) => i === existingIdx ? merged : c);
    }
    case 'highest': {
      if (cond.severity > existing.severity) {
        return list.map((c, i) => i === existingIdx ? cond : c);
      }
      return list;
    }
    case 'replace':
    default: {
      return list.map((c, i) => i === existingIdx ? cond : c);
    }
  }
}

/**
 * Compare two until values and return the longer one.
 */
function longerDuration(a, b) {
  // 'permanent' always wins
  if (a === 'permanent' || b === 'permanent') return 'permanent';
  // 'save_ends' > numeric/end_of_next_turn (it persists until saved)
  if (a === 'save_ends' && b === 'save_ends') return 'save_ends';
  if (a === 'save_ends') return 'save_ends';
  if (b === 'save_ends') return 'save_ends';
  // Compare numerics
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (typeof a === 'number') return a;
  if (typeof b === 'number') return b;
  // end_of_next_turn fallback
  return 'end_of_next_turn';
}

// ── tickConditions ────────────────────────────────────────────────────────

/**
 * Process each condition at start-of-turn:
 * 1. onTick damage
 * 2. Expiration check
 * 3. Save-to-end rolls
 *
 * Returns { conditions, tickResults }.
 * tickResults: [{ name, damage, damageType, saved }]
 */
export function tickConditions(conditions, entity, currentTurn, rng) {
  const list = Array.isArray(conditions) ? [...conditions] : [];
  const turn = typeof currentTurn === 'number' ? currentTurn : 0;
  const tickResults = [];
  const kept = [];

  for (const cond of list) {
    let remove = false;
    const tr = { name: cond.name, damage: 0, damageType: null, saved: false };

    // 1. onTick damage
    if (cond.onTick) {
      tr.damage = cond.severity;
      tr.damageType = cond.onTick;
    }

    // 2. Expiration by turn number
    if (typeof cond.until === 'number' && turn >= cond.until) {
      remove = true;
    }
    // end_of_next_turn: expires after the turn following application.
    // We model this by converting to a turn number on first tick:
    // If until is still 'end_of_next_turn', it means this is its first
    // tick — we keep it but mark it to expire next tick.
    if (cond.until === 'end_of_next_turn') {
      // Convert to concrete turn number: expires at next turn
      const updated = { ...cond, until: turn + 1 };
      kept.push(updated);
      tickResults.push(tr);
      continue;
    }

    // 3. Save-to-end
    if (!remove && cond.saveToEnd && cond.until === 'save_ends' && rng) {
      const stat = cond.saveToEnd.stat || 'GRIT';
      const dc = cond.saveToEnd.dc ?? 10;
      const statScore = entity?.stats?.[stat] ?? 10;
      const mod = statMod(statScore);
      const roll = rng.int(1, 20);
      // Natural 20 always succeeds
      if (roll === 20 || (roll + mod) >= dc) {
        remove = true;
        tr.saved = true;
      }
    }

    if (!remove) {
      kept.push(cond);
    }
    tickResults.push(tr);
  }

  return { conditions: kept, tickResults };
}

// ── removeCondition / removeAllConditions ─────────────────────────────────

/**
 * Remove first condition with matching name. Returns new array.
 */
export function removeCondition(conditions, conditionName) {
  const list = Array.isArray(conditions) ? conditions : [];
  const name = String(conditionName ?? '');
  let removed = false;
  return list.filter(c => {
    if (!removed && c.name === name) { removed = true; return false; }
    return true;
  });
}

/**
 * Remove all conditions with matching name. Returns new array.
 */
export function removeAllConditions(conditions, conditionName) {
  const list = Array.isArray(conditions) ? conditions : [];
  const name = String(conditionName ?? '');
  return list.filter(c => c.name !== name);
}

// ── hasCondition / getCondition ───────────────────────────────────────────

/**
 * Returns true if any condition in the array has the given name.
 */
export function hasCondition(conditions, conditionName) {
  const list = Array.isArray(conditions) ? conditions : [];
  const name = String(conditionName ?? '');
  return list.some(c => c.name === name);
}

/**
 * Returns the first condition with the given name, or null.
 */
export function getCondition(conditions, conditionName) {
  const list = Array.isArray(conditions) ? conditions : [];
  const name = String(conditionName ?? '');
  return list.find(c => c.name === name) || null;
}

// ── internals ─────────────────────────────────────────────────────────────

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
