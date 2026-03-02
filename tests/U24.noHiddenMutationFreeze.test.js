import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { simulateTurns } from '../engine/simulate.js';

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

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

test('U24: Gate IV No Hidden Mutation — world must not mutate in place during simulation', () => {
  const w0 = newWorld({
    seed: 'u24-seed-0',
    fate: 0.2,
    campaignId: 'u24',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  deepFreeze(w0);

  assert.doesNotThrow(() => {
    simulateTurns(w0, packsById, 10);
  }, 'Simulation attempted to mutate frozen world in place');
});
