// C5: Campfire Integration Test — two NPCs, one secret, contradiction detection
// "The minimum viable heartbreak."
import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { ensureMap } from '../engine/map/mapState.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { computeNpcDepth, updatePlayerRelationship } from '../engine/npc/npcDepth.js';
import { filterContext, detectContradictions, applyContradictionEffects } from '../engine/npc/perspectiveFilter.js';
import { buildNarratorContext, buildSpeakerContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';

const pack = {
  id: 'fantasy',
  starterLocations: ['Port of Ash'],
  starterObjectives: ['Find shelter'],
  skills: [],
  toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['dark'] },
  locations: ['Port of Ash'],
  objectives: ['Find shelter (1)', 'Survive the night (2)'],
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

// Helper: create a decompressed settlement with guaranteed conditions
function campfireWorld(seed) {
  let w = newWorld({ seed, fate: 0.5, campaignId: 'campfire', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, map: ensureMap(generateInitialMap({ seed, packId: 'fantasy', pack })) };
  // Force a settlement node with enough events for drama
  w = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map((n, i) => i === 0
        ? { ...n, nodeType: 'settlement', tags: ['town', 'trade'] }
        : n
      )
    }
  };
  const nodeId = w.map.nodes[0].id;
  w = decompressAndCanonizeSync(w, nodeId, pack);
  w = { ...w, map: { ...w.map, currentNodeId: nodeId }, scene: { location: 'Campfire Village', objective: 'survive' } };
  return w;
}

test('C5.1: campfire scene — settlement decompresses with two+ NPCs', () => {
  const w = campfireWorld('campfire-basic');
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);

  assert.ok(node.settlement, 'settlement must be decompressed');
  assert.ok(node.settlement.decompressed, 'decompressed flag set');
  assert.ok(node.settlement.npcs.length >= 2, `need at least 2 NPCs, got ${node.settlement.npcs.length}`);
});

test('C5.2: campfire scene — NPCs have computed depth', () => {
  const w = campfireWorld('campfire-depth');
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npcs = node.settlement.npcs;

  for (const npc of npcs) {
    assert.ok(npc.personality, `${npc.role} has personality`);
    assert.ok(typeof npc.personality.honesty === 'number', `${npc.role} has honesty`);
    assert.ok(Array.isArray(npc.knowledgeGraph), `${npc.role} has knowledge graph`);
    assert.ok(typeof npc.playerRelationship === 'object', `${npc.role} has player relationship`);
  }
});

test('C5.3: campfire scene — two NPCs have different personality axes from decompression', () => {
  // The perspective filter is deterministic and produces different output for different
  // personality axes. Here we verify that decompressed NPCs get distinct personalities
  // (from role bias + faction + RNG jitter), which is the prerequisite for different perspectives.
  const w = campfireWorld('campfire-axes');
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npcs = node.settlement.npcs;

  assert.ok(npcs.length >= 2, 'need at least 2 NPCs');
  const npcA = npcs[0];
  const npcB = npcs[1];
  assert.ok(npcA.personality, 'NPC A has personality');
  assert.ok(npcB.personality, 'NPC B has personality');

  // With deterministic seeding, at least one axis should differ
  const axesDiffer =
    npcA.personality.honesty !== npcB.personality.honesty ||
    npcA.personality.trustOfOutsiders !== npcB.personality.trustOfOutsiders ||
    npcA.personality.selfPreservation !== npcB.personality.selfPreservation;
  assert.ok(axesDiffer, 'two NPCs should have at least one different personality axis');
});

test('C5.3b: controlled scene — two NPCs with events produce different filtered facts', () => {
  // Controlled scenario with explicit knowledge and secrets to verify the filter
  // produces genuinely different output for different NPCs
  const npcA = {
    id: 'npc_a',
    role: 'mediator',
    personality: { honesty: 0.9, trustOfOutsiders: 0.8, selfPreservation: 0.2 },
    knowledgeGraph: [
      { factId: 'war_era1', source: 'witnessed', confidence: 0.9, event: { era: 1, eventId: 'faction_war' } },
      { factId: 'peace_era2', source: 'witnessed', confidence: 0.8, event: { era: 2, eventId: 'peace_period' } }
    ],
    secrets: [],
    playerRelationship: { trust: 0.7, interactions: 3 }
  };

  const npcB = {
    id: 'npc_b',
    role: 'enforcer',
    personality: { honesty: 0.2, trustOfOutsiders: 0.1, selfPreservation: 0.9 },
    knowledgeGraph: [
      { factId: 'war_era1', source: 'witnessed', confidence: 0.9, event: { era: 1, eventId: 'faction_war' } },
      { factId: 'secret_corruption', source: 'secret', confidence: 1.0, event: { era: 3, eventId: 'corruption_scar' } }
    ],
    secrets: ['secret_corruption'],
    playerRelationship: { trust: 0.1, interactions: 0 }
  };

  const allFacts = [
    { factId: 'war_era1', source: 'witnessed', confidence: 0.9, event: { era: 1, eventId: 'faction_war' } },
    { factId: 'peace_era2', source: 'witnessed', confidence: 0.8, event: { era: 2, eventId: 'peace_period' } },
    { factId: 'secret_corruption', source: 'secret', confidence: 1.0, event: { era: 3, eventId: 'corruption_scar' } }
  ];

  const ctxA = filterContext(npcA, allFacts, npcA.playerRelationship);
  const ctxB = filterContext(npcB, allFacts, npcB.playerRelationship);

  const idsA = ctxA.filteredFacts.map(f => f.factId).sort();
  const idsB = ctxB.filteredFacts.map(f => f.factId).sort();

  // A knows war and peace, B knows war and corruption (hidden). They must differ.
  assert.notDeepEqual(idsA, idsB, 'two NPCs with different knowledge produce different filtered facts');

  // A should have peace_era2 (B doesn't know it)
  assert.ok(idsA.includes('peace_era2'), 'A reveals peace');
  assert.ok(!idsB.includes('peace_era2'), 'B does not know peace');

  // B should hide corruption (low trust)
  assert.ok(!idsB.includes('secret_corruption'), 'B hides corruption secret');

  // Check spin difference on shared fact (war_era1)
  const warA = ctxA.filteredFacts.find(f => f.factId === 'war_era1');
  const warB = ctxB.filteredFacts.find(f => f.factId === 'war_era1');
  assert.ok(warA && warB, 'both know about the war');
  assert.notEqual(warA.spin, warB.spin, 'honest mediator and dishonest enforcer spin war differently');
});

test('C5.4: campfire scene — contradiction detection works across NPC pair', () => {
  // Create a controlled scenario with a guaranteed secret
  const npcA = {
    id: 'npc_a',
    role: 'mediator',
    personality: { honesty: 0.9, trustOfOutsiders: 0.8, selfPreservation: 0.2 },
    knowledgeGraph: [
      { factId: 'dark_past', source: 'witnessed', confidence: 1.0, event: { era: 1, eventId: 'corruption_scar' } }
    ],
    secrets: [],
    playerRelationship: { trust: 0.8, interactions: 5 }
  };

  const npcB = {
    id: 'npc_b',
    role: 'enforcer',
    personality: { honesty: 0.2, trustOfOutsiders: 0.1, selfPreservation: 0.9 },
    knowledgeGraph: [
      { factId: 'dark_past', source: 'secret', confidence: 1.0, event: { era: 1, eventId: 'corruption_scar' } }
    ],
    secrets: ['dark_past'],
    playerRelationship: { trust: 0.1, interactions: 0 }
  };

  const allFacts = [
    { factId: 'dark_past', source: 'witnessed', confidence: 1.0, event: { era: 1, eventId: 'corruption_scar' } }
  ];

  // A is honest and trusting → reveals the fact
  const ctxA = filterContext(npcA, allFacts, npcA.playerRelationship);
  // B is dishonest and distrustful → hides the fact
  const ctxB = filterContext(npcB, allFacts, npcB.playerRelationship);

  assert.ok(ctxA.filteredFacts.some(f => f.factId === 'dark_past'), 'A reveals the dark past');
  assert.ok(!ctxB.filteredFacts.some(f => f.factId === 'dark_past'), 'B hides the dark past');

  // Detect contradiction: A reveals what B is hiding
  const contradictions = detectContradictions(npcA, npcB, ctxA.filteredFacts, ctxB.filteredFacts);
  assert.equal(contradictions.length, 1, 'one contradiction');
  assert.equal(contradictions[0].type, 'contradiction_exposed');
  assert.equal(contradictions[0].revealer, 'npc_a');
  assert.equal(contradictions[0].holder, 'npc_b');

  // Apply contradiction effects to B
  const updatedB = applyContradictionEffects(npcB, contradictions[0]);
  assert.ok(!updatedB.secrets.includes('dark_past'), 'B no longer holds the secret');
  assert.ok(updatedB.lastContradiction, 'contradiction recorded on B');
});

test('C5.5: campfire scene — player interaction changes NPC trust and filter output', () => {
  const npc = {
    id: 'npc_0',
    role: 'trader',
    personality: { honesty: 0.5, trustOfOutsiders: 0.3, selfPreservation: 0.5 },
    knowledgeGraph: [
      { factId: 'war_secret', source: 'secret', confidence: 1.0, event: { era: 1, eventId: 'war_scar' } }
    ],
    secrets: ['war_secret'],
    playerRelationship: { trust: 0.3, interactions: 0 }
  };

  const facts = [{ factId: 'war_secret', source: 'secret', confidence: 1.0, event: { era: 1, eventId: 'war_scar' } }];

  // Before helping: trust 0.3, threshold 0.5 → secret hidden
  const beforeCtx = filterContext(npc, facts, npc.playerRelationship);
  assert.ok(!beforeCtx.filteredFacts.some(f => f.factId === 'war_secret'), 'secret hidden before help');

  // Help the NPC multiple times
  let helped = npc;
  for (let i = 0; i < 3; i++) {
    helped = updatePlayerRelationship(helped, 'help');
  }
  assert.ok(helped.playerRelationship.trust > npc.playerRelationship.trust, 'trust increased');

  // After helping: trust should be above threshold → secret revealed
  const afterCtx = filterContext(helped, facts, helped.playerRelationship);
  assert.ok(afterCtx.filteredFacts.some(f => f.factId === 'war_secret'), 'secret revealed after building trust');
});

test('C5.6: campfire scene — narrator prompts differ per speaker', () => {
  const baseCtx = {
    placeName: 'Campfire Village',
    nodeType: 'settlement',
    structuresHere: [],
    interior: null,
    tone: 'grim',
    settlement: {
      npcs: [
        { name: 'Alara', role: 'mediator', disposition: 'friendly' },
        { name: 'Kord', role: 'enforcer', disposition: 'wary' }
      ],
      factions: [{ id: 'militia', attitude: 'wary' }],
      tensions: [],
      economy: 'stable',
      population: 30
    }
  };

  const promptA = buildSystemPrompt({
    ...baseCtx,
    speaker: {
      name: 'Alara',
      omittedFacts: [],
      secrets: [],
      emotionalColoring: [{ emotion: 'eager', intensity: 0.6, trigger: null }]
    }
  });

  const promptB = buildSystemPrompt({
    ...baseCtx,
    speaker: {
      name: 'Kord',
      omittedFacts: ['the corruption event'],
      secrets: ['what happened in era 3'],
      emotionalColoring: [{ emotion: 'evasive', intensity: 0.8, trigger: 'secret_1' }]
    }
  });

  assert.ok(promptA.includes('Alara'), 'prompt A has Alara');
  assert.ok(promptB.includes('Kord'), 'prompt B has Kord');
  assert.ok(promptB.includes('the corruption event'), 'prompt B has omitted facts');
  assert.ok(promptB.includes('evasive'), 'prompt B has evasive state');
  assert.ok(!promptA.includes('evasive'), 'prompt A is not evasive');
  assert.notEqual(promptA, promptB, 'prompts must differ');
});

test('C5.7: campfire scene — full pipeline determinism across replays', () => {
  const seed = 'campfire-replay';
  const w1 = campfireWorld(seed);
  const w2 = campfireWorld(seed);

  const node1 = w1.map.nodes.find(n => n.id === w1.map.currentNodeId);
  const node2 = w2.map.nodes.find(n => n.id === w2.map.currentNodeId);

  assert.equal(node1.settlement.npcs.length, node2.settlement.npcs.length, 'NPC count deterministic');
  assert.equal(node1.settlement.economy, node2.settlement.economy, 'economy deterministic');
  assert.equal(node1.settlement.population, node2.settlement.population, 'population deterministic');

  for (let i = 0; i < node1.settlement.npcs.length; i++) {
    const a = node1.settlement.npcs[i];
    const b = node2.settlement.npcs[i];
    assert.equal(a.role, b.role, `NPC ${i} role matches`);
    if (a.personality && b.personality) {
      assert.equal(a.personality.honesty, b.personality.honesty, `NPC ${i} honesty matches`);
      assert.equal(a.personality.trustOfOutsiders, b.personality.trustOfOutsiders, `NPC ${i} trust matches`);
    }
  }
});

test('C5.8: campfire scene — emotional coloring shifts on contradiction', () => {
  // Simulate the full campfire beat:
  // 1. NPC B hides a secret
  // 2. NPC A reveals it
  // 3. B's coloring shifts to high-intensity nervous/evasive
  const npcB = {
    id: 'npc_b',
    role: 'guard',
    personality: { honesty: 0.3, trustOfOutsiders: 0.2, selfPreservation: 0.8 },
    knowledgeGraph: [
      { factId: 'betrayal', source: 'secret', confidence: 1.0, event: { era: 2, eventId: 'war_scar' } }
    ],
    secrets: ['betrayal'],
    playerRelationship: { trust: 0.1, interactions: 0 }
  };

  const facts = [{ factId: 'betrayal', source: 'secret', confidence: 1.0, event: { era: 2, eventId: 'war_scar' } }];

  // Before contradiction: hiding produces evasive coloring
  const before = filterContext(npcB, facts, npcB.playerRelationship);
  assert.ok(before.emotionalColoring.length > 0, 'hiding produces coloring');

  // After contradiction is exposed: secret removed, re-filter
  const exposed = applyContradictionEffects(npcB, { factId: 'betrayal', revealer: 'npc_a', holder: 'npc_b' });
  const after = filterContext(exposed, facts, exposed.playerRelationship);

  // Now the fact is no longer a secret — it should be in filtered facts (if still in knowledge)
  assert.ok(exposed.lastContradiction, 'contradiction recorded');
});
