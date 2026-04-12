// O05: Canon Log replay — NPC decisions are logged and replayed from Canon Log
// without re-querying the model.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createCanonLog, appendCanonEvent } from '../engine/csl/canonLog.js';
import { buildNpcContext, fallbackRules, findCachedDecision } from '../engine/npc/npcBrain.js';

function makeNpc(trust = 7) {
  return {
    id: 'npc_replay',
    name: 'Sera',
    role: 'scholar',
    archetype: 'scholar',
    traits: ['curious'],
    personality: { honesty: 0.8, trustOfOutsiders: 0.5, selfPreservation: 0.3 },
    conversationState: { trustLevel: trust, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'ancient_lore_era1', source: 'witnessed', confidence: 0.95 }
    ],
    secrets: [],
    relationships: {},
    rumorIds: []
  };
}

function makeWorld() {
  return { time: { turn: 2 }, rumors: [] };
}

describe('O05: Brain decision is logged to Canon Log as npcDecision event', () => {
  it('appendCanonEvent accepts npcDecision type', () => {
    let log = createCanonLog();
    const npc = makeNpc();
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about the ancients');
    const decision = fallbackRules(ctx);

    log = appendCanonEvent(log, {
      id: `npcDecision:${npc.id}:2`,
      type: 'npcDecision',
      targetId: npc.id,
      decision
    });

    assert.equal(log.events.length, 1);
    assert.equal(log.events[0].type, 'npcDecision');
    assert.equal(log.events[0].targetId, npc.id);
    assert.deepEqual(log.events[0].decision, decision);
  });
});

describe('O05: On replay, logged decision is returned without querying', () => {
  it('findCachedDecision returns the logged decision', () => {
    let log = createCanonLog();
    const npc = makeNpc();
    const world = makeWorld();
    const ctx = buildNpcContext(npc, world, 'Tell me about the ancients');
    const decision = fallbackRules(ctx);

    log = appendCanonEvent(log, {
      id: `npcDecision:${npc.id}:2`,
      type: 'npcDecision',
      targetId: npc.id,
      decision
    });

    // On "replay" — look up the cached decision.
    const cached = findCachedDecision(log, npc.id, 2);
    assert.ok(cached, 'cached decision should exist');
    assert.deepEqual(cached, decision, 'cached decision matches original');
  });

  it('findCachedDecision returns null for a different turn', () => {
    let log = createCanonLog();
    const decision = { share: [], mood: 'wary', approach: 'deflect', why: 'test' };
    log = appendCanonEvent(log, {
      id: 'npcDecision:npc_replay:2',
      type: 'npcDecision',
      targetId: 'npc_replay',
      decision
    });

    const cached = findCachedDecision(log, 'npc_replay', 99);
    assert.equal(cached, null, 'different turn should not match');
  });

  it('findCachedDecision returns null for empty log', () => {
    const log = createCanonLog();
    const cached = findCachedDecision(log, 'npc_replay', 2);
    assert.equal(cached, null);
  });
});

describe('O05: Deduplicate — same event ID is not appended twice', () => {
  it('deterministic dedupe prevents duplicate npcDecision entries', () => {
    let log = createCanonLog();
    const decision = { share: ['ancient_lore_era1'], mood: 'warm', approach: 'volunteer', why: 'high trust' };
    const evt = {
      id: 'npcDecision:npc_replay:2',
      type: 'npcDecision',
      targetId: 'npc_replay',
      decision
    };

    log = appendCanonEvent(log, evt);
    log = appendCanonEvent(log, evt);

    assert.equal(log.events.length, 1, 'duplicate events are deduped');
  });
});
