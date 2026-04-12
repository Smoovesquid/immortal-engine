/**
 * Pass CM3 — Saving throw resolution.
 *
 * Pure function. All randomness from seeded rng parameter.
 *
 * rollSave(entity, stat, dc, rng) -> { success, roll, modifier, total, natural20, natural1 }
 */

import { statMod } from '../ruleset/core/stats.js';
import { profBonusFor } from '../ruleset/core/levelTable.js';

/**
 * rollSave(entity, stat, dc, rng)
 *
 * entity: { stats, saveProficiencies?, level? }
 * stat: 'MIGHT'|'AGILITY'|'WITS'|'GRIT'|'CHARM'
 * dc: number
 * rng: seeded RNG
 *
 * Natural 20: always succeeds.
 * Natural 1: always fails.
 */
export function rollSave(entity, stat, dc, rng) {
  const e = entity && typeof entity === 'object' ? entity : {};
  const statKey = String(stat || 'GRIT');
  const dcVal = typeof dc === 'number' && Number.isFinite(dc) ? dc : 10;

  const statScore = e.stats?.[statKey] ?? 10;
  const mod = statMod(statScore);

  const profs = Array.isArray(e.saveProficiencies) ? e.saveProficiencies : [];
  const isProficient = profs.includes(statKey);
  const profBonus = isProficient ? profBonusFor(e.level ?? 1) : 0;

  const roll = rng.int(1, 20);
  const natural20 = roll === 20;
  const natural1 = roll === 1;
  const modifier = mod + profBonus;
  const total = roll + modifier;

  let success;
  if (natural20) success = true;
  else if (natural1) success = false;
  else success = total >= dcVal;

  return { success, roll, modifier, total, natural20, natural1 };
}
