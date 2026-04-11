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

test('U37: explore intent surfaces exits deterministically and does not travel', () => {
  const w0 = newWorld({ seed: 'u37', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);
  // Pass H — leave the home interior so explore reports node-graph exits
  // (the gate's contract) rather than interior room exits.
  let outside = a.world;
  if (outside.scene?.interior) {
    outside = playerMove(outside, packsById, 'leave the house').world;
  }

  const m0 = ensureMap(outside.map);
  const here0 = String(m0.currentNodeId || '');
  const nbs = neighbors(m0, here0);
  assert.ok(nbs.length > 0, 'precondition: map should have neighbors');

  const nbNode = m0.nodes.find(n => n && n.id === nbs[0]);
  const nbName = String(nbNode?.name || '').trim();
  assert.ok(nbName, 'precondition: neighbor should have a name');

  const t1 = playerMove(outside, packsById, 'Look around.');
  const m1 = ensureMap(t1.world.map);
  const here1 = String(m1.currentNodeId || '');

  assert.equal(here1, here0, 'exploration must not move currentNodeId');
  assert.ok(String(t1.output?.narration || '').includes('Exits:'), 'output should include Exits:');
  assert.ok(String(t1.output?.narration || '').includes(nbName), 'output should include a neighbor name');
});
