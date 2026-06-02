// Pass B1 — CR-appropriate encounter tables per region.

import { getMonsterDef } from './bestiary/index.js';

export const ENCOUNTER_TABLES = {
  // ── Original region tables ──────────────────────────────────────────
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
  ],

  // ── Habitat-keyed tables (named bestiary only) ─────────────────────

  forest: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 2, enemies: ['wolf', 'wolf'] },
    { weight: 1, enemies: ['wolf', 'wolf', 'wolf'] },
    { weight: 1, enemies: ['bandit', 'bandit'] },
    { weight: 0.5, enemies: ['owlbear'] },
  ],

  plains: [
    { weight: 3, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['goblin', 'goblin'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
    { weight: 1, enemies: ['goblin', 'goblin_archer'] },
  ],

  farmland: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['wolf'] },
    { weight: 2, enemies: ['bandit'] },
    { weight: 1, enemies: ['goblin', 'goblin_archer'] },
    { weight: 1, enemies: ['bandit', 'bandit'] },
  ],

  urban: [
    { weight: 3, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['cultist', 'cultist'] },
    { weight: 2, enemies: ['bandit'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
    { weight: 1, enemies: ['cultist', 'cultist', 'cultist'] },
    { weight: 0.5, enemies: ['bandit_captain', 'bandit', 'bandit'] },
  ],

  dungeon: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 2, enemies: ['cultist', 'cultist'] },
    { weight: 1, enemies: ['goblin', 'goblin', 'goblin'] },
    { weight: 1, enemies: ['owlbear'] },
    { weight: 0.5, enemies: ['ashenmoor_warden'] },
  ],

  ruins: [
    { weight: 3, enemies: ['cultist', 'cultist'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 2, enemies: ['goblin', 'goblin'] },
    { weight: 1, enemies: ['owlbear'] },
    { weight: 1, enemies: ['cultist', 'cultist', 'cultist'] },
  ],

  underground: [
    { weight: 3, enemies: ['goblin', 'goblin', 'goblin'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 2, enemies: ['cultist', 'cultist'] },
    { weight: 1, enemies: ['owlbear'] },
    { weight: 0.5, enemies: ['ashenmoor_warden'] },
  ],

  mountain: [
    { weight: 3, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['wolf'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
    { weight: 1, enemies: ['wolf', 'wolf', 'wolf'] },
  ],

  mountains: [
    { weight: 3, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['wolf'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
    { weight: 1, enemies: ['wolf', 'wolf', 'wolf'] },
  ],

  arctic: [
    { weight: 3, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['wolf', 'wolf', 'wolf'] },
    { weight: 2, enemies: ['bandit'] },
    { weight: 1, enemies: ['bandit', 'bandit'] },
    { weight: 0.5, enemies: ['bandit_captain', 'bandit'] },
  ],

  tundra: [
    { weight: 3, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['wolf'] },
    { weight: 2, enemies: ['bandit', 'bandit'] },
    { weight: 1, enemies: ['wolf', 'wolf', 'wolf'] },
    { weight: 0.5, enemies: ['bandit_captain', 'bandit'] },
  ],

  marsh: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 1, enemies: ['goblin', 'goblin', 'goblin'] },
    { weight: 1, enemies: ['wolf'] },
  ],

  swamp: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['wolf', 'wolf'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 1, enemies: ['goblin', 'goblin', 'goblin'] },
    { weight: 1, enemies: ['wolf'] },
  ],

  desert: [
    { weight: 3, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['cultist', 'cultist'] },
    { weight: 2, enemies: ['bandit'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
    { weight: 0.5, enemies: ['cultist', 'cultist', 'cultist'] },
  ],

  volcanic: [
    { weight: 3, enemies: ['cultist', 'cultist'] },
    { weight: 2, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['cultist', 'cultist', 'cultist'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
    { weight: 0.5, enemies: ['ashenmoor_warden'] },
  ],

  coastal: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['bandit', 'bandit'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 1, enemies: ['bandit'] },
    { weight: 1, enemies: ['bandit_captain', 'bandit'] },
  ],

  jungle: [
    { weight: 3, enemies: ['goblin', 'goblin'] },
    { weight: 2, enemies: ['goblin', 'goblin_archer'] },
    { weight: 2, enemies: ['goblin', 'goblin', 'goblin'] },
    { weight: 1, enemies: ['bandit', 'bandit'] },
    { weight: 1, enemies: ['wolf', 'wolf'] },
  ],
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
