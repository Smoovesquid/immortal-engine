// O12: memory cap FIFO — adding 15 memories results in 12, oldest evicted.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';

function makeWorldWithNpc(existingMemory = []) {
  const npc = {
    id: 'npc_fifo',
    name: 'Brynn',
    role: 'trader',
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    conversationState: { metPlayer: true, topicsDiscussed: [], trustLevel: 5, lastInteraction: null },
    knowledgeGraph: [],
    secrets: [],
    relationships: {},
    rumorIds: [],
    memory: existingMemory
  };
  const node = {
    id: 'node_fifo',
    name: 'Test Town',
    tags: ['settlement'],
    motifs: [],
    scars: [],
    nodeType: 'settlement',
    settlement: { npcs: [npc], buildings: [], history: [] }
  };
  return ensureWorld({
    map: {
      nodes: [node],
      edges: [],
      discovered: ['node_fifo'],
      currentNodeId: 'node_fifo'
    }
  });
}

function getNpcMemory(w) {
  const node = w.map.nodes.find(n => n.id === 'node_fifo');
  const npc = node.settlement.npcs.find(n => n.id === 'npc_fifo');
  return npc.memory;
}

describe('O12: Memory cap FIFO eviction', () => {
  it('adding 15 memories sequentially results in only 12 remaining', () => {
    let w = makeWorldWithNpc();
    for (let i = 0; i < 15; i++) {
      w = applyDeltas(w, [
        { op: 'npcMemoryAdd', npcId: 'npc_fifo', entry: `Memory entry ${i}` }
      ]);
    }
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 12, 'exactly 12 memories after adding 15');
  });

  it('the oldest 3 entries were evicted (FIFO)', () => {
    let w = makeWorldWithNpc();
    for (let i = 0; i < 15; i++) {
      w = applyDeltas(w, [
        { op: 'npcMemoryAdd', npcId: 'npc_fifo', entry: `Memory entry ${i}` }
      ]);
    }
    const mem = getNpcMemory(w);
    assert.ok(!mem.includes('Memory entry 0'), 'entry 0 evicted');
    assert.ok(!mem.includes('Memory entry 1'), 'entry 1 evicted');
    assert.ok(!mem.includes('Memory entry 2'), 'entry 2 evicted');
  });

  it('the newest 12 entries survived', () => {
    let w = makeWorldWithNpc();
    for (let i = 0; i < 15; i++) {
      w = applyDeltas(w, [
        { op: 'npcMemoryAdd', npcId: 'npc_fifo', entry: `Memory entry ${i}` }
      ]);
    }
    const mem = getNpcMemory(w);
    for (let i = 3; i < 15; i++) {
      assert.ok(mem.includes(`Memory entry ${i}`), `entry ${i} survived`);
    }
  });

  it('order is preserved — oldest surviving entry is first', () => {
    let w = makeWorldWithNpc();
    for (let i = 0; i < 15; i++) {
      w = applyDeltas(w, [
        { op: 'npcMemoryAdd', npcId: 'npc_fifo', entry: `Memory entry ${i}` }
      ]);
    }
    const mem = getNpcMemory(w);
    assert.equal(mem[0], 'Memory entry 3', 'first element is oldest surviving');
    assert.equal(mem[11], 'Memory entry 14', 'last element is newest');
  });
});

describe('O12: ensureMap normalizes memory cap on load', () => {
  it('NPC with 15 pre-existing memories is truncated to 12 by ensureWorld', () => {
    const oversize = [];
    for (let i = 0; i < 15; i++) oversize.push(`Pre-existing ${i}`);
    const w = makeWorldWithNpc(oversize);
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 12, 'ensureMap truncates to 12');
    // slice(0, 12) keeps the first 12
    assert.equal(mem[0], 'Pre-existing 0');
    assert.equal(mem[11], 'Pre-existing 11');
  });
});
