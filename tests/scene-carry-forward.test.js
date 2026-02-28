import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene } from '../engine/playloop.js';
import { addThreat } from '../engine/ledger.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['A'],
    starterObjectives: ['O1'],
    locations: ['A','B','C','D','E','F'],
    objectives: ['O1','O2','O3','O4','O5','O6'],
    sensoryMotifs: ['m1','m2','m3'],
    skills: [],
    omens: ['a coin spins', 'a door clicks', 'a shadow lingers'],
    prices: ['time', 'blood', 'trust']
  }
};

test('after 5 New Scene presses, each scene carries forward at least one unresolved element', () => {
  let w = newWorld({ seed: 'seed', fate: 0.8, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  // Ensure we have something to carry.
  w = addThreat(w, 'A rival group is already here (1).', 2);

  const begun = beginAdventure(w, packsById);
  w = begun.world;

  for (let i = 0; i < 5; i++) {
    const res = newScene(w, packsById, { lastResolutionKind: 'turn' });
    w = res.world;

    const hasCarry = (w.ledger.threats.length > 0) || (w.ledger.questions.length > 0);
    assert.equal(hasCarry, true);

    // tags/thread should be present (non-empty) once established.
    assert.ok(Array.isArray(w.scene.tags));
    assert.ok(typeof w.scene.thread === 'string');
    assert.ok(w.scene.thread.length > 0);
  }
});
