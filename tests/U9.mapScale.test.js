import test from 'node:test';
import assert from 'node:assert/strict';

import { generateInitialMap } from '../engine/map/generateMap.js';

const pack = { locations: Array.from({ length: 20 }, (_, i) => `L${i+1}`) };

test('U9: can generate a 200-node map deterministically (override) with stable edges', () => {
  const a = generateInitialMap({ seed: 'U9-seed', packId: 'fantasy', pack, nodeCountOverride: 200 });
  const b = generateInitialMap({ seed: 'U9-seed', packId: 'fantasy', pack, nodeCountOverride: 200 });

  assert.equal(a.nodes.length, 200);
  assert.equal(b.nodes.length, 200);

  // Determinism
  assert.deepEqual(a.nodes, b.nodes);
  assert.deepEqual(a.edges, b.edges);

  // Basic structure invariants
  assert.ok(a.currentNodeId);
  assert.ok(Array.isArray(a.discovered));
  assert.equal(a.discovered[0], a.currentNodeId);

  // Edge uniqueness (undirected)
  const seen = new Set();
  for (const e of a.edges) {
    const key = [e.a, e.b].sort().join('|');
    assert.ok(!seen.has(key), `duplicate edge: ${key}`);
    seen.add(key);
  }
});
