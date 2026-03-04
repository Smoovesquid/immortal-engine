import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureStructureDiscovery, edgeKey, markDiscoveredOnNode, markDiscoveredOnEdge } from '../engine/structures/discoveryState.js';

test('U48: S4 ensureStructureDiscovery normalizes and clamps', () => {
  const d = ensureStructureDiscovery({
    byNodeId: {
      'node-1': { structures: { 'st:1': 1, 'st:2': false }, lastSeenTurn: 7.9 }
    },
    byEdgeId: {
      'b|a': { structures: { 'st:e': true }, lastSeenTurn: -5 }
    }
  });

  assert.deepEqual(d.byNodeId['node-1'].structures, { 'st:1': true, 'st:2': false });
  assert.equal(d.byNodeId['node-1'].lastSeenTurn, 7);
  assert.equal(d.byEdgeId['b|a'].lastSeenTurn, 0);
});

test('U48: S4 edgeKey is canonical', () => {
  assert.equal(edgeKey('b', 'a'), 'a|b');
  assert.equal(edgeKey('a', 'b'), 'a|b');
});

test('U48: S4 markDiscoveredOnNode is deterministic and monotonic on lastSeenTurn', () => {
  const d0 = ensureStructureDiscovery(null);
  const d1 = markDiscoveredOnNode(d0, { nodeId: 'n', structureId: 's', turn: 3 });
  const d2 = markDiscoveredOnNode(d1, { nodeId: 'n', structureId: 's2', turn: 2 });

  assert.deepEqual(Object.keys(d2.byNodeId.n.structures).sort(), ['s', 's2']);
  assert.equal(d2.byNodeId.n.lastSeenTurn, 3);
});

test('U48: S4 markDiscoveredOnEdge is deterministic and monotonic on lastSeenTurn', () => {
  const d0 = ensureStructureDiscovery(null);
  const d1 = markDiscoveredOnEdge(d0, { aNodeId: 'b', bNodeId: 'a', structureId: 's', turn: 5 });
  const d2 = markDiscoveredOnEdge(d1, { aNodeId: 'a', bNodeId: 'b', structureId: 's2', turn: 4 });

  assert.ok(d2.byEdgeId['a|b']);
  assert.deepEqual(Object.keys(d2.byEdgeId['a|b'].structures).sort(), ['s', 's2']);
  assert.equal(d2.byEdgeId['a|b'].lastSeenTurn, 5);
});
