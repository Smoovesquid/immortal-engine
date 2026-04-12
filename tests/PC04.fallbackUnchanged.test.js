// PC04: fallbackRules produces identical output with compressed context
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext, fallbackRules } from '../engine/npc/npcBrain.js';

function makeNpc(overrides = {}) {
  return {
    id: 'npc_0',
    name: 'Greta',
    role: 'herbalist',
    traits: ['cautious', 'observant'],
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    conversationState: { trustLevel: 5 },
    knowledgeGraph: [
      { factId: 'dragon_sighting', source: 'witnessed' },
      { factId: 'merchant_missing', source: 'heard' },
      { factId: 'secret_poison', source: 'secret' }
    ],
    secrets: ['secret_poison'],
    rumorIds: ['r_bandit'],
    relationships: {},
    ...overrides
  };
}

function makeWorld() {
  return {
    time: { turn: 3 },
    rumors: [
      { id: 'r_bandit', body: 'Bandits camp north', tier: 2, tags: ['danger'] }
    ]
  };
}

test('PC04.1: fallbackRules — high trust shares public facts and rumors', () => {
  const npc = makeNpc({ conversationState: { trustLevel: 7 } });
  const ctx = buildNpcContext(npc, makeWorld(), 'Hello');
  const decision = fallbackRules(ctx);

  assert.equal(decision.mood, 'warm');
  assert.equal(decision.approach, 'volunteer');
  // Should share non-secret facts + rumors
  assert.ok(decision.share.includes('dragon_sighting'));
  assert.ok(decision.share.includes('merchant_missing'));
  assert.ok(decision.share.includes('r_bandit'));
  // Should NOT share secrets at trust 7
  assert.ok(!decision.share.includes('secret_poison'));
});

test('PC04.2: fallbackRules — trust 8+ shares secrets too', () => {
  const npc = makeNpc({ conversationState: { trustLevel: 8 } });
  const ctx = buildNpcContext(npc, makeWorld(), 'Tell me everything');
  const decision = fallbackRules(ctx);

  assert.ok(decision.share.includes('secret_poison'), 'trust 8+ should share secrets');
  assert.equal(decision.mood, 'warm');
  assert.equal(decision.approach, 'volunteer');
});

test('PC04.3: fallbackRules — medium trust shares one fact deterministically', () => {
  const npc = makeNpc({ conversationState: { trustLevel: 5 } });
  const ctx = buildNpcContext(npc, makeWorld(), 'What do you know?');
  const decision = fallbackRules(ctx);

  assert.equal(decision.mood, 'wary');
  assert.equal(decision.approach, 'wait_to_be_asked');
  // Should share exactly one public fact
  const publicFacts = ['dragon_sighting', 'merchant_missing'];
  assert.equal(decision.share.length, 1, 'medium trust shares exactly one fact');
  assert.ok(publicFacts.includes(decision.share[0]), 'shared fact should be public');
});

test('PC04.4: fallbackRules — low trust shares nothing', () => {
  const npc = makeNpc({ conversationState: { trustLevel: 2 } });
  const ctx = buildNpcContext(npc, makeWorld(), 'Speak!');
  const decision = fallbackRules(ctx);

  assert.deepEqual(decision.share, []);
  assert.equal(decision.mood, 'wary');
  assert.equal(decision.approach, 'deflect');
});

test('PC04.5: fallbackRules — very low trust is hostile', () => {
  const npc = makeNpc({ conversationState: { trustLevel: 1 } });
  const ctx = buildNpcContext(npc, makeWorld(), 'Talk!');
  const decision = fallbackRules(ctx);

  assert.deepEqual(decision.share, []);
  assert.equal(decision.mood, 'hostile');
  assert.equal(decision.approach, 'deflect');
});

test('PC04.6: fallbackRules is deterministic — same input same output', () => {
  const npc = makeNpc({ conversationState: { trustLevel: 5 } });
  const world = makeWorld();
  const ctx1 = buildNpcContext(npc, world, 'Hello');
  const ctx2 = buildNpcContext(npc, world, 'Hello');
  const d1 = fallbackRules(ctx1);
  const d2 = fallbackRules(ctx2);

  assert.deepEqual(d1, d2, 'same input should produce identical decisions');
});
