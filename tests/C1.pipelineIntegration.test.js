// C1: Pipeline Integration — decompression + physics + narration wired end-to-end
import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { ensureMap } from '../engine/map/mapState.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { detectPhysicalInteraction } from '../engine/llmPhysics.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';

const pack = {
  id: 'fantasy',
  starterLocations: ['Port of Ash'],
  starterObjectives: ['Find shelter'],
  skills: [],
  toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['dark'] },
  locations: ['Port of Ash'],
  objectives: ['Find shelter (1)'],
  sensoryMotifs: ['dripping water'],
  factionPool: [
    { id: 'guild', name: 'Merchant Guild', type: 'trade', goal: 'Profit' },
    { id: 'militia', name: 'Town Militia', type: 'military', goal: 'Order' }
  ],
  gear: [{ name: 'torch', tags: ['light'], weight: 1, noise: 0, light: 3, bulk: 1 }],
  complications: [],
  omens: [],
  prices: []
};
const packsById = { fantasy: pack };

function makeSettlementWorld(seed) {
  let w = newWorld({ seed, fate: 0.3, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, map: ensureMap(generateInitialMap({ seed, packId: 'fantasy', pack })) };
  // Find a settlement node or force one
  const settlementNode = w.map.nodes.find(n => n.nodeType === 'settlement');
  if (settlementNode) return w;
  // Force first node to be settlement
  w = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map((n, i) => i === 0
        ? { ...n, nodeType: 'settlement', tags: [...(n.tags || []), 'village'] }
        : n
      )
    }
  };
  return w;
}

test('C1.1: decompressAndCanonizeSync produces settlement with NPCs and history', () => {
  let w = makeSettlementWorld('c1-decomp');
  const nodeId = w.map.nodes.find(n => n.nodeType === 'settlement')?.id;
  assert.ok(nodeId, 'settlement node must exist');

  const w2 = decompressAndCanonizeSync(w, nodeId, pack);
  const node = w2.map.nodes.find(n => n.id === nodeId);

  assert.ok(node.settlement, 'settlement must be canonized');
  assert.ok(node.settlement.decompressed, 'settlement must be marked decompressed');
  assert.ok(Array.isArray(node.settlement.npcs), 'npcs array exists');
  assert.ok(node.settlement.npcs.length > 0, 'at least one NPC');
  assert.ok(typeof node.settlement.economy === 'string', 'economy is string');
  assert.ok(typeof node.settlement.population === 'number', 'population is number');
});

test('C1.2: decompression is idempotent — second call returns same world', () => {
  let w = makeSettlementWorld('c1-idempotent');
  const nodeId = w.map.nodes.find(n => n.nodeType === 'settlement')?.id;
  const w2 = decompressAndCanonizeSync(w, nodeId, pack);
  const w3 = decompressAndCanonizeSync(w2, nodeId, pack);
  assert.deepEqual(w2, w3, 'second decompression must be no-op');
});

test('C1.3: decompression is deterministic — same seed produces same settlement', () => {
  const seed = 'c1-determinism';
  let w1 = makeSettlementWorld(seed);
  let w2 = makeSettlementWorld(seed);
  const nodeId = w1.map.nodes.find(n => n.nodeType === 'settlement')?.id;

  const r1 = decompressAndCanonizeSync(w1, nodeId, pack);
  const r2 = decompressAndCanonizeSync(w2, nodeId, pack);

  const s1 = r1.map.nodes.find(n => n.id === nodeId).settlement;
  const s2 = r2.map.nodes.find(n => n.id === nodeId).settlement;

  assert.equal(s1.npcs.length, s2.npcs.length, 'NPC count must match');
  assert.equal(s1.economy, s2.economy, 'economy must match');
  assert.equal(s1.population, s2.population, 'population must match');
});

test('C1.4: narrator context includes settlement data after decompression', () => {
  let w = makeSettlementWorld('c1-narrator');
  const nodeId = w.map.nodes.find(n => n.nodeType === 'settlement')?.id;
  w = decompressAndCanonizeSync(w, nodeId, pack);
  // Move to the settlement node
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };

  const ctx = buildNarratorContext(w);
  assert.ok(ctx.settlement, 'narrator context must include settlement');
  assert.ok(Array.isArray(ctx.settlement.npcs), 'settlement.npcs in context');
  assert.ok(ctx.settlement.npcs.length > 0, 'at least one NPC in context');
  assert.ok(typeof ctx.settlement.economy === 'string', 'economy in context');
});

test('C1.5: physics detection finds furniture at current node', () => {
  let w = makeSettlementWorld('c1-physics');
  w = beginAdventure(w, packsById).world;
  // Add furniture to current node
  const nodeId = w.map.currentNodeId;
  w = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n => n.id === nodeId
        ? { ...n, furniture: [{ name: 'wooden table', parts: ['leg', 'top'], state: 'intact', tags: ['wood'], weight: 3, bulk: 4 }] }
        : n
      )
    }
  };

  const result = detectPhysicalInteraction(w, 'I examine the wooden table');
  assert.ok(result.detected, 'should detect physical interaction with table');
  assert.ok(result.matches.length > 0, 'should have at least one match');
  assert.equal(result.matches[0].name, 'wooden table');
});
