import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['A'],
    starterObjectives: ['O1'],
    locations: ['A','B','C'],
    objectives: ['O1','O2','O3'],
    sensoryMotifs: ['m'],
    skills: []
  }
};

test('newScene rotates locations deterministically and avoids consecutive repeats', () => {
  const w0 = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);
  const s1 = newScene(a.world, packsById);
  const s2 = newScene(s1.world, packsById);

  assert.notEqual(s1.world.scene.location, a.world.scene.location);
  assert.notEqual(s2.world.scene.location, s1.world.scene.location);

  // deterministic with same seed
  const a2 = beginAdventure(w0, packsById);
  const t1 = newScene(a2.world, packsById);
  const t2 = newScene(t1.world, packsById);
  assert.equal(s1.world.scene.location, t1.world.scene.location);
  assert.equal(s2.world.scene.location, t2.world.scene.location);
});
