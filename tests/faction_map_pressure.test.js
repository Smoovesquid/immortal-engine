import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldTick } from '../engine/worldTick.js';
import { generateInitialMap } from '../engine/map/generateMap.js';

test('map pressure: hostile faction can scarify a node deterministically', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.map = generateInitialMap({ seed: w.meta.seed, packId: 'fantasy', pack: { locations: ['A','B','C','D'] } });

  // Ensure map has at least one node.
  assert.ok(w.map?.nodes?.length >= 1);

  // Force hostility.
  w.factions = [{ id: 'shadow', goal: 'Exploit', pressure: 90, assets: [], hostility: 95, lastMove: 'strike' }];

  const before = JSON.stringify(w.map.nodes);
  const w2 = worldTick(w, 'S');
  const after = JSON.stringify(w2.map.nodes);

  // Some node should have gained at least one scar.
  assert.notEqual(after, before);
  assert.ok(w2.map.nodes.some(n => Array.isArray(n.scars) && n.scars.length >= 1));
});
