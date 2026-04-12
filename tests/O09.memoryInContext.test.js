// O09: memory appears in buildNpcContext — NPC memory entries are passed through.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext } from '../engine/npc/npcBrain.js';

function makeNpc(memoryEntries = []) {
  return {
    id: 'npc_ctx',
    name: 'Sera',
    role: 'scholar',
    archetype: 'scholar',
    traits: ['curious'],
    personality: { honesty: 0.8, trustOfOutsiders: 0.5, selfPreservation: 0.3 },
    conversationState: { trustLevel: 5, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'ancient_lore', source: 'witnessed', confidence: 0.9 }
    ],
    secrets: [],
    relationships: {},
    rumorIds: [],
    memory: memoryEntries
  };
}

function makeWorld() {
  return { time: { turn: 1 }, rumors: [] };
}

describe('O09: buildNpcContext includes NPC memories', () => {
  it('context.memories contains the NPC memory entries', () => {
    const memories = ['Sera discussed trade with the traveler.', 'Sera withheld info about the ruins.'];
    const npc = makeNpc(memories);
    const ctx = buildNpcContext(npc, makeWorld(), 'Tell me about the ruins');
    assert.ok(Array.isArray(ctx.memories), 'context.memories is an array');
    assert.equal(ctx.memories.length, 2);
    assert.equal(ctx.memories[0], memories[0]);
    assert.equal(ctx.memories[1], memories[1]);
  });

  it('context.memories is empty array when NPC has no memories', () => {
    const npc = makeNpc([]);
    const ctx = buildNpcContext(npc, makeWorld(), 'hello');
    assert.ok(Array.isArray(ctx.memories));
    assert.equal(ctx.memories.length, 0);
  });

  it('context.memories defaults to empty array when memory field is missing', () => {
    const npc = makeNpc();
    delete npc.memory;
    const ctx = buildNpcContext(npc, makeWorld(), 'hello');
    assert.ok(Array.isArray(ctx.memories));
    assert.equal(ctx.memories.length, 0);
  });

  it('context.memories is a copy (not a reference)', () => {
    const memories = ['Original memory'];
    const npc = makeNpc(memories);
    const ctx = buildNpcContext(npc, makeWorld(), 'hi');
    ctx.memories.push('mutated');
    assert.equal(npc.memory.length, 1, 'original NPC memory not mutated');
  });
});
