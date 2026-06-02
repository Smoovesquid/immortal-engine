/**
 * Pass C2 — Companion combat turn resolver.
 *
 * Pure. Deterministic. No LLM, no Math.random. RNG is seeded from
 * (world.meta.seed, combat.round, companion.id) so simulate and replay
 * produce identical companion turns without threading an rng through
 * the playloop.
 *
 * Companion approach is derived from their role via a flat table. The
 * table covers every role in npcGenesis.js BUILDING_ARCHETYPES and
 * GENERIC_ROLES; unknown roles fall back to 'force'. Companions do NOT
 * call resolve.js — they have a simpler action budget and don't compete
 * with player mechanics. Their effects mirror the player-turn approach
 * signatures in combatResolve.js but with smaller damage numbers.
 *
 * Signatures:
 *   force   → enemy HP damage (base 2 + rng bump 0..1; clamp 1..4)
 *   finesse → enemy HP damage (base 2 + rng bump 0..1; clamp 1..4)
 *   heart   → parley ends combat IF target canParley; otherwise 1 damage
 *   endure  → sets companionGuard (one-shot, consumed before guard is off)
 *   focus   → studies target; no damage; reveals maxHp in mechanicsLine
 *
 * A companion with wounds >= 6 is "down" and skips its turn.
 */

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { makeRng, seedFromString } from '../rng.js';
import { statMod, maxWounds } from '../ruleset/core/stats.js';

// Role → approachTag. Deterministic lookup. Default fallback is 'force'.
// Covers every role in npcGenesis.js BUILDING_ARCHETYPES and GENERIC_ROLES.
// Exported so narratorContext can render companion approach without
// duplicating the table.
export const COMPANION_ROLE_APPROACH = {
  // BUILDING_ARCHETYPES
  tavern_keeper: 'heart',
  innkeeper: 'heart',
  smith: 'force',
  priest: 'endure',
  merchant: 'heart',
  guard_captain: 'force',
  stable_hand: 'finesse',
  scholar: 'focus',
  hedge_witch: 'endure',
  artisan: 'finesse',
  // GENERIC_ROLES
  elder: 'endure',
  laborer: 'force',
  veteran: 'force',
  trader: 'heart',
  healer: 'endure',
  scavenger: 'finesse',
  mediator: 'heart',
  guard: 'force',
  representative: 'heart'
};

const DEFAULT_APPROACH = 'force';

/**
 * companionApproachForRole(role) → approachTag
 *
 * Pure lookup. Unknown / missing roles fall back to 'force' so the
 * companion always has a swing.
 */
export function companionApproachForRole(role) {
  const key = String(role ?? '').toLowerCase();
  return COMPANION_ROLE_APPROACH[key] ?? DEFAULT_APPROACH;
}

export function resolveCompanionTurn(world, companion) {
  let w = ensureWorld(world);

  if (!w.combat?.active || !Array.isArray(w.combat.enemies)) {
    return { world: w, result: { skipped: true, reason: 'no-combat', mechanicsLine: '' } };
  }

  // Down companions (wounds >= maxWounds) do not act.
  if ((companion?.wounds ?? 0) >= maxWounds(companion?.level ?? 1, statMod(companion?.stats?.GRIT ?? 10))) {
    return { world: w, result: { skipped: true, reason: 'down', mechanicsLine: '' } };
  }

  // First living enemy is the target.
  const target = (w.combat.enemies || []).find(e => e && (e.hp > 0));
  if (!target) {
    return { world: w, result: { skipped: true, reason: 'no-enemies', mechanicsLine: '' } };
  }

  // Approach from role table — check companion.role first, then archetype.
  const roleSource = companion?.companion?.role ?? companion?.archetype ?? '';
  const approach = companionApproachForRole(roleSource);

  // Seeded RNG: determinism keyed on (seed, round, companion id).
  const rng = makeRng(seedFromString(
    `${w.meta.seed}|companion-turn|${w.combat.round}|${companion.id}`
  ));

  const marginBump = rng.int(0, 1);

  const deltas = [];
  let mechanicsLine = '';
  let parleyed = false;

  if (approach === 'force' || approach === 'finesse') {
    const dmg = clamp(2 + marginBump, 1, 4);
    deltas.push({ op: 'combatState', enemyHpDelta: [{ id: target.id, by: -dmg }] });
    mechanicsLine = `[companion ${companion.name} | ${approach} | ${dmg} on ${target.name}]`;
  } else if (approach === 'heart') {
    if (target.canParley) {
      // Parley: combat ends. Mirrors the player-turn parley branch in
      // combatResolve.js — reason marker is 'companion-parley' so tests
      // and replay can distinguish it from a player-driven parley.
      deltas.push({
        op: 'combatState',
        set: {
          active: false,
          round: 0,
          turnIndex: 0,
          reason: 'companion-parley',
          playerGuard: false,
          companionGuard: false
        }
      });
      parleyed = true;
      mechanicsLine = `[companion ${companion.name} | heart parley | ${target.name} yields]`;
    } else {
      // Heart-fallback: trivial 1 damage — mirrors player heart-fallback.
      deltas.push({ op: 'combatState', enemyHpDelta: [{ id: target.id, by: -1 }] });
      mechanicsLine = `[companion ${companion.name} | heart | 1 on ${target.name}]`;
    }
  } else if (approach === 'endure') {
    // Sets companionGuard — next enemy counter is softened by 1. One-shot,
    // consumed in the counter phase after playerGuard.
    deltas.push({ op: 'combatState', set: { companionGuard: true } });
    mechanicsLine = `[companion ${companion.name} | endure | guard raised]`;
  } else if (approach === 'focus') {
    // Studies target; no damage, reveals maxHp in mechanicsLine.
    mechanicsLine = `[companion ${companion.name} | focus | ${target.name} maxHp ${target.maxHp}]`;
  }

  if (deltas.length) w = applyDeltas(w, deltas);

  return {
    world: w,
    result: {
      skipped: false,
      companionId: companion.id,
      companionName: companion.name,
      approach,
      targetEnemyId: target.id,
      targetEnemyName: target.name,
      parleyed,
      mechanicsLine
    }
  };
}

function clamp(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
