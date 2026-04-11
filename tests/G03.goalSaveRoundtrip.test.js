import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    starterGoals: [
      { kind: 'reach', targetRef: '__nearest_settlement__', label: 'Travel to next settlement' }
    ],
    skills: ['Steel']
  }
};

test('G03: goals survive export → import round-trip with identical hash', () => {
  // Pass H — beginAdventure no longer seeds a goal, so this gate verifies
  // the goals subsystem still survives the save round-trip with goals=[] and
  // worldHash stays stable. Goal save/load is exercised end-to-end via U61
  // (and other gates that mutate goals after begin).
  const w0 = newWorld({ seed: 'g03-roundtrip', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const w = beginAdventure(w0, packsById).world;

  assert.ok(Array.isArray(w.goals));
  assert.equal(w.goals.length, 0, 'Pass H: begin produces no goal');

  const exported = exportWorld(w);
  const imported = importWorld(exported);

  assert.deepEqual(imported.goals, w.goals);
  assert.equal(worldHash(imported), worldHash(w));
});

test('G03: an old save with no goals field defaults to []', () => {
  const w0 = newWorld({ seed: 'g03-old', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const json = exportWorld(w0);
  const parsed = JSON.parse(json);
  delete parsed.world.goals;
  const reimported = importWorld(JSON.stringify(parsed));
  assert.ok(Array.isArray(reimported.goals));
  assert.equal(reimported.goals.length, 0);
});
