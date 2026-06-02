/**
 * U88 — Overworld grid embedding (v19).
 *
 * Every map node gets a stable integer grid position so the overworld has real
 * geography (and the compass can read direction from coordinates). The embedding
 * is a pure function of the graph: deterministic, integer-only, collision-free,
 * and identical whether produced fresh by generateMap or backfilled by ensureMap
 * for a pre-v19 save.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { embedNodes } from '../engine/map/embedding.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { ensureMap } from '../engine/map/mapState.js';

function sampleGraphs() {
  return [
    generateInitialMap({ seed: 'embed-a', packId: 'fantasy', pack: {} }),
    generateInitialMap({ seed: 'embed-b', packId: 'fantasy', pack: {} }),
    generateInitialMap({ seed: 'zzz', packId: 'horror', pack: {} })
  ];
}

test('U88: every node gets an integer position', () => {
  for (const map of sampleGraphs()) {
    const pos = embedNodes(map.nodes, map.edges);
    assert.equal(pos.size, map.nodes.length, 'every node placed');
    for (const n of map.nodes) {
      const p = pos.get(String(n.id));
      assert.ok(p, `missing position for ${n.id}`);
      assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y), `non-integer cell for ${n.id}`);
    }
  }
});

test('U88: no two nodes share a grid cell', () => {
  for (const map of sampleGraphs()) {
    const pos = embedNodes(map.nodes, map.edges);
    const cells = new Set([...pos.values()].map(p => `${p.x},${p.y}`));
    assert.equal(cells.size, pos.size, 'all cells unique');
  }
});

test('U88: embedding is deterministic across recomputes', () => {
  for (const map of sampleGraphs()) {
    const a = embedNodes(map.nodes, map.edges);
    const b = embedNodes(map.nodes, map.edges);
    for (const n of map.nodes) {
      assert.deepEqual(a.get(String(n.id)), b.get(String(n.id)), `unstable cell for ${n.id}`);
    }
  }
});

test('U88: embedding does not depend on node array order', () => {
  for (const map of sampleGraphs()) {
    const a = embedNodes(map.nodes, map.edges);
    const shuffled = map.nodes.slice().reverse();
    const b = embedNodes(shuffled, map.edges);
    for (const n of map.nodes) {
      assert.deepEqual(a.get(String(n.id)), b.get(String(n.id)), `order-dependent cell for ${n.id}`);
    }
  }
});

test('U88: generateMap output already carries coordinates', () => {
  for (const map of sampleGraphs()) {
    for (const n of map.nodes) {
      assert.ok(Number.isInteger(n.x) && Number.isInteger(n.y), `generateMap left ${n.id} unplaced`);
    }
  }
});

test('U88: ensureMap backfills a coordinate-less (pre-v19) save to match a fresh embed', () => {
  for (const map of sampleGraphs()) {
    // Simulate an old save: strip the positions generateMap added.
    const stripped = {
      ...map,
      nodes: map.nodes.map(({ x, y, ...rest }) => rest)
    };
    const upgraded = ensureMap(stripped);
    const fresh = embedNodes(map.nodes, map.edges);
    for (const n of upgraded.nodes) {
      const want = fresh.get(String(n.id));
      assert.deepEqual({ x: n.x, y: n.y }, want, `backfill mismatch for ${n.id}`);
    }
  }
});

test('U88: disconnected nodes still get unique cells', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'island' }];
  const edges = [{ a: 'a', b: 'b' }]; // 'island' has no edges
  const pos = embedNodes(nodes, edges);
  assert.equal(pos.size, 3);
  const cells = new Set([...pos.values()].map(p => `${p.x},${p.y}`));
  assert.equal(cells.size, 3, 'disconnected node must not collide');
});
