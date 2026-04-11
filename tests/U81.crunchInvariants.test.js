import test from 'node:test';
import assert from 'node:assert/strict';

import { assertWorldInvariants } from '../engine/invariants.js';
import { ensureWorld, WORLD_VERSION } from '../engine/state.js';

// U81 — Pass T1 crunch invariants throw on malformed fields.
//
// These tests bypass ensureWorld's normalization by constructing a
// well-formed world via ensureWorld first, then directly mutating a
// single field into an invalid state and calling assertWorldInvariants
// on the result. Invariants are a belt-and-suspenders check — they
// must catch shapes that slipped past the normalizer.

function baseWorld() {
  return ensureWorld({
    meta: { seed: 'u81', fate: 0.2, campaignId: 'c', version: WORLD_VERSION },
    party: [{
      id: 'party',
      name: 'Hero',
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }
    }]
  });
}

function withMember(patch) {
  const w = baseWorld();
  w.party[0] = { ...w.party[0], ...patch };
  return w;
}

test('U81-01: level = 0 throws', () => {
  const w = withMember({ level: 0 });
  assert.throws(() => assertWorldInvariants(w), /level must be integer 1..20/);
});

test('U81-02: level = 21 throws', () => {
  const w = withMember({ level: 21 });
  assert.throws(() => assertWorldInvariants(w), /level must be integer 1..20/);
});

test('U81-03: level non-integer throws', () => {
  const w = withMember({ level: 2.5 });
  assert.throws(() => assertWorldInvariants(w), /level must be integer/);
});

test('U81-04: xp = -1 throws', () => {
  const w = withMember({ xp: -1 });
  assert.throws(() => assertWorldInvariants(w), /xp must be non-negative integer/);
});

test('U81-05: foci length 7 throws', () => {
  const w = withMember({ foci: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  assert.throws(() => assertWorldInvariants(w), /foci length 7 exceeds cap 6/);
});

test('U81-06: foci containing a non-string throws', () => {
  const w = withMember({ foci: ['athletics', 42] });
  assert.throws(() => assertWorldInvariants(w), /foci entries must be non-empty strings/);
});

test('U81-07: purse.gold = -1 throws', () => {
  const w = withMember({
    purse: { copper: 0, silver: 0, gold: -1, platinum: 0 }
  });
  assert.throws(() => assertWorldInvariants(w), /purse.gold must be non-negative integer/);
});

test('U81-08: inventory.items missing defRef throws', () => {
  const base = baseWorld();
  base.party[0] = {
    ...base.party[0],
    inventory: {
      ...base.party[0].inventory,
      items: [{ id: 'item1', equipped: null }]
    }
  };
  assert.throws(() => assertWorldInvariants(base), /inventory.items\[0\].defRef must be non-empty string/);
});

test('U81-09: inventory.items missing id throws', () => {
  const base = baseWorld();
  base.party[0] = {
    ...base.party[0],
    inventory: {
      ...base.party[0].inventory,
      items: [{ defRef: 'sword:short', equipped: null }]
    }
  };
  assert.throws(() => assertWorldInvariants(base), /inventory.items\[0\].id must be non-empty string/);
});

test('U81-10: inventory.items.equipped as empty string throws', () => {
  const base = baseWorld();
  base.party[0] = {
    ...base.party[0],
    inventory: {
      ...base.party[0].inventory,
      items: [{ id: 'item1', defRef: 'sword:short', equipped: '' }]
    }
  };
  assert.throws(() => assertWorldInvariants(base), /equipped must be non-empty string or null/);
});

test('U81-11: spells.slots[1] > spells.maxSlots[1] throws', () => {
  const w = withMember({
    spells: {
      known: [],
      slots: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0 },
      maxSlots: { 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 },
      concentration: null
    }
  });
  assert.throws(() => assertWorldInvariants(w), /spells.slots\[1\] 2 exceeds maxSlots\[1\] 1/);
});

test('U81-12: spells.concentration with empty spellRef throws', () => {
  const w = withMember({
    spells: {
      known: [],
      slots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      maxSlots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      concentration: { spellRef: '', startedAt: 1 }
    }
  });
  assert.throws(() => assertWorldInvariants(w), /concentration.spellRef must be non-empty string/);
});

test('U81-13: spells.known length 21 throws', () => {
  const known = Array.from({ length: 21 }, (_, i) => `spell:${i}`);
  const w = withMember({
    spells: {
      known,
      slots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      maxSlots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      concentration: null
    }
  });
  assert.throws(() => assertWorldInvariants(w), /spells.known length 21 exceeds cap 20/);
});

test('U81-14: wounds exceeding maxWounds throws', () => {
  // level 1, GRIT 10 (mod 0) → maxWounds = 6
  const w = withMember({ level: 1, wounds: 7 });
  assert.throws(() => assertWorldInvariants(w), /wounds must be integer 0\.\.6/);
});
