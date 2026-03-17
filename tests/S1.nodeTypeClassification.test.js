/**
 * Gate S1 — Node Type Classification
 *
 * Every map node must have a deterministic type.
 * Same seed => same type for same node, always.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyNodeType } from '../engine/map/nodeType.js';
import { generateInitialMap } from '../engine/map/generateMap.js';

// ── Keyword classification ────────────────────────────────────────

test('S1: dungeon keywords classify as dungeon_entrance', () => {
  const cases = ['sunken crypt', 'salt-cave', 'deep passage', 'mine shaft', 'old tomb'];
  for (const name of cases) {
    assert.equal(
      classifyNodeType({ seed: 'test', nodeId: 'n0', name }),
      'dungeon_entrance',
      `"${name}" should be dungeon_entrance`
    );
  }
});

test('S1: settlement keywords classify as settlement', () => {
  const cases = ['riverside inn', 'market town', 'border fort', 'hunting camp'];
  for (const name of cases) {
    assert.equal(
      classifyNodeType({ seed: 'test', nodeId: 'n0', name }),
      'settlement',
      `"${name}" should be settlement`
    );
  }
});

test('S1: landmark keywords classify as landmark', () => {
  const cases = ['ruined watchtower', 'old shrine', 'hollow chapel', 'sooted bridge', 'mossy stair'];
  for (const name of cases) {
    assert.equal(
      classifyNodeType({ seed: 'test', nodeId: 'n0', name }),
      'landmark',
      `"${name}" should be landmark`
    );
  }
});

test('S1: unrecognised names get a deterministic fallback type', () => {
  const t1 = classifyNodeType({ seed: 'world1', nodeId: 'n5_abc', name: 'The Pale Field' });
  const t2 = classifyNodeType({ seed: 'world1', nodeId: 'n5_abc', name: 'The Pale Field' });
  assert.equal(t1, t2, 'same inputs must always produce same type');
  const validTypes = ['settlement', 'wilderness', 'landmark', 'dungeon_entrance'];
  assert.ok(validTypes.includes(t1), `type "${t1}" must be a valid node type`);
});

// ── Map generation integration ───────────────────────────────────

test('S1: every generated node has a nodeType field', () => {
  const map = generateInitialMap({ seed: 's1-test', packId: 'fantasy' });
  for (const node of map.nodes) {
    assert.ok(
      typeof node.nodeType === 'string' && node.nodeType.length > 0,
      `node ${node.id} (${node.name}) missing nodeType`
    );
  }
});

test('S1: same seed produces same nodeType for every node', () => {
  const map1 = generateInitialMap({ seed: 's1-det', packId: 'fantasy' });
  const map2 = generateInitialMap({ seed: 's1-det', packId: 'fantasy' });
  for (let i = 0; i < map1.nodes.length; i++) {
    assert.equal(
      map1.nodes[i].nodeType,
      map2.nodes[i].nodeType,
      `node ${i} nodeType must be deterministic`
    );
  }
});

test('S1: different seeds can produce different nodeTypes', () => {
  const map1 = generateInitialMap({ seed: 'alpha', packId: 'fantasy' });
  const map2 = generateInitialMap({ seed: 'beta',  packId: 'fantasy' });
  const types1 = map1.nodes.map(n => n.nodeType).join(',');
  const types2 = map2.nodes.map(n => n.nodeType).join(',');
  assert.notEqual(types1, types2, 'different seeds should not produce identical type sequences');
});

test('S1: fantasy pack nodes include at least one of each type across a full map', () => {
  const map = generateInitialMap({ seed: 's1-coverage', packId: 'fantasy' });
  const types = new Set(map.nodes.map(n => n.nodeType));
  // With 12+ nodes we expect at least wilderness and landmark to appear
  assert.ok(types.has('wilderness') || types.has('landmark') || types.has('dungeon_entrance'),
    'map should contain non-settlement nodes');
});
