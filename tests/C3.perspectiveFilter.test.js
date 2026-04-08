// C3: Perspective Filter — deterministic filtering of what NPCs reveal
import test from 'node:test';
import assert from 'node:assert/strict';

import { filterContext, detectContradictions, applyContradictionEffects } from '../engine/npc/perspectiveFilter.js';

function makeNpc(overrides = {}) {
  return {
    id: 'npc_0',
    role: 'trader',
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    knowledgeGraph: [
      { factId: 'war_era1', source: 'witnessed', confidence: 0.9, event: { era: 1, eventId: 'faction_war' } },
      { factId: 'peace_era2', source: 'witnessed', confidence: 0.8, event: { era: 2, eventId: 'peace_period' } },
      { factId: 'secret_corruption_era3', source: 'secret', confidence: 1.0, event: { era: 3, eventId: 'corruption_scar' } }
    ],
    secrets: ['secret_corruption_era3'],
    playerRelationship: { trust: 0.5, interactions: 0 },
    ...overrides
  };
}

const allFacts = [
  { factId: 'war_era1', source: 'witnessed', confidence: 0.9, event: { era: 1, eventId: 'faction_war' } },
  { factId: 'peace_era2', source: 'witnessed', confidence: 0.8, event: { era: 2, eventId: 'peace_period' } },
  { factId: 'secret_corruption_era3', source: 'secret', confidence: 1.0, event: { era: 3, eventId: 'corruption_scar' } },
  { factId: 'blight_era0', source: 'witnessed', confidence: 0.7, event: { era: 0, eventId: 'blight' } }
];

test('C3.1: filterContext removes facts the speaker does not know', () => {
  const npc = makeNpc();
  const { filteredFacts } = filterContext(npc, allFacts, npc.playerRelationship);

  // NPC knows war_era1, peace_era2, secret_corruption_era3 but NOT blight_era0
  const ids = filteredFacts.map(f => f.factId);
  assert.ok(!ids.includes('blight_era0'), 'should not include unknown fact');
});

test('C3.2: filterContext omits secrets when trust is low', () => {
  // honesty=0.5 → threshold = 1-0.5 = 0.5, trust=0.3 < 0.5 → secret hidden
  const npc = makeNpc({
    personality: { honesty: 0.5, trustOfOutsiders: 0.3, selfPreservation: 0.5 },
    playerRelationship: { trust: 0.3, interactions: 0 }
  });

  const { filteredFacts, emotionalColoring } = filterContext(npc, allFacts, npc.playerRelationship);
  const ids = filteredFacts.map(f => f.factId);

  assert.ok(!ids.includes('secret_corruption_era3'), 'secret should be hidden');
  assert.ok(emotionalColoring.length > 0, 'hiding should produce emotional coloring');
  const secretColoring = emotionalColoring.find(e => e.trigger === 'secret_corruption_era3');
  assert.ok(secretColoring, 'should have coloring for hidden secret');
});

test('C3.3: filterContext reveals secrets when trust exceeds threshold', () => {
  // honesty=0.8 → threshold = 1-0.8 = 0.2, trust=0.5 > 0.2 → secret revealed
  const npc = makeNpc({
    personality: { honesty: 0.8, trustOfOutsiders: 0.6, selfPreservation: 0.3 },
    playerRelationship: { trust: 0.5, interactions: 3 }
  });

  const { filteredFacts } = filterContext(npc, allFacts, npc.playerRelationship);
  const ids = filteredFacts.map(f => f.factId);

  assert.ok(ids.includes('secret_corruption_era3'), 'secret should be revealed with high trust');
});

test('C3.4: filterContext is deterministic', () => {
  const npc = makeNpc();
  const r1 = filterContext(npc, allFacts, npc.playerRelationship);
  const r2 = filterContext(npc, allFacts, npc.playerRelationship);

  assert.deepEqual(
    r1.filteredFacts.map(f => f.factId),
    r2.filteredFacts.map(f => f.factId),
    'same input → same filtered facts'
  );
  assert.equal(r1.emotionalColoring.length, r2.emotionalColoring.length, 'same coloring count');
});

test('C3.5: low honesty NPCs add spin to facts', () => {
  const npc = makeNpc({
    personality: { honesty: 0.2, trustOfOutsiders: 0.5, selfPreservation: 0.5 }
  });

  const { filteredFacts } = filterContext(npc, allFacts, npc.playerRelationship);
  const warFact = filteredFacts.find(f => f.factId === 'war_era1');
  assert.ok(warFact, 'war fact should be included');
  assert.ok(warFact.spin === 'deflected' || warFact.spin === 'downplayed', 'dishonest NPC should spin war facts');
});

test('C3.6: high honesty NPCs are forthcoming', () => {
  const npc = makeNpc({
    personality: { honesty: 0.9, trustOfOutsiders: 0.7, selfPreservation: 0.3 },
    secrets: [] // no secrets to hide
  });

  const { filteredFacts } = filterContext(npc, allFacts, npc.playerRelationship);
  const hasForthcoming = filteredFacts.some(f => f.spin === 'forthcoming');
  assert.ok(hasForthcoming, 'honest NPC should have forthcoming spin');
});

test('C3.7: guarded coloring when hiding multiple facts', () => {
  const npc = makeNpc({
    personality: { honesty: 0.2, trustOfOutsiders: 0.2, selfPreservation: 0.8 },
    knowledgeGraph: [
      { factId: 'war_era1', source: 'witnessed', confidence: 0.9, event: { era: 1, eventId: 'faction_war' } }
    ],
    secrets: ['war_era1'],
    playerRelationship: { trust: 0.1, interactions: 0 }
  });

  const { emotionalColoring } = filterContext(npc, allFacts, npc.playerRelationship);
  const guarded = emotionalColoring.find(e => e.emotion === 'guarded');
  assert.ok(guarded, 'should have guarded ambient coloring');
});

test('C3.8: empty facts/speaker returns empty result', () => {
  const r1 = filterContext(null, [], { trust: 0.5, interactions: 0 });
  assert.deepEqual(r1.filteredFacts, []);
  assert.deepEqual(r1.emotionalColoring, []);

  const npc = makeNpc();
  const r2 = filterContext(npc, [], npc.playerRelationship);
  assert.deepEqual(r2.filteredFacts, []);
});

test('C3.9: detectContradictions finds when A reveals B secret', () => {
  const npcA = makeNpc({
    id: 'npc_0',
    secrets: [],
    knowledgeGraph: [
      { factId: 'secret_corruption_era3', source: 'witnessed', confidence: 0.9, event: { era: 3, eventId: 'corruption_scar' } }
    ]
  });
  const npcB = makeNpc({
    id: 'npc_1',
    secrets: ['secret_corruption_era3']
  });

  const filteredA = [{ factId: 'secret_corruption_era3' }];
  const filteredB = [];

  const contradictions = detectContradictions(npcA, npcB, filteredA, filteredB);
  assert.equal(contradictions.length, 1, 'should find one contradiction');
  assert.equal(contradictions[0].type, 'contradiction_exposed');
  assert.equal(contradictions[0].revealer, 'npc_0');
  assert.equal(contradictions[0].holder, 'npc_1');
  assert.equal(contradictions[0].factId, 'secret_corruption_era3');
});

test('C3.10: applyContradictionEffects removes exposed secret', () => {
  const holder = makeNpc({ id: 'npc_1', secrets: ['secret_corruption_era3', 'other_secret'] });
  const contradiction = { factId: 'secret_corruption_era3', revealer: 'npc_0', holder: 'npc_1' };

  const updated = applyContradictionEffects(holder, contradiction);
  assert.ok(!updated.secrets.includes('secret_corruption_era3'), 'exposed secret removed');
  assert.ok(updated.secrets.includes('other_secret'), 'other secrets remain');
  assert.ok(updated.lastContradiction, 'contradiction recorded');
  assert.equal(updated.lastContradiction.factId, 'secret_corruption_era3');
});

test('C3.11: no contradictions when NPCs have no overlapping secrets', () => {
  const npcA = makeNpc({ id: 'npc_0', secrets: [] });
  const npcB = makeNpc({ id: 'npc_1', secrets: [] });

  const contradictions = detectContradictions(npcA, npcB, [], []);
  assert.equal(contradictions.length, 0, 'no contradictions expected');
});
