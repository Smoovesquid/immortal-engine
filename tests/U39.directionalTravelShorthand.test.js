import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { ensureMap, neighbors } from '../engine/map/mapState.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('U39: "go north" triggers inter-node travel to a neighboring node', () => {
  const w0 = newWorld({ seed: 'u39', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);
  // Pass H — leave the home interior so directional shorthand resolves to
  // inter-node travel rather than interior room navigation.
  let outside = a.world;
  if (outside.scene?.interior) {
    outside = playerMove(outside, packsById, 'leave the house').world;
  }

  const m0 = ensureMap(outside.map);
  const startNode = m0.currentNodeId;
  const nbs = neighbors(m0, startNode);

  const t1 = playerMove(outside, packsById, 'go north');
  const m1 = ensureMap(t1.world.map);

  // Bare directionals route to inter-node travel (free movement intent).
  // If neighbors exist, should move to one; if not, stays put.
  if (nbs.length > 0) {
    assert.notEqual(m1.currentNodeId, startNode, 'node should change — go north is inter-node travel');
    assert.ok(nbs.includes(m1.currentNodeId), 'must travel to an adjacent node');
  }
});

test('U39b: "exit" with no named destination travels to deterministic neighbor[0]', () => {
  const w0 = newWorld({ seed: 'u39b', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);
  // Pass H — leave the home interior so the bare "exit" verb resolves to
  // inter-node travel rather than interior exit.
  let outside = a.world;
  if (outside.scene?.interior) {
    outside = playerMove(outside, packsById, 'leave the house').world;
  }

  const m0 = ensureMap(outside.map);
  const nbs = neighbors(m0, m0.currentNodeId);
  assert.ok(nbs.length >= 1, 'must have at least one neighbor');

  const t1 = playerMove(outside, packsById, 'exit');
  const m1 = ensureMap(t1.world.map);

  assert.equal(m1.currentNodeId, nbs[0], 'exit selects neighbor[0]');
});
