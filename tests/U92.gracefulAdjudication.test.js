import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import {
  computePacingDelay,
  computeTone,
  getToneModifier,
  isMetaQuestion,
  handleMetaQuestion,
  adjudicateWithGrace
} from '../engine/grace/gracefulAdjudication.js';

// ── U92 — Graceful Adjudication (Pacing, Grace, Conversation) ──────

// Create a test world
function makeTestWorld() {
  return ensureWorld({
    meta: { version: 21, seed: 'u92-grace', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Hero',
      stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 },
      position: { ux: 30, uy: 50, elevation: 0, nodeId: 'n0' },
      health: { current: 25, max: 30 }
    }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        currentNodeId: 'n0',
        furniture: [
          {
            name: 'wooden barrel',
            state: 'intact',
            bulk: 4,
            ux: 70,
            uy: 50,
            position: { ux: 70, uy: 50, elevation: 0 }
          }
        ]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: [],
    scene: { location: 'cellar' },
    conductor: {
      threat: { severity: 0.3 },
      discovery: { rate: 0.2 }
    },
    conversation: {
      lastAction: null,
      lastNarration: null
    }
  });
}

test('U92-01: computePacingDelay for simple interaction', () => {
  const delay = computePacingDelay('examine the barrel');
  assert.ok(delay >= 200 && delay <= 400);
});

test('U92-02: computePacingDelay for decision action', () => {
  const delay = computePacingDelay('hide behind the door');
  assert.ok(delay >= 400 && delay <= 600);
});

test('U92-03: computePacingDelay for significant action', () => {
  const delay = computePacingDelay('charge at the enemy');
  assert.ok(delay >= 600 && delay <= 800);
});

test('U92-04: computePacingDelay for breaking action', () => {
  const delay = computePacingDelay('smash the barrel');
  assert.ok(delay >= 500 && delay <= 700);
});

test('U92-05: computePacingDelay returns default for unknown', () => {
  const delay = computePacingDelay('foo bar baz');
  assert.ok(delay === 400); // default
});

test('U92-06: computeTone from healthy world', () => {
  const w = makeTestWorld();
  const tone = computeTone(w);
  assert.ok(tone.tension >= 0 && tone.tension <= 1);
  assert.ok(tone.wonder >= 0 && tone.wonder <= 1);
  assert.ok(tone.dread >= 0 && tone.dread <= 1);
  assert.ok(tone.hope >= 0.2 && tone.hope <= 1); // never below 0.2
});

test('U92-07: computeTone reflects low health', () => {
  const w = makeTestWorld();
  w.party[0].health.current = 3; // very low
  const tone = computeTone(w);
  assert.ok(tone.hope < 0.4); // low hope when hurt
});

test('U92-08: computeTone reflects threat', () => {
  const w = makeTestWorld();
  w.conductor.threat.severity = 0.9;
  const tone = computeTone(w);
  assert.ok(tone.tension > 0.5); // high tension
});

test('U92-09: getToneModifier returns modifier for dominant tone', () => {
  const tone = { tension: 0.8, wonder: 0.2, dread: 0.3, hope: 0.4 };
  const modifier = getToneModifier(tone);
  assert.ok(modifier.adjectives && modifier.adjectives.length > 0);
  assert.ok(modifier.pace);
  assert.ok(modifier.intensity);
});

test('U92-10: getToneModifier dread has grave intensity', () => {
  const tone = { dread: 0.9, tension: 0.2, wonder: 0.1, hope: 0.2 };
  const modifier = getToneModifier(tone);
  assert.equal(modifier.intensity, 'grave');
});

test('U92-11: getToneModifier hope has exultant intensity', () => {
  const tone = { hope: 0.9, tension: 0.2, wonder: 0.1, dread: 0.1 };
  const modifier = getToneModifier(tone);
  assert.equal(modifier.intensity, 'exultant');
});

test('U92-12: isMetaQuestion detects health check', () => {
  assert.ok(isMetaQuestion('am I hurt?'));
  assert.ok(isMetaQuestion('what is my health?'));
  assert.ok(isMetaQuestion('how much HP do I have?'));
});

test('U92-13: isMetaQuestion detects status question', () => {
  assert.ok(isMetaQuestion('what happened?'));
  assert.ok(isMetaQuestion('what did I just do?'));
  assert.ok(isMetaQuestion('where am I?'));
});

test('U92-14: isMetaQuestion rejects action commands', () => {
  assert.ok(!isMetaQuestion('smash the barrel'));
  assert.ok(!isMetaQuestion('hide behind the door'));
  assert.ok(!isMetaQuestion('talk to the goblin'));
});

test('U92-15: handleMetaQuestion responds to health check', () => {
  const w = makeTestWorld();
  w.party[0].health.current = 25;
  w.party[0].health.max = 30;

  const response = handleMetaQuestion('am I hurt?', w);
  assert.ok(response);
  assert.ok(response.includes('25') || response.includes('scratch'));
});

test('U92-16: handleMetaQuestion responds to status', () => {
  const w = makeTestWorld();
  w.conversation.lastNarration = 'You smashed the barrel to pieces.';

  const response = handleMetaQuestion('what happened?', w);
  assert.ok(response);
  assert.ok(response.includes('smashed'));
});

test('U92-17: handleMetaQuestion responds to location', () => {
  const w = makeTestWorld();
  w.scene.location = 'the deep dungeon';

  const response = handleMetaQuestion('where am I?', w);
  assert.ok(response);
  assert.ok(response.includes('dungeon'));
});

test('U92-18: handleMetaQuestion returns null for non-meta', () => {
  const w = makeTestWorld();
  const response = handleMetaQuestion('smash the barrel', w);
  assert.equal(response, null);
});

test('U92-19: adjudicateWithGrace returns action for high confidence', async () => {
  const w = makeTestWorld();
  const result = await adjudicateWithGrace(w, 'smash the barrel');

  assert.equal(result.type, 'action');
  assert.ok(result.narration);
  assert.ok(result.world);
});

test('U92-20: adjudicateWithGrace returns clarification for low confidence', async () => {
  const w = makeTestWorld();
  const result = await adjudicateWithGrace(w, 'the thing');

  assert.equal(result.type, 'clarification');
  assert.ok(result.message);
});

test('U92-21: adjudicateWithGrace detects meta-question', async () => {
  const w = makeTestWorld();
  w.conversation.lastNarration = 'You broke the barrel.';
  const result = await adjudicateWithGrace(w, 'what happened?');

  assert.equal(result.type, 'meta');
  assert.ok(result.message);
});

test('U92-22: adjudicateWithGrace stores conversation state', async () => {
  const w = makeTestWorld();
  const result = await adjudicateWithGrace(w, 'smash the barrel');

  assert.ok(result.world.conversation.lastAction);
  assert.ok(result.world.conversation.lastNarration);
});

test('U92-23: adjudicateWithGrace increments clarification attempts', async () => {
  const w = makeTestWorld();

  // First attempt
  const r1 = await adjudicateWithGrace(w, 'the thing');
  assert.equal(r1.world.conversation.clarificationAttempts, 1);

  // Second attempt with same world
  const r2 = await adjudicateWithGrace(r1.world, 'another thing');
  assert.equal(r2.world.conversation.clarificationAttempts, 2);
});

test('U92-24: adjudicateWithGrace includes tone information', async () => {
  const w = makeTestWorld();
  const result = await adjudicateWithGrace(w, 'smash the barrel');

  assert.ok(result.tone);
  assert.ok(result.toneModifier);
  assert.ok(result.pacingMs);
});

test('U92-25: adjudicateWithGrace is deterministic (same input = same narration)', async () => {
  const seed = 'u92-det';

  const w1 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 }, position: { ux: 30, uy: 50, elevation: 0, nodeId: 'n0' } }],
    map: { nodes: [{ id: 'n0', name: 'cellar', currentNodeId: 'n0', furniture: [{ name: 'barrel', state: 'intact', bulk: 4, ux: 70, uy: 50, position: { ux: 70, uy: 50, elevation: 0 } }] }], currentNodeId: 'n0', edges: [] },
    timeline: [],
    scene: { location: 'cellar' },
    conversation: {}
  });

  const w2 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 }, position: { ux: 30, uy: 50, elevation: 0, nodeId: 'n0' } }],
    map: { nodes: [{ id: 'n0', name: 'cellar', currentNodeId: 'n0', furniture: [{ name: 'barrel', state: 'intact', bulk: 4, ux: 70, uy: 50, position: { ux: 70, uy: 50, elevation: 0 } }] }], currentNodeId: 'n0', edges: [] },
    timeline: [],
    scene: { location: 'cellar' },
    conversation: {}
  });

  const r1 = await adjudicateWithGrace(w1, 'smash the barrel');
  const r2 = await adjudicateWithGrace(w2, 'smash the barrel');

  assert.equal(r1.narration, r2.narration);
  assert.equal(r1.mechanics, r2.mechanics);
});
