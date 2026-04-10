import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    name: 'Fantasy',
    locations: ['Thornwall (1)', 'Ashford (2)'],
    objectives: ['survive the night (1)', 'find the missing merchant (2)'],
    starterLocations: ['Thornwall'],
    starterObjectives: ['survive the night'],
    sensoryMotifs: ['dust in shafts of light', 'a low hum threads through the walls'],
    complications: ['a stranger arrives', 'something goes missing'],
    npcArchetypes: ['wary guide with a secret (1)', 'injured veteran (2)'],
    toneWords: { blood: ['brutal'], grim: ['cold'], cooperative: ['warm'] },
    factionPool: [{ id: 'civic', type: 'civic' }]
  }
};

test('beginAdventure starts in a settlement', () => {
  const w = newWorld({ seed: 'start1', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const { world } = beginAdventure(w, packsById);
  const currentNode = world.map.nodes.find(n => n.id === world.map.currentNodeId);
  assert.equal(currentNode.nodeType, 'settlement', 'starting node should be a settlement');
});

test('beginAdventure decompresses starting settlement', () => {
  const w = newWorld({ seed: 'start2', fate: 0.5, pack: { primaryId: 'fantasy', mixerId: null } });
  const { world } = beginAdventure(w, packsById);
  const currentNode = world.map.nodes.find(n => n.id === world.map.currentNodeId);
  assert.ok(currentNode.settlement?.decompressed, 'starting settlement should be decompressed');
  assert.ok(currentNode.settlement?.npcs?.length > 0, 'starting settlement should have NPCs');
});

test('beginAdventure NPCs have names', () => {
  const w = newWorld({ seed: 'start3', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
  const { world } = beginAdventure(w, packsById);
  const currentNode = world.map.nodes.find(n => n.id === world.map.currentNodeId);
  for (const npc of (currentNode.settlement?.npcs ?? [])) {
    assert.ok(npc.name, `NPC should have a name, got: ${npc.name}`);
    assert.notEqual(npc.name, `the ${npc.role}`, 'NPC should have a real name, not template');
  }
});

test('beginAdventure is deterministic across calls', () => {
  const w = newWorld({ seed: 'detStart', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const a = beginAdventure(w, packsById);
  const b = beginAdventure(w, packsById);
  const npcsA = a.world.map.nodes.find(n => n.id === a.world.map.currentNodeId)?.settlement?.npcs?.map(n => n.name) ?? [];
  const npcsB = b.world.map.nodes.find(n => n.id === b.world.map.currentNodeId)?.settlement?.npcs?.map(n => n.name) ?? [];
  assert.deepEqual(npcsA, npcsB, 'NPCs should be identical across calls with same seed');
});

test('beginAdventure outcome includes NPC names', () => {
  const w = newWorld({ seed: 'start4', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const { world } = beginAdventure(w, packsById);
  // Check the begin event in timeline
  const beginEvent = world.timeline.find(e => e.kind === 'begin');
  assert.ok(beginEvent, 'should have begin event');
  assert.ok(Array.isArray(beginEvent.data.npcsPresent), 'begin event should include npcsPresent');
  assert.ok(beginEvent.data.npcsPresent.length > 0, 'begin event should have NPC names');
});
