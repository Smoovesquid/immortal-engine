// Pass T2 — loot table registry.

import { monstrous_common } from './monstrous_common.js';
import { humanoid_common } from './humanoid_common.js';

export const LOOT_TABLES = { monstrous_common, humanoid_common };

export function getLootTable(id) {
  return LOOT_TABLES[id] || null;
}
