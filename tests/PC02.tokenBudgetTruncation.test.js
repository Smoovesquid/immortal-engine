// PC02: Token budget truncation
import test from 'node:test';
import assert from 'node:assert/strict';

import { compressPrompt, countTokensApprox } from '../engine/npc/npcBrain.js';

function makeCtxWithManyFacts(factCount) {
  const facts = [];
  for (let i = 0; i < factCount; i++) {
    facts.push({
      id: `fact_${String(i).padStart(3, '0')}`,
      text: `This is fact number ${i} with extensive detail about the world and its inhabitants that makes it quite long and verbose so that thirty of these facts will exceed the token budget when assembled into a prompt together with headers and formatting overhead`,
      source: 'witnessed'
    });
  }
  return {
    npcId: 'npc_0',
    name: 'Greta',
    archetype: 'herbalist',
    traits: ['cautious'],
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    trust: 5,
    mood: 'wary',
    knownFacts: facts,
    carriedRumors: [],
    relationships: [],
    playerInput: 'Tell me everything.',
    turn: 1,
    secrets: new Set()
  };
}

test('PC02.1: prompt with 30 facts fits within 1500 token budget', () => {
  const ctx = makeCtxWithManyFacts(30);
  const prompt = compressPrompt(ctx, { tokenBudget: 1500 });
  const tokens = countTokensApprox(prompt);
  assert.ok(tokens <= 1500,
    `prompt should fit in 1500 tokens, got ${tokens}`);
});

test('PC02.2: some facts are truncated when budget is tight', () => {
  const ctx = makeCtxWithManyFacts(30);
  const unbounded = compressPrompt(ctx, { tokenBudget: 100000 });
  const bounded = compressPrompt(ctx, { tokenBudget: 1500 });

  // Unbounded should contain all 30 facts
  const unboundedFactCount = (unbounded.match(/\[F:/g) || []).length;
  const boundedFactCount = (bounded.match(/\[F:/g) || []).length;

  assert.equal(unboundedFactCount, 30, 'unbounded should have all 30 facts');
  assert.ok(boundedFactCount < 30,
    `bounded should have fewer facts, got ${boundedFactCount}`);
  assert.ok(boundedFactCount > 0, 'should still have some facts');
});

test('PC02.3: countTokensApprox returns correct rough estimate', () => {
  assert.equal(countTokensApprox(''), 0);
  assert.equal(countTokensApprox('abcd'), 1);
  assert.equal(countTokensApprox('abcde'), 2);
  assert.equal(countTokensApprox(null), 0);
});

test('PC02.4: default budget is applied when no opts given', () => {
  const ctx = makeCtxWithManyFacts(100);
  const prompt = compressPrompt(ctx);
  const tokens = countTokensApprox(prompt);
  // Default budget is 1500
  assert.ok(tokens <= 1500,
    `default budget should cap at 1500 tokens, got ${tokens}`);
});
