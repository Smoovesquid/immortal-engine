/**
 * Trait hook system — mechanical execution for creature traits.
 *
 * Creatures have traits: string[] on their bestiary definition. Each trait
 * string maps to zero or one hook object that modifies combat behavior at
 * specific trigger points. Unknown traits are narrative-only and pass through.
 *
 * Hook points:
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
 * Trait params are parsed from the parenthetical where needed.
 *
 * Pure. No RNG. No LLM. Deterministic given the same trait string.
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

// ── Hook registry ────────────────────────────────────────────────────────

const HOOKS = {};

function register(name, hooks) {
  HOOKS[name] = hooks;
}

// ── Combat-relevant traits ───────────────────────────────────────────────

// -- Regeneration: heals HP at start of turn
register('Regeneration', {
  onTurnStart(enemy, world, traitStr) {
    const amt = parseParam(traitStr, /(\d+)\s*HP/i, 10);
    return { hpDelta: amt, summaryPart: `${enemy.name} regenerates ${amt} HP` };
  }
});

register('Dire Regeneration', {
  onTurnStart(enemy, world, traitStr) {
    const amt = parseParam(traitStr, /(\d+)\s*HP/i, 20);
    return { hpDelta: amt, summaryPart: `${enemy.name} regenerates ${amt} HP` };
  }
});

register('Fungal Regeneration', {
  onTurnStart(enemy, world, traitStr) {
    return { hpDelta: 5, summaryPart: `${enemy.name} regenerates 5 HP (fungal)` };
  }
});

register('Regenerative Heads', {
  onTurnStart(enemy, world, traitStr) {
    return { hpDelta: 5, summaryPart: `${enemy.name} regrows a head (+5 HP)` };
  }
});

// -- Pack Tactics: +2 to hit when allies present
register('Pack Tactics', {
  modifyToHit(enemy, toHit, world) {
    const allies = (world?.combat?.enemies || []).filter(e => e.hp > 0 && e.id !== enemy.id);
    return allies.length > 0 ? toHit + 2 : toHit;
  }
});

register('Flock Tactics', {
  modifyToHit(enemy, toHit, world) {
    const allies = (world?.combat?.enemies || []).filter(e => e.hp > 0 && e.id !== enemy.id);
    return allies.length > 0 ? toHit + 2 : toHit;
  }
});

// -- Reckless / Aggressive: +2 to hit
register('Reckless', {
  modifyToHit(enemy, toHit) { return toHit + 2; }
});

register('Reckless Attack', {
  modifyToHit(enemy, toHit) { return toHit + 2; }
});

register('Aggressive', {
  modifyToHit(enemy, toHit) { return toHit + 1; }
});

register('Aggressive Charge', {
  modifyToHit(enemy, toHit) { return toHit + 1; }
});

// -- Brute: +2 damage dealt
register('Brute', {
  modifyDamageDealt(enemy, dmg) { return dmg + 2; }
});

// -- Sneak Attack: +3 damage on first hit
register('Sneak Attack', {
  modifyDamageDealt(enemy, dmg) { return dmg + 3; }
});

register('Assassinate', {
  modifyDamageDealt(enemy, dmg) { return dmg + 4; }
});

register('Surprise Strike', {
  modifyDamageDealt(enemy, dmg) { return dmg + 2; }
});

register('Death Strike', {
  modifyDamageDealt(enemy, dmg) { return dmg + 3; }
});

register('Precision Strike', {
  modifyDamageDealt(enemy, dmg) { return dmg + 2; }
});

// -- Natural Armor / Armored: +1 AC
register('Natural Armor', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Armored', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Shell Armor', {
  modifyAC(enemy, ac) { return ac + 2; }
});

register('Crystal Hide', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Metal Hide', {
  modifyAC(enemy, ac) { return ac + 2; }
});

register('Iron Body', {
  modifyAC(enemy, ac) { return ac + 2; }
});

register('Ironwood Body', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Spectral Armor', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Barbed Hide', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Thorn Armor', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Adaptive Armor', {
  modifyAC(enemy, ac) { return ac + 2; }
});

register('Rune Armor', {
  modifyAC(enemy, ac) { return ac + 2; }
});

// -- Evasion: halve incoming damage
register('Evasion', {
  modifyDamageTaken(enemy, dmg) { return Math.max(1, Math.floor(dmg / 2)); }
});

register('Avoidance', {
  modifyDamageTaken(enemy, dmg) { return Math.max(1, Math.floor(dmg / 2)); }
});

// -- Uncanny Dodge: reduce damage by 2
register('Uncanny Dodge', {
  modifyDamageTaken(enemy, dmg) { return Math.max(1, dmg - 2); }
});

// -- Magic Resistance: +2 AC vs spells (approximated as flat AC since
//    we don't distinguish spell vs weapon attacks in the current system)
register('Magic Resistance', {
  modifyAC(enemy, ac) { return ac + 1; }
});

register('Spell Resistance', {
  modifyAC(enemy, ac) { return ac + 1; }
});

// -- Legendary Resistance: absorbed by the legendaryActions system already.
//    No hook needed — it's narrative flavor when the save system is triggered.

// -- Heated Body / Fire Form / Acid Blood: damage to melee attackers
//    (modeled as damage reduction since we can't easily counter-damage the player mid-resolve)
register('Heated Body', {
  modifyDamageTaken(enemy, dmg, dmgType) {
    // Fire aura discourages melee — represented as minor DR
    return Math.max(1, dmg - 1);
  }
});

register('Fire Form', {
  modifyDamageTaken(enemy, dmg, dmgType) { return Math.max(1, dmg - 1); }
});

register('Fire Aura', {
  modifyDamageTaken(enemy, dmg, dmgType) { return Math.max(1, dmg - 1); }
});

register('Acid Blood', {
  modifyDamageTaken(enemy, dmg, dmgType) { return Math.max(1, dmg - 1); }
});

register('Corrosive Body', {
  modifyDamageTaken(enemy, dmg, dmgType) { return Math.max(1, dmg - 1); }
});

register('Cold Aura', {
  modifyDamageTaken(enemy, dmg, dmgType) { return Math.max(1, dmg - 1); }
});

register('Storm Aura', {
  modifyDamageTaken(enemy, dmg, dmgType) { return Math.max(1, dmg - 1); }
});

// -- Undead Fortitude: on death, revive at 1 HP (one-shot)
register('Undead Fortitude', {
  onDeath(enemy) {
    return { revive: true, hpIfRevived: 1, summaryPart: `${enemy.name} refuses to die (Undead Fortitude)` };
  }
});

register('Undead Persistence', {
  onDeath(enemy) {
    return { revive: true, hpIfRevived: 1, summaryPart: `${enemy.name} persists (Undead Persistence)` };
  }
});

register('Rejuvenation', {
  onDeath(enemy) {
    return { revive: true, hpIfRevived: Math.max(1, Math.floor(enemy.maxHp * 0.25)), summaryPart: `${enemy.name} rejuvenates` };
  }
});

register('Reassemble', {
  onDeath(enemy) {
    return { revive: true, hpIfRevived: Math.max(1, Math.floor(enemy.maxHp * 0.5)), summaryPart: `${enemy.name} reassembles` };
  }
});

register('Reforming', {
  onDeath(enemy) {
    return { revive: true, hpIfRevived: Math.max(1, Math.floor(enemy.maxHp * 0.25)), summaryPart: `${enemy.name} reforms` };
  }
});

// -- Death Burst / Combustion Death: damage on death (narrative; no mechanical counter-damage yet)
// These are narrative-only for now.

// -- Flyby: no mechanical hook in current system (no opportunity attacks)
// -- Keen Smell/Sight/Hearing: flavor (senses system handles these already)
// -- Amphibious/Swim/Burrow/Climb/Flight: movement flavor
// -- False Appearance: ambush/surprise flavor
// -- Spider Climb: movement flavor

// ── Public API ───────────────────────────────────────────────────────────

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
  for (const { fn, traitStr } of hooks.modifyToHit) {
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
  for (const { fn, traitStr } of hooks.onDeath) {
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
