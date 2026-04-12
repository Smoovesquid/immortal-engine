// O03: NPC decision shape — queryBrain returns valid NpcDecision with mock LLM,
// returns null on invalid JSON, fallbackRules matches trust-threshold behavior.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext, queryBrain, fallbackRules } from '../engine/npc/npcBrain.js';

function makeNpc(overrides = {}) {
  return {
    id: 'npc_0',
    name: 'Marta the Quiet',
    role: 'trader',
    archetype: 'trader',
    traits: ['cautious', 'observant'],
    personality: {
      honesty: 0.6,
      trustOfOutsiders: 0.5,
      selfPreservation: 0.4
    },
    conversationState: { trustLevel: 5, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'trade_boom_era2', source: 'witnessed', confidence: 0.9 },
      { factId: 'secret_corruption_era1', source: 'secret', confidence: 1.0 }
    ],
    secrets: ['secret_corruption_era1'],
    relationships: {
      npc_1: { targetId: 'npc_1', bond: 0.3, history: ['neighbors'] }
    },
    rumorIds: ['rumor_1'],
    ...overrides
  };
}

function makeWorld() {
  return {
    time: { turn: 3 },
    rumors: [
      { id: 'rumor_1', body: 'Strange lights over the pass', tier: 2, tags: ['mystery'] }
    ]
  };
}

function mockQueryLocal(result) {
  return async ({ prompt, schema, timeout }) => {
    return { ok: true, result };
  };
}

function mockQueryLocalBad() {
  return async () => ({ ok: true, result: { garbage: true } });
}

function mockQueryLocalFail() {
  return async () => ({ ok: false, reason: 'unavailable' });
}

describe('O03: queryBrain with valid mock LLM', () => {
  it('returns a valid NpcDecision shape', async () => {
    const npc = makeNpc();
    const world = makeWorld();
    const ctx = buildNpcContext(npc, world, 'Tell me about the trade routes');

    const decision = await queryBrain(ctx, {
      queryLocal: mockQueryLocal({
        share: ['trade_boom_era2'],
        mood: 'warm',
        approach: 'volunteer',
        why: 'Player asked about trade, which I know about.'
      })
    });

    assert.ok(decision, 'decision should not be null');
    assert.ok(Array.isArray(decision.share), 'share is an array');
    assert.deepEqual(decision.share, ['trade_boom_era2']);
    assert.equal(decision.mood, 'warm');
    assert.equal(decision.approach, 'volunteer');
    assert.equal(typeof decision.why, 'string');
  });
});

describe('O03: queryBrain with invalid JSON from LLM', () => {
  it('returns null (triggers fallback)', async () => {
    const npc = makeNpc();
    const ctx = buildNpcContext(npc, makeWorld(), 'hello');

    const decision = await queryBrain(ctx, {
      queryLocal: mockQueryLocalBad()
    });
    assert.equal(decision, null, 'invalid shape should return null');
  });
});

describe('O03: queryBrain with unavailable LLM', () => {
  it('returns null', async () => {
    const npc = makeNpc();
    const ctx = buildNpcContext(npc, makeWorld(), 'hello');

    const decision = await queryBrain(ctx, {
      queryLocal: mockQueryLocalFail()
    });
    assert.equal(decision, null, 'unavailable LLM should return null');
  });
});

describe('O03: queryBrain with no queryLocal function', () => {
  it('returns null', async () => {
    const npc = makeNpc();
    const ctx = buildNpcContext(npc, makeWorld(), 'hello');
    const decision = await queryBrain(ctx);
    assert.equal(decision, null);
  });
});

describe('O03: fallbackRules with trust=8', () => {
  it('shares facts including personal, mood=warm, approach=volunteer', () => {
    const npc = makeNpc({ conversationState: { trustLevel: 8, metPlayer: true, topicsDiscussed: [], lastInteraction: null } });
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me everything');

    const decision = fallbackRules(ctx);
    assert.equal(decision.mood, 'warm');
    assert.equal(decision.approach, 'volunteer');
    assert.ok(decision.share.length > 0, 'should share facts');
    // At trust 8, personal facts are included.
    assert.ok(decision.share.includes('secret_corruption_era1'), 'personal facts shared at trust 8');
  });
});

describe('O03: fallbackRules with trust=3', () => {
  it('shares nothing, mood=wary, approach=deflect', () => {
    const npc = makeNpc({ conversationState: { trustLevel: 3, metPlayer: true, topicsDiscussed: [], lastInteraction: null } });
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me something');

    const decision = fallbackRules(ctx);
    assert.deepEqual(decision.share, []);
    assert.equal(decision.mood, 'wary');
    assert.equal(decision.approach, 'deflect');
  });
});
