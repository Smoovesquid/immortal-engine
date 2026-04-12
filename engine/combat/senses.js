/**
 * Pass CM9 — Mechanical Senses.
 *
 * Pure functions. No randomness, no LLM, no Math.random.
 *
 * applySenseOverrides(attacker, target, conditions) -> { toHitMod, acMod, bypassInvisible }
 *
 * Senses shape (from bestiary/ensureCombat):
 *   { darkvision: number|null, blindsight: number|null, tremorsense: number|null, truesight: number|null }
 *
 * Rules:
 *   - Blindsight: ignore invisible condition on target, +2 toHit in darkness
 *   - Tremorsense: ignore invisible condition on target if target is grounded
 *   - Darkvision: no penalty attacking in darkness (normally -2 toHit)
 *   - Truesight: ignore invisible, ignore illusion conditions, +1 toHit
 *   - An attacker with no senses attacking an invisible target: -5 toHit
 *   - An attacker attacking a blinded target: +2 toHit
 */

import { hasCondition } from './conditions.js';

/**
 * applySenseOverrides(attacker, target, environmentTags?)
 *
 * attacker: entity with .senses and .conditions
 * target: entity with .conditions
 * environmentTags: optional Set of strings like 'darkness', 'fog'
 *
 * Returns { toHitMod, acMod, bypassInvisible }
 */
export function applySenseOverrides(attacker, target, environmentTags) {
  const aSenses = attacker?.senses || {};
  const aConds = attacker?.conditions || [];
  const tConds = target?.conditions || [];
  const env = environmentTags instanceof Set ? environmentTags : new Set();

  let toHitMod = 0;
  let acMod = 0;
  let bypassInvisible = false;

  const targetInvisible = hasCondition(tConds, 'invisible');
  const targetBlinded = hasCondition(tConds, 'blinded');
  const attackerBlinded = hasCondition(aConds, 'blinded');
  const inDarkness = env.has('darkness');

  // Truesight: best sense — bypasses invisible, ignores illusions, +1 toHit.
  if (aSenses.truesight != null && aSenses.truesight > 0) {
    bypassInvisible = true;
    toHitMod += 1;
  }

  // Blindsight: ignore invisible, +2 in darkness.
  if (aSenses.blindsight != null && aSenses.blindsight > 0) {
    bypassInvisible = true;
    if (inDarkness) toHitMod += 2;
  }

  // Tremorsense: ignore invisible (assuming grounded targets).
  if (aSenses.tremorsense != null && aSenses.tremorsense > 0) {
    bypassInvisible = true;
  }

  // Darkvision: no darkness penalty.
  if (aSenses.darkvision != null && aSenses.darkvision > 0) {
    // Darkvision negates the darkness penalty but doesn't grant bonus.
    // (darkness penalty is applied below only if no darkvision)
  }

  // Darkness penalty: -2 toHit if in darkness without any vision.
  if (inDarkness && !aSenses.darkvision && !aSenses.blindsight && !aSenses.truesight) {
    toHitMod -= 2;
  }

  // Attacking an invisible target without sense bypass: -5 toHit.
  if (targetInvisible && !bypassInvisible) {
    toHitMod -= 5;
  }

  // Attacking a blinded target: +2 toHit.
  if (targetBlinded) {
    toHitMod += 2;
  }

  // Attacker is blinded (no senses bypass): -3 toHit.
  if (attackerBlinded && !bypassInvisible) {
    toHitMod -= 3;
  }

  return { toHitMod, acMod, bypassInvisible };
}
