// U362 — validateNarrationCandidate learns material + position (ROM-2,
// docs/briefs/ROOM_OCCUPANCY_MODEL.md §2, packet ROM-2 items (iii)+(iv)).
//
// (iii) Rule 6b rejects a candidate whose wall/floor material words hit
//     ctx.roomMaterial.forbidden (ROM-0's structureMaterial.js contradiction
//     lexicon, imported by reference through ctx — this file constructs the
//     lexicon shape directly rather than importing structureMaterial.js, so
//     the test stays a pure llmAdapter.js unit and doesn't reach into
//     structures/ — the C2 "wooden wall" -> "stone wall" -> "it was always
//     stone" drift, brief §1b).
// (iv) Rule 6c rejects a candidate that confidently names the player's
//     position as a real, OTHER room-role name (from the closed
//     ROOM_ROLE_NAMES vocabulary) when ctx.roomName says otherwise — the C4
//     "here in the back room of the cottage" invention, brief §1c.
//
// Synthetic ctx objects (world=null) isolate these two rules the same way
// U361 does for Rules 4f/6a. No network, no API key, no cost, no mutation.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

// Mirrors structureMaterial.js's frozen shape closely enough to exercise
// Rule 6b without importing structures/ (out of this lane's ownership —
// llmAdapter.js only ever READS ctx.roomMaterial.forbidden, never derives it).
function material(family, forbidden) {
  return Object.freeze({
    shell: family, family, walls: `${family} walls`, floor: `${family} floor`,
    line: `This building is ${family}-built.`,
    forbidden: Object.freeze(forbidden)
  });
}
const TIMBER = material('timber', [
  'stone wall', 'stone walls', 'wall of stone', 'walls of stone',
  'rock wall', 'rock walls', 'wall of rock', 'walls of rock'
]);
const STONE = material('stone', [
  'wooden wall', 'wooden walls', 'wall of wood', 'walls of wood',
  'timber wall', 'timber walls'
]);
const MARKET = material('open', []); // an open build polices nothing (ROM-0's own carve-out)

function ctx({ placeName = 'Test Keep', roomName = 'Solar', roomMaterial = TIMBER } = {}) {
  return {
    placeName,
    nodeType: 'settlement',
    location: placeName,
    objective: '',
    structuresHere: [],
    interior: { structureKey: 'st:1', roomId: 'room:st:1:1', layout: null, objects: [] },
    tone: 'grim',
    actionText: 'look around',
    mechanicsText: '',
    fate: 0.5,
    roomName,
    roomMaterial,
    roomOccupants: [],
    settlement: null
  };
}

const base = (c) => `You are in the ${c.roomName}, ${c.placeName}.`;

test('U362a: Rule 6b — a forbidden wall-material phrase is REJECTED', () => {
  const c = ctx({ roomMaterial: TIMBER });
  const cand = `${c.placeName}: cold stone walls press in around you.`;
  assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'a stone-wall claim inside a timber build is rejected');
});

test('U362b: Rule 6b — every forbidden phrase for a family fires, not just the first', () => {
  const c = ctx({ roomMaterial: TIMBER });
  for (const phrase of TIMBER.forbidden) {
    const cand = `${c.placeName}: the ${phrase} loom overhead.`;
    assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
      `forbidden phrase "${phrase}" is rejected`);
  }
});

test('U362c: Rule 6b — the building\'s OWN material family is never rejected', () => {
  const c = ctx({ roomMaterial: TIMBER });
  const cand = `${c.placeName}: the timber walls creak in the wind.`;
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'the timber build\'s own wall material is always narratable');
});

test('U362d: Rule 6b — a bare material word off a non-wall object stays narratable (wall-scoped, not word-scoped)', () => {
  const c = ctx({ roomMaterial: STONE }); // a stone build; a wooden object is fine, only "wooden wall" is banned
  const cand = `${c.placeName}: a small wooden chest sits in the corner.`;
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'a wooden CHEST in a stone building is untouched — the lexicon is wall-scoped');
});

test('U362e: Rule 6b — an open build (empty forbidden list) polices nothing', () => {
  const c = ctx({ roomMaterial: MARKET });
  const cand = `${c.placeName}: stone paving and canvas awnings stretch overhead.`;
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'a market-style open build has no wall lexicon to violate');
});

test('U362f: Rule 6b is a no-op when ctx.roomMaterial is absent (defensive — never throws)', () => {
  const c = ctx({ roomMaterial: null });
  const cand = `${c.placeName}: cold stone walls press in around you.`;
  assert.doesNotThrow(() => validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }));
});

test('U362g: Rule 6c — naming a real, OTHER room as the player\'s position is REJECTED', () => {
  const c = ctx({ roomName: 'Bedchamber' });
  const cand = `${c.placeName}: you are standing in the Kitchen, pots hanging low overhead.`;
  assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'asserting a different real room as the player\'s position is rejected');
});

test('U362h: Rule 6c — several phrasings of the same wrong-room claim are all caught', () => {
  const c = ctx({ roomName: 'Bedchamber' });
  for (const cand of [
    `${c.placeName}: you're in the Cellar now, the air gone cold.`,
    `${c.placeName}: standing in the Kitchen, you catch the smell of woodsmoke.`,
    `Here in the Armory at ${c.placeName}, racks line the walls.`,
  ]) {
    assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
      `wrong-room phrasing rejected: "${cand}"`);
  }
});

test('U362i: Rule 6c — naming the ACTUAL current room is never rejected by this rule', () => {
  const c = ctx({ roomName: 'Bedchamber' });
  const cand = `${c.placeName}: you are standing in the Bedchamber, dust hanging in the air.`;
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'the real current room is never flagged as a contradiction');
});

test('U362j: Rule 6c — a generic, non-role adjective ("a small room", "the dim room") never trips this rule', () => {
  const c = ctx({ roomName: 'Bedchamber' });
  const cand = `${c.placeName}: you stand in the small room, dust hanging in the air.`;
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'a bare adjective is not a real room-role name — this rule is scoped to the closed vocabulary only');
});

test('U362k: Rule 6c is a no-op outdoors (ctx.interior absent) and when ctx.roomName is unset (defensive)', () => {
  const c1 = ctx({ roomName: 'Bedchamber' });
  c1.interior = null;
  const cand1 = `Out in the open at ${c1.placeName}, you glance toward the Kitchen across the yard.`;
  assert.doesNotThrow(() => validateNarrationCandidate(null, cand1, { ctx: c1, baseNarration: `You are at ${c1.placeName}.` }));

  const c2 = ctx({ roomName: null });
  const cand2 = `${c2.placeName}: you are standing in the Kitchen.`;
  assert.doesNotThrow(() => validateNarrationCandidate(null, cand2, { ctx: c2, baseNarration: base({ ...c2, roomName: 'here' }) }));
});
