/**
 * Pass CM6 — Initiative system.
 *
 * Pure functions. All randomness comes from the seeded rng parameter.
 *
 * rollInitiative(combatants, rng) -> sorted initiative order array
 *
 * Each combatant: { id, type: 'party'|'enemy', modifier }
 * Result entry:   { id, type, roll, modifier, total }
 *
 * Ties are broken by modifier (higher wins), then by type ('party' wins
 * over 'enemy' on equal modifier — the hero's advantage).
 */

import { statMod } from '../ruleset/core/stats.js';

/**
 * buildCombatants(party, enemies) -> combatant[]
 *
 * Assembles the combatant list from party members and enemies.
 * Party members use AGILITY for their initiative modifier.
 * Enemies use their initMod field (from bestiary) or default 0.
 */
export function buildCombatants(party, enemies) {
  const out = [];
  const partyArr = Array.isArray(party) ? party : [];
  for (const p of partyArr) {
    if (!p || typeof p !== 'object') continue;
    if ((p.wounds ?? 0) >= 6) continue; // dead members don't roll
    const mod = statMod(p.stats?.AGILITY ?? 10);
    out.push({ id: String(p.id ?? ''), type: 'party', modifier: mod });
  }
  const enemyArr = Array.isArray(enemies) ? enemies : [];
  for (const e of enemyArr) {
    if (!e || typeof e !== 'object') continue;
    if (!(e.hp > 0)) continue; // dead enemies don't roll
    const mod = typeof e.initMod === 'number' ? e.initMod : 0;
    out.push({ id: String(e.id ?? ''), type: 'enemy', modifier: mod });
  }
  return out;
}

/**
 * rollInitiative(combatants, rng) -> sorted array of initiative entries.
 *
 * Each entry: { id, type, roll, modifier, total }.
 * Sorted descending by total. Ties: higher modifier first, then
 * party before enemy.
 */
export function rollInitiative(combatants, rng) {
  const list = Array.isArray(combatants) ? combatants : [];
  const entries = list.map(c => {
    const roll = rng.int(1, 20);
    const modifier = typeof c.modifier === 'number' ? c.modifier : 0;
    return {
      id: String(c.id ?? ''),
      type: String(c.type ?? 'enemy'),
      roll,
      modifier,
      total: roll + modifier
    };
  });

  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.modifier !== a.modifier) return b.modifier - a.modifier;
    // Party wins ties against enemies.
    if (a.type === 'party' && b.type !== 'party') return -1;
    if (b.type === 'party' && a.type !== 'party') return 1;
    return 0;
  });

  return entries;
}
