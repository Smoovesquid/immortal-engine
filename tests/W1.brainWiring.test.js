// W1: Brain wiring — brainDecision influences live dialogue mode, mood flows through.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { askNpc, beginDialogue } from '../engine/npc/dialogue.js';
import { createCanonLog, appendCanonEvent } from '../engine/csl/canonLog.js';
import { ensureWorld, newWorld } from '../engine/state.js';

// ── fixtures ────────────────────────────────────────────────────────────────

function makeNpc(id, trust, overrides = {}) {
  return {
    id,
    name: 'Aldric',
    role: 'guard',
    archetype: 'guard',
    traits: ['stern'],
    personality: {
      honesty: 0.5,
      trustOfOutsiders: 0.5,
      selfPreservation: 0.5,
      ...overrides.personality
    },
    conversationState: {
      trustLevel: trust,
      metPlayer: true,
      topicsDiscussed: [],
      lastInteraction: null
    },
    knowledgeGraph: overrides.knowledgeGraph || [
      { factId: 'public_market_info', source: 'witnessed', confidence: 0.9 },
      { factId: 'secret_war_plan', source: 'secret', confidence: 1.0 }
    ],
    secrets: overrides.secrets || ['secret_war_plan'],
    relationships: {},
    rumorIds: [],
    ...overrides,
    // Re-apply personality and conversationState since ...overrides may clobber
    personality: {
      honesty: 0.5,
      trustOfOutsiders: 0.5,
      selfPreservation: 0.5,
      ...overrides.personality
    },
    conversationState: {
      trustLevel: trust,
      metPlayer: true,
      topicsDiscussed: [],
      lastInteraction: null
    }
  };
}

function makeWorld(npc, opts = {}) {
  const npcId = npc.id;
  const turn = opts.turn ?? 3;
  const w = ensureWorld({
    ...newWorld('test-seed'),
    time: { turn, day: 1, phase: 'morning' },
    map: {
      currentNodeId: 'node_0',
      nodes: [{
        id: 'node_0',
        name: 'Crossroads',
        biome: 'plains',
        edges: [],
        settlement: { npcs: [npc] }
      }]
    },
    scene: {
      dialogue: {
        npcId,
        startedAt: 0,
        turnsInDialogue: 0,
        topicsOffered: [],
        lastAnswer: null
      },
      location: 'Crossroads'
    },
    canonLog: opts.canonLog || createCanonLog(),
    rumors: []
  });
  return w;
}

function cacheBrainDecision(canonLog, npcId, turn, decision) {
  return appendCanonEvent(canonLog, {
    id: `npcDecision:${npcId}:${turn}`,
    type: 'npcDecision',
    targetId: npcId,
    decision
  });
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('W1-01: brain share override lowers trust threshold', () => {
  it('NPC at trust 3 shares public fact when brain says share', () => {
    const npc = makeNpc('npc_w1', 3);
    const turn = 3;
    let log = createCanonLog();
    log = cacheBrainDecision(log, 'npc_w1', turn, {
      share: ['public_market_info'],
      mood: 'warm',
      approach: 'volunteer',
      why: 'test: brain wants to share'
    });

    const w = makeWorld(npc, { turn, canonLog: log });
    const { outcome } = askNpc(w, 'tell me about the market info');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.mode, 'shared', 'brain override should share at trust 3');
    assert.equal(outcome.factId, 'public_market_info');
  });
});

describe('W1-02: brain deflect override prevents sharing', () => {
  it('NPC at trust 5 deflects when brain says deflect', () => {
    const npc = makeNpc('npc_w2', 5);
    const turn = 3;
    let log = createCanonLog();
    log = cacheBrainDecision(log, 'npc_w2', turn, {
      share: [],
      mood: 'wary',
      approach: 'deflect',
      why: 'test: brain wants to deflect'
    });

    const w = makeWorld(npc, { turn, canonLog: log });
    const { outcome } = askNpc(w, 'tell me about the market info');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.mode, 'deflected', 'brain deflect should override share at trust 5');
  });
});

describe('W1-03: brain cannot override secret protection', () => {
  it('NPC at trust 4 withholds secret even when brain says share', () => {
    const npc = makeNpc('npc_w3', 4);
    const turn = 3;
    let log = createCanonLog();
    log = cacheBrainDecision(log, 'npc_w3', turn, {
      share: ['secret_war_plan'],
      mood: 'warm',
      approach: 'volunteer',
      why: 'test: brain tries to share secret'
    });

    const w = makeWorld(npc, { turn, canonLog: log });
    const { outcome } = askNpc(w, 'tell me about the war plan');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.mode, 'withheld',
      'secret protection at trust < 7 must hold regardless of brain');
  });
});

describe('W1-04: brainMood appears in outcome', () => {
  it('outcome includes brainMood from brain decision', () => {
    const npc = makeNpc('npc_w4', 5);
    const turn = 3;
    let log = createCanonLog();
    log = cacheBrainDecision(log, 'npc_w4', turn, {
      share: ['public_market_info'],
      mood: 'fearful',
      approach: 'wait_to_be_asked',
      why: 'test: mood passthrough'
    });

    const w = makeWorld(npc, { turn, canonLog: log });
    const { outcome } = askNpc(w, 'tell me about the market info');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.brainMood, 'fearful',
      'brainMood should pass through to outcome');
  });
});

describe('W1-05: fallback works without brain (regression)', () => {
  it('trust 5 NPC shares public fact via old threshold rules', () => {
    const npc = makeNpc('npc_w5', 5);
    // No cached brain decision and no canonLog → fallbackRules will run
    const w = makeWorld(npc, { turn: 3 });
    const { outcome } = askNpc(w, 'tell me about the market info');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.mode, 'shared',
      'trust 5 with public fact should share via default threshold');
    assert.equal(outcome.factId, 'public_market_info');
  });

  it('trust 2 NPC deflects public fact via old threshold rules', () => {
    const npc = makeNpc('npc_w5b', 2);
    const w = makeWorld(npc, { turn: 3 });
    const { outcome } = askNpc(w, 'tell me about the market info');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.mode, 'deflected',
      'trust 2 should deflect via default threshold');
  });

  it('trust 8 NPC shares secret via old threshold rules', () => {
    const npc = makeNpc('npc_w5c', 8);
    const w = makeWorld(npc, { turn: 3 });
    const { outcome } = askNpc(w, 'tell me about the war plan');

    assert.equal(outcome.ok, true);
    assert.equal(outcome.mode, 'shared',
      'trust 8 with secret should share via default threshold');
    assert.equal(outcome.factId, 'secret_war_plan');
  });
});
