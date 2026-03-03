import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { moveToNode, neighbors, ensureMap } from '../engine/map/mapState.js';

test('U42: moving to a node stamps visitedTurn and seenTurn deterministically', () => {
  const seed = 'u42_visit_stamp_seed';

  const packsById = {
    fantasy: {
      id: 'fantasy',
      toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
      starterLocations: ['tower'],
      starterObjectives: ['find the key'],
      skills: ['Steel']
    }
  };

  const w0 = newWorld({
    seed,
    fate: 0.2,
    campaignId: 'c1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const a = beginAdventure(w0, packsById);

  const m0 = ensureMap(a.world.map);
  const here0 = m0.currentNodeId;
  const turn0 = a.world.time.turn;

  // Initial node should be considered seen
  assert.ok(
    m0.memory.seenNodeIds.includes(here0),
    'current node must be in memory.seenNodeIds at boot'
  );

  // Pick deterministic neighbor
  const nbs = neighbors(m0, here0);
  assert.ok(nbs.length > 0, 'no neighbors to move to');
  const dest = nbs[0];

  const w1 = moveToNode(a.world, dest);
  const m1 = ensureMap(w1.map);

  const turn1 = w1.time.turn; // should not change from moveToNode alone

  assert.equal(turn1, turn0, 'moveToNode must not mutate time');

  assert.equal(
    m1.memory.visitedTurnByNodeId[dest],
    turn1,
    'visitedTurnByNodeId not stamped correctly'
  );

  assert.equal(
    m1.memory.seenTurnByNodeId[dest],
    turn1,
    'seenTurnByNodeId not stamped correctly'
  );

  assert.ok(
    m1.memory.seenNodeIds.includes(dest),
    'destination not added to seenNodeIds'
  );
});
