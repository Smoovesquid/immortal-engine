import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['Roadside'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('U36: travel intent syncs scene.location to map.currentNodeId node name', () => {
  const w0 = newWorld({ seed: 'u36', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a0 = beginAdventure(w0, packsById);

  const beforeNode = String(a0.world?.map?.currentNodeId || '');
  const beforeLoc = String(a0.world?.scene?.location || '');

  const t1 = playerMove(a0.world, packsById, 'leave');
  const afterNode = String(t1.world?.map?.currentNodeId || '');
  const afterLoc = String(t1.world?.scene?.location || '');

  // If movement happened, the scene location must match the node name.
  if (afterNode && afterNode !== beforeNode) {
    const node = (t1.world?.map?.nodes || []).find(n => n && String(n.id) === afterNode) || null;
    const nodeName = String(node?.name || '');
    assert.ok(nodeName.length > 0);
    assert.equal(afterLoc, nodeName);
    assert.notEqual(afterLoc, beforeLoc);
  } else {
    // If no movement (edge case), the invariant still must hold (scene is consistent with node).
    const node = (t1.world?.map?.nodes || []).find(n => n && String(n.id) === afterNode) || null;
    const nodeName = String(node?.name || '');
    if (nodeName) assert.equal(afterLoc, nodeName);
  }
});
