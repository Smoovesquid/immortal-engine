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

test('G01: same seed + same pack produces same initial goal id/kind/targetRef', () => {
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
  assert.ok(w1.goals.length >= 1, 'beginAdventure should seed at least one goal');
  assert.equal(w1.goals.length, w2.goals.length);

  const a = w1.goals[0];
  const b = w2.goals[0];
  assert.equal(a.id, b.id);
  assert.equal(a.kind, b.kind);
  assert.equal(a.targetRef, b.targetRef);
  assert.equal(a.status, 'active');
  assert.equal(a.completedAt, null);
});

test('G01: pack without starterGoals still seeds a fallback goal deterministically', () => {
  const noGoalsPacks = {
    fantasy: { ...packsById.fantasy, starterGoals: undefined }
  };
  const w = beginAdventure(
    newWorld({ seed: 'g01-fallback', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } }),
    noGoalsPacks
  ).world;

  assert.ok(w.goals.length >= 1, 'fallback should still seed a goal');
  const g = w.goals[0];
  assert.ok(g.kind === 'reach' || g.kind === 'learn', `expected reach|learn fallback, got ${g.kind}`);
  assert.equal(g.status, 'active');
});
