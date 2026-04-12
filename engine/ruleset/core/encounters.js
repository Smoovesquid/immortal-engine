// Pass B1 — CR-appropriate encounter tables per region.

import { getMonsterDef } from './bestiary/index.js';

export const ENCOUNTER_TABLES = {
  westmarch: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 2, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['bandit'] },
    { weight: 1, enemies: ['bandit', 'bandit'] },
    { weight: 0.5, enemies: ['bandit_captain', 'bandit'] },
  ],
  ashenmoor: [
    { weight: 3, enemies: ['cultist', 'cultist'] },
    { weight: 2, enemies: ['wolf'] },
    { weight: 1, enemies: ['owlbear'] },
    { weight: 1, enemies: ['cultist', 'cultist', 'cultist'] },
    { weight: 0.5, enemies: ['ashenmoor_warden'] },
  ]
};

/**
 * rollEncounter(regionId, rng) -> { enemies: MonsterDef[] }
 *
 * Uses weighted random selection via the seeded rng (engine/rng.js).
 * Returns resolved monster definitions, not just refs.
 */
export function rollEncounter(regionId, rng) {
  const table = ENCOUNTER_TABLES[regionId];
  if (!table || !table.length) return { enemies: [] };

  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rng.nextFloat() * totalWeight;

  let cumulative = 0;
  let selected = table[0];
  for (const entry of table) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      selected = entry;
      break;
    }
  }

  const enemies = selected.enemies
    .map(ref => getMonsterDef(ref))
    .filter(Boolean);

  return { enemies };
}
