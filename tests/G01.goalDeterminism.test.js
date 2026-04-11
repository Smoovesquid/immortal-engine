import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';

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

// Pass H — beginAdventure no longer seeds an initial goal. The player wakes
// in their home bedroom with no quest; quests are discovered by venturing out.
// G01 now asserts the new contract: begin produces an empty goals array, and
// the empty state is reproducible across runs (still deterministic).

test('G01: same seed + same pack produces the same (empty) initial goals', () => {
  const seed = 'g01-determinism';

  const w1 = beginAdventure(
    newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } }),
    packsById
  ).world;

  const w2 = beginAdventure(
    newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } }),
    packsById
  ).world;

  assert.ok(Array.isArray(w1.goals), 'goals must be an array');
  assert.equal(w1.goals.length, 0, 'Pass H: beginAdventure must not seed any starting goal');
  assert.deepEqual(w1.goals, w2.goals, 'same seed must produce same goals state');
});

test('G01: pack without starterGoals also produces no starting goal', () => {
  const noGoalsPacks = {
    fantasy: { ...packsById.fantasy, starterGoals: undefined }
  };
  const w = beginAdventure(
    newWorld({ seed: 'g01-fallback', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } }),
    noGoalsPacks
  ).world;

  assert.equal(w.goals.length, 0, 'Pass H: pack starterGoals are unused at begin');
});
