import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['A'],
    starterObjectives: ['OBJ'],
    locations: ['A','B','C'],
    objectives: ['OBJ','OBJ','OBJ'],
    sensoryMotifs: ['m'],
    skills: []
  }
};

test('no duplicate objective fact per scene when objective repeats', () => {
  const w0 = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);
  const s = newScene(a.world, packsById);

  const objFacts = s.world.ledger.facts.filter(f => String(f.text).startsWith('objective:OBJ'));
  assert.equal(objFacts.length, 1);
});
