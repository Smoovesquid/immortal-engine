import test from 'node:test';
import assert from 'node:assert/strict';

import { generateSettlementNPCs } from '../engine/npc/npcGenesis.js';

const factions = [
  { id: 'civic', goal: 'Maintain order', pressure: 30, assets: [], hostility: 10, lastMove: '' },
  { id: 'shadow', goal: 'Exploit instability', pressure: 20, assets: [], hostility: 50, lastMove: '' }
];
const ecology = { corruption: 15, instability: 10, scarcity: 20 };

test('same seed produces identical NPCs', () => {
  const a = generateSettlementNPCs('node1', 'seedA', {}, factions, ecology);
  const b = generateSettlementNPCs('node1', 'seedA', {}, factions, ecology);
  assert.deepStrictEqual(a, b);
});

test('different seeds produce different NPCs', () => {
  const a = generateSettlementNPCs('node1', 'seedA', {}, factions, ecology);
  const b = generateSettlementNPCs('node1', 'seedB', {}, factions, ecology);
  // Names should differ (extremely unlikely to match across seeds)
  const namesA = a.map(n => n.name).join(',');
  const namesB = b.map(n => n.name).join(',');
  assert.notEqual(namesA, namesB);
});

test('generates 3-5 NPCs per settlement', () => {
  // Run with several seeds to test range
  for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
    const npcs = generateSettlementNPCs('n1', seed, {}, factions, ecology);
    assert.ok(npcs.length >= 3 && npcs.length <= 5, `expected 3-5 NPCs, got ${npcs.length} for seed ${seed}`);
  }
});

test('settlement with tavern has a tavern_keeper', () => {
  const npcs = generateSettlementNPCs('n1', 'seedT', {}, factions, ecology, { buildings: ['tavern'] });
  const keeper = npcs.find(n => n.role === 'tavern_keeper');
  assert.ok(keeper, 'should have a tavern_keeper when tavern building exists');
});

test('settlement with smithy has a smith', () => {
  const npcs = generateSettlementNPCs('n1', 'seedS', {}, factions, ecology, { buildings: ['smithy'] });
  const smith = npcs.find(n => n.role === 'smith');
  assert.ok(smith, 'should have a smith when smithy building exists');
});

test('NPC names are unique within settlement', () => {
  const npcs = generateSettlementNPCs('n1', 'seedU', {}, factions, ecology);
  const names = npcs.map(n => n.name);
  const unique = new Set(names);
  assert.equal(names.length, unique.size, 'all NPC names should be unique');
});

test('NPC disposition references real factions', () => {
  const npcs = generateSettlementNPCs('n1', 'seedD', {}, factions, ecology);
  for (const npc of npcs) {
    for (const f of factions) {
      assert.ok(f.id in npc.disposition, `NPC ${npc.name} should have disposition for faction ${f.id}`);
      assert.ok(typeof npc.disposition[f.id] === 'number');
      assert.ok(npc.disposition[f.id] >= -100 && npc.disposition[f.id] <= 100);
    }
  }
});

test('first NPC is affiliated with highest-pressure faction', () => {
  const npcs = generateSettlementNPCs('n1', 'seedF', {}, factions, ecology);
  // civic has pressure 30 > shadow 20
  assert.equal(npcs[0].factionId, 'civic');
});

test('NPC has correct conversationState defaults', () => {
  const npcs = generateSettlementNPCs('n1', 'seedCS', {}, factions, ecology);
  for (const npc of npcs) {
    assert.equal(npc.conversationState.metPlayer, false);
    assert.deepEqual(npc.conversationState.topicsDiscussed, []);
    assert.equal(npc.conversationState.trustLevel, 5);
    assert.equal(npc.conversationState.lastInteraction, null);
  }
});

test('high scarcity reduces NPC count (minimum 2)', () => {
  const highScarcity = { corruption: 0, instability: 0, scarcity: 80 };
  // Test several seeds — at least one should show reduced count
  let sawReduction = false;
  const normalCounts = [];
  const scarceCounts = [];
  for (const seed of ['r1', 'r2', 'r3', 'r4', 'r5']) {
    const normal = generateSettlementNPCs('n1', seed, {}, factions, ecology);
    const scarce = generateSettlementNPCs('n1', seed, {}, factions, highScarcity);
    normalCounts.push(normal.length);
    scarceCounts.push(scarce.length);
    if (scarce.length < normal.length) sawReduction = true;
    assert.ok(scarce.length >= 2, 'minimum 2 NPCs even in famine');
  }
  assert.ok(sawReduction, `scarcity should reduce NPC count at least once. Normal: [${normalCounts}], Scarce: [${scarceCounts}]`);
});

test('different nodeIds produce different NPCs', () => {
  const a = generateSettlementNPCs('nodeA', 'seed1', {}, factions, ecology);
  const b = generateSettlementNPCs('nodeB', 'seed1', {}, factions, ecology);
  const namesA = a.map(n => n.name).join(',');
  const namesB = b.map(n => n.name).join(',');
  assert.notEqual(namesA, namesB);
});
