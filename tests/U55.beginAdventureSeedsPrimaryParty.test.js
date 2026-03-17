import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['Roadside'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('U55: beginAdventure seeds deterministic primary party actor when world.party is empty', () => {
  const w0 = newWorld({ seed: 'u55', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById).world;

  assert.ok(Array.isArray(a.party));
  assert.equal(a.party.length, 1);

  const pc = a.party[0];
  assert.ok(pc);
  assert.ok(typeof pc.id === 'string' && pc.id.length > 0);
  assert.ok(typeof pc.name === 'string' && pc.name.length > 0);
  assert.equal(pc.position?.zone, 'far');
});
