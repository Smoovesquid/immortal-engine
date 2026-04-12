import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { propagateRumors } from '../engine/rumor/propagate.js';
import { seedFromString, makeRng } from '../engine/rng.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function mkWorld(overrides = {}) {
  const base = newWorld({ seed: 'u74', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({ ...base, ...overrides });
}

function mkRumor(overrides = {}) {
  return {
    id: 'rumor:seed1:alice:1',
    sourceSeedId: 'seed1',
    carrierNpcId: 'alice',
    hopCount: 1,
    tier: 1,
    age: 0,
    mintedAt: 0,
    body: 'They say the old well is cursed.',
    tags: ['well', 'curse'],
    ...overrides
  };
}

function mkNpc(id, nodeId, overrides = {}) {
  return {
    id,
    name: id,
    role: 'tavern_keeper',
    rumorIds: [],
    sophistication: 2,
    conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null },
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    knowledgeGraph: [],
    witnessedEvents: [],
    secrets: [],
    playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] },
    revealedSecrets: [],
    ...overrides
  };
}

/**
 * Build a world with two connected nodes, NPCs on each, and optional rumors.
 */
function mkTwoNodeWorld({ rumors = [], aliceOverrides = {}, bobOverrides = {} } = {}) {
  const w = mkWorld();
  const nodeA = {
    id: 'nodeA',
    settlement: {
      decompressed: true,
      npcs: [mkNpc('alice', 'nodeA', aliceOverrides)]
    }
  };
  const nodeB = {
    id: 'nodeB',
    settlement: {
      decompressed: true,
      npcs: [mkNpc('bob', 'nodeB', bobOverrides)]
    }
  };
  const edges = [{ a: 'nodeA', b: 'nodeB' }];
  return ensureWorld({
    ...w,
    rumors,
    map: { ...w.map, nodes: [nodeA, nodeB], edges, currentNodeId: 'nodeA' }
  });
}

/** Create a rigged RNG that returns specified floats in sequence, then falls through to real RNG. */
function riggedRng(floats) {
  let idx = 0;
  const real = makeRng(seedFromString('rigged'));
  return {
    nextFloat() {
      if (idx < floats.length) return floats[idx++];
      return real.nextFloat();
    },
    int(min, max) {
      const f = this.nextFloat();
      return min + Math.floor(f * (max - min + 1));
    },
    pick(arr) {
      if (!arr?.length) return undefined;
      return arr[this.int(0, arr.length - 1)];
    }
  };
}

// ── U74-01: age increments on propagateRumors call ──────────────────────

test('U74-01: age increments on propagateRumors call', () => {
  const rumor = mkRumor({ age: 0 });
  const w = mkTwoNodeWorld({ rumors: [rumor] });
  const rng = makeRng(seedFromString('u74-01'));
  const { world } = propagateRumors(w, rng, { events: [] });
  assert.equal(world.rumors[0].age, 1, 'age should increment by 1');
});

// ── U74-02: rumor at age > 30 can propagate to adjacent NPC ─────────────

test('U74-02: rumor at age > 30 can propagate to adjacent NPC', () => {
  const rumor = mkRumor({ age: 30 }); // will become 31 after aging
  const w = mkTwoNodeWorld({ rumors: [rumor] });
  // Rig RNG: first float < 0.3 (propagation succeeds), then 0.0 for pick (selects bob).
  const rng = riggedRng([0.1, 0.0]);
  const { world } = propagateRumors(w, rng, { events: [] });
  assert.equal(world.rumors.length, 2, 'should have propagated a new rumor');
  const newRumor = world.rumors.find(r => r.carrierNpcId === 'bob');
  assert.ok(newRumor, 'new rumor should be carried by bob');
  assert.equal(newRumor.hopCount, rumor.hopCount + 1, 'hop count should increment');
  assert.equal(newRumor.age, 0, 'new rumor should start at age 0');
  assert.equal(newRumor.sourceSeedId, rumor.sourceSeedId, 'sourceSeedId should match');
});

// ── U74-03: rumor at age ≤ 30 does not propagate ────────────────────────

test('U74-03: rumor at age <= 30 does not propagate', () => {
  const rumor = mkRumor({ age: 24 }); // will become 25 after aging, still <= 30
  const w = mkTwoNodeWorld({ rumors: [rumor] });
  // Even with propagation-friendly RNG, age check should prevent it.
  const rng = riggedRng([0.1, 0.0]);
  const { world } = propagateRumors(w, rng, { events: [] });
  assert.equal(world.rumors.length, 1, 'should not propagate when age <= 30');
});

// ── U74-04: propagation skips NPC who already carries the rumor ─────────

test('U74-04: propagation skips NPC who already carries the rumor', () => {
  const rumor = mkRumor({ age: 30 });
  // Bob already has a rumor from the same source seed.
  const bobRumor = mkRumor({ id: 'rumor:seed1:bob:0', carrierNpcId: 'bob', age: 5 });
  const w = mkTwoNodeWorld({
    rumors: [rumor, bobRumor],
    bobOverrides: { rumorIds: [bobRumor.id] }
  });
  const rng = riggedRng([0.1, 0.0]);
  const { world } = propagateRumors(w, rng, { events: [] });
  // No new rumor should be created since bob already has one from seed1.
  const bobRumors = world.rumors.filter(r => r.carrierNpcId === 'bob');
  assert.equal(bobRumors.length, 1, 'bob should still have just one rumor from seed1');
});

// ── U74-05: rumor at age > 60 can be forgotten ─────────────────────────

test('U74-05: rumor at age > 60 can be forgotten', () => {
  const rumor = mkRumor({ age: 60 }); // will become 61 after aging
  const w = mkTwoNodeWorld({
    rumors: [rumor],
    aliceOverrides: { rumorIds: [rumor.id] }
  });
  // Rig RNG: first float >= 0.3 (propagation fails), then < 0.2 (forgetting succeeds).
  const rng = riggedRng([0.5, 0.1]);
  const { world } = propagateRumors(w, rng, { events: [] });
  assert.equal(world.rumors.length, 0, 'rumor should be forgotten');
});

// ── U74-06: propagation is deterministic ────────────────────────────────

test('U74-06: propagation is deterministic', () => {
  const rumor = mkRumor({ age: 30 });
  const w = mkTwoNodeWorld({ rumors: [rumor] });

  const seed = seedFromString('u74-06-determinism');

  const rng1 = makeRng(seed);
  const result1 = propagateRumors(w, rng1, { events: [] });

  const rng2 = makeRng(seed);
  const result2 = propagateRumors(w, rng2, { events: [] });

  assert.equal(result1.world.rumors.length, result2.world.rumors.length, 'same seed → same rumor count');
  for (let i = 0; i < result1.world.rumors.length; i++) {
    assert.equal(result1.world.rumors[i].id, result2.world.rumors[i].id, `rumor ${i} id should match`);
    assert.equal(result1.world.rumors[i].age, result2.world.rumors[i].age, `rumor ${i} age should match`);
  }
});
