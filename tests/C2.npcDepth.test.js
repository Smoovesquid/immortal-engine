// C2: NPC Depth System — personality axes, knowledge graphs, relationships, secrets
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeNpcDepth, updatePlayerRelationship } from '../engine/npc/npcDepth.js';

const sampleNpcs = [
  { role: 'representative', factionId: 'guild', disposition: 'friendly', originTick: 0 },
  { role: 'enforcer', factionId: 'militia', disposition: 'wary', originTick: 0 },
  { role: 'healer', factionId: '', disposition: 'friendly', originTick: null },
  { role: 'trader', factionId: 'guild', disposition: 'friendly', originTick: 2 }
];

const sampleHistory = [
  { era: 0, eventId: 'faction_tension', worldState: {}, detected: true },
  { era: 1, eventId: 'faction_war', worldState: {}, detected: true },
  { era: 2, eventId: 'peace_period', worldState: {}, detected: true },
  { era: 3, eventId: 'blight', worldState: {}, detected: true }
];

const sampleSecrets = [
  { type: 'war', connectedTo: 1, severity: 4 },
  { type: 'corruption', connectedTo: 3, severity: 3 }
];

test('C2.1: computeNpcDepth returns enriched NPCs with all depth fields', () => {
  const deep = computeNpcDepth(sampleNpcs, sampleHistory, sampleSecrets, 'c2-test');
  assert.equal(deep.length, sampleNpcs.length, 'same number of NPCs');

  for (const npc of deep) {
    assert.ok(npc.id, 'NPC has id');
    assert.ok(npc.personality, 'NPC has personality');
    assert.ok(typeof npc.personality.honesty === 'number', 'honesty is number');
    assert.ok(typeof npc.personality.trustOfOutsiders === 'number', 'trust is number');
    assert.ok(typeof npc.personality.selfPreservation === 'number', 'selfPres is number');
    assert.ok(npc.personality.honesty >= 0 && npc.personality.honesty <= 1, 'honesty 0-1');
    assert.ok(npc.personality.trustOfOutsiders >= 0 && npc.personality.trustOfOutsiders <= 1, 'trust 0-1');
    assert.ok(npc.personality.selfPreservation >= 0 && npc.personality.selfPreservation <= 1, 'selfPres 0-1');
    assert.ok(Array.isArray(npc.knowledgeGraph), 'NPC has knowledge graph');
    assert.ok(typeof npc.relationships === 'object', 'NPC has relationships');
    assert.ok(typeof npc.playerRelationship === 'object', 'NPC has player relationship');
    assert.ok(typeof npc.playerRelationship.trust === 'number', 'player trust is number');
    assert.ok(Array.isArray(npc.secrets), 'NPC has secrets');
    assert.ok(Array.isArray(npc.witnessedEvents), 'NPC has witnessed events');
  }
});

test('C2.2: NPC depth is deterministic — same seed produces same output', () => {
  const d1 = computeNpcDepth(sampleNpcs, sampleHistory, sampleSecrets, 'c2-det');
  const d2 = computeNpcDepth(sampleNpcs, sampleHistory, sampleSecrets, 'c2-det');

  for (let i = 0; i < d1.length; i++) {
    assert.equal(d1[i].personality.honesty, d2[i].personality.honesty, `NPC ${i} honesty matches`);
    assert.equal(d1[i].personality.trustOfOutsiders, d2[i].personality.trustOfOutsiders, `NPC ${i} trust matches`);
    assert.equal(d1[i].personality.selfPreservation, d2[i].personality.selfPreservation, `NPC ${i} selfPres matches`);
    assert.equal(d1[i].knowledgeGraph.length, d2[i].knowledgeGraph.length, `NPC ${i} knowledge count matches`);
    assert.deepEqual(d1[i].secrets, d2[i].secrets, `NPC ${i} secrets match`);
  }
});

test('C2.3: role-based personality bias — enforcer is less trusting than mediator', () => {
  const enforcerNpcs = [{ role: 'enforcer', factionId: '', disposition: 'wary', originTick: null }];
  const mediatorNpcs = [{ role: 'mediator', factionId: '', disposition: 'friendly', originTick: null }];

  const [enforcer] = computeNpcDepth(enforcerNpcs, [], [], 'c2-role-enforcer');
  const [mediator] = computeNpcDepth(mediatorNpcs, [], [], 'c2-role-mediator');

  assert.ok(enforcer.personality.trustOfOutsiders < mediator.personality.trustOfOutsiders,
    'enforcer should be less trusting than mediator');
  assert.ok(enforcer.personality.selfPreservation > mediator.personality.selfPreservation,
    'enforcer should have higher self-preservation than mediator');
});

test('C2.4: war events reduce trust, increase self-preservation', () => {
  const npcs = [{ role: 'trader', factionId: 'guild', disposition: 'friendly', originTick: 0 }];
  const noWar = [];
  const withWar = [
    { era: 0, eventId: 'faction_war', worldState: {}, detected: true },
    { era: 1, eventId: 'war_scar', worldState: {}, detected: true }
  ];

  const [peaceful] = computeNpcDepth(npcs, noWar, [], 'c2-war-no');
  const [warTorn] = computeNpcDepth(npcs, withWar, [], 'c2-war-yes');

  assert.ok(warTorn.personality.trustOfOutsiders < peaceful.personality.trustOfOutsiders,
    'war reduces trust');
});

test('C2.5: NPCs with shared events have positive bond', () => {
  const npcs = [
    { role: 'guard', factionId: 'militia', disposition: 'wary', originTick: 0 },
    { role: 'guard', factionId: 'militia', disposition: 'wary', originTick: 0 }
  ];
  const history = [
    { era: 0, eventId: 'faction_tension', worldState: {}, detected: true }
  ];

  const deep = computeNpcDepth(npcs, history, [], 'c2-bond');
  const rel0 = deep[0].relationships['npc_1'];
  assert.ok(rel0, 'NPC 0 should have relationship with NPC 1');
  assert.ok(rel0.bond > 0, 'same-faction NPCs should have positive bond');
});

test('C2.6: rival faction NPCs have negative bond', () => {
  const npcs = [
    { role: 'representative', factionId: 'guild', disposition: 'friendly', originTick: 0 },
    { role: 'enforcer', factionId: 'militia', disposition: 'wary', originTick: 0 }
  ];

  const deep = computeNpcDepth(npcs, [], [], 'c2-rival');
  const rel0 = deep[0].relationships['npc_1'];
  assert.ok(rel0, 'NPC 0 should have relationship with NPC 1');
  assert.ok(rel0.bond < 0, 'rival-faction NPCs should have negative bond');
  assert.ok(rel0.history.includes('rival factions'), 'history should note rivalry');
});

test('C2.7: empty NPCs/history returns empty array', () => {
  assert.deepEqual(computeNpcDepth([], [], [], 'empty'), []);
  assert.deepEqual(computeNpcDepth(null, null, null, 'null'), []);
});

test('C2.8: NPC with zero history gets default personality from role', () => {
  const npcs = [{ role: 'scholar', factionId: '', disposition: 'friendly', originTick: null }];
  const [npc] = computeNpcDepth(npcs, [], [], 'c2-zero-history');

  assert.ok(npc.personality.honesty > 0.6, 'scholar should be honest');
  assert.equal(npc.knowledgeGraph.length, 0, 'no events = no knowledge');
  assert.deepEqual(npc.secrets, [], 'no secrets without events');
});

test('C2.9: updatePlayerRelationship changes trust based on action', () => {
  const npc = computeNpcDepth(
    [{ role: 'trader', factionId: '', disposition: 'friendly', originTick: null }],
    [], [], 'c2-player'
  )[0];

  const helped = updatePlayerRelationship(npc, 'help');
  assert.ok(helped.playerRelationship.trust > npc.playerRelationship.trust, 'help increases trust');
  assert.equal(helped.playerRelationship.interactions, 1, 'interactions increment');

  const threatened = updatePlayerRelationship(npc, 'threaten');
  assert.ok(threatened.playerRelationship.trust < npc.playerRelationship.trust, 'threaten decreases trust');
});

test('C2.10: at least one NPC gets secrets when settlement has scar events', () => {
  const npcs = [
    { role: 'representative', factionId: 'guild', disposition: 'friendly', originTick: 0 },
    { role: 'trader', factionId: '', disposition: 'friendly', originTick: null }
  ];
  const secrets = [{ type: 'war', connectedTo: 1, severity: 4 }];

  const deep = computeNpcDepth(npcs, sampleHistory, secrets, 'c2-secrets');
  const anySecrets = deep.some(n => n.secrets.length > 0);
  assert.ok(anySecrets, 'at least one NPC should hold settlement secrets');
});
