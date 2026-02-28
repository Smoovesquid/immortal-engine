import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('scene references remain deterministic across same seed + inputs', () => {
  const w0 = newWorld({ seed: 'abc', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });

  const a1 = beginAdventure(w0, packsById);
  const a2 = beginAdventure(w0, packsById);
  assert.equal(a1.output.narration, a2.output.narration);
  assert.equal(a1.output.mechanics, a2.output.mechanics);

  const s1 = newScene(a1.world, packsById);
  const s2 = newScene(a2.world, packsById);
  assert.equal(s1.output.narration, s2.output.narration);
  assert.equal(s1.output.mechanics, s2.output.mechanics);

  // Basic sanity: narration should mention current location.
  assert.ok(s1.output.narration.toLowerCase().includes(s1.world.scene.location.toLowerCase()));
});
