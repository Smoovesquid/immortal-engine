// O07: npcMemoryAdd delta op — adds entries, respects cap of 12, deduplicates.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';

function makeWorldWithNpc(npcOverrides = {}) {
  const npc = {
    id: 'npc_mem_test',
    name: 'Aldric',
    role: 'guard',
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    conversationState: { metPlayer: true, topicsDiscussed: [], trustLevel: 5, lastInteraction: null },
    knowledgeGraph: [],
    secrets: [],
    relationships: {},
    rumorIds: [],
    memory: [],
    ...npcOverrides
  };
  const node = {
    id: 'node_0',
    name: 'Test Village',
    tags: ['settlement'],
    motifs: [],
    scars: [],
    nodeType: 'settlement',
    settlement: { npcs: [npc], buildings: [], history: [] }
  };
  const w = ensureWorld({
    map: {
      nodes: [node],
      edges: [],
      discovered: ['node_0'],
      currentNodeId: 'node_0'
    }
  });
  return w;
}

function getNpcMemory(w) {
  const node = w.map.nodes.find(n => n.id === 'node_0');
  const npc = node.settlement.npcs.find(n => n.id === 'npc_mem_test');
  return npc.memory;
}

describe('O07: npcMemoryAdd delta adds entry to npc.memory', () => {
  it('adds a single memory entry', () => {
    const w = makeWorldWithNpc();
    const w1 = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: 'Discussed trade routes.' }
    ]);
    const mem = getNpcMemory(w1);
    assert.equal(mem.length, 1);
    assert.equal(mem[0], 'Discussed trade routes.');
  });

  it('adds multiple distinct entries', () => {
    let w = makeWorldWithNpc();
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: 'Entry A' }
    ]);
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: 'Entry B' }
    ]);
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 2);
    assert.equal(mem[0], 'Entry A');
    assert.equal(mem[1], 'Entry B');
  });
});

describe('O07: npcMemoryAdd respects cap of 12 (FIFO eviction)', () => {
  it('adding 15 entries results in only 12 remaining, newest survive', () => {
    let w = makeWorldWithNpc();
    for (let i = 0; i < 15; i++) {
      w = applyDeltas(w, [
        { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: `Memory ${i}` }
      ]);
    }
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 12);
    // Oldest 3 (0, 1, 2) should be evicted
    assert.ok(!mem.includes('Memory 0'), 'oldest evicted');
    assert.ok(!mem.includes('Memory 1'), 'second oldest evicted');
    assert.ok(!mem.includes('Memory 2'), 'third oldest evicted');
    // Newest 12 (3..14) survive
    for (let i = 3; i < 15; i++) {
      assert.ok(mem.includes(`Memory ${i}`), `Memory ${i} should survive`);
    }
  });
});

describe('O07: npcMemoryAdd deduplicates exact string matches', () => {
  it('same entry applied twice results in only one copy', () => {
    let w = makeWorldWithNpc();
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: 'Duplicate entry' }
    ]);
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: 'Duplicate entry' }
    ]);
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 1);
    assert.equal(mem[0], 'Duplicate entry');
  });
});

describe('O07: npcMemoryAdd ignores empty or missing fields', () => {
  it('empty entry is ignored', () => {
    const w = makeWorldWithNpc();
    const w1 = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_mem_test', entry: '' }
    ]);
    assert.equal(getNpcMemory(w1).length, 0);
  });

  it('missing npcId is ignored', () => {
    const w = makeWorldWithNpc();
    const w1 = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: '', entry: 'Test' }
    ]);
    assert.equal(getNpcMemory(w1).length, 0);
  });
});
