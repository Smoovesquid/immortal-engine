// PC01: Compressed prompt is shorter than verbose prompt
import test from 'node:test';
import assert from 'node:assert/strict';

import { compressPrompt, _buildPromptVerbose } from '../engine/npc/npcBrain.js';

function makeCtx(overrides = {}) {
  return {
    npcId: 'npc_0',
    name: 'Greta',
    archetype: 'herbalist',
    traits: ['cautious', 'observant'],
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    trust: 5,
    mood: 'wary',
    knownFacts: [
      { id: 'dragon_sighting', text: 'A dragon was seen near the pass', source: 'witnessed' },
      { id: 'merchant_missing', text: 'The merchant has been missing for days', source: 'heard' },
      { id: 'well_poisoned', text: 'The well water tastes bitter', source: 'observed' }
    ],
    carriedRumors: [
      { id: 'rumor_bandit', text: 'Bandits camp north of the bridge', tier: 2, tags: ['danger'] },
      { id: 'rumor_treasure', text: 'Gold buried beneath the old chapel', tier: 0, tags: ['treasure'] }
    ],
    relationships: [
      { targetId: 'npc_1', bond: 0.6, history: ['traded', 'argued'] }
    ],
    playerInput: 'What do you know about the dragon?',
    turn: 3,
    secrets: new Set(),
    ...overrides
  };
}

test('PC01.1: compressed prompt is shorter than verbose prompt', () => {
  const ctx = makeCtx();
  const compressed = compressPrompt(ctx);
  const verbose = _buildPromptVerbose(ctx);
  assert.ok(compressed.length < verbose.length,
    `compressed (${compressed.length}) should be shorter than verbose (${verbose.length})`);
});

test('PC01.2: compressed prompt uses abbreviated fact format [F:id]', () => {
  const ctx = makeCtx();
  const compressed = compressPrompt(ctx);
  assert.ok(compressed.includes('[F:dragon_sighting]'), 'should use [F:id] format');
  assert.ok(!compressed.includes('[fact:dragon_sighting]'), 'should not use verbose [fact:id] format');
});

test('PC01.3: compressed prompt uses abbreviated rumor format [R:id] with tN', () => {
  const ctx = makeCtx();
  const compressed = compressPrompt(ctx);
  assert.ok(compressed.includes('[R:rumor_bandit]'), 'should use [R:id] format');
  assert.ok(compressed.includes('t2'), 'should use tN tier format');
  assert.ok(!compressed.includes('(tier 2)'), 'should not use verbose (tier N) format');
});

test('PC01.4: compressed prompt omits Relationships header when empty', () => {
  const ctx = makeCtx({ relationships: [] });
  const compressed = compressPrompt(ctx);
  assert.ok(!compressed.includes('Rel:'), 'should omit Rel: header when no relationships');
});

test('PC01.5: compressed prompt uses single-char mood/approach codes', () => {
  const ctx = makeCtx();
  const compressed = compressPrompt(ctx);
  assert.ok(compressed.includes('W/H/X/F/A'), 'should use single-char mood codes in schema');
  assert.ok(compressed.includes('V/Q/D/L'), 'should use single-char approach codes in schema');
});
