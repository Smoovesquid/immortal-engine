// Save version mismatch regression test
import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSlot, saveSlot } from '../engine/save.js';
import { WORLD_VERSION, ensureWorld } from '../engine/state.js';

// Minimal in-memory storage mock
function mockStorage() {
  const data = {};
  return {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

test('save version check: current version round-trips cleanly', () => {
  const storage = mockStorage();
  const world = ensureWorld({ meta: { seed: 'test', fate: 0.5 } });
  saveSlot(storage, world, 'slot1');
  const loaded = loadSlot(storage, 'slot1');
  assert.equal(loaded.meta.version, WORLD_VERSION);
});

test('save version check: warns on old version (captured via console.warn)', () => {
  const storage = mockStorage();
  // Simulate a save from an older version
  const oldWorld = { meta: { version: 5, seed: 'old', fate: 0.3 } };
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(oldWorld));

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const loaded = loadSlot(storage, 'slot1');
    assert.ok(loaded, 'should still load successfully');
    assert.equal(loaded.meta.version, WORLD_VERSION, 'ensureWorld should upgrade version');
    assert.ok(warnings.length > 0, 'should have logged a warning');
    assert.ok(warnings[0].includes('v5'), 'warning should mention old version');
    assert.ok(warnings[0].includes(`v${WORLD_VERSION}`), 'warning should mention current version');
  } finally {
    console.warn = origWarn;
  }
});

test('save version check: no warning when version matches', () => {
  const storage = mockStorage();
  const world = ensureWorld({ meta: { seed: 'current', fate: 0.5 } });
  saveSlot(storage, world, 'slot1');

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    loadSlot(storage, 'slot1');
    assert.equal(warnings.length, 0, 'should not warn when version matches');
  } finally {
    console.warn = origWarn;
  }
});

test('save preserves settlement NPC depth data through round-trip', () => {
  const storage = mockStorage();
  const world = ensureWorld({ meta: { seed: 'depth-test', fate: 0.4 } });
  // Add a settlement with deep NPC data to a map node
  const deepNpc = {
    name: 'Elder Voss',
    role: 'representative',
    personality: { honesty: 0.8, trustOfOutsiders: 0.5, selfPreservation: 0.3 },
    knowledgeGraph: [{ factId: 'war_era1', source: 'witnessed', confidence: 0.9 }],
    relationships: [{ npcIndex: 1, bond: 0.6 }],
    secrets: ['corruption_scar_era3'],
    playerRelationship: { trust: 0.5, interactions: 3 }
  };
  const withSettlement = {
    ...world,
    map: {
      ...world.map,
      nodes: [{
        id: 'town1',
        name: 'Ashvale',
        nodeType: 'settlement',
        settlement: {
          decompressed: true,
          npcs: [deepNpc],
          factions: [{ id: 'guild', hostility: 20 }]
        }
      }]
    }
  };

  saveSlot(storage, withSettlement, 'slot1');
  const loaded = loadSlot(storage, 'slot1');

  const loadedNode = loaded.map.nodes.find(n => n.id === 'town1');
  assert.ok(loadedNode?.settlement, 'settlement should survive save/load');
  assert.ok(loadedNode.settlement.decompressed, 'decompressed flag should survive');
  const loadedNpc = loadedNode.settlement.npcs[0];
  assert.ok(loadedNpc.personality, 'personality should survive save/load');
  assert.equal(loadedNpc.personality.honesty, 0.8);
  assert.ok(loadedNpc.knowledgeGraph?.length > 0, 'knowledge graph should survive');
  assert.deepEqual(loadedNpc.secrets, ['corruption_scar_era3']);
  assert.equal(loadedNpc.playerRelationship.trust, 0.5);
});
