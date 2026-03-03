import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { ensureMap, neighbors, seeNode } from '../engine/map/mapState.js';

test('U43: Map rumor reveal — marks nodes as seen without travel, time change, or timeline events', () => {
  const seed = 'u43_rumor_reveal_seed';
  const w0 = newWorld({
    seed,
    fate: 0.3,
    campaignId: 'c1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const m0 = ensureMap(w0.map);
  const here0 = m0.currentNodeId;
  const turn0 = w0.time.turn;
  const tl0 = w0.timeline.length;

  const nbs = neighbors(m0, here0);
  const dest = (nbs && nbs.length)
    ? nbs[0]
    : (m0.nodes.find(n => n && n.id && n.id !== here0)?.id || "");
  assert.ok(dest && dest !== here0, "no node available to reveal");

  const w1 = seeNode(w0, dest);
  const m1 = ensureMap(w1.map);

  assert.equal(m1.currentNodeId, here0, 'seeNode must not change currentNodeId');
  assert.equal(w1.time.turn, turn0, 'seeNode must not change time');
  assert.equal(w1.timeline.length, tl0, 'seeNode must not add timeline events');

  // Keep invariant: discovered[0] must remain currentNodeId.
  assert.equal(m1.discovered[0], here0, 'discovered[0] must remain currentNodeId');

  // But dest is now known/seen.
  assert.ok(m1.discovered.includes(dest), 'revealed node not added to discovered');
  assert.ok(m1.memory.seenNodeIds.includes(dest), 'revealed node not added to memory.seenNodeIds');
  assert.equal(m1.memory.seenTurnByNodeId[dest], turn0, 'seenTurn not stamped at reveal');

  // Visiting is distinct: rumor reveal must not stamp visited.
  assert.equal(m1.memory.visitedTurnByNodeId[dest], undefined, 'visitedTurn must not be stamped by rumor reveal');
});
