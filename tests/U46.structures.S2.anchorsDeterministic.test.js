import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorToEdge, anchorToNode, anchorToCoord, normalizeAnchor } from '../engine/structures/anchors.js';

test('U46: S2 anchorToNode deterministic shape', () => {
  assert.deepEqual(anchorToNode('node-1'), { kind: 'node', nodeId: 'node-1' });
});

test('U46: S2 anchorToEdge canonical ordering', () => {
  const a = anchorToEdge('node-9', 'node-2');
  const b = anchorToEdge('node-2', 'node-9');
  assert.deepEqual(a, b);
  assert.deepEqual(a, { kind: 'edge', aNodeId: 'node-2', bNodeId: 'node-9' });
});

test('U46: S2 anchorToCoord clamps and normalizes', () => {
  const a = anchorToCoord('node-1', 1.2, -999999999);
  assert.deepEqual(a, { kind: 'coord', nodeId: 'node-1', x: 1, y: -1000000 });
});

test('U46: S2 normalizeAnchor default is node', () => {
  assert.deepEqual(normalizeAnchor({ nodeId: 'n' }), { kind: 'node', nodeId: 'n' });
});
