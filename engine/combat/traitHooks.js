/**
 * Trait hook system — mechanical execution for creature traits.
 *
 * TA-1 (docs/briefs/COMBAT_TRAIT_ALGEBRA.md): traits are DATA, not code.
 * Each trait name maps to a list of effect ATOMS — typed, declarative records
 * of where (channel) and how (op) the trait modifies combat resolution:
 *
 *   { ch, op, v, min?, when?, param?, read? }
 *
 *   ch    'turnStart' | 'toHit' | 'dmgDealt' | 'dmgTaken' | 'ac' | 'death'
 *         (the enum maps 1:1 onto the resolver's call sites)
 *   op    'add' (x + v) | 'mul' (floor(x * v)) | 'hp' (turn-start delta)
 *         | 'reviveAt' (death-channel revive)
 *   min   per-atom clamp applied after the op (Evasion's max(1, ·))
 *   when  declarative predicate — data, not code (TA-1: { allyStanding })
 *   param { rx } — parse a v override from the trait string's parenthetical
 *   read  fiction template for the DM ('{name}', '{v}') — prose, never a
 *         bare number leak (THE LAW, docs/DND_XCOM.md)
 *
 * A NEW mechanical trait = ONE data row here. Zero resolver edits.
 * Unknown traits are narrative-only and pass through (the safety default —
 * the catalog's long tail stays inert until given a row).
 *
 * Composition (unchanged from the legacy implementation, now explicit):
 * atoms fold per channel in creature-declaration order; turn-start heals SUM
 * then clamp to headroom; death revives are FIRST-WINS (one fires); numeric
 * channels fold sequentially. Canonical op-rank ordering across sources
 * arrives with TA-4 (see the brief §2.2).
 *
 * The legacy hook API is generated from the atoms at module init, so every
 * consumer (escapeCombat, combatResolve, actionResolver, castSpell) is
 * untouched and byte-identical — proven exhaustively against the frozen
 * pre-TA-1 implementation by tests/U322.traitAlgebraEquivalence.test.js.
 *
 * Hook points (generated):
 *   onTurnStart(enemy, world)  → { hpDelta?, summaryPart? }
 *   modifyToHit(enemy, toHit)  → adjusted toHit (number)
 *   modifyDamageDealt(enemy, dmg) → adjusted damage (number)
 *   modifyDamageTaken(enemy, dmg, dmgType) → adjusted damage (number)
 *   modifyAC(enemy, ac)        → adjusted AC (number)
 *   onDeath(enemy, world)      → { revive?, hpIfRevived?, summaryPart? }
 *
 * The base trait name is extracted from the string (before parenthetical).
 * e.g., "Regeneration (15 HP/round, stops with radiant)" → "Regeneration"
 *
 * Pure. No RNG. No LLM. Deterministic given the same trait string.
 * Atoms never roll — the resolver rolls. (Determinism backbone: every fold
 * is arithmetic on already-rolled values; a trait-less foe is byte-identical.)
 */

// ── Trait name extraction ────────────────────────────────────────────────

function baseName(traitStr) {
  const s = String(traitStr || '');
  const paren = s.indexOf('(');
  return (paren > 0 ? s.slice(0, paren) : s).trim();
}

function parseParam(traitStr, regex, fallback) {
  const m = String(traitStr || '').match(regex);
  return m ? Number(m[1]) || fallback : fallback;
}

// ── The atom algebra ─────────────────────────────────────────────────────

/** Atom constructor — keeps rows terse and shapes uniform. */
const A = (ch, op, v, extra) => Object.freeze({ ch, op, v, ...(extra || {}) });

/**
 * Evaluate a declarative `when` predicate against a read-only context.
 * TA-1 vocabulary: { allyStanding } — another enemy still up (Pack Tactics).
 * Extending the vocabulary = adding a key here, never a new mechanism.
 */
function evalWhen(when, ctx) {
  if (!when) return true;
  if (when.allyStanding) {
    const allies = (ctx.world?.combat?.enemies || [])
      .filter(e => e.hp > 0 && e.id !== ctx.enemy.id);
    if (allies.length === 0) return false;
  }
  return true;
}

/** Apply a numeric atom: add / mul(floored), then the per-atom min clamp. */
function applyNumOp(atom, x) {
  let r = atom.op === 'mul' ? Math.floor(x * atom.v) : x + atom.v;
  if (typeof atom.min === 'number') r = Math.max(atom.min, r);
  return r;
}

/** Render a read template: '{name} regenerates {v} HP' → fiction line. */
function renderRead(template, map) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => String(map[k]));
}

// ── The trait table — every mechanical trait is data rows ────────────────

const TRAIT_DEFS = {
  // -- turn-start regeneration: heals HP at the start of the foe's turn
  'Regeneration':       [A('turnStart', 'hp', 10, { param: { rx: /(\d+)\s*HP/i }, read: '{name} regenerates {v} HP' })],
  'Dire Regeneration':  [A('turnStart', 'hp', 20, { param: { rx: /(\d+)\s*HP/i }, read: '{name} regenerates {v} HP' })],
  'Fungal Regeneration':[A('turnStart', 'hp', 5,  { read: '{name} regenerates 5 HP (fungal)' })],
  'Regenerative Heads': [A('turnStart', 'hp', 5,  { read: '{name} regrows a head (+5 HP)' })],

  // -- to-hit: pack instincts (+2 while an ally still stands) and ferocity
  'Pack Tactics':       [A('toHit', 'add', 2, { when: { allyStanding: true } })],
  'Flock Tactics':      [A('toHit', 'add', 2, { when: { allyStanding: true } })],
  'Reckless':           [A('toHit', 'add', 2)],
  'Reckless Attack':    [A('toHit', 'add', 2)],
  'Aggressive':         [A('toHit', 'add', 1)],
  'Aggressive Charge':  [A('toHit', 'add', 1)],

  // -- damage dealt: hits harder
  'Brute':              [A('dmgDealt', 'add', 2)],
  'Sneak Attack':       [A('dmgDealt', 'add', 3)],
  'Assassinate':        [A('dmgDealt', 'add', 4)],
  'Surprise Strike':    [A('dmgDealt', 'add', 2)],
  'Death Strike':       [A('dmgDealt', 'add', 3)],
  'Precision Strike':   [A('dmgDealt', 'add', 2)],

  // -- AC: hide, shell, plate, warded skin
  'Natural Armor':      [A('ac', 'add', 1)],
  'Armored':            [A('ac', 'add', 1)],
  'Shell Armor':        [A('ac', 'add', 2)],
  'Crystal Hide':       [A('ac', 'add', 1)],
  'Metal Hide':         [A('ac', 'add', 2)],
  'Iron Body':          [A('ac', 'add', 2)],
  'Ironwood Body':      [A('ac', 'add', 1)],
  'Spectral Armor':     [A('ac', 'add', 1)],
  'Barbed Hide':        [A('ac', 'add', 1)],
  'Thorn Armor':        [A('ac', 'add', 1)],
  'Adaptive Armor':     [A('ac', 'add', 2)],
  'Rune Armor':         [A('ac', 'add', 2)],
  // Magic/Spell Resistance: +AC approximation while attacks are untyped
  // (the legacy note stands — folds flat until spell-vs-weapon is modeled).
  'Magic Resistance':   [A('ac', 'add', 1)],
  'Spell Resistance':   [A('ac', 'add', 1)],

  // -- damage taken: slips the blow (mul), shrugs part of it (add w/ floor)
  'Evasion':            [A('dmgTaken', 'mul', 0.5, { min: 1 })],
  'Avoidance':          [A('dmgTaken', 'mul', 0.5, { min: 1 })],
  'Uncanny Dodge':      [A('dmgTaken', 'add', -2, { min: 1 })],
  // Auras / hazardous bodies: melee is discouraged — minor DR until cascade
  // (TA-5) lets them counter-damage for real.
  'Heated Body':        [A('dmgTaken', 'add', -1, { min: 1 })],
  'Fire Form':          [A('dmgTaken', 'add', -1, { min: 1 })],
  'Fire Aura':          [A('dmgTaken', 'add', -1, { min: 1 })],
  'Acid Blood':         [A('dmgTaken', 'add', -1, { min: 1 })],
  'Corrosive Body':     [A('dmgTaken', 'add', -1, { min: 1 })],
  'Cold Aura':          [A('dmgTaken', 'add', -1, { min: 1 })],
  'Storm Aura':         [A('dmgTaken', 'add', -1, { min: 1 })],

  // -- on death: refuses to fall (one-shot per fight via _traitRevived)
  'Undead Fortitude':   [A('death', 'reviveAt', { kind: 'flat', hp: 1 },   { read: '{name} refuses to die (Undead Fortitude)' })],
  'Undead Persistence': [A('death', 'reviveAt', { kind: 'flat', hp: 1 },   { read: '{name} persists (Undead Persistence)' })],
  'Rejuvenation':       [A('death', 'reviveAt', { kind: 'frac', q: 0.25 }, { read: '{name} rejuvenates' })],
  'Reassemble':         [A('death', 'reviveAt', { kind: 'frac', q: 0.5 },  { read: '{name} reassembles' })],
  'Reforming':          [A('death', 'reviveAt', { kind: 'frac', q: 0.25 }, { read: '{name} reforms' })]
};

// -- Legendary Resistance: TA-3 (save.autoSucceed, uses:3 → _traitUses).
// -- Death Burst / Combustion Death: TA-5 (emit atoms → the cascade queue).
// -- Flyby / Keen senses / Amphibious / False Appearance / Spider Climb…:
//    narrative-only by design — no row, clean pass-through.

// ── Compiler: atoms → the legacy hook shape ──────────────────────────────
// Generates the exact hook-object contract the resolvers consume, so TA-1
// changes no caller and no behavior. Later packets consume atoms directly.

function hpDeltaFor(atom, traitStr) {
  return atom.param ? parseParam(traitStr, atom.param.rx, atom.v) : atom.v;
}

function reviveHpFor(atom, enemy) {
  const v = atom.v || {};
  return v.kind === 'frac'
    ? Math.max(1, Math.floor(enemy.maxHp * v.q))
    : v.hp;
}

function atomsToHooks(name, atoms) {
  const by = {};
  for (const a of atoms) (by[a.ch] = by[a.ch] || []).push(a);
  if ((by.turnStart || []).length > 1 || (by.death || []).length > 1) {
    // Event-channel aggregation semantics arrive with TA-3/TA-5; until a
    // packet defines them, fail fast at module init (deterministic, test-time).
    throw new Error(`traitHooks: '${name}' declares multiple ${by.turnStart?.length > 1 ? 'turnStart' : 'death'} atoms — undefined until TA-3/TA-5`);
  }
  const hooks = {};
  if (by.turnStart) {
    const atom = by.turnStart[0];
    hooks.onTurnStart = (enemy, world, traitStr) => {
      const amt = hpDeltaFor(atom, traitStr);
      return { hpDelta: amt, summaryPart: renderRead(atom.read, { name: enemy.name, v: amt }) };
    };
  }
  if (by.toHit) {
    const list = by.toHit;
    hooks.modifyToHit = (enemy, toHit, world) => {
      let x = toHit;
      for (const a of list) if (evalWhen(a.when, { enemy, world })) x = applyNumOp(a, x);
      return x;
    };
  }
  if (by.dmgDealt) {
    const list = by.dmgDealt;
    hooks.modifyDamageDealt = (enemy, dmg) => {
      let x = dmg;
      for (const a of list) if (evalWhen(a.when, { enemy })) x = applyNumOp(a, x);
      return x;
    };
  }
  if (by.dmgTaken) {
    const list = by.dmgTaken;
    hooks.modifyDamageTaken = (enemy, dmg, dmgType) => {
      let x = dmg;
      for (const a of list) if (evalWhen(a.when, { enemy, dmgType })) x = applyNumOp(a, x);
      return x;
    };
  }
  if (by.ac) {
    const list = by.ac;
    hooks.modifyAC = (enemy, ac) => {
      let x = ac;
      for (const a of list) if (evalWhen(a.when, { enemy })) x = applyNumOp(a, x);
      return x;
    };
  }
  if (by.death) {
    const atom = by.death[0];
    hooks.onDeath = (enemy) => ({
      revive: true,
      hpIfRevived: reviveHpFor(atom, enemy),
      summaryPart: renderRead(atom.read, { name: enemy.name })
    });
  }
  return hooks;
}

// ── Hook registry (generated from the trait table) ───────────────────────

const HOOKS = {};
for (const [name, atoms] of Object.entries(TRAIT_DEFS)) {
  HOOKS[name] = atomsToHooks(name, atoms);
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Get the effect atoms for a creature's traits array, in declaration order.
 * The forward-facing algebra surface — TA-3/4/5 consumers fold these
 * directly instead of going through the generated legacy hooks.
 * Returns [{ atom, traitStr, declIndex }]. Unknown names contribute nothing.
 */
export function getTraitAtoms(traits) {
  const arr = Array.isArray(traits) ? traits : [];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const atoms = TRAIT_DEFS[baseName(arr[i])];
    if (!atoms) continue;
    for (const atom of atoms) out.push({ atom, traitStr: arr[i], declIndex: i });
  }
  return out;
}

/**
 * Get all hooks for a creature's traits array.
 * Returns an object with merged hook functions.
 */
export function getTraitHooks(traits) {
  const arr = Array.isArray(traits) ? traits : [];
  const result = {
    onTurnStart: [],
    modifyToHit: [],
    modifyDamageDealt: [],
    modifyDamageTaken: [],
    modifyAC: [],
    onDeath: []
  };

  for (const traitStr of arr) {
    const name = baseName(traitStr);
    const hook = HOOKS[name];
    if (!hook) continue;
    if (hook.onTurnStart) result.onTurnStart.push({ fn: hook.onTurnStart, traitStr });
    if (hook.modifyToHit) result.modifyToHit.push({ fn: hook.modifyToHit, traitStr });
    if (hook.modifyDamageDealt) result.modifyDamageDealt.push({ fn: hook.modifyDamageDealt, traitStr });
    if (hook.modifyDamageTaken) result.modifyDamageTaken.push({ fn: hook.modifyDamageTaken, traitStr });
    if (hook.modifyAC) result.modifyAC.push({ fn: hook.modifyAC, traitStr });
    if (hook.onDeath) result.onDeath.push({ fn: hook.onDeath, traitStr });
  }

  return result;
}

/**
 * Apply onTurnStart hooks. Returns { hpDelta, summaryParts }.
 */
export function applyTurnStartTraits(enemy, world) {
  const hooks = getTraitHooks(enemy.traits);
  let totalHpDelta = 0;
  const parts = [];
  for (const { fn, traitStr } of hooks.onTurnStart) {
    const r = fn(enemy, world, traitStr);
    if (r?.hpDelta) totalHpDelta += r.hpDelta;
    if (r?.summaryPart) parts.push(r.summaryPart);
  }
  // Clamp regeneration so it doesn't exceed maxHp.
  if (totalHpDelta > 0 && enemy.maxHp) {
    const headroom = Math.max(0, enemy.maxHp - (enemy.hp || 0));
    totalHpDelta = Math.min(totalHpDelta, headroom);
  }
  return { hpDelta: totalHpDelta, summaryParts: parts };
}

/**
 * Apply toHit modifiers from traits.
 */
export function applyToHitTraits(enemy, baseToHit, world) {
  const hooks = getTraitHooks(enemy.traits);
  let toHit = baseToHit;
  for (const { fn } of hooks.modifyToHit) {
    toHit = fn(enemy, toHit, world);
  }
  return toHit;
}

/**
 * Apply damage dealt modifiers from traits.
 */
export function applyDamageDealtTraits(enemy, baseDmg) {
  const hooks = getTraitHooks(enemy.traits);
  let dmg = baseDmg;
  for (const { fn } of hooks.modifyDamageDealt) {
    dmg = fn(enemy, dmg);
  }
  return Math.max(0, dmg);
}

/**
 * Apply damage taken modifiers from traits.
 */
export function applyDamageTakenTraits(enemy, baseDmg, dmgType) {
  const hooks = getTraitHooks(enemy.traits);
  let dmg = baseDmg;
  for (const { fn } of hooks.modifyDamageTaken) {
    dmg = fn(enemy, dmg, dmgType);
  }
  return Math.max(0, dmg);
}

/**
 * Apply AC modifiers from traits.
 */
export function applyACTraits(enemy, baseAC) {
  const hooks = getTraitHooks(enemy.traits);
  let ac = baseAC;
  for (const { fn } of hooks.modifyAC) {
    ac = fn(enemy, ac);
  }
  return ac;
}

/**
 * Apply onDeath hooks. Returns { revive, hpIfRevived, summaryParts }.
 * Only the first revive hook fires (no stacking revives).
 */
export function applyDeathTraits(enemy, world) {
  const hooks = getTraitHooks(enemy.traits);
  const parts = [];
  for (const { fn } of hooks.onDeath) {
    const r = fn(enemy, world);
    if (r?.revive) {
      if (r.summaryPart) parts.push(r.summaryPart);
      return { revive: true, hpIfRevived: r.hpIfRevived || 1, summaryParts: parts };
    }
    if (r?.summaryPart) parts.push(r.summaryPart);
  }
  return { revive: false, hpIfRevived: 0, summaryParts: parts };
}

/**
 * Check if a trait name has a registered hook.
 */
export function hasTraitHook(traitStr) {
  return Boolean(HOOKS[baseName(traitStr)]);
}

/**
 * Count of registered trait hooks.
 */
export const REGISTERED_TRAIT_COUNT = Object.keys(HOOKS).length;
