import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';

// U83 — Pass T1 worldHash projection for crunch fields.
//
// The projection sorts non-load-bearing party arrays:
//   - inventory.items (by id)
//   - spells.known (lexicographic)
//   - foci (lexicographic)
// So two worlds that differ ONLY in the order of those arrays must
// hash equal. Worlds that differ in an integer field (purse.gold)
// must hash differently.

function worldWith(member) {
  const w0 = newWorld({
    seed: 'u83', fate: 0.2, campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
  return ensureWorld({ ...w0, party: [{ id: 'party', name: 'H', ...member }] });
}

const ITEM_A = { id: 'a1', defRef: 'sword:short', equipped: null };
const ITEM_B = { id: 'b1', defRef: 'shield:round', equipped: null };
const ITEM_C = { id: 'c1', defRef: 'cloak:plain', equipped: null };

test('U83-01: inventory.items reordering yields equal hash', () => {
  const wa = worldWith({
    inventory: {
      weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [],
      oddities: [], consumables: [], junk: [],
      items: [ITEM_A, ITEM_B, ITEM_C]
    }
  });
  const wb = worldWith({
    inventory: {
      weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [],
      oddities: [], consumables: [], junk: [],
      items: [ITEM_C, ITEM_A, ITEM_B]
    }
  });
  assert.equal(worldHash(wb), worldHash(wa));
});

test('U83-02: purse.gold difference yields different hash', () => {
  const wa = worldWith({ purse: { copper: 0, silver: 0, gold: 5, platinum: 0 } });
  const wb = worldWith({ purse: { copper: 0, silver: 0, gold: 6, platinum: 0 } });
  assert.notEqual(worldHash(wb), worldHash(wa));
});

test('U83-03: spells.known reordering yields equal hash', () => {
  const base = {
    spells: {
      known: ['spark', 'ward', 'light'],
      slots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      maxSlots: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      concentration: null
    }
  };
  const wa = worldWith(base);
  const wb = worldWith({
    spells: { ...base.spells, known: ['light', 'spark', 'ward'] }
  });
  assert.equal(worldHash(wb), worldHash(wa));
});

test('U83-04: foci reordering yields equal hash', () => {
  const wa = worldWith({ foci: ['athletics', 'stealth', 'arcana'] });
  const wb = worldWith({ foci: ['arcana', 'athletics', 'stealth'] });
  assert.equal(worldHash(wb), worldHash(wa));
});

test('U83-05: adding a new focus yields different hash', () => {
  const wa = worldWith({ foci: ['athletics'] });
  const wb = worldWith({ foci: ['athletics', 'stealth'] });
  assert.notEqual(worldHash(wb), worldHash(wa));
});
