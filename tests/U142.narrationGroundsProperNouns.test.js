import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectGroundedNouns,
  findInventedProperNoun,
  validateNarrationCandidate,
} from '../engine/llmAdapter.js';

// Backstop reinstated 2026-06-15: the Opus playtest gate caught the narration
// LLM inventing NPC/place names ("Senna the Elder", "Ferry Landing", "Aldren")
// the system prompt alone failed to suppress. These cases come straight from
// that run (docs/playtests/opus-gate-2026-06-15.md).

const CTX = {
  placeName: "Pilgrim's Rest Village",
  location: "Pilgrim's Rest Village",
  settlement: { npcs: [{ name: 'Corwin Boneknit', role: 'representative' }] },
  speaker: { name: 'Corwin Boneknit' },
  placeChunks: [],
  structuresHere: [],
};

test('U142: invented NPC name (Aldren) is flagged', () => {
  const g = collectGroundedNouns({ ctx: CTX, base: '' });
  assert.equal(findInventedProperNoun('In the quiet of the village, he says "Aldren" and stops.', g), 'Aldren');
});

test('U142: invented NPC name (Senna the Elder) is flagged', () => {
  const g = collectGroundedNouns({ ctx: CTX, base: '' });
  assert.ok(findInventedProperNoun('At the table, Senna the Elder glances up with a faint smile.', g));
});

test('U142: invented place name (Ferry Landing) is flagged', () => {
  const g = collectGroundedNouns({ ctx: CTX, base: '' });
  assert.equal(findInventedProperNoun('You sense that here at Ferry Landing the day is done.', g), 'Ferry');
});

test('U142: grounded NPC name (Corwin, incl. possessive) passes', () => {
  const g = collectGroundedNouns({ ctx: CTX, base: '' });
  assert.equal(findInventedProperNoun("In the village, Corwin Boneknit's jaw tightens.", g), null);
});

test('U142: grounded place name (Pilgrim) passes', () => {
  const g = collectGroundedNouns({ ctx: CTX, base: '' });
  assert.equal(findInventedProperNoun("You stand in Pilgrim's Rest Village, quiet and steady.", g), null);
});

test('U142: nouns from the engine base narration are grounded', () => {
  const base = 'You lift the Witness Orb from beside the cot.';
  const g = collectGroundedNouns({ ctx: CTX, base });
  assert.equal(findInventedProperNoun('You turn the Witness Orb over in your hands.', g), null);
});

test('U142: sentence-initial caps and common/title words are not flagged', () => {
  const g = collectGroundedNouns({ ctx: CTX, base: '' });
  assert.equal(findInventedProperNoun('The elder watches you from across the room.', g), null);
  assert.equal(findInventedProperNoun('Brother, the road north leads home.', g), null);
});

test('U142: validator rejects a candidate with an invented name, accepts a grounded one', () => {
  const world = { scene: { location: "Pilgrim's Rest Village" }, map: { nodes: [] }, ledger: { facts: [] } };
  const base = "You stand in Pilgrim's Rest Village.";
  const invented = "In Pilgrim's Rest Village, Aldren watches you closely.";
  const grounded = "In Pilgrim's Rest Village, Corwin Boneknit watches you closely.";
  assert.equal(validateNarrationCandidate(world, invented, { ctx: CTX, baseNarration: base }), false);
  assert.equal(validateNarrationCandidate(world, grounded, { ctx: CTX, baseNarration: base }), true);
});
