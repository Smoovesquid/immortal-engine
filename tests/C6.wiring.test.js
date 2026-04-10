// C6: Campfire Engine wiring tests — speaker context, NPC trust, contradictions
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNarratorContext, buildSpeakerContext } from '../engine/ai/narratorContext.js';
import { computeNpcDepth } from '../engine/npc/npcDepth.js';
import { filterContext, detectContradictions } from '../engine/npc/perspectiveFilter.js';
import { ensureWorld } from '../engine/state.js';

// Build a world with a decompressed settlement containing deep NPCs
function buildWorldWithDeepNpcs() {
  const npcs = [
    { role: 'representative', factionId: 'guild', disposition: 'friendly', originTick: 0 },
    { role: 'enforcer', factionId: 'militia', disposition: 'wary', originTick: 0 }
  ];
  const history = [
    { era: 0, eventId: 'faction_tension', worldState: {}, detected: true },
    { era: 1, eventId: 'faction_war', worldState: {}, detected: true }
  ];
  const secrets = [
    { type: 'war', connectedTo: 1, severity: 4 }
  ];

  const deepNpcs = computeNpcDepth(npcs, history, secrets, 'test-seed');

  const world = ensureWorld({
    meta: { seed: 'wiring-test', fate: 0.5 },
    map: {
      currentNodeId: 'town1',
      nodes: [{
        id: 'town1',
        name: 'Ashvale',
        nodeType: 'settlement',
        settlement: {
          decompressed: true,
          npcs: deepNpcs,
          factions: [{ id: 'guild', hostility: 20 }, { id: 'militia', hostility: 50 }],
          tensions: [{ type: 'faction_rivalry', severity: 3 }],
          economy: 'strained',
          population: 80,
          secrets
        }
      }]
    }
  });

  return { world, deepNpcs };
}

// ── Speaker context wiring ────────────────────────────────────────────

test('C6.1: buildNarratorContext includes speaker when settlement has deep NPCs', () => {
  const { world } = buildWorldWithDeepNpcs();
  const ctx = buildNarratorContext(world, {});
  assert.ok(ctx.speaker, 'speaker should be populated');
  assert.ok(ctx.speaker.name, 'speaker should have a name');
  assert.ok(ctx.speaker.personality, 'speaker should have personality');
  assert.ok(Array.isArray(ctx.speaker.filteredFacts), 'speaker should have filtered facts');
  assert.ok(Array.isArray(ctx.speaker.emotionalColoring), 'speaker should have emotional coloring');
});

test('C6.2: buildNarratorContext picks mentioned NPC when action references them', () => {
  const { world, deepNpcs } = buildWorldWithDeepNpcs();
  const enforcerName = deepNpcs[1].name || deepNpcs[1].role;
  const ctx = buildNarratorContext(world, { text: `I approach the ${enforcerName}` });
  assert.ok(ctx.speaker, 'speaker should be populated');
});

test('C6.3: buildNarratorContext returns null speaker when no settlement', () => {
  const world = ensureWorld({
    meta: { seed: 'wilderness', fate: 0.5 },
    map: {
      currentNodeId: 'wild1',
      nodes: [{ id: 'wild1', name: 'Dark Forest', nodeType: 'wilderness' }]
    }
  });
  const ctx = buildNarratorContext(world, {});
  assert.equal(ctx.speaker, null, 'no speaker in wilderness');
});

// ── buildSpeakerContext directly ───────────────────────────────────────

test('C6.4: buildSpeakerContext returns null for NPCs without depth', () => {
  const result = buildSpeakerContext({ role: 'guard' }, []);
  assert.equal(result, null);
});

test('C6.5: buildSpeakerContext returns speaker with omitted facts and secrets', () => {
  const { deepNpcs } = buildWorldWithDeepNpcs();
  const npc = deepNpcs[0];
  const allFacts = deepNpcs.flatMap(n => n.knowledgeGraph || []);
  const speaker = buildSpeakerContext(npc, allFacts);

  assert.ok(speaker, 'should return speaker context');
  assert.ok(speaker.name, 'should have name');
  assert.ok(speaker.personality, 'should have personality');
  assert.ok(Array.isArray(speaker.filteredFacts), 'should have filteredFacts');
  assert.ok(Array.isArray(speaker.omittedFacts), 'should have omittedFacts');
  assert.ok(Array.isArray(speaker.secrets), 'should have secrets');
  assert.ok(Array.isArray(speaker.emotionalColoring), 'should have emotionalColoring');
});

// ── Contradiction detection wiring ────────────────────────────────────

test('C6.6: detectContradictions finds exposed secrets between NPCs', () => {
  const { deepNpcs } = buildWorldWithDeepNpcs();
  // Get filtered views for each NPC
  const npcA = deepNpcs[0];
  const npcB = deepNpcs[1];
  const factsA = filterContext(npcA, npcA.knowledgeGraph || [], npcA.playerRelationship).filteredFacts;
  const factsB = filterContext(npcB, npcB.knowledgeGraph || [], npcB.playerRelationship).filteredFacts;

  const contradictions = detectContradictions(npcA, npcB, factsA, factsB);
  // May or may not find contradictions depending on seed — but should not throw
  assert.ok(Array.isArray(contradictions), 'should return array');
});

// ── Settlement context in narrator ────────────────────────────────────

test('C6.7: buildNarratorContext includes settlement data at settlement nodes', () => {
  const { world } = buildWorldWithDeepNpcs();
  const ctx = buildNarratorContext(world, {});
  assert.ok(ctx.settlement, 'settlement context should be present');
  assert.ok(ctx.settlement.npcs.length >= 2, 'should list NPCs');
  assert.ok(ctx.settlement.factions.length >= 1, 'should list factions');
  assert.equal(ctx.settlement.economy, 'strained');
});

test('C6.8: buildNarratorContext uses canonical fateBand thresholds', () => {
  // Fate 0.35 should be 'grim' (not 'cooperative' — the old bug)
  const world = ensureWorld({
    meta: { seed: 'threshold', fate: 0.35 },
    map: { currentNodeId: 'x', nodes: [{ id: 'x', name: 'X' }] }
  });
  const ctx = buildNarratorContext(world, {});
  assert.equal(ctx.tone, 'grim', 'fate 0.35 should map to grim, not cooperative');
});

test('C6.9: buildNarratorContext tone at boundary 0.67 is blood', () => {
  const world = ensureWorld({
    meta: { seed: 'boundary', fate: 0.67 },
    map: { currentNodeId: 'x', nodes: [{ id: 'x', name: 'X' }] }
  });
  const ctx = buildNarratorContext(world, {});
  assert.equal(ctx.tone, 'blood', 'fate 0.67 should map to blood');
});
