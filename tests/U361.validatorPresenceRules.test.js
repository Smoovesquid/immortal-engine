// U361 — validateNarrationCandidate learns room-scoped presence (ROM-2,
// docs/briefs/ROOM_OCCUPANCY_MODEL.md §2, packet ROM-2 items (i)+(ii)).
//
// (i) Rule 4f's source is fixed from the node-global roster to the occupancy
//     set (ctx.roomOccupants), so a TRUTHFUL "X isn't here" about a real
//     roster NPC who simply isn't IN THIS ROOM is now ACCEPTED, not rejected
//     (the old bug: collectPresentNpcNames read the whole settlement, so any
//     denial about anyone who existed anywhere at the node was wrongly
//     flagged).
// (ii) Rule 6a rejects a candidate that VOICES (`**Name:**` / attributed
//     speech verbs) or PHYSICALLY PLACES a roster NPC marked `elsewhere` —
//     the C1 "teleporting Elske" gate-evidence pattern (brief §1a.4-5) —
//     while a truthful absence statement about that same NPC is exempt (must
//     not double-reject what Rule 4f already accepts).
//
// Synthetic ctx objects (world=null is a supported call shape — see
// tests/N2N3N4N5.narrator.test.js) isolate these two rules from the rest of
// the guard stack. N10-ROM2b/U360 cover the same law against a real live
// boot; this file is the deterministic, hermetic unit layer underneath it.
// No network, no API key, no cost, no world mutation possible (world=null).

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate, collectGroundedNouns, findInventedProperNoun } from '../engine/llmAdapter.js';

// Minimal ctx builder — interior + settlement.npcs (with the elsewhere flag
// ROM-2 adds) + roomOccupants, matching buildNarratorContext's real shape
// closely enough to isolate Rules 4f/6a from the rest of the guard stack.
function ctx({ placeName = 'Test Keep', roomName = 'Solar', npcs = [], occupants = [] } = {}) {
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
    roomMaterial: null,
    roomOccupants: occupants,
    settlement: { npcs, factions: [], tensions: [], economy: null, population: null }
  };
}

const base = (c) => `You are in the ${c.roomName}, ${c.placeName}.`;

test('U361a: Rule 4f (fixed) — a truthful denial of a roster NPC who is real but NOT in ctx.roomOccupants is ACCEPTED', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Brokefang', elsewhere: true }],
    occupants: [] // Brokefang exists in the roster but occupies nowhere near this room
  });
  const cand = `Brokefang is not here at ${c.placeName}; the ${c.roomName} stands empty.`;
  assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), true,
    'a truthful absence about a real-but-elsewhere NPC must pass');
});

test('U361b: Rule 4f still REJECTS a false denial of an NPC who IS in ctx.roomOccupants', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Brokefang', elsewhere: false }],
    occupants: [{ id: 'npc_1', name: 'Brokefang' }]
  });
  const cand = `Brokefang is not here at ${c.placeName}; you are alone.`;
  assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'a false denial of a genuinely present NPC is still rejected — Rule 4f\'s core protection is unweakened');
});

test('U361c: Rule 4f — a denial about an NPC entirely absent from roomOccupants/roster context is a no-op (never throws, never over-fires)', () => {
  const c = ctx({ npcs: [], occupants: [] });
  const cand = `Nobody named Brokefang is not here at ${c.placeName}.`;
  // No roster NPC named Brokefang exists in ctx at all — Rule 4f has nothing to
  // check against, so this must not spuriously reject (defensive/no-throw).
  assert.doesNotThrow(() => validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }));
});

test('U361d: Rule 6a — a candidate with a `**Name:**` dialogue tag for an absent roster NPC is REJECTED', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Elske Nightherd', elsewhere: true }],
    occupants: []
  });
  const cand = `${c.placeName} holds still. **Elske Nightherd:** "Can't say, no record."`;
  assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'a dialogue-tag voicing of an absent roster NPC is rejected');
});

test('U361e: Rule 6a — attributed speech verbs (said/says/shrugs/mutters/etc.) for an absent NPC are REJECTED', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Elske Nightherd', elsewhere: true }],
    occupants: []
  });
  for (const verb of ['shrugs', 'says', 'mutters', 'whispers', 'growls', 'calls out']) {
    const cand = `In ${c.placeName}, Elske Nightherd ${verb} something you can't quite hear.`;
    assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
      `attribution verb "${verb}" for an absent NPC is rejected`);
  }
});

test('U361f: Rule 6a — physical placement verbs (stands/enters/approaches/etc.) for an absent NPC are REJECTED', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Elske Nightherd', elsewhere: true }],
    occupants: []
  });
  for (const verb of ['stands', 'enters', 'approaches', 'steps', 'appears']) {
    const cand = `Elske Nightherd ${verb} into the ${c.roomName} of ${c.placeName}.`;
    assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
      `placement verb "${verb}" for an absent NPC is rejected`);
  }
});

test('U361g: Rule 6a — voicing/placing an NPC who IS present (elsewhere:false) is NOT rejected by this rule', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Elske Nightherd', elsewhere: false }],
    occupants: [{ id: 'npc_1', name: 'Elske Nightherd' }]
  });
  const cand = `In ${c.placeName}, Elske Nightherd shrugs and says nothing.`;
  const grounded = collectGroundedNouns({ world: null, ctx: c, base: base(c) });
  assert.equal(findInventedProperNoun(cand, grounded), null, 'the name is grounded (present in the roster)');
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), false,
    'voicing a genuinely PRESENT NPC must never be rejected by the absence-presence rule');
});

test('U361h: Rule 6a — the absence-statement exemption stacks with Rule 4f: a truthful "X isn\'t here" about the SAME absent NPC is accepted, not double-rejected', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Elske Nightherd', elsewhere: true }],
    occupants: []
  });
  const cand = `Elske Nightherd is not here in ${c.placeName}; the room stands empty.`;
  assert.equal(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: base(c) }), true,
    'the absence statement is accepted — Rule 6a\'s exemption and Rule 4f\'s accept agree');
});

test('U361i: Rule 6a is a no-op when ctx.interior is absent (outdoors) — the room-presence law is interior-scoped', () => {
  const c = ctx({
    npcs: [{ id: 'npc_1', name: 'Elske Nightherd', elsewhere: true }],
    occupants: []
  });
  c.interior = null; // outdoors
  const cand = `Out in the open at ${c.placeName}, Elske Nightherd shrugs and says nothing.`;
  // Outdoors, ROM-2's interior-scoped rule set does not police presence — the
  // existing outdoor occupancy surface (look-around/window-peek, ROM-1's
  // territory) is a separate mechanism this rule set intentionally leaves alone.
  assert.notEqual(validateNarrationCandidate(null, cand, { ctx: c, baseNarration: `You are at ${c.placeName}.` }), false,
    'outdoors, this rule does not fire (ctx.interior gates it)');
});

test('U361j: Rule 6a never throws on a malformed/partial ctx (defensive)', () => {
  assert.doesNotThrow(() => validateNarrationCandidate(null, 'Nothing happens.', { ctx: { interior: {}, settlement: null }, baseNarration: 'Nothing happens.' }));
  assert.doesNotThrow(() => validateNarrationCandidate(null, 'Nothing happens.', { ctx: {}, baseNarration: 'Nothing happens.' }));
});
