import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('U43: feet-based local movement mutates localFt and does not travel nodes', () => {
  const w0 = newWorld({ seed: 'u43', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  let a0 = beginAdventure(w0, packsById).world;
  // Pass H — leave the home interior so feet-based movement (exterior-only)
  // can run.
  if (a0.scene?.interior) {
    a0 = playerMove(a0, packsById, 'leave the house').world;
  }

  const beforeNode = String(a0.map?.currentNodeId || '');
  const beforeLocation = String(a0.scene?.location || '');
  const beforeTimelineLen = Array.isArray(a0.timeline) ? a0.timeline.length : 0;
  const beforeX = Number(a0.party?.[0]?.position?.localFtX || 0);
  const beforeY = Number(a0.party?.[0]?.position?.localFtY || 0);

  const t1 = playerMove(a0, packsById, 'move 10 ft north').world;

  const afterNode = String(t1.map?.currentNodeId || '');
  const afterLocation = String(t1.scene?.location || '');
  const afterX = Number(t1.party?.[0]?.position?.localFtX || 0);
  const afterY = Number(t1.party?.[0]?.position?.localFtY || 0);

  assert.equal(afterNode, beforeNode, 'feet movement stays in current node');
  assert.equal(afterLocation, beforeLocation, 'feet movement keeps scene.location unchanged');
  assert.equal(afterX - beforeX, 0, 'north move keeps localFtX');
  assert.equal(afterY - beforeY, -10, 'north move mutates localFtY by -10');

  const deltaEvents = (t1.timeline || []).slice(beforeTimelineLen);
  const hasTravel = deltaEvents.some((e) => e?.kind === 'travel');
  const hasLocalMove = deltaEvents.some((e) => e?.kind === 'move' && e?.data?.type === 'local_move');
  assert.equal(hasTravel, false, 'feet movement emits no travel event');
  assert.equal(hasLocalMove, true, 'feet movement emits local move event');
});
