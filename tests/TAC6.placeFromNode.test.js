import test from 'node:test';
import assert from 'node:assert/strict';
import { placeModelFromNode, tierForNode } from '../public/map/placeFromNode.js';

function world() {
  return {
    meta: { seed: 'world1', homeNodeId: 'home' },
    map: {
      currentNodeId: 'home',
      nodes: [
        { id: 'home', x: 0, y: 0, nodeType: 'wilderness', settlement: { population: 120, npcs: [1, 2, 3] } },
        { id: 'near', x: 3, y: 1, nodeType: 'wilderness' },
        { id: 'far', x: 16, y: 9, nodeType: 'wilderness' },
        { id: 'town', x: 1, y: 1, settlement: { population: 500, npcs: [1, 2, 3, 4, 5, 6, 7] } }
      ]
    }
  };
}

test('TAC6: tier rises with distance from home (geographic danger)', () => {
  const w = world();
  const home = w.map.nodes[0], near = w.map.nodes[1], far = w.map.nodes[2];
  assert.equal(tierForNode(w, home), 1, 'home is safe');
  assert.ok(tierForNode(w, far) > tierForNode(w, near), 'the edges are deadlier');
  assert.equal(tierForNode(w, far), 4, 'the far reaches are elite tier');
});

test('TAC6: a node becomes a walkable place model', () => {
  const w = world();
  const p = placeModelFromNode(w, 'far');
  assert.ok(p && Array.isArray(p.buildings) && Array.isArray(p.tokens));
  assert.ok(p.tokens.some(t => t.type === 'player'));
  assert.equal(p.tier, 4);
});

test('TAC6: a large settlement generates a town; wilderness generates wild', () => {
  const w = world();
  assert.equal(placeModelFromNode(w, 'town').nodeType, 'town');
  assert.equal(placeModelFromNode(w, 'far').nodeType, 'wild');
});

test('TAC6: deterministic, and null for an unknown node', () => {
  const w = world();
  assert.deepEqual(placeModelFromNode(w, 'near'), placeModelFromNode(w, 'near'));
  assert.equal(placeModelFromNode(w, 'nope'), null);
});
