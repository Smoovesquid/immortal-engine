// O04: fallback matches rules — trust-threshold behavior is deterministic
// and matches the documented spec from LOCAL_LLM.md.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext, fallbackRules } from '../engine/npc/npcBrain.js';

function makeNpc(trust, extras = {}) {
  return {
    id: 'npc_test',
    name: 'Aldric',
    role: 'guard',
    archetype: 'guard',
    traits: ['stern'],
    personality: {
      honesty: 0.5,
      trustOfOutsiders: 0.5,
      selfPreservation: 0.5
    },
    conversationState: { trustLevel: trust, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'public_fact_1', source: 'witnessed', confidence: 0.9 },
      { factId: 'public_fact_2', source: 'witnessed', confidence: 0.8 },
      { factId: 'secret_war_era3', source: 'secret', confidence: 1.0 }
    ],
    secrets: ['secret_war_era3'],
    relationships: {},
    rumorIds: ['rumor_a'],
    ...extras
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

function ctx(trust, extras) {
  return buildNpcContext(makeNpc(trust, extras), makeWorld(), 'What do you know?');
}

describe('O04: Trust 7+ shares all non-personal facts', () => {
  it('trust=7 shares public facts and rumors but not personal', () => {
    const d = fallbackRules(ctx(7));
    assert.ok(d.share.includes('public_fact_1'));
    assert.ok(d.share.includes('public_fact_2'));
    assert.ok(d.share.includes('rumor_a'));
    assert.ok(!d.share.includes('secret_war_era3'), 'personal fact not shared at trust 7');
    assert.equal(d.mood, 'warm');
    assert.equal(d.approach, 'volunteer');
  });

  it('trust=9 shares public facts, rumors, and personal facts', () => {
    const d = fallbackRules(ctx(9));
    assert.ok(d.share.includes('public_fact_1'));
    assert.ok(d.share.includes('secret_war_era3'), 'personal facts shared at trust 9');
    assert.equal(d.mood, 'warm');
  });
});

describe('O04: Trust 4-6 shares exactly one fact', () => {
  it('trust=5 shares exactly one fact', () => {
    const d = fallbackRules(ctx(5));
    assert.equal(d.share.length, 1, 'exactly one fact shared');
    assert.equal(d.mood, 'wary');
    assert.equal(d.approach, 'wait_to_be_asked');
  });

  it('trust=4 shares exactly one fact', () => {
    const d = fallbackRules(ctx(4));
    assert.equal(d.share.length, 1);
  });

  it('trust=6 shares exactly one fact', () => {
    const d = fallbackRules(ctx(6));
    assert.equal(d.share.length, 1);
  });
});

describe('O04: Trust <=3 shares nothing', () => {
  it('trust=3 shares nothing', () => {
    const d = fallbackRules(ctx(3));
    assert.deepEqual(d.share, []);
    assert.equal(d.approach, 'deflect');
  });

  it('trust=2 shares nothing, mood=wary', () => {
    const d = fallbackRules(ctx(2));
    assert.deepEqual(d.share, []);
    assert.equal(d.mood, 'wary');
  });
});

describe('O04: Trust <=1 mood is hostile', () => {
  it('trust=1 mood is hostile', () => {
    const d = fallbackRules(ctx(1));
    assert.equal(d.mood, 'hostile');
    assert.deepEqual(d.share, []);
  });

  it('trust=0 mood is hostile', () => {
    const d = fallbackRules(ctx(0));
    assert.equal(d.mood, 'hostile');
  });
});

describe('O04: Personal facts never shared below trust 8', () => {
  for (const t of [0, 1, 2, 3, 4, 5, 6, 7]) {
    it(`trust=${t} does not share personal facts`, () => {
      const d = fallbackRules(ctx(t));
      assert.ok(!d.share.includes('secret_war_era3'),
        `personal fact should not be shared at trust ${t}`);
    });
  }

  it('trust=8 shares personal facts', () => {
    const d = fallbackRules(ctx(8));
    assert.ok(d.share.includes('secret_war_era3'));
  });
});
