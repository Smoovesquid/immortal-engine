// Pass T2 — deterministic loot roller.
// Uses seeded RNG from engine/rng.js — no Math.random().

import { getLootTable } from './index.js';

/**
 * rollLoot(tableId, rng) -> array of loot results (items/currency).
 *
 * @param {string} tableId - ID of the loot table to roll against
 * @param {object} rng - Seeded RNG object from engine/rng.js (must have .nextFloat())
 * @returns {Array<{kind: string, defRef?: string, currency?: string, amount?: string}>}
 */
export function rollLoot(tableId, rng) {
  const table = getLootTable(tableId);
  if (!table) return [];
  const results = [];
  for (let i = 0; i < (table.rolls || 1); i++) {
    const totalWeight = table.entries.reduce((s, e) => s + (e.weight || 0), 0);
    if (totalWeight <= 0) continue;
    let roll = Math.floor(rng.nextFloat() * totalWeight);
    for (const entry of table.entries) {
      roll -= (entry.weight || 0);
      if (roll < 0) {
        if (entry.result) results.push(entry.result);
        break;
      }
    }
  }
  return results;
}
