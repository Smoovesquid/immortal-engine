// U629 — ENSURE-STATS-1 (save/load variant): an enemy's stats + level survive a
// full export → import round-trip (docs/PACKETS.md).
//
// The sibling-sweep for ENSURE-STATS-1 found EXACTLY two stripped fields
// (`stats`, `level`) — no other minted field falls out of the ensureCombat
// whitelist (id/name/hp/…/traits/tactical/cx/cy are all preserved). So U629
// covers the SAVE/LOAD round-trip variant the packet reserves for the
// "sweep-finds-nothing-else" case: exportWorld/importWorld serialize the world
// to JSON and re-normalize on the way back in (importWorld → ensureWorld →
// ensureCombat), which is a THIRD place the strip would bite (beyond
// beginCombat's applyDeltas and the between-turns ensureWorld covered by U628).
//
// This also proves the invariant survives the trip: a saved world whose enemy
// carries stats/level must pass assertWorldInvariants (run inside ensureWorld) —
// the ENSURE-STATS-1 shape checks accept a real ability block, not just the
// empty default.
//
// LLM-off (deterministic path only).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { mintEnemyFromNpc, beginCombat } from '../engine/combat/combatLifecycle.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';

const OGRE_NPC = {
  id: 'npc_ogre',
  name: 'Ogre',
  hostile: true,
  combatProfile: {
    maxHp: 30,
    damage: 8,
    stats: { MIGHT: 19, AGILITY: 8, WITS: 5, GRIT: 16, CHARM: 7 },
    level: 5,
    saveProficiencies: ['GRIT']
  }
};

function worldInCombat() {
  const w = ensureWorld(newWorld({
    seed: 'ensure-stats-1-saveload',
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }));
  return beginCombat(w, { enemies: [mintEnemyFromNpc(OGRE_NPC)], reason: 'test-ambush' });
}

// ── the round-trip: stats + level survive exportWorld → importWorld ───────────

test('U629-roundtrip: an enemy retains stats + level through export → import', () => {
  const before = worldInCombat();
  const eBefore = before.combat.enemies[0];
  // Precondition (guards against a silent regression in beginCombat itself).
  assert.deepEqual(eBefore.stats, { MIGHT: 19, AGILITY: 8, WITS: 5, GRIT: 16, CHARM: 7 },
    'precondition: stats present before save');
  assert.equal(eBefore.level, 5, 'precondition: level present before save');

  const after = importWorld(exportWorld(before));
  const eAfter = after.combat.enemies[0];
  assert.deepEqual(eAfter.stats, { MIGHT: 19, AGILITY: 8, WITS: 5, GRIT: 16, CHARM: 7 },
    'stats stripped by the save/load re-normalize');
  assert.equal(eAfter.level, 5, 'level stripped by the save/load re-normalize');
});

// ── the invariant accepts the real block through the trip (assertWorldInvariants
//    runs inside ensureWorld, which importWorld calls) ──────────────────────────

test('U629-invariant: a saved world with a stat-bearing enemy passes ensureWorld', () => {
  const before = worldInCombat();
  // importWorld → ensureWorld → assertWorldInvariants; must not throw.
  assert.doesNotThrow(() => importWorld(exportWorld(before)),
    'the ENSURE-STATS-1 invariant rejected a legitimate saved enemy');
});

// ── the round-trip is hash-stable (a saved-then-loaded world equals a re-derived
//    one — the fields ride combat state deterministically) ─────────────────────

test('U629-det: a saved→loaded world has the same worldHash as a fresh ensureWorld', () => {
  const before = worldInCombat();
  const loaded = importWorld(exportWorld(before));
  assert.equal(worldHash(loaded), worldHash(ensureWorld(before)),
    'save/load perturbed the worldHash relative to a plain re-normalize');
});
