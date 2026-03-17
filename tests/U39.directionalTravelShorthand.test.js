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

test('U39: "go north" moves player dot locally 30ft (no node travel)', () => {
  const w0 = newWorld({ seed: 'u39', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);

  const m0 = ensureMap(a.world.map);
  const startNode = m0.currentNodeId;

  const t1 = playerMove(a.world, packsById, 'go north');
  const m1 = ensureMap(t1.world.map);

  assert.equal(m1.currentNodeId, startNode, 'node must not change — go north is local movement');
  const pos = t1.world.party?.[0]?.position || {};
  assert.equal(pos.localFtY, -30, 'localFtY must decrease by 30ft when going north');
  assert.equal(pos.localFtX, 0, 'localFtX must be unchanged');
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
