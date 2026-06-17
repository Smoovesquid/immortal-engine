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
  const w0 = newWorld({ seed: 'aj04', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  return newScene(begun, packsById).world;
}

const GIBBERISH = 'xqzwhbk fghjkl zzxcvbn';

test('AJ04: gibberish abstains to route "clarify" with a clarifyPrompt and no move', () => {
  const w = startedWorld();
  const decision = adjudicate(w, GIBBERISH);
  assert.equal(decision.route, 'clarify');
  assert.equal(decision.move, null, 'clarify carries no move');
  assert.ok(typeof decision.clarifyPrompt === 'string' && decision.clarifyPrompt.length > 0, 'clarifyPrompt present');
});

test('AJ04: a clarify turn does not mutate world state', () => {
  const w = startedWorld();
  const before = worldHash(w);
  const { world: after, output } = playerMove(w, packsById, GIBBERISH);
  assert.equal(worldHash(after), before, 'clarify must not mutate world state');
  assert.match(output.mechanics, /clarify/);
});

test('AJ04: recognizable intent does NOT abstain', () => {
  const w = startedWorld();
  const decision = adjudicate(w, 'I search the dusty shelves for a key');
  assert.notEqual(decision.route, 'clarify', 'real words with intent must not clarify');
});
