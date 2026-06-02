import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';

// U80 — Pass T1 crunch schema defaults.
// An ensureWorld() pass over an old-shape party member (no level/xp/
// foci/purse/items/spells) must produce sane defaults for every new
// crunch field. These are the defaults downstream passes (T2/T3) will
// rely on when they layer items and spells on top.

const PARTIAL_WORLD = {
  meta: { seed: 'u80', fate: 0.2, campaignId: 'c' },
  party: [
    {
      id: 'party',
      name: 'Hero',
      archetype: 'Wanderer',
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }
      // intentionally missing: level, xp, foci, purse, inventory, spells
    }
  ]
};

test('U80-01: old-shape party member gets level=1, xp=0', () => {
  const w = ensureWorld(PARTIAL_WORLD);
  assert.equal(w.party[0].level, 1);
  assert.equal(w.party[0].xp, 0);
});

test('U80-02: old-shape party member gets empty foci array', () => {
  const w = ensureWorld(PARTIAL_WORLD);
  assert.deepEqual(w.party[0].foci, []);
});

test('U80-03: old-shape party member gets all-zero purse', () => {
  const w = ensureWorld(PARTIAL_WORLD);
  assert.deepEqual(w.party[0].purse, {
    copper: 0, silver: 0, gold: 0, platinum: 0
  });
});

test('U80-04: old-shape party member gets empty inventory.items', () => {
  const w = ensureWorld(PARTIAL_WORLD);
  assert.deepEqual(w.party[0].inventory.items, []);
  // existing inventory categories remain present and empty
  assert.deepEqual(w.party[0].inventory.weapons, []);
  assert.deepEqual(w.party[0].inventory.armor, []);
});

test('U80-05: old-shape party member gets empty spells block', () => {
  const w = ensureWorld(PARTIAL_WORLD);
  const s = w.party[0].spells;
  assert.deepEqual(s.known, []);
  assert.deepEqual(s.slots, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(s.maxSlots, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.equal(s.concentration, null);
});

test('U80-06: newWorld() then ensureEntity still passes invariants with crunch defaults', () => {
  // This exercises the normal end-to-end path — no party yet, add one via
  // ensureWorld. It must not throw.
  const w = newWorld({ seed: 'u80-new', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const w2 = ensureWorld({ ...w, party: [{ id: 'party', name: 'Hero' }] });
  assert.equal(w2.party[0].level, 1);
  assert.equal(w2.party[0].wounds, 0);
});

test('U80-07: meta.version is 20 after ensureWorld', () => {
  const w = ensureWorld(PARTIAL_WORLD);
  assert.equal(w.meta.version, 20);
});
