import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { adjudicateWithGrace, buildLocationSurvey, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

// ── U93 — Grace Layer Integration (End-to-End Playtest) ──────────────

// A world with a settlement (NPCs) and neighboring nodes laid out on the grid
// so compass exits resolve to real directions.
function makeSurveyWorld() {
  return ensureWorld({
    // The survey fixture is the player's HOME — so you know your neighbors by name
    // (earned-knowledge for people: home → names; a foreign town → roles, see U279).
    meta: { version: 21, seed: 'u93-survey', fate: 0.2, homeNodeId: 'town' },
    party: [{ id: 'party', name: 'Sera', level: 1, wounds: 0, stress: 0,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      position: { ux: 50, uy: 50, elevation: 0, nodeId: 'town' } }],
    // NOTE: grid y grows DOWNWARD in this engine — south is +y, north is -y
    // (engine/map/mapState.js). So the northern node has the SMALLER y.
    map: {
      currentNodeId: 'town',
      nodes: [
        { id: 'town', name: 'Buttnoid Village', nodeType: 'settlement', x: 5, y: 5,
          settlement: { npcs: [
            { id: 'mary', name: 'Mary Rottencrotch', role: 'barkeep' },
            { id: 'gus', name: 'Gus', role: 'smith' }
          ] } },
        { id: 'north_node', name: 'the Old Tower', nodeType: 'ruin', x: 5, y: 2 },
        { id: 'south_node', name: 'the Stone Well', nodeType: 'landmark', x: 5, y: 8 }
      ],
      edges: [
        { a: 'town', b: 'north_node' },
        { a: 'town', b: 'south_node' }
      ]
    },
    timeline: [],
    scene: { location: 'Buttnoid Village' }
  });
}

test('U93-S1: survey names the current place', () => {
  const w = makeSurveyWorld();
  const survey = buildLocationSurvey(w);
  assert.ok(survey.includes('Buttnoid Village'), survey);
});

test('U93-S2: survey lists NPCs present by name and role', () => {
  const w = makeSurveyWorld();
  const survey = buildLocationSurvey(w);
  assert.ok(survey.includes('Mary Rottencrotch'), survey);
  assert.ok(survey.includes('barkeep'), survey);
  assert.ok(survey.includes('Gus'), survey);
});

test('U93-S3: a KNOWN landmark in sight is named by compass direction (line of sight)', () => {
  // Look-around reports only what you can SEE. Landmarks poke above the treeline, so they're
  // in view; once you've been to them (discovered) you also know their names. An UNKNOWN
  // landmark reads by silhouette, and an over-the-horizon settlement is directional — see U278.
  const base = makeSurveyWorld();
  const w = ensureWorld({ ...base, map: { ...base.map,
    nodes: base.map.nodes.map(n => (n.id === 'town' ? n : { ...n, nodeType: 'landmark' })),
    discovered: ['town', 'north_node', 'south_node'] } });
  const survey = buildLocationSurvey(w).toLowerCase();
  // Tight, order-specific: the Old Tower (y=2) is north, the Stone Well (y=8) is south.
  assert.ok(survey.includes('to the north lies the old tower'), survey);
  assert.ok(survey.includes('to the south lies the stone well'), survey);
});

test('U93-S4: "where am I?" routes through survey via handleMetaQuestion', () => {
  const w = makeSurveyWorld();
  const answer = handleMetaQuestion('where am I?', w);
  assert.ok(answer.includes('Buttnoid Village'), answer);
  assert.ok(answer.includes('Mary Rottencrotch'), answer);
});

test('U93-S5: survey never invents exits that do not exist', () => {
  const w = makeSurveyWorld();
  // Remove all edges — no exits should be claimed.
  w.map.edges = [];
  const survey = buildLocationSurvey(w);
  assert.ok(!survey.includes('Old Tower'), survey);
  assert.ok(!survey.includes('Stone Well'), survey);
});

// FIRST_ROOM #4 — inside a private interior, "look around" describes the ROOM
// (its furniture), never the settlement's people. You can't see the village
// roster through the walls; naming them here was the meta-roster leak.
test('U93-S6: interior survey describes room furniture, not the settlement NPC roster', () => {
  const w = makeSurveyWorld();
  w.scene.interior = { structureKey: 'inn:room-3', roomId: 'r3', visited: ['r3'] };
  const node = w.map.nodes.find(n => n.id === 'town');
  node.furniture = [
    { name: 'straw pallet' }, { name: 'oil lantern' }, { name: 'iron-bound chest' }
  ];
  const survey = buildLocationSurvey(w);
  // Room contents present...
  assert.ok(survey.includes('straw pallet'), survey);
  assert.ok(survey.includes('iron-bound chest'), survey);
  // ...and the settlement roster is NOT leaked through the walls.
  assert.ok(!survey.includes('Mary Rottencrotch'), survey);
  assert.ok(!survey.includes('barkeep'), survey);
  assert.ok(!survey.includes('Gus'), survey);
  // No exterior survey vocabulary either (no compass exits / "nearby stand").
  assert.ok(!/to the (?:north|south|east|west) lies/i.test(survey), survey);
});

// A bare interior (no furniture defined) still answers honestly — never the
// roster, never a hallucinated object.
test('U93-S7: bare interior survey holds little of note, no roster leak', () => {
  const w = makeSurveyWorld();
  w.scene.interior = { structureKey: 'inn:room-3', roomId: 'r3', visited: ['r3'] };
  const survey = buildLocationSurvey(w);
  assert.ok(!survey.includes('Mary Rottencrotch'), survey);
  assert.ok(/little of note|way out/i.test(survey), survey);
});


// Create a test world
function makeTestWorld() {
  return ensureWorld({
    meta: { version: 21, seed: 'u93-integration', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Hero',
      level: 1,
      wounds: 0,
      stress: 0,
      stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 },
      position: { ux: 30, uy: 50, elevation: 0, nodeId: 'n0' }
    }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        currentNodeId: 'n0',
        furniture: [
          {
            name: 'wooden barrel',
            state: 'intact',
            bulk: 4,
            ux: 70,
            uy: 50,
            position: { ux: 70, uy: 50, elevation: 0 }
          }
        ]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: [],
    scene: { location: 'cellar' },
    conductor: {
      threat: { severity: 0.3 },
      discovery: { rate: 0.2 }
    }
  });
}

test('U93-01: Meta-question "Where am I?" returns location without mutation', async () => {
  const w = makeTestWorld();
  const input = 'Where am I?';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'meta');
  assert.ok(result.message.includes('cellar'));
});

test('U93-02: Meta-question "Am I hurt?" returns health status without mutation', async () => {
  const w = makeTestWorld();
  w.party[0].wounds = 3;
  const input = 'Am I hurt?';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'meta');
  assert.ok(result.message.includes('wounds') || result.message.includes('hurt'));
});

test('U93-03: Ambiguous input "the thing" triggers clarification', async () => {
  const w = makeTestWorld();
  const input = 'the thing';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'clarification');
  assert.ok(result.message);
  assert.ok(result.suggesting);
  assert.ok(result.confidence < 0.6);
});

test('U93-04: Clear action "smash the barrel" proceeds to adjudication', async () => {
  const w = makeTestWorld();
  const input = 'smash the barrel';
  const result = await adjudicateWithGrace(w, input);

  assert.equal(result.type, 'action');
  assert.ok(result.narration);
  assert.ok(result.mechanics);
  assert.ok(result.world);
  assert.ok(result.confidence >= 0.8);
  assert.ok(result.pacingMs); // pacing should be set
  assert.ok(result.tone); // tone should be set
});

test('U93-05: Pacing delays are action-appropriate', async () => {
  const w = makeTestWorld();

  const examine = await adjudicateWithGrace(w, 'examine the barrel');
  const attack = await adjudicateWithGrace(makeTestWorld(), 'attack the barrel');

  // Attack should have longer pacing than examine
  assert.ok(attack.pacingMs > examine.pacingMs);
});

test('U93-06: Tone reflects world state (high threat)', async () => {
  const w = makeTestWorld();
  w.conductor.threat.severity = 0.9;

  const result = await adjudicateWithGrace(w, 'examine the barrel');

  assert.ok(result.tone.tension > 0.5);
  assert.ok(result.tone.hope <= 1);
});

test('U93-07: Conversation state persists after action', async () => {
  const w = makeTestWorld();
  const result = await adjudicateWithGrace(w, 'break the barrel');

  assert.ok(result.world.conversation.lastAction);
  assert.ok(result.world.conversation.lastNarration);
  assert.equal(result.world.conversation.clarificationAttempts, 0);
});

test('U93-08: Clarification state is tracked for multi-turn interaction', async () => {
  const w = makeTestWorld();

  // First turn: ambiguous input
  const r1 = await adjudicateWithGrace(w, 'the thing');
  assert.equal(r1.type, 'clarification');
  assert.equal(r1.world.conversation.clarificationAttempts, 1);

  // Second turn: clarification answered
  const r2 = await adjudicateWithGrace(r1.world, 'the barrel');
  assert.ok(r2.type === 'action' || r2.type === 'clarification');
  // Clarification should have been reset or handled
});

test('U93-09: World state is passed through grace layer correctly', async () => {
  const w = makeTestWorld();
  const original_location = w.scene.location;
  const original_wounds = w.party[0].wounds;

  const result = await adjudicateWithGrace(w, 'Where am I?');

  // Meta-question shouldn't mutate world state
  assert.equal(result.world.scene.location, original_location);
  assert.equal(result.world.party[0].wounds, original_wounds);
});

test('U93-10: Tone modifiers are correctly assigned', async () => {
  const w = makeTestWorld();
  w.conductor.threat.severity = 0.8;

  const result = await adjudicateWithGrace(w, 'smash the barrel');

  assert.ok(result.toneModifier);
  assert.ok(result.toneModifier.adjectives && result.toneModifier.adjectives.length > 0);
  assert.ok(result.toneModifier.pace);
  assert.ok(result.toneModifier.intensity);
});
