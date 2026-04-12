// Pass T2 + CM5 — loot table registry with CR-scaled selection.

import { monstrous_common } from './monstrous_common.js';
import { humanoid_common } from './humanoid_common.js';
import { cr_0_4 } from './cr_0_4.js';
import { cr_5_10 } from './cr_5_10.js';
import { cr_11_16 } from './cr_11_16.js';
import { cr_17_plus } from './cr_17_plus.js';

export const LOOT_TABLES = {
  monstrous_common,
  humanoid_common,
  cr_0_4,
  cr_5_10,
  cr_11_16,
  cr_17_plus
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
