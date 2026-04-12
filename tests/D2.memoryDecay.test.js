// D2: Memory decay + consolidation — NPC memories lose salience over turns,
// important memories decay slower, low-salience memories consolidate,
// and faded memories no longer trigger trust boosts.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMemoryEntry,
  decayMemories,
  consolidateMemories,
  extractMemory
} from '../engine/npc/npcMemory.js';
import { ensureWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { buildNpcContext, fallbackRules } from '../engine/npc/npcBrain.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeWorldWithNpc(npcOverrides = {}, worldOverrides = {}) {
  const npc = {
    id: 'npc_decay',
    name: 'Elara',
    role: 'herbalist',
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    conversationState: { metPlayer: true, topicsDiscussed: [], trustLevel: 5, lastInteraction: null },
    knowledgeGraph: [{ factId: 'herb_lore', source: 'local', confidence: 1.0, event: null }],
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
  return ensureWorld({
    map: {
      nodes: [node],
      edges: [],
      discovered: ['node_0'],
      currentNodeId: 'node_0'
    },
    ...worldOverrides
  });
}

function getNpcMemory(w) {
  const node = w.map.nodes.find(n => n.id === 'node_0');
  const npc = node.settlement.npcs.find(n => n.id === 'npc_decay');
  return npc.memory;
}

// ── D2-01: memories lose salience over turns ────────────────────────────────

describe('D2-01: memories lose salience over turns', () => {
  it('memory at turn 0 decayed at turn 20 has reduced salience', () => {
    const memories = [
      { text: 'Elara discussed herb_lore with the traveler (trust: 5).', turn: 0, salience: 0.9 }
    ];
    const decayed = decayMemories(memories, 20);
    assert.equal(decayed.length, 1);
    // age=20, floor(20/5)=4 intervals, 4*0.1=0.4 decay, 0.9-0.4=0.5
    assert.equal(decayed[0].salience, 0.5);
  });

  it('salience floors at 0.1, never reaches 0', () => {
    const memories = [
      { text: 'Elara spoke about general matters.', turn: 0, salience: 0.5 }
    ];
    const decayed = decayMemories(memories, 100);
    assert.equal(decayed[0].salience, 0.1);
  });
});

// ── D2-02: important memories decay slower ──────────────────────────────────

describe('D2-02: important memories decay at half rate', () => {
  it('secret keyword memory has higher salience than generic at same age', () => {
    const memories = [
      { text: 'Elara revealed a secret about the mine.', turn: 0, salience: 0.9 },
      { text: 'Elara discussed trade_routes with the traveler.', turn: 0, salience: 0.9 }
    ];
    const decayed = decayMemories(memories, 30);
    // secret: age=30, floor(30/5)=6, 6*0.05=0.3, 0.9-0.3=0.6
    // generic: age=30, floor(30/5)=6, 6*0.1=0.6, 0.9-0.6=0.3
    assert.equal(decayed[0].salience, 0.6, 'secret memory decays slower');
    assert.equal(decayed[1].salience, 0.3, 'generic memory decays faster');
    assert.ok(decayed[0].salience > decayed[1].salience);
  });
});

// ── D2-03: consolidation merges similar old memories ────────────────────────

describe('D2-03: consolidation merges similar low-salience memories', () => {
  it('3 memories about dragon_sighting consolidate to 1', () => {
    const memories = [
      { text: 'Elara discussed dragon_sighting with the traveler (trust: 5).', turn: 0, salience: 0.2 },
      { text: 'Elara discussed dragon_sighting with the traveler (trust: 6).', turn: 5, salience: 0.2 },
      { text: 'Elara discussed dragon_sighting with the traveler (trust: 7).', turn: 10, salience: 0.15 }
    ];
    const result = consolidateMemories(memories);
    assert.equal(result.length, 1, 'consolidated to 1 entry');
    assert.ok(result[0].text.includes('dragon_sighting'), 'summary mentions topic');
  });
});

// ── D2-04: consolidated memory preserves key info ───────────────────────────

describe('D2-04: consolidated memory preserves topic and name', () => {
  it('summary text contains NPC name and topic', () => {
    const memories = [
      { text: 'Brynn discussed herb_lore with the traveler (trust: 5).', turn: 0, salience: 0.25 },
      { text: 'Brynn discussed herb_lore with the traveler (trust: 6).', turn: 5, salience: 0.2 }
    ];
    const result = consolidateMemories(memories);
    assert.equal(result.length, 1);
    assert.ok(result[0].text.includes('Brynn'), 'summary includes NPC name');
    assert.ok(result[0].text.includes('herb_lore'), 'summary includes topic');
    assert.equal(result[0].salience, 0.25, 'salience = max of group');
    assert.equal(result[0].turn, 5, 'turn = latest of group');
  });
});

// ── D2-05: fresh memories unaffected by decay ───────────────────────────────

describe('D2-05: fresh memories are unaffected by decay', () => {
  it('memory at turn 10 decayed at turn 10 has unchanged salience', () => {
    const memories = [
      { text: 'Elara shared something.', turn: 10, salience: 0.9 }
    ];
    const decayed = decayMemories(memories, 10);
    assert.equal(decayed[0].salience, 0.9, 'no decay for zero-age memory');
  });

  it('memory at turn 10 decayed at turn 13 has unchanged salience (under 5-turn threshold)', () => {
    const memories = [
      { text: 'Elara shared something.', turn: 10, salience: 0.9 }
    ];
    const decayed = decayMemories(memories, 13);
    assert.equal(decayed[0].salience, 0.9, 'no decay under 5 turns');
  });
});

// ── D2-06: backward compat — string entries normalize correctly ─────────────

describe('D2-06: backward compat — string entries normalize', () => {
  it('plain string normalizes to { text, turn: 0, salience: 1.0 }', () => {
    const result = normalizeMemoryEntry('Marta discussed trade with the traveler.');
    assert.deepStrictEqual(result, {
      text: 'Marta discussed trade with the traveler.',
      turn: 0,
      salience: 1.0
    });
  });

  it('object entry normalizes with clamping', () => {
    const result = normalizeMemoryEntry({ text: 'test', turn: -5, salience: 2.0 });
    assert.equal(result.text, 'test');
    assert.equal(result.turn, 0, 'negative turn clamped to 0');
    assert.equal(result.salience, 1.0, 'salience clamped to 1.0');
  });

  it('null/undefined input normalizes to empty entry', () => {
    const result = normalizeMemoryEntry(null);
    assert.equal(result.text, '');
    assert.equal(result.turn, 0);
    assert.equal(result.salience, 0);
  });

  it('decayMemories handles mixed string and object entries', () => {
    const memories = [
      'Marta discussed trade with the traveler (trust: 5).',
      { text: 'Marta shared a secret.', turn: 5, salience: 0.8 }
    ];
    const decayed = decayMemories(memories, 15);
    assert.equal(decayed.length, 2);
    // String entry: turn=0, salience=1.0, age=15, floor(15/5)=3, decay=0.3, result=0.7
    assert.equal(decayed[0].salience, 0.7);
    assert.equal(decayed[0].text, 'Marta discussed trade with the traveler (trust: 5).');
    // Object entry: turn=5, salience=0.8, age=10, floor(10/5)=2
    // "secret" keyword -> half rate: 2*0.05=0.1, 0.8-0.1=0.7
    assert.equal(decayed[1].salience, 0.7);
  });
});

// ── D2-07: salience threshold blocks memory match in fallback ───────────────

describe('D2-07: faded memory does not boost trust in fallbackRules', () => {
  it('memory with salience 0.15 does NOT trigger trust boost', () => {
    const context = {
      npcId: 'npc_decay',
      name: 'Elara',
      archetype: 'herbalist',
      traits: [],
      personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
      trust: 5,
      mood: 'wary',
      knownFacts: [{ id: 'herb_lore', text: 'Local herb lore', priority: 1 }],
      carriedRumors: [],
      relationships: [],
      memories: [
        { text: 'Elara discussed herb_lore with the traveler (trust: 5).', turn: 0, salience: 0.15 }
      ],
      playerInput: 'tell me about herb_lore',
      turn: 50,
      secrets: new Set()
    };
    const decision = fallbackRules(context);
    // At trust 5 without boost, approach should be wait_to_be_asked (medium trust)
    assert.equal(decision.approach, 'wait_to_be_asked');
    // Should share exactly one fact (medium trust behavior, not high trust volunteer)
    assert.ok(decision.share.length <= 1, 'medium trust shares at most 1');
  });

  it('memory with salience 0.5 DOES trigger trust boost', () => {
    const context = {
      npcId: 'npc_decay',
      name: 'Elara',
      archetype: 'herbalist',
      traits: [],
      personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
      trust: 6,
      mood: 'wary',
      knownFacts: [{ id: 'herb_lore', text: 'Local herb lore', priority: 1 }],
      carriedRumors: [],
      relationships: [],
      memories: [
        { text: 'Elara discussed herb_lore with the traveler (trust: 5).', turn: 10, salience: 0.5 }
      ],
      playerInput: 'tell me about herb_lore',
      turn: 20,
      secrets: new Set()
    };
    const decision = fallbackRules(context);
    // trust 6 + memory boost = effectiveTrust 7 → high trust → volunteer
    assert.equal(decision.approach, 'volunteer');
    assert.equal(decision.mood, 'warm');
  });
});

// ── D2-08: object memory entry round-trips through npcMemoryAdd delta ───────

describe('D2-08: object memory entry round-trips through npcMemoryAdd', () => {
  it('object entry with text/turn/salience is stored as-is', () => {
    const w = makeWorldWithNpc();
    const w1 = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_decay', entry: { text: 'Elara discussed herb_lore.', turn: 5, salience: 0.9 } }
    ]);
    const mem = getNpcMemory(w1);
    assert.equal(mem.length, 1);
    assert.equal(typeof mem[0], 'object');
    assert.equal(mem[0].text, 'Elara discussed herb_lore.');
    assert.equal(mem[0].turn, 5);
    assert.equal(mem[0].salience, 0.9);
  });

  it('string entry is still stored as string (backward compat)', () => {
    const w = makeWorldWithNpc();
    const w1 = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_decay', entry: 'Plain string memory.' }
    ]);
    const mem = getNpcMemory(w1);
    assert.equal(mem.length, 1);
    assert.equal(mem[0], 'Plain string memory.');
  });

  it('object entry deduplicates by text content', () => {
    let w = makeWorldWithNpc();
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_decay', entry: { text: 'Same text.', turn: 1, salience: 0.9 } }
    ]);
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_decay', entry: { text: 'Same text.', turn: 2, salience: 0.8 } }
    ]);
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 1, 'deduplicated by text content');
  });

  it('mixed string and object entries coexist', () => {
    let w = makeWorldWithNpc();
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_decay', entry: 'String memory.' }
    ]);
    w = applyDeltas(w, [
      { op: 'npcMemoryAdd', npcId: 'npc_decay', entry: { text: 'Object memory.', turn: 3, salience: 0.7 } }
    ]);
    const mem = getNpcMemory(w);
    assert.equal(mem.length, 2);
    assert.equal(typeof mem[0], 'string');
    assert.equal(typeof mem[1], 'object');
  });
});

// ── D2-09: extractMemory returns structured entry with turn + salience ──────

describe('D2-09: extractMemory returns structured { text, turn, salience }', () => {
  it('shared mode returns object with salience 0.9', () => {
    const npc = { name: 'Marta', conversationState: { trustLevel: 6 } };
    const result = extractMemory(npc, 'trade?', null, {
      mode: 'shared', topic: 'trade_routes', trustLevel: 6
    }, 10);
    assert.equal(typeof result, 'object');
    assert.equal(typeof result.text, 'string');
    assert.ok(result.text.includes('discussed'));
    assert.equal(result.turn, 10);
    assert.equal(result.salience, 0.9);
  });

  it('recruited mode returns salience 1.0', () => {
    const npc = { name: 'Aldric', conversationState: { trustLevel: 7 } };
    const result = extractMemory(npc, 'invite to travel', null, {
      mode: 'recruited', topic: '', trustLevel: 7
    }, 20);
    assert.equal(result.salience, 1.0);
    assert.equal(result.turn, 20);
  });

  it('deflected with no topic still returns null', () => {
    const npc = { name: 'Marta', conversationState: { trustLevel: 5 } };
    const result = extractMemory(npc, 'hello', null, { mode: 'deflected', topic: '' }, 5);
    assert.equal(result, null);
  });
});
