import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { buildNarratorContext, buildDMContext } from '../engine/ai/narratorContext.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';

function makeWorld() {
  let w = newWorld({ seed: 'dm-ctx', fate: 0.5, pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, scene: { location: 'Thornwall', objective: 'survive', time: 'start', promptSeed: 'p1', tags: [], thread: '' } };
  w = { ...w, party: [{ id: 'party', name: 'Kael', stats: { MIGHT: 14, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 10 }, wounds: 1, stress: 2, inventory: { weapons: [{ name: 'Iron Sword' }], armor: [{ name: 'Leather Vest' }], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] }, traits: {}, background: {}, signature: {}, position: { zone: 'far' } }] };
  return w;
}

test('buildNarratorContext returns original slim format', () => {
  const w = makeWorld();
  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.placeName);
  assert.ok(ctx.nodeType);
  assert.ok(typeof ctx.fate === 'number');
  assert.ok(typeof ctx.tone === 'string');
});

test('buildDMContext returns scene, npcsPresent, worldPressure, player, rules', () => {
  const w = makeWorld();
  const ctx = buildDMContext(w, {}, {});
  assert.ok(ctx.scene);
  assert.ok(Array.isArray(ctx.npcsPresent));
  assert.ok(ctx.worldPressure);
  assert.ok(ctx.player);
  assert.ok(ctx.rules);
});

test('DM context scene includes exits and timeOfDay', () => {
  const w = makeWorld();
  const ctx = buildDMContext(w, {}, {});
  assert.ok(Array.isArray(ctx.scene.location.exits));
  assert.ok(typeof ctx.scene.timeOfDay === 'string');
  assert.ok(['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'].includes(ctx.scene.timeOfDay));
});

test('DM context player includes name, stats, wounds, stress', () => {
  const w = makeWorld();
  const ctx = buildDMContext(w, {}, {});
  assert.equal(ctx.player.name, 'Kael');
  assert.equal(ctx.player.wounds, 1);
  assert.equal(ctx.player.stress, 2);
  assert.equal(ctx.player.stats.MIGHT, 14);
  assert.ok(ctx.player.weapons.length > 0);
});

test('DM context worldPressure includes factions and ecology', () => {
  const w = makeWorld();
  const ctx = buildDMContext(w, {}, {});
  assert.ok(typeof ctx.worldPressure.factionSummary === 'string');
  assert.ok(typeof ctx.worldPressure.ecologySummary === 'string');
  assert.ok(Array.isArray(ctx.worldPressure.activeScars));
  assert.ok(Array.isArray(ctx.worldPressure.activeThreads));
});

test('DM context rules includes setting and diceSystem', () => {
  const w = makeWorld();
  const ctx = buildDMContext(w, {}, { name: 'Dark Fantasy' });
  assert.ok(typeof ctx.rules.setting === 'string');
  assert.equal(ctx.rules.diceSystem, 'd20, DC set by engine, report result to engine');
});

test('DM context includes NPCs after decompression', () => {
  let w = makeWorld();
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (settlements.length === 0) return; // skip if no settlements in this seed

  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);

  const ctx = buildDMContext(w, {}, pack);
  assert.ok(ctx.npcsPresent.length > 0, 'should have NPCs after decompression');
  assert.ok(ctx.npcsPresent[0].name, 'NPC should have a name');
  assert.ok(ctx.npcsPresent[0].role, 'NPC should have a role');
  assert.ok(ctx.npcsPresent[0].conversationState, 'NPC should have conversationState');
});

test('DM context first NPC has full detail, others are summaries', () => {
  let w = makeWorld();
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (settlements.length === 0) return;

  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);

  const ctx = buildDMContext(w, {}, pack);
  if (ctx.npcsPresent.length > 0) {
    // First NPC should have publicKnowledge and secrets
    assert.ok('publicKnowledge' in ctx.npcsPresent[0], 'first NPC should have publicKnowledge');
    assert.ok('secrets' in ctx.npcsPresent[0], 'first NPC should have secrets');
  }
  if (ctx.npcsPresent.length > 1) {
    // Second NPC should NOT have full detail
    assert.ok(!('publicKnowledge' in ctx.npcsPresent[1]), 'secondary NPC should be summary only');
  }
});

test('world whisper returns most recent worldTick event', () => {
  let w = makeWorld();
  w = { ...w, timeline: [
    ...w.timeline,
    { t: 0, kind: 'worldTick', data: { text: '[TICK] faction civic enters war posture' } }
  ]};
  const ctx = buildDMContext(w, {}, {});
  assert.ok(ctx.worldWhisper);
  assert.ok(ctx.worldWhisper.includes('faction civic'));
});
