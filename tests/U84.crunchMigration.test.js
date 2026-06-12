import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSlot } from '../engine/save.js';
import { WORLD_VERSION } from '../engine/state.js';

// U84 — Pass T1 v15 → v16 save migration.
//
// A synthetic v15 save (pre-crunch: party member has no level/xp/
// foci/purse/items/spells fields) must load via loadSlot() without
// throwing. The loaded world must carry version 16 and all crunch
// defaults populated on party[0].

function mkStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

test('U84-01: loading a v15 save upgrades to v16 with crunch defaults', () => {
  const v15Save = {
    meta: { version: 15, seed: 'u84', fate: 0.2, campaignId: 'c' },
    party: [
      {
        id: 'party',
        name: 'OldHero',
        archetype: 'Wanderer',
        stats: { MIGHT: 12, AGILITY: 10, WITS: 11, GRIT: 10, CHARM: 9 },
        inventory: {
          weapons: ['rusty knife'], armor: [], tools: [], clothes: [],
          spells: [], tech: [], oddities: [], consumables: [], junk: []
          // NOTE: no `items`, no `spells` block, no level/xp/foci/purse
        }
      }
    ]
  };
  const storage = mkStorage();
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(v15Save));

  // Capture the version warning without polluting test output
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  let loaded;
  try {
    loaded = loadSlot(storage, 'slot1');
  } finally {
    console.warn = origWarn;
  }

  assert.ok(loaded, 'loadSlot must return a world');
  assert.equal(loaded.meta.version, WORLD_VERSION);
  assert.equal(loaded.meta.version, 27);

  // Warning mentioned both versions
  assert.ok(warnings.length > 0, 'expected a version-mismatch warning');
  assert.ok(warnings[0].includes('v15'));
  assert.ok(warnings[0].includes('v27'));

  const member = loaded.party[0];
  assert.equal(member.level, 1);
  assert.equal(member.xp, 0);
  assert.deepEqual(member.foci, []);
  assert.deepEqual(member.purse, { copper: 0, silver: 0, gold: 0, platinum: 0 });
  assert.deepEqual(member.inventory.items, []);
  // Existing inventory category preserved
  assert.deepEqual(member.inventory.weapons, ['rusty knife']);
  // Spells defaulted
  assert.deepEqual(member.spells.known, []);
  assert.deepEqual(member.spells.slots,    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(member.spells.maxSlots, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.equal(member.spells.concentration, null);
});

test('U84-02: v15 save with wounds at the legacy cap of 6 still loads cleanly', () => {
  // Pre-T1 static cap was 6. maxWounds(1, 0) = 6 — backward compatible.
  const v15Save = {
    meta: { version: 15, seed: 'u84-b', fate: 0.2, campaignId: 'c' },
    party: [{
      id: 'party',
      name: 'Scarred',
      wounds: 6,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }
    }]
  };
  const storage = mkStorage();
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(v15Save));
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const loaded = loadSlot(storage, 'slot1');
    assert.equal(loaded.party[0].wounds, 6);
    assert.equal(loaded.meta.version, 27);
  } finally {
    console.warn = origWarn;
  }
});
