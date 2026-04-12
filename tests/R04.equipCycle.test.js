// R04 — Equip cycle: add item, equip, save, load, worldHash stable.
//
// Asserts that the new addItem/equipItem/unequipItem/removeItemById
// delta ops work correctly and that equip state survives save/load
// with a stable worldHash.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

function mkWorld(seedKey) {
  let w = newWorld({ seed: `r04-${seedKey}`, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 14, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 10 }
    }],
    scene: { location: 'town', objective: 'test', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

test('R04-01: addItem places item in inventory.items', () => {
  let w = mkWorld('add');
  w = applyDeltas(w, [{
    op: 'addItem', entityId: 'party',
    item: { id: 'sword_1', defRef: 'longsword', equipped: null }
  }]);
  const items = w.party[0].inventory.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'sword_1');
  assert.equal(items[0].defRef, 'longsword');
  assert.equal(items[0].equipped, null);
});

test('R04-02: addItem rejects duplicates by id', () => {
  let w = mkWorld('dupe');
  w = applyDeltas(w, [
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'longsword' } },
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'shortsword' } }
  ]);
  assert.equal(w.party[0].inventory.items.length, 1);
  assert.equal(w.party[0].inventory.items[0].defRef, 'longsword');
});

test('R04-03: equipItem sets equipped slot', () => {
  let w = mkWorld('equip');
  w = applyDeltas(w, [
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'longsword' } },
    { op: 'equipItem', entityId: 'party', itemId: 'sword_1', slot: 'main_hand' }
  ]);
  assert.equal(w.party[0].inventory.items[0].equipped, 'main_hand');
});

test('R04-04: equipItem unequips previous item in same slot', () => {
  let w = mkWorld('swap');
  w = applyDeltas(w, [
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'longsword' } },
    { op: 'addItem', entityId: 'party', item: { id: 'sword_2', defRef: 'shortsword' } },
    { op: 'equipItem', entityId: 'party', itemId: 'sword_1', slot: 'main_hand' },
    { op: 'equipItem', entityId: 'party', itemId: 'sword_2', slot: 'main_hand' }
  ]);
  const items = w.party[0].inventory.items;
  const s1 = items.find(it => it.id === 'sword_1');
  const s2 = items.find(it => it.id === 'sword_2');
  assert.equal(s1.equipped, null, 'previous weapon unequipped');
  assert.equal(s2.equipped, 'main_hand', 'new weapon equipped');
});

test('R04-05: unequipItem clears equipped field', () => {
  let w = mkWorld('unequip');
  w = applyDeltas(w, [
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'longsword' } },
    { op: 'equipItem', entityId: 'party', itemId: 'sword_1', slot: 'main_hand' },
    { op: 'unequipItem', entityId: 'party', itemId: 'sword_1' }
  ]);
  assert.equal(w.party[0].inventory.items[0].equipped, null);
});

test('R04-06: removeItemById removes item from inventory', () => {
  let w = mkWorld('remove');
  w = applyDeltas(w, [
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'longsword' } },
    { op: 'addItem', entityId: 'party', item: { id: 'pot_1', defRef: 'healing_potion_minor' } },
    { op: 'removeItemById', entityId: 'party', itemId: 'sword_1' }
  ]);
  const items = w.party[0].inventory.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'pot_1');
});

test('R04-07: equip → save → load → worldHash stable', () => {
  let w = mkWorld('hash');
  w = applyDeltas(w, [
    { op: 'addItem', entityId: 'party', item: { id: 'sword_1', defRef: 'longsword' } },
    { op: 'addItem', entityId: 'party', item: { id: 'armor_1', defRef: 'leather_armor' } },
    { op: 'equipItem', entityId: 'party', itemId: 'sword_1', slot: 'main_hand' },
    { op: 'equipItem', entityId: 'party', itemId: 'armor_1', slot: 'armor' }
  ]);
  const hashBefore = worldHash(w);

  // Roundtrip through export/import
  const json = exportWorld(w);
  const loaded = importWorld(json);
  const hashAfter = worldHash(loaded);

  assert.equal(hashBefore, hashAfter, 'worldHash must be stable across save/load');

  // Items survive roundtrip
  const items = loaded.party[0].inventory.items;
  assert.equal(items.length, 2);
  const sword = items.find(it => it.id === 'sword_1');
  assert.equal(sword.equipped, 'main_hand');
  const armor = items.find(it => it.id === 'armor_1');
  assert.equal(armor.equipped, 'armor');
});

test('R04-08: legacy removeItem (string-based) still works', () => {
  let w = mkWorld('legacy');
  w = applyDeltas(w, [
    { op: 'createItem', entityId: 'party', bucket: 'weapons', item: { name: 'Rusty Blade', tags: ['weapon'], weight: 2 } },
    { op: 'removeItem', entityId: 'party', bucket: 'weapons', itemName: 'Rusty Blade' }
  ]);
  assert.equal(w.party[0].inventory.weapons.length, 0);
});
