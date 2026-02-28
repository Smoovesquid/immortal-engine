import test from 'node:test';
import assert from 'node:assert/strict';

import { generateInitialMap } from '../engine/map/generateMap.js';
import { newWorld } from '../engine/state.js';
import { exportWorld, importWorld } from '../engine/save.js';

const pack = { locations: ['A', 'B', 'C', 'D', 'E', 'F'] };

test('map deterministic: same seed + packId => same nodes/edges', () => {
  const a = generateInitialMap({ seed: 'seed', packId: 'fantasy', pack });
  const b = generateInitialMap({ seed: 'seed', packId: 'fantasy', pack });
  assert.deepEqual(a.nodes, b.nodes);
  assert.deepEqual(a.edges, b.edges);
});

test('map discovery persists across save roundtrip', () => {
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, map: generateInitialMap({ seed: w.meta.seed, packId: 'fantasy', pack }) };
  const s = exportWorld(w);
  const w2 = importWorld(s);
  assert.ok(Array.isArray(w2.map.discovered));
  assert.ok(w2.map.discovered.length >= 1);
});
