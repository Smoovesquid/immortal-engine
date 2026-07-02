// U310 — DTD-A: meta/knowledge questions get ANSWERED, never rolled or bounced
//
// Three routing failures from the 2026-07-02 Opus gate (seed: tallow,
// DM_TEST_DEADEND ×4 / CANON_HALLUCINATION ×1):
//
//   R1 — rules/capability question falls through meta-detectors → d20 roll
//        "Gravedigger — is that a class with abilities, or just a background?
//         What can I actually do in a fight?"
//   R2 — NPC-addressed in-fiction question returns buildLocationSurvey nav recap
//        "Who lit that lantern, Elske? If it's morning, someone struck it — name them."
//   R3 — character-sheet gear answer misses items[] consumables (Holy water)
//        "Before I get up, what's my character's name, class, and current HP?
//         And do I have any gear on me?"
//
// All reproducible LLM-OFF at the routing layer.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMetaQuestion,
  handleMetaQuestion,
  handleNpcAddressedQuestion
} from '../engine/grace/gracefulAdjudication.js';

// Tallow world matching gate harness state after beginAdventure
function makeWorld(overrides = {}) {
  return {
    party: [{
      name: 'Sera',
      archetype: 'Gravedigger',
      level: 1,
      stats: { MIGHT: 11, AGILITY: 11, WITS: 11, GRIT: 11, CHARM: 11 },
      foci: [],
      background: { hook: 'You know what should stay buried — and what never does.' },
      traits: {},
      inventory: {
        weapons: [{ name: 'Wooden staff', damage: '1d6' }, { name: 'Worn Blade', damage: '1d6' }],
        armor: [{ name: 'Travel helm' }],
        tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [],
        items: [
          { id: 'start_holy_water_questionable_0', defRef: 'holy_water_questionable', equipped: null },
          { id: 'start_holy_water_questionable_1', defRef: 'holy_water_questionable', equipped: null }
        ]
      },
      signature: { itemName: 'Mirror shard', meaning: 'a reminder' }
    }],
    meta: { mode: 'escape', escapeHp: 13, escapeMaxHp: 13 },
    map: {
      currentNodeId: 'wayfarers-outpost',
      nodes: [{
        id: 'wayfarers-outpost',
        name: "Wayfarers' Outpost",
        nodeType: 'settlement',
        settlement: {
          npcs: [
            { name: 'Elske', role: 'innkeeper', hostile: false, description: 'A weathered woman who keeps a clean hearth.' }
          ]
        }
      }]
    },
    conversation: {},
    ledger: { facts: [], threats: [], questions: [] },
    ...overrides
  };
}

// ── R1: capability/class question → meta answer, not roll ───────────────────

test('U310-R1a: "is that a class" question is recognized as a meta-question', () => {
  const q = 'Gravedigger — is that a class with abilities, or just a background? What can I actually do in a fight?';
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question so it never reaches the d20 resolver');
});

test('U310-R1b: capability question returns a non-null answer', () => {
  const w = makeWorld();
  const q = 'Gravedigger — is that a class with abilities, or just a background? What can I actually do in a fight?';
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'handleMetaQuestion must return a non-null answer');
});

test('U310-R1c: capability answer does not contain roll-result mechanics', () => {
  const w = makeWorld();
  const q = 'Gravedigger — is that a class with abilities, or just a background? What can I actually do in a fight?';
  const ans = handleMetaQuestion(q, w);
  assert.doesNotMatch(String(ans), /\[roll:|roll:\d|vs DC/i, 'answer must not contain roll mechanics');
});

test('U310-R1d: capability answer names the archetype or background concept', () => {
  const w = makeWorld();
  const q = 'What can I actually do in a fight?';
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'must return an answer');
  assert.match(String(ans), /gravedigger|background|archetype|attack|fight/i, 'must reference archetype or available actions');
});

test('U310-R1e: "what can I do in combat" also routes to meta', () => {
  assert.ok(isMetaQuestion('What can I do in combat?'), 'must be meta-question');
  assert.ok(isMetaQuestion('What can I really do in a battle?'), 'must be meta-question');
});

test('U310-R1f: action declarations are NOT caught by META_CAPABILITY', () => {
  // These are real actions, not capability questions — must NOT be swept in
  assert.doesNotMatch(
    String(handleMetaQuestion('I fight the guard', makeWorld()) || ''),
    /background|archetype/i,
    '"I fight the guard" must not route to capability answer'
  );
});

// ── R2: NPC-addressed question → honest answer, not buildLocationSurvey ─────

test('U310-R2a: NPC-addressed question is detected when name at end after comma', () => {
  const w = makeWorld();
  const q = "Who lit that lantern, Elske? If it's morning, someone struck it — name them.";
  const ans = handleNpcAddressedQuestion(q, w);
  assert.ok(ans, 'must return a non-null NPC response');
});

test('U310-R2b: NPC-addressed answer does not contain buildLocationSurvey language', () => {
  const w = makeWorld();
  const q = "Who lit that lantern, Elske? If it's morning, someone struck it — name them.";
  const ans = handleNpcAddressedQuestion(q, w);
  assert.doesNotMatch(String(ans), /ways lead off|paths? lead\b/i, 'must not be a navigation survey recap');
});

test('U310-R2c: NPC name-first address is also caught', () => {
  const w = makeWorld();
  const q = 'Elske, who lit that lantern?';
  const ans = handleNpcAddressedQuestion(q, w);
  assert.ok(ans, 'name-first address must be detected');
  assert.doesNotMatch(String(ans), /ways lead off|paths? lead\b/i, 'must not be a nav survey');
});

test('U310-R2d: non-NPC-addressed question returns null (no false positive)', () => {
  const w = makeWorld();
  // Elske mentioned incidentally, not as direct address
  const q = "What should I do? Elske is standing nearby.";
  const ans = handleNpcAddressedQuestion(q, w);
  assert.strictEqual(ans, null, 'incidental NPC mention must not trigger NPC-address handler');
});

test('U310-R2e: action directed at NPC (not a question) returns null', () => {
  const w = makeWorld();
  const q = 'I walk over to Elske and sit down.';
  const ans = handleNpcAddressedQuestion(q, w);
  assert.strictEqual(ans, null, 'non-question NPC action must return null');
});

// ── R3: character-sheet gear includes real inventory items[] ─────────────────

test('U310-R3a: compound name+class+HP+gear answer includes items[] consumables', () => {
  const w = makeWorld();
  const q = "Before I get up, what's my character's name, class, and current HP? And do I have any gear on me?";
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'must return an answer');
  assert.match(String(ans), /holy water/i, 'must include items[] consumables (Holy water) in the gear answer');
});

test('U310-R3b: gear answer still includes real weapon names', () => {
  const w = makeWorld();
  const q = "Before I get up, what's my character's name, class, and current HP? And do I have any gear on me?";
  const ans = handleMetaQuestion(q, w);
  assert.match(String(ans), /wooden staff|worn blade/i, 'must still include the real weapon from inventory');
});

test('U310-R3c: standalone loadout question includes items[] consumables', () => {
  const w = makeWorld();
  const q = 'What gear am I carrying?';
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'must return an answer');
  assert.match(String(ans), /holy water/i, 'standalone gear query must include items[] consumables');
});

test('U310-R3d: world with no items[] does not crash describeLoadout', () => {
  const w = makeWorld();
  w.party[0].inventory.items = [];
  const q = 'What am I armed with?';
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'must return an answer even with empty items[]');
});
