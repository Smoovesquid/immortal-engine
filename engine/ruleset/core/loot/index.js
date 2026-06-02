// Pass T2 + CM5 — loot table registry with CR-scaled selection.

import { monstrous_common } from './monstrous_common.js';
import { humanoid_common } from './humanoid_common.js';
import { cr_0_4 } from './cr_0_4.js';
import { cr_5_10 } from './cr_5_10.js';
import { cr_11_16 } from './cr_11_16.js';
import { cr_17_plus } from './cr_17_plus.js';
import {
  aberration_elite, aberration_minor, aberration_standard, aberration_trivial,
  beast_elite, beast_minor, beast_standard, beast_trivial,
  construct_elite, construct_minor, construct_standard, construct_trivial,
  dragon_elite, dragon_minor, dragon_standard,
  elemental_elite, elemental_minor, elemental_standard, elemental_trivial,
  fey_minor, fey_standard, fey_trivial,
  fiend_elite, fiend_minor, fiend_standard, fiend_trivial,
  fungal_minor,
  giant_elite, giant_minor, giant_standard,
  humanoid_elite, humanoid_minor, humanoid_standard,
  monstrosity_minor, monstrosity_trivial,
  ooze_minor, ooze_standard, ooze_trivial,
  parasite_minor,
  plant_elite, plant_minor, plant_standard, plant_trivial,
  shadow_elite, shadow_minor, shadow_standard,
  spirit_trivial,
  undead_elite, undead_minor, undead_standard, undead_trivial
} from './catalog.js';

export const LOOT_TABLES = {
  monstrous_common,
  humanoid_common,
  cr_0_4,
  cr_5_10,
  cr_11_16,
  cr_17_plus,
  // Bestiary type-tier tables
  aberration_elite, aberration_minor, aberration_standard, aberration_trivial,
  beast_elite, beast_minor, beast_standard, beast_trivial,
  construct_elite, construct_minor, construct_standard, construct_trivial,
  dragon_elite, dragon_minor, dragon_standard,
  elemental_elite, elemental_minor, elemental_standard, elemental_trivial,
  fey_minor, fey_standard, fey_trivial,
  fiend_elite, fiend_minor, fiend_standard, fiend_trivial,
  fungal_minor,
  giant_elite, giant_minor, giant_standard,
  humanoid_elite, humanoid_minor, humanoid_standard,
  monstrosity_minor, monstrosity_trivial,
  ooze_minor, ooze_standard, ooze_trivial,
  parasite_minor,
  plant_elite, plant_minor, plant_standard, plant_trivial,
  shadow_elite, shadow_minor, shadow_standard,
  spirit_trivial,
  undead_elite, undead_minor, undead_standard, undead_trivial
};

export function getLootTable(id) {
  return LOOT_TABLES[id] || null;
}

/**
 * tableIdForCR(cr) -> string
 *
 * Maps a creature's CR to the appropriate loot table id.
 */
export function tableIdForCR(cr) {
  const n = typeof cr === 'number' ? cr : 0;
  if (n >= 17) return 'cr_17_plus';
  if (n >= 11) return 'cr_11_16';
  if (n >= 5) return 'cr_5_10';
  return 'cr_0_4';
}
