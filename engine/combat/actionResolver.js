/**
 * Pass CM3 — Enemy action resolution.
 *
 * Pure functions. All randomness from seeded rng parameter.
 *
 * resolveAction(action, attacker, target, rng) -> ActionResult
 * resolveRecharge(rechargeValue, rng)           -> boolean
 */

import { rollDice } from './diceRoller.js';
import { rollSave } from './savingThrows.js';
import { applyResistance } from './damageTypes.js';
import { applyCondition } from './conditions.js';

/**
 * resolveAction(action, attacker, target, rng)
 *
 * action: { name, toHit?, damage, type, range?, save?, conditions?, recharge? }
 * attacker: enemy state object
 * target: { ac?, stats?, conditions?, conditionImmunities?, resistances? }
 * rng: seeded RNG
 *
 * Returns {
 *   hit, critical, damage, damageType, damageRolls,
 *   resistanceResult, conditionsApplied, saveResult, actionName
 * }
 */
export function resolveAction(action, attacker, target, rng) {
  const act = action && typeof action === 'object' ? action : {};
  const tgt = target && typeof target === 'object' ? target : {};
  const actionName = String(act.name ?? 'Attack');
  const damageType = String(act.type ?? 'bludgeoning');

  // Save-based action (breath weapon, area effect)
  if (act.save && typeof act.save === 'object') {
    return resolveSaveAction(act, tgt, rng, actionName, damageType);
  }

  // Attack roll action (default)
  return resolveAttackAction(act, tgt, rng, actionName, damageType);
}

function resolveSaveAction(act, tgt, rng, actionName, damageType) {
  const save = act.save;
  const stat = String(save.stat ?? 'AGILITY');
  const dc = typeof save.dc === 'number' ? save.dc : 10;
  const halfOnSave = Boolean(save.halfOnSave);

  const saveResult = rollSave(tgt, stat, dc, rng);

  let rawDmg = 0;
  let damageRolls = { total: 0, rolls: [], modifier: 0 };

  if (!saveResult.success) {
    // Full damage on failure
    damageRolls = rollDice(act.damage, rng);
    rawDmg = Math.max(0, damageRolls.total);
  } else if (halfOnSave) {
    // Half damage on save
    damageRolls = rollDice(act.damage, rng);
    rawDmg = Math.max(0, Math.floor(damageRolls.total / 2));
  }
  // else: success + !halfOnSave = 0 damage

  const resistanceResult = applyResistance(rawDmg, damageType, tgt.resistances);
  const finalDmg = resistanceResult.heals ? 0 : resistanceResult.final;

  // Conditions applied on failed save
  const conditionsApplied = [];
  if (!saveResult.success && Array.isArray(act.conditions)) {
    for (const cond of act.conditions) {
      conditionsApplied.push(cond);
    }
  }

  return {
    hit: !saveResult.success,
    critical: false,
    damage: finalDmg,
    damageType,
    damageRolls,
    resistanceResult,
    conditionsApplied,
    saveResult,
    actionName
  };
}

function resolveAttackAction(act, tgt, rng, actionName, damageType) {
  const toHit = typeof act.toHit === 'number' ? act.toHit : 0;
  const targetAc = typeof tgt.ac === 'number' ? tgt.ac : 10;

  const attackRoll = rng.int(1, 20);
  const natural20 = attackRoll === 20;
  const natural1 = attackRoll === 1;

  let hit;
  let critical = false;
  if (natural1) {
    hit = false;
  } else if (natural20) {
    hit = true;
    critical = true;
  } else {
    hit = (attackRoll + toHit) >= targetAc;
  }

  let damage = 0;
  let damageRolls = { total: 0, rolls: [], modifier: 0 };
  const resistanceResult = { final: 0, level: 'normal', heals: false };

  if (hit) {
    damageRolls = rollDice(act.damage, rng);
    let rawDmg = Math.max(0, damageRolls.total);

    if (critical) {
      // Critical hit: roll damage dice again and add
      const critExtra = rollDice(act.damage, rng);
      rawDmg += Math.max(0, critExtra.total);
      damageRolls = {
        total: rawDmg,
        rolls: [...damageRolls.rolls, ...critExtra.rolls],
        modifier: damageRolls.modifier + critExtra.modifier
      };
    }

    const res = applyResistance(rawDmg, damageType, tgt.resistances);
    damage = res.heals ? 0 : res.final;
    resistanceResult.final = res.final;
    resistanceResult.level = res.level;
    resistanceResult.heals = res.heals;
  }

  // Conditions applied on hit
  const conditionsApplied = [];
  if (hit && Array.isArray(act.conditions)) {
    for (const cond of act.conditions) {
      conditionsApplied.push(cond);
    }
  }

  return {
    hit,
    critical,
    damage,
    damageType,
    damageRolls,
    resistanceResult,
    conditionsApplied,
    saveResult: null,
    actionName
  };
}

/**
 * resolveRecharge(rechargeValue, rng) -> boolean
 *
 * Roll d6. If >= rechargeValue, ability is recharged.
 */
export function resolveRecharge(rechargeValue, rng) {
  if (typeof rechargeValue !== 'number' || rechargeValue < 1) return true;
  const roll = rng.int(1, 6);
  return roll >= rechargeValue;
}
