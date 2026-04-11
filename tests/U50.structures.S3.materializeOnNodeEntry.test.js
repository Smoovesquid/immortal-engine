import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove, newScene } from '../engine/playloop.js';
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

  // Travel to n1 => n1 structures materialize
  w = playerMove(w, packsById, 'travel to North').world;
  assert.equal(w.map.currentNodeId, 'n1');
  assert.deepEqual(ids(), ['stgen:v16:n1:0']);

  // Re-enter n1 via newScene (from n1, dest should be n0; then back to n1)
  w = newScene(w, packsById).world;
  assert.equal(w.map.currentNodeId, 'n0');
  assert.deepEqual(ids().sort(), ['stgen:v16:n0:0', 'stgen:v16:n1:0']);

  // Travel north again (back to n1). Should NOT add a duplicate n1 structure.
  w = playerMove(w, packsById, 'travel to North').world;
  assert.equal(w.map.currentNodeId, 'n1');
  assert.deepEqual(ids().sort(), ['stgen:v16:n0:0', 'stgen:v16:n1:0']);
});
