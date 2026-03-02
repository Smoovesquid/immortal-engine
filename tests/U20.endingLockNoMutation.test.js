import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { triggerEnding } from '../engine/ending.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key']
  }
};

test('U20: ending locked => no further state mutation from play surfaces', () => {
  const w0 = newWorld({ seed: 'u20-seed', fate: 0.9, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let w = beginAdventure(w0, packsById).world;

  // Force deterministic ending trigger via legacy gate (dread >= 8).
  w = { ...w, clocks: { ...w.clocks, dread: 8 } };
  w = triggerEnding(w);

  assert.equal(Boolean(w.ending?.triggered), true, 'expected ending to be triggered');
  assert.equal(Boolean(w.ending?.locked), true, 'expected ending to be locked');

  const before = w;

  const afterMove = playerMove(w, packsById, 'I keep going anyway.').world;
  const afterScene = newScene(w, packsById).world;

  // Gate III.2: after ending, no additional mutation allowed.
  assert.deepEqual(afterMove, before, 'playerMove must not mutate world after ending is locked');
  assert.deepEqual(afterScene, before, 'newScene must not mutate world after ending is locked');
});
