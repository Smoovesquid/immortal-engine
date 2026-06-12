/**
 * P-75 — Boss mechanics.
 *
 * The CM7/CM9 machinery (legendary actions between turns, lair actions at
 * round start) exists, but bestiary catalog entries carry flavor-only
 * payloads: after ensureCombat normalization a legendary option's `action`
 * is an empty object and a lair entry has no `action` at all, so both
 * resolved as 0-damage duds. This module makes boss data mechanical:
 *
 *   resolveBossActionPayload(enemy, option) — fill a legendary option's
 *     payload: authored action > matching enemy action by name > a
 *     deterministic CR-scaled synthesis.
 *   resolveLairActionPayload(enemy, entry)  — same for lair actions
 *     (synthesized as save-based area effects).
 *   bossPhase(enemy)        — 1 or 2, derived purely from hp fraction.
 *   applyBossPhase(enemy)   — phase-2 bosses fight differently: an authored
 *     phase action joins their routine, or their strikes hit harder.
 *   detectPhaseCrossings(hpBefore, enemies) — which living bosses crossed
 *     the phase threshold this turn, with the narration beat to surface.
 *
 * Phase state is never persisted — it is a pure function of hp — so the
 * world state shape, WORLD_VERSION, and worldHash are untouched. Non-boss
 * enemies (no legendaryActions) pass through every function unchanged.
 *
 * Pure: no Math.random, no Date.now. Synthesis is arithmetic on the def.
 */

import { elite } from '../ruleset/core/bestiary/catalog/elite.js';

// Lazy name→def index over the elite catalog (authored `phases` live there).
let ELITE_BY_NAME = null;
function eliteDef(name) {
  if (!ELITE_BY_NAME) {
    ELITE_BY_NAME = new Map();
    for (const d of elite) {
      if (d && d.name) ELITE_BY_NAME.set(String(d.name), d);
    }
  }
  return ELITE_BY_NAME.get(String(name ?? '')) || null;
}

function isRealAction(a) {
  return Boolean(
    a && typeof a === 'object' &&
    (typeof a.toHit === 'number' || (a.save && typeof a.save === 'object')) &&
    a.damage != null
  );
}

function isBoss(enemy) {
  return Boolean(enemy && enemy.legendaryActions && enemy.legendaryActions.perRound > 0);
}

/**
 * Fill in the mechanical payload for a legendary option.
 * Order: authored option.action → enemy action with the same name →
 * deterministic synthesis from CR and option cost.
 */
export function resolveBossActionPayload(enemy, option) {
  const o = option && typeof option === 'object' ? option : {};
  if (isRealAction(o.action)) return o.action;

  const name = String(o.name ?? 'Strike');
  const actions = Array.isArray(enemy?.actions) ? enemy.actions : [];
  const matched = actions.find(a => a && String(a.name).toLowerCase() === name.toLowerCase());
  if (isRealAction(matched)) return matched;

  const cr = typeof enemy?.cr === 'number' ? enemy.cr : 1;
  const cost = Math.max(1, Math.min(3, Math.trunc(Number(o.cost) || 1)));
  const mod = Math.floor(cr / 3);
  return {
    name,
    toHit: 4 + Math.floor(cr / 2),
    damage: `${cost}d8${mod > 0 ? `+${mod}` : ''}`,
    type: typeof enemy?.damageType === 'string' ? enemy.damageType : 'bludgeoning',
    range: null,
    save: null,
    conditions: [],
    recharge: null
  };
}

/**
 * Fill in the mechanical payload for a lair action entry.
 * Authored entry.action wins; otherwise synthesize a save-for-half area
 * effect scaled to the boss's CR.
 */
export function resolveLairActionPayload(enemy, entry) {
  const la = entry && typeof entry === 'object' ? entry : {};
  if (isRealAction(la.action)) return la.action;

  const cr = typeof enemy?.cr === 'number' ? enemy.cr : 1;
  return {
    name: String(la.name ?? 'Lair Action'),
    toHit: null,
    damage: `2d6${cr >= 6 ? '+2' : ''}`,
    type: typeof enemy?.damageType === 'string' ? enemy.damageType : 'bludgeoning',
    range: 30,
    save: { stat: 'AGILITY', dc: 10 + Math.floor(cr / 2), halfOnSave: true },
    conditions: [],
    recharge: null
  };
}

/** Phase threshold for an enemy: authored def.phases[0].at, default ½. */
function phaseThreshold(enemy) {
  const def = eliteDef(enemy?.name);
  const at = def?.phases?.[0]?.at;
  return typeof at === 'number' && at > 0 && at < 1 ? at : 0.5;
}

/** 1 (fresh) or 2 (at/below the phase threshold). Non-bosses are always 1. */
export function bossPhase(enemy) {
  if (!isBoss(enemy)) return 1;
  const maxHp = Math.max(1, Number(enemy.maxHp) || 1);
  const hp = Number(enemy.hp) || 0;
  return hp / maxHp <= phaseThreshold(enemy) ? 2 : 1;
}

/** Bump a dice expression's flat modifier (bloodied fury): '2d6+1' → '2d6+3'. */
function boostDamage(expr) {
  const s = String(expr ?? '').trim();
  const m = s.match(/^(\d+d\d+)([+-]\d+)?$/);
  if (!m) return s;
  const mod = (m[2] ? parseInt(m[2], 10) : 0) + 2;
  return `${m[1]}${mod >= 0 ? `+${mod}` : mod}`;
}

/**
 * Returns the enemy to use for this turn's action resolution.
 * Phase 1 / non-boss: the same reference (byte-identical path).
 * Phase 2: a copy whose routine includes the authored phase action, or —
 * with no authored phase — whose attacks hit harder (bloodied fury).
 */
export function applyBossPhase(enemy) {
  if (bossPhase(enemy) !== 2) return enemy;

  const actions = Array.isArray(enemy.actions) ? enemy.actions : [];
  const def = eliteDef(enemy.name);
  const phaseAction = def?.phases?.[0]?.action;

  if (isRealAction(phaseAction)) {
    const multi = Array.isArray(enemy.multiattack) && enemy.multiattack.length > 0
      ? [...enemy.multiattack, phaseAction.name]
      : (actions[0] ? [actions[0].name, phaseAction.name] : [phaseAction.name]);
    return { ...enemy, actions: [...actions, phaseAction], multiattack: multi };
  }

  return {
    ...enemy,
    actions: actions.map(a => (a && a.damage != null) ? { ...a, damage: boostDamage(a.damage) } : a)
  };
}

/**
 * Compare turn-start hp against current enemies; report bosses that crossed
 * the phase threshold this turn (and are still up). Each entry carries the
 * narration beat: the authored def.phases line or a default bloodied beat.
 */
export function detectPhaseCrossings(hpBefore, enemies) {
  const out = [];
  for (const e of (Array.isArray(enemies) ? enemies : [])) {
    if (!isBoss(e) || !(e.hp > 0)) continue;
    const before = hpBefore instanceof Map ? hpBefore.get(e.id) : undefined;
    if (typeof before !== 'number') continue;
    const maxHp = Math.max(1, Number(e.maxHp) || 1);
    const at = phaseThreshold(e);
    const wasAbove = before / maxHp > at;
    const nowAtOrBelow = e.hp / maxHp <= at;
    if (wasAbove && nowAtOrBelow) {
      const def = eliteDef(e.name);
      const authored = def?.phases?.[0]?.narration;
      out.push({
        id: e.id,
        name: e.name,
        phaseName: String(def?.phases?.[0]?.name ?? 'Bloodied'),
        narration: typeof authored === 'string' && authored
          ? authored
          : `${e.name} is bloodied — its manner changes, wilder and more desperate`
      });
    }
  }
  return out;
}
