import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { ensureMap } from '../engine/map/mapState.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('U38: explore intent is free (no resolution event, no clocks/timeline change)', () => {
  const w0 = newWorld({ seed: 'u38', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w0, packsById);

  const tl0 = a.world.timeline.length;
  const c0 = { ...a.world.clocks };
  const here0 = ensureMap(a.world.map).currentNodeId;

  const t1 = playerMove(a.world, packsById, 'Look around.');
  const tl1 = t1.world.timeline.length;
  const c1 = { ...t1.world.clocks };
  const here1 = ensureMap(t1.world.map).currentNodeId;

  assert.equal(tl1, tl0, 'timeline must not change');
  assert.deepEqual(c1, c0, 'clocks must not change');
  assert.equal(here1, here0, 'position must not change');
  assert.ok(String(t1.output?.mechanics || '').includes('no roll'), 'mechanics must signal no-roll observe');
  // explore must still surface where the ways out lie (prose form, not a bare "Exits:" label).
  assert.match(String(t1.output?.narration || ''), /\bway(s)?\b|north|south|east|west/i, 'must communicate the exits');
});
