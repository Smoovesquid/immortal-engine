// SRD 5.1 — the six abilities. Canonical on the player character sheet.
// The legacy five-stat block (MIGHT/AGILITY/WITS/GRIT/CHARM) is DERIVED from
// these via toLegacyStats() so existing consumers (resolve, combat, bestiary)
// keep working during the migration. New code should read sheet.abilities.

export const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const ABILITY_NAMES = {
  STR: 'Strength',
  DEX: 'Dexterity',
  CON: 'Constitution',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma'
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function abilityMod(score) {
  const n = Math.trunc(Number(score));
  if (!Number.isFinite(n)) return 0;
  return Math.floor((n - 10) / 2);
}

// 4d6 drop lowest, six pools. Returns { pools: [{dice:[a,b,c,d], dropped, total}], totals }
// in roll order — assignment to abilities is the player's job.
export function roll4d6DropLowest(rng) {
  const pools = [];
  for (let i = 0; i < 6; i++) {
    const dice = [rng.int(1, 6), rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)];
    const sorted = [...dice].sort((a, b) => a - b);
    const dropped = sorted[0];
    const total = sorted[1] + sorted[2] + sorted[3];
    pools.push({ dice, dropped, total });
  }
  return { pools, totals: pools.map(p => p.total) };
}

// Validate + normalize an assignment of rolled totals (or the standard array)
// to the six abilities. `assignment` maps ABILITY key -> score. Every score in
// `totals` must be used exactly once. Returns a clean {STR..CHA} object or null.
export function normalizeAssignment(totals, assignment) {
  const a = assignment && typeof assignment === 'object' ? assignment : {};
  const remaining = [...totals].sort((x, y) => y - x);
  const out = {};
  for (const k of ABILITY_KEYS) {
    const v = Math.trunc(Number(a[k]));
    const idx = remaining.indexOf(v);
    if (!Number.isFinite(v) || idx === -1) return null;
    remaining.splice(idx, 1);
    out[k] = v;
  }
  return remaining.length === 0 ? out : null;
}

// Apply species ability score increases. asi is {STR:+2, ...} (partial).
export function applyASI(abilities, asi) {
  const out = { ...abilities };
  for (const k of ABILITY_KEYS) {
    const inc = Math.trunc(Number(asi?.[k] ?? 0)) || 0;
    out[k] = clampScore((out[k] ?? 10) + inc);
  }
  return out;
}

export function clampScore(n) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return 10;
  return Math.max(1, Math.min(20, x));
}

// Legacy projection — keeps the 5-stat engine consumers alive during the
// migration. WITS takes the better of INT/WIS (the old stat covered both
// "clever" and "perceptive"); everything else is one-to-one.
export function toLegacyStats(abilities) {
  const ab = abilities && typeof abilities === 'object' ? abilities : {};
  const g = k => clampScore(ab[k] ?? 10);
  return {
    MIGHT: g('STR'),
    AGILITY: g('DEX'),
    WITS: Math.max(g('INT'), g('WIS')),
    GRIT: g('CON'),
    CHARM: g('CHA')
  };
}
