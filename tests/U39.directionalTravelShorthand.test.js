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

test('U39: "go north" travels to deterministic neighbor[0] and syncs scene.location', () => {
  const w0 = newWorld({ seed: 'u39', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);

  const m0 = ensureMap(a.world.map);
  const nbs = neighbors(m0, m0.currentNodeId);
  assert.ok(nbs.length >= 1, 'must have at least one neighbor');

  const t1 = playerMove(a.world, packsById, 'go north');
  const m1 = ensureMap(t1.world.map);

  assert.equal(m1.currentNodeId, nbs[0], 'north selects neighbor[0]');
  const here = m1.nodes.find(n => n.id === m1.currentNodeId);
  assert.equal(String(t1.world.scene.location), String(here?.name || ''), 'scene.location syncs to map node name');
});

test('U39b: "exit" with no named destination travels to deterministic neighbor[0]', () => {
  const w0 = newWorld({ seed: 'u39b', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);

  const m0 = ensureMap(a.world.map);
  const nbs = neighbors(m0, m0.currentNodeId);
  assert.ok(nbs.length >= 1, 'must have at least one neighbor');

  const t1 = playerMove(a.world, packsById, 'exit');
  const m1 = ensureMap(t1.world.map);

  assert.equal(m1.currentNodeId, nbs[0], 'exit selects neighbor[0]');
});
