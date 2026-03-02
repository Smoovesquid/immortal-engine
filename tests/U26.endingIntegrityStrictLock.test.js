import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { simulateTurns } from '../engine/simulate.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

test('U26: Gate III Ending Integrity — no mutation after endingTriggered', () => {
  let w = newWorld({
    seed: 'u26-seed-0',
    fate: 0.95,
    campaignId: 'u26',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const { world: simulated } = simulateTurns(w, packsById, 200);
  w = simulated;

  const endingEvents = (w.timeline ?? []).filter(e => e?.kind === 'endingTriggered');
  assert.equal(endingEvents.length, 1, 'endingTriggered must emit exactly once');

  const hashBefore = worldHash(w);

  const { world: after } = simulateTurns(w, packsById, 10);
  const hashAfter = worldHash(after);

  assert.equal(hashBefore, hashAfter, 'World mutated after endingTriggered');
});
