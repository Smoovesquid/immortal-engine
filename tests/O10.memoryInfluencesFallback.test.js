// O10: memory influences fallbackRules — memory-based trust boost in the 4-6 range.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext, fallbackRules } from '../engine/npc/npcBrain.js';

function makeNpc(trust, memories = []) {
  return {
    id: 'npc_mem_fb',
    name: 'Aldric',
    role: 'guard',
    archetype: 'guard',
    traits: ['stern'],
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    conversationState: { trustLevel: trust, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'public_fact_1', source: 'witnessed', confidence: 0.9 },
      { factId: 'public_fact_2', source: 'witnessed', confidence: 0.8 },
      { factId: 'secret_war', source: 'secret', confidence: 1.0 }
    ],
    secrets: ['secret_war'],
    relationships: {},
    rumorIds: ['rumor_a'],
    memory: memories
  };
}

function makeWorld() {
  return {
    time: { turn: 5 },
    rumors: [
      { id: 'rumor_a', body: 'Orcs gathering', tier: 1, tags: ['danger'] }
    ]
  };
}

describe('O10: NPC at trust 5 with relevant memory shares (boosted to trust 6)', () => {
  it('memory mentioning player topic → share behavior', () => {
    // "trade" is >= 4 chars, and appears in the memory
    const npc = makeNpc(5, ['Aldric discussed trade_routes with the traveler (trust: 5).']);
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about trade');
    const d = fallbackRules(ctx);
    // At trust 5 without boost: shares exactly one fact (cautious).
    // At trust 6 with boost: still shares exactly one fact (still in 4-6 range).
    // The boost treats trust as 6 — still in the cautious band.
    assert.equal(d.share.length, 1, 'boosted trust 6 still shares one fact');
    assert.equal(d.approach, 'wait_to_be_asked');
  });
});

describe('O10: NPC at trust 6 with relevant memory shares like trust 7 (warm)', () => {
  it('memory boost pushes trust 6 to effective 7 → warm sharing', () => {
    const npc = makeNpc(6, ['Aldric discussed trade_routes with the traveler (trust: 6).']);
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about trade');
    const d = fallbackRules(ctx);
    // Effective trust 7 → shares all public facts + rumors, mood warm, volunteer
    assert.ok(d.share.includes('public_fact_1'), 'shares public fact 1');
    assert.ok(d.share.includes('public_fact_2'), 'shares public fact 2');
    assert.ok(d.share.includes('rumor_a'), 'shares rumor');
    assert.equal(d.mood, 'warm');
    assert.equal(d.approach, 'volunteer');
  });
});

describe('O10: NPC at trust 5 with NO relevant memory → normal cautious behavior', () => {
  it('no memory match → standard trust-5 sharing', () => {
    const npc = makeNpc(5, ['Aldric spoke about weather with the traveler.']);
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about trade');
    const d = fallbackRules(ctx);
    // "trade" does not appear in the weather memory
    assert.equal(d.share.length, 1, 'standard cautious sharing');
    assert.equal(d.approach, 'wait_to_be_asked');
  });
});

describe('O10: NPC at trust 3 (below threshold) → memory boost does not help', () => {
  it('trust 3 with matching memory still shares nothing', () => {
    const npc = makeNpc(3, ['Aldric discussed trade_routes with the traveler.']);
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about trade');
    const d = fallbackRules(ctx);
    // Trust 3 is outside the 4-6 range, so memory boost does not apply
    assert.deepEqual(d.share, [], 'trust 3 shares nothing even with memory match');
    assert.equal(d.approach, 'deflect');
  });
});

describe('O10: NPC at trust 5 with empty memories → no boost', () => {
  it('empty memory array does not boost', () => {
    const npc = makeNpc(5, []);
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about trade');
    const d = fallbackRules(ctx);
    assert.equal(d.share.length, 1, 'standard cautious sharing');
  });
});

describe('O10: Short words (<4 chars) do not trigger memory boost', () => {
  it('player input with only short words does not match', () => {
    const npc = makeNpc(6, ['Aldric discussed the war with the traveler.']);
    // "the" and "war" are both < 4 chars
    const ctx = buildNpcContext(npc, makeWorld(), 'the war');
    const d = fallbackRules(ctx);
    // No boost because no word >= 4 chars in player input
    assert.equal(d.share.length, 1, 'no boost from short words');
  });
});
