import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { adjudicateWithGrace } from '../engine/grace/gracefulAdjudication.js';

// ── U93 — Grace Layer Integration (End-to-End Playtest) ──────────────

// Create a test world
function makeTestWorld() {
  return ensureWorld({
    meta: { version: 21, seed: 'u93-integration', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Hero',
      level: 1,
      wounds: 0,
      stress: 0,
      stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 },
      position: { ux: 30, uy: 50, elevation: 0, nodeId: 'n0' }
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
    }
  });
}

test('U93-01: Meta-question "Where am I?" returns location without mutation', async () => {
  const w = makeTestWorld();
  const input = 'Where am I?';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'meta');
  assert.ok(result.message.includes('cellar'));
});

test('U93-02: Meta-question "Am I hurt?" returns health status without mutation', async () => {
  const w = makeTestWorld();
  w.party[0].wounds = 3;
  const input = 'Am I hurt?';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'meta');
  assert.ok(result.message.includes('wounds') || result.message.includes('hurt'));
});

test('U93-03: Ambiguous input "the thing" triggers clarification', async () => {
  const w = makeTestWorld();
  const input = 'the thing';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'clarification');
  assert.ok(result.message);
  assert.ok(result.suggesting);
  assert.ok(result.confidence < 0.6);
});

test('U93-04: Clear action "smash the barrel" proceeds to adjudication', async () => {
  const w = makeTestWorld();
  const input = 'smash the barrel';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'action');
  assert.ok(result.narration);
  assert.ok(result.mechanics);
  assert.ok(result.world);
  assert.ok(result.confidence >= 0.8);
  assert.ok(result.pacingMs); // pacing should be set
  assert.ok(result.tone); // tone should be set
});

test('U93-05: Pacing delays are action-appropriate', async () => {
  const w = makeTestWorld();

  const examine = await adjudicateWithGrace(w, 'examine the barrel');
  const attack = await adjudicateWithGrace(makeTestWorld(), 'attack the barrel');

  // Attack should have longer pacing than examine
  assert.ok(attack.pacingMs > examine.pacingMs);
});

test('U93-06: Tone reflects world state (high threat)', async () => {
  const w = makeTestWorld();
  w.conductor.threat.severity = 0.9;

  const result = await adjudicateWithGrace(w, 'examine the barrel');

  assert.ok(result.tone.tension > 0.5);
  assert.ok(result.tone.hope <= 1);
});

test('U93-07: Conversation state persists after action', async () => {
  const w = makeTestWorld();
  const result = await adjudicateWithGrace(w, 'break the barrel');

  assert.ok(result.world.conversation.lastAction);
  assert.ok(result.world.conversation.lastNarration);
  assert.equal(result.world.conversation.clarificationAttempts, 0);
});

test('U93-08: Clarification state is tracked for multi-turn interaction', async () => {
  const w = makeTestWorld();

  // First turn: ambiguous input
  const r1 = await adjudicateWithGrace(w, 'the thing');
  assert.equal(r1.type, 'clarification');
  assert.equal(r1.world.conversation.clarificationAttempts, 1);

  // Second turn: clarification answered
  const r2 = await adjudicateWithGrace(r1.world, 'the barrel');
  assert.ok(r2.type === 'action' || r2.type === 'clarification');
  // Clarification should have been reset or handled
});

test('U93-09: World state is passed through grace layer correctly', async () => {
  const w = makeTestWorld();
  const original_location = w.scene.location;
  const original_wounds = w.party[0].wounds;

  const result = await adjudicateWithGrace(w, 'Where am I?');

  // Meta-question shouldn't mutate world state
  assert.equal(result.world.scene.location, original_location);
  assert.equal(result.world.party[0].wounds, original_wounds);
});

test('U93-10: Tone modifiers are correctly assigned', async () => {
  const w = makeTestWorld();
  w.conductor.threat.severity = 0.8;

  const result = await adjudicateWithGrace(w, 'smash the barrel');

  assert.ok(result.toneModifier);
  assert.ok(result.toneModifier.adjectives && result.toneModifier.adjectives.length > 0);
  assert.ok(result.toneModifier.pace);
  assert.ok(result.toneModifier.intensity);
});
