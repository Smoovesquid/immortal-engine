/**
 * Pass CM1 — Damage Types & Resistance Matrix.
 *
 * Pure functions. No randomness, no LLM, no Math.random.
 *
 * DAMAGE_TYPES         — canonical list of 14 damage type strings
 * RESISTANCE_LEVELS    — { immune, resistant, normal, vulnerable, absorb }
 * applyResistance(dmg, type, resistances) -> { final, level, heals }
 * normalizeResistances(raw) -> { [type]: level }
 */

export const DAMAGE_TYPES = [
  // Primary (physical)
  'slashing', 'piercing', 'bludgeoning',
  // Energy
  'fire', 'cold', 'lightning', 'acid', 'sonic',
  // Exotic
  'radiant', 'necrotic', 'psychic', 'poison', 'force', 'temporal', 'entropic'
];

const DAMAGE_TYPE_SET = new Set(DAMAGE_TYPES);

export const RESISTANCE_LEVELS = {
  immune: 'immune',
  resistant: 'resistant',
  normal: 'normal',
  vulnerable: 'vulnerable',
  absorb: 'absorb'
};

const VALID_LEVELS = new Set(Object.keys(RESISTANCE_LEVELS));

/**
 * applyResistance(dmg, damageType, resistances) -> { final, level, heals }
 *
 * dmg: non-negative integer (pre-resistance damage)
 * damageType: string from DAMAGE_TYPES (unknown types treated as normal)
 * resistances: object { [type]: level } (from normalizeResistances)
 *
 * Returns:
 *   final — the hp change magnitude (always >= 0)
 *   level — the resistance level that was applied
 *   heals — true if the target heals instead of taking damage (absorb)
 */
export function applyResistance(dmg, damageType, resistances) {
  const d = Math.max(0, Math.trunc(Number(dmg)) || 0);
  const type = typeof damageType === 'string' ? damageType : 'bludgeoning';
  const res = resistances && typeof resistances === 'object' ? resistances : {};

  const level = VALID_LEVELS.has(res[type]) ? res[type] : 'normal';

  switch (level) {
    case 'immune':
      return { final: 0, level: 'immune', heals: false };
    case 'resistant':
      return { final: Math.floor(d / 2), level: 'resistant', heals: false };
    case 'vulnerable':
      return { final: d * 2, level: 'vulnerable', heals: false };
    case 'absorb':
      return { final: d, level: 'absorb', heals: true };
    default: // normal
      return { final: d, level: 'normal', heals: false };
  }
}

/**
 * normalizeResistances(raw) -> { [type]: level }
 *
 * Strips invalid types and invalid levels. Unknown types are dropped.
 * Conditional resistances (object values with { level, condition }) are
 * simplified to the level string for now — condition evaluation is a
 * future pass.
 */
export function normalizeResistances(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!DAMAGE_TYPE_SET.has(key)) continue;
    // Support conditional shape: { level: 'resistant', condition: '...' }
    const lvl = typeof val === 'string' ? val
      : (val && typeof val === 'object' && typeof val.level === 'string') ? val.level
      : null;
    if (lvl && VALID_LEVELS.has(lvl) && lvl !== 'normal') {
      out[key] = lvl;
    }
    // 'normal' entries are omitted — absence means normal
  }
  return out;
}

/** Returns true if the string is a recognized damage type. */
export function isValidDamageType(type) {
  return DAMAGE_TYPE_SET.has(type);
}
