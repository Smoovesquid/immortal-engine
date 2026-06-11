import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove, newScene } from '../engine/playloop.js';
import { ensureMap } from '../engine/map/mapState.js';

// v20 free-roam: walk the avatar tile by tile onto a node's cell to "enter" it.
function walkToNode(w, packs, targetId) {
  for (let i = 0; i < 100; i++) {
    const m = ensureMap(w.map);
    const target = m.nodes.find(n => String(n.id) === String(targetId));
    const { x, y } = m.pos;
    if (x === target.x && y === target.y) break;
    const cmd = (target.x !== x)
      ? (target.x > x ? 'go east' : 'go west')
      : (target.y > y ? 'go south' : 'go north');
    w = playerMove(w, packs, cmd).world;
  }
  return w;
}

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('U50: S3 node entry materializes generated structures once per node (id-based, deterministic)', () => {
  let w = ensureWorld({
    meta: { seed: 'struct-demo' },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [
        { id: 'n0', name: 'Start', tags: ['structure:demo'] },
        { id: 'n1', name: 'North', tags: [] }
      ],
      edges: [{ a: 'n0', b: 'n1' }],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });

  const ids = () => Object.keys(w.structures?.byId || {}).sort();

  // Walk to n1 => n1 structures materialize on arrival
  w = walkToNode(w, packsById, 'n1');
  assert.equal(w.map.currentNodeId, 'n1');
  assert.deepEqual(ids(), ['stgen:v26:n1:0']);

  // Re-enter n1 via newScene (from n1, dest should be n0; then back to n1)
  w = newScene(w, packsById).world;
  assert.equal(w.map.currentNodeId, 'n0');
  assert.deepEqual(ids().sort(), ['stgen:v26:n0:0', 'stgen:v26:n1:0']);

  // Walk back to n1. Should NOT add a duplicate n1 structure.
  w = walkToNode(w, packsById, 'n1');
  assert.equal(w.map.currentNodeId, 'n1');
  assert.deepEqual(ids().sort(), ['stgen:v26:n0:0', 'stgen:v26:n1:0']);
});
