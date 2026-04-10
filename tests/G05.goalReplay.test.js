import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { createGoal } from '../engine/goals/goalContract.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function buildWorld() {
  let w = ensureWorld({
    meta: { seed: 'g05-replay' },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [
        { id: 'n0', name: 'Start', tags: [] },
        { id: 'n1', name: 'North', tags: [] }
      ],
      edges: [{ a: 'n0', b: 'n1' }],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
  w = createGoal(w, { kind: 'reach', targetRef: 'n1', label: 'Reach North' }).world;
  return w;
}

const TRANSCRIPT = [
  'travel to North',
  'wait',
  'wait'
];

function runTranscript() {
  let w = buildWorld();
  for (const text of TRANSCRIPT) {
    w = playerMove(w, packsById, text).world;
  }
  return w;
}

test('G05: deterministic transcript that completes a reach goal yields identical worldHash across runs', () => {
  const w1 = runTranscript();
  const w2 = runTranscript();

  // Goal completed in both runs.
  assert.equal(w1.goals[0].status, 'completed');
  assert.equal(w2.goals[0].status, 'completed');

  // Hash equality across replays.
  assert.equal(worldHash(w1), worldHash(w2), 'replayed worlds must hash identically');
});
