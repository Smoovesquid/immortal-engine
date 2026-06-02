import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { ensureMap } from '../engine/map/mapState.js';
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

// v20 free-roam: reaching n1 means walking the avatar onto its cell, one tile per
// move. The path is a pure function of the (deterministic) embedding, so the step
// sequence is identical across runs.
function walkToNode(w, targetId) {
  for (let i = 0; i < 100; i++) {
    const m = ensureMap(w.map);
    const target = m.nodes.find(n => String(n.id) === String(targetId));
    const { x, y } = m.pos;
    if (x === target.x && y === target.y) break;
    const cmd = (target.x !== x)
      ? (target.x > x ? 'go east' : 'go west')
      : (target.y > y ? 'go south' : 'go north');
    w = playerMove(w, packsById, cmd).world;
  }
  return w;
}

function runTranscript() {
  let w = buildWorld();
  w = walkToNode(w, 'n1');
  for (const text of ['wait', 'wait']) {
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
