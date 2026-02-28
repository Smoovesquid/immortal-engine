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

test('deterministic: same seed + same inputs -> same outputs', () => {
  const w0 = newWorld({ seed: 'abc', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a1 = beginAdventure(w0, packsById);
  const a2 = beginAdventure(w0, packsById);
  assert.deepEqual(a1.output, a2.output);

  const t1 = playerMove(a1.world, packsById, 'I take the torch.');
  const t2 = playerMove(a2.world, packsById, 'I take the torch.');
  assert.deepEqual(t1.output, t2.output);
  assert.deepEqual(t1.world.scene, t2.world.scene);
});
