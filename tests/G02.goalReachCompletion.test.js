import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { ensureMap } from '../engine/map/mapState.js';
import { createGoal, checkGoals } from '../engine/goals/goalContract.js';

// v20 free-roam: there is no teleport-to-node. Walk the avatar one tile at a time
// toward a target node's cell; landing on it triggers arrival (and goal checks).
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

test('G02: reach-goal flips to completed when player moves to target node, exactly once', () => {
  let w = ensureWorld({
    meta: { seed: 'g02-reach' },
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

  const created = createGoal(w, { kind: 'reach', targetRef: 'n1', label: 'Reach North' });
  w = created.world;
  const goalId = created.goal.id;
  assert.ok(goalId, 'createGoal must return a goal');
  assert.equal(w.goals.length, 1);
  assert.equal(w.goals[0].status, 'active');

  // Sanity: checking before move does nothing.
  const noop = checkGoals(w);
  assert.equal(noop.completed.length, 0);
  assert.equal(noop.world.goals[0].status, 'active');

  // Walk the overworld to the target cell (arrival calls checkGoals internally).
  w = walkToNode(w, packsById, 'n1');
  assert.equal(w.map.currentNodeId, 'n1');

  const g = w.goals.find(x => x.id === goalId);
  assert.ok(g, 'goal still present');
  assert.equal(g.status, 'completed');
  assert.equal(typeof g.completedAt, 'number');

  // Replay another move; status and completedAt should remain stable.
  const completedAtBefore = g.completedAt;
  w = playerMove(w, packsById, 'wait').world;
  const g2 = w.goals.find(x => x.id === goalId);
  assert.equal(g2.status, 'completed');
  assert.equal(g2.completedAt, completedAtBefore);

  // Exactly one goalCompleted event for this goal.
  const events = w.timeline.filter(e => e?.kind === 'goalCompleted' && e.data?.goalId === goalId);
  assert.equal(events.length, 1, `expected exactly one goalCompleted event, got ${events.length}`);
});
