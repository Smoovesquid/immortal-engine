import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { adjudicate } from '../engine/gracefulAdjudication.js';

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

function startedWorld() {
  const w0 = newWorld({ seed: 'aj01', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  return newScene(begun, packsById).world;
}

test('AJ01: a META question leaves worldHash identical', () => {
  const w = startedWorld();
  const before = worldHash(w);
  const after = playerMove(w, packsById, "what's my AC?").world;
  assert.equal(worldHash(after), before, 'meta question must not mutate world state');
});

test('AJ01: a META question emits no resolution event and no time advance', () => {
  const w = startedWorld();
  const turnBefore = Number(w.time?.turn ?? 0);
  const tlBefore = (w.timeline || []).length;

  const { world: after, output } = playerMove(w, packsById, "what's the DC?");

  assert.equal(Number(after.time?.turn ?? 0), turnBefore, 'time must not advance');
  assert.equal((after.timeline || []).length, tlBefore, 'no event may be pushed');
  // No resolution event for this turn.
  const resolutions = (after.timeline || []).filter(e => e?.kind === 'resolution');
  const baseline = (w.timeline || []).filter(e => e?.kind === 'resolution');
  assert.equal(resolutions.length, baseline.length, 'no resolution event may be emitted');
  assert.match(output.mechanics, /no roll/, 'mechanics line marks it as a no-roll meta answer');
});

test('AJ01: capability and state questions route to meta (no dice)', () => {
  const w = startedWorld();
  const cap = adjudicate(w, 'can I even do that?');
  assert.equal(cap.route, 'meta');
  assert.equal(cap.meta.kind, 'capability');
  assert.equal(cap.move, null);

  const state = adjudicate(w, 'where am I?');
  assert.equal(state.route, 'meta');
  assert.equal(state.meta.kind, 'state');
});
