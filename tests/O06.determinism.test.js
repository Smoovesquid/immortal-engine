// O06: Determinism — same NPC state + same player input + fallback rules
// always produces the same decision. Fact selection via seeded RNG is stable.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext, fallbackRules } from '../engine/npc/npcBrain.js';

function makeNpc(trust = 5) {
  return {
    id: 'npc_det',
    name: 'Bram',
    role: 'veteran',
    archetype: 'veteran',
    traits: ['grizzled', 'wary'],
    personality: { honesty: 0.6, trustOfOutsiders: 0.3, selfPreservation: 0.5 },
    conversationState: { trustLevel: trust, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'battle_era2', source: 'witnessed', confidence: 0.9 },
      { factId: 'trade_route_era1', source: 'witnessed', confidence: 0.85 },
      { factId: 'famine_era3', source: 'witnessed', confidence: 0.7 },
      { factId: 'secret_war_era2', source: 'secret', confidence: 1.0 }
    ],
    secrets: ['secret_war_era2'],
    relationships: {},
    rumorIds: ['rumor_x']
  };
}

function makeWorld(turn = 7) {
  return {
    time: { turn },
    rumors: [
      { id: 'rumor_x', body: 'Strange lights', tier: 2, tags: ['mystery'] }
    ]
  };
}

describe('O06: Determinism — identical inputs produce identical decisions', () => {
  it('fallbackRules at trust=5 returns same decision on two calls', () => {
    const npc = makeNpc(5);
    const world = makeWorld(7);

    const ctx1 = buildNpcContext(npc, world, 'What happened in the war?');
    const d1 = fallbackRules(ctx1);

    const ctx2 = buildNpcContext(npc, world, 'What happened in the war?');
    const d2 = fallbackRules(ctx2);

    assert.deepEqual(d1, d2, 'identical inputs must produce identical decisions');
  });

  it('fallbackRules at trust=7 returns same decision on two calls', () => {
    const npc = makeNpc(7);
    const world = makeWorld(7);

    const ctx1 = buildNpcContext(npc, world, 'Tell me everything');
    const d1 = fallbackRules(ctx1);

    const ctx2 = buildNpcContext(npc, world, 'Tell me everything');
    const d2 = fallbackRules(ctx2);

    assert.deepEqual(d1, d2);
  });

  it('fallbackRules at trust=1 returns same decision on two calls', () => {
    const npc = makeNpc(1);
    const world = makeWorld(7);

    const ctx1 = buildNpcContext(npc, world, 'Speak!');
    const d1 = fallbackRules(ctx1);

    const ctx2 = buildNpcContext(npc, world, 'Speak!');
    const d2 = fallbackRules(ctx2);

    assert.deepEqual(d1, d2);
  });
});

describe('O06: Deterministic fact selection via seeded RNG', () => {
  it('mid-trust selects same fact from multiple candidates each time', () => {
    const npc = makeNpc(5);
    const world = makeWorld(7);

    const ctx = buildNpcContext(npc, world, 'any question');
    const d1 = fallbackRules(ctx);

    assert.equal(d1.share.length, 1, 'mid-trust shares exactly one fact');
    const selectedFact = d1.share[0];

    // Run 10 more times — must always pick the same fact.
    for (let i = 0; i < 10; i++) {
      const ctx2 = buildNpcContext(npc, world, 'any question');
      const d2 = fallbackRules(ctx2);
      assert.equal(d2.share[0], selectedFact,
        `Run ${i}: expected ${selectedFact} but got ${d2.share[0]}`);
    }
  });

  it('different turns produce different seeds and may select different facts', () => {
    const npc = makeNpc(5);
    // With enough different turns, at least one should differ (probabilistic
    // but deterministic — the seeded RNG distributes across candidates).
    const selections = new Set();
    for (let turn = 0; turn < 20; turn++) {
      const world = makeWorld(turn);
      const ctx = buildNpcContext(npc, world, 'question');
      const d = fallbackRules(ctx);
      if (d.share.length > 0) selections.add(d.share[0]);
    }
    // With 3 public candidates and 20 different seeds, we expect variety.
    assert.ok(selections.size >= 2,
      `Expected variety across turns but got only: ${[...selections].join(', ')}`);
  });
});

describe('O06: buildNpcContext is pure — same inputs, same output', () => {
  it('produces identical context objects', () => {
    const npc = makeNpc(5);
    const world = makeWorld(7);

    const ctx1 = buildNpcContext(npc, world, 'hello');
    const ctx2 = buildNpcContext(npc, world, 'hello');

    // secrets is a Set — compare serialized
    const s1 = { ...ctx1, secrets: [...ctx1.secrets] };
    const s2 = { ...ctx2, secrets: [...ctx2.secrets] };
    assert.deepEqual(s1, s2, 'context must be identical for identical inputs');
  });
});
