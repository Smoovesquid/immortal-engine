// U505 — MR-2a: doors are canon (the REPRODUCE-FIRST baseline).
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a. Tim's ruling: drawn architecture is
// functionally real — "doors = FULL CRUNCH". BEFORE this packet, doors were ink:
//   (a) a structure had NO record of its front door (MR-1a derived the doorstep from
//       the entry room's wall — tacticalPos.doorThresholdCells' comment says "there
//       is NO explicit exterior door record"), and
//   (b) nothing stopped movement through a wall / a locked door — there was no state
//       to refuse a move on.
// This file is the failing baseline the fix closed: it asserts (a) the wake structure
// exposes an exterior/front-door RECORD, and (b) an interior room-move through a
// LOCKED door is refused in-fiction (no mechanical bounce). Both FAILED pre-MR-2a
// (no doors[] existed); both pass now that ensureWorld authors canon door records
// and the room-move seam enforces their state.
//
// LLM OFF (deterministic parseIntent floor). Siblings: U503 (schema/defaults/
// invariants), U504 (mask + door op + threshold-record precedence), U506 (no soft-lock).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { exteriorDoorOf, doorsOf, doorBetween } from '../engine/structures/doors.js';
import { adjacentRooms, normalizeTopology, interiorExitsFrom } from '../engine/structures/topology.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

function bootSlice() {
  const w0 = newWorld({
    seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// The (adjacent room, cardinal that reaches it, door between) for the current room.
function adjacentMove(world) {
  const sk = String(world.scene.interior.structureKey);
  const st = world.structures.byId[sk];
  const here = String(world.scene.interior.roomId);
  const topo = normalizeTopology(st.topology);
  const ex = interiorExitsFrom(topo, here);
  for (const dir of ['north', 'east', 'south', 'west']) {
    const to = ex[dir];
    if (to && to !== here) return { sk, here, to, dir, door: doorBetween(st, here, to) };
  }
  // Fallback: any adjacent room (no cardinal), pick the door directly.
  const adj = adjacentRooms(topo, here).filter(id => id !== here);
  const to = adj[0];
  return { sk, here, to, dir: null, door: to ? doorBetween(st, here, to) : null };
}

// ── (a) the exterior/front-door RECORD exists ────────────────────────────────
test('U505: the wake structure exposes exactly one exterior (front) door RECORD', () => {
  const world = bootSlice();
  const sk = String(world.scene.interior.structureKey);
  const st = world.structures.byId[sk];

  const doors = doorsOf(st);
  assert.ok(doors.length > 0, 'the wake structure carries canon door records (was: none — ink only)');

  const exteriors = doors.filter(d => d.exterior);
  assert.equal(exteriors.length, 1, 'exactly one exterior/front-door record (MR-1a found none existed)');

  const front = exteriorDoorOf(st);
  assert.ok(front && String(front.a) !== '', 'the front door fronts a real entry room');
  assert.equal(String(front.b), '', 'the front door\'s far side is outside (b === "")');
  // The wake cottage's front door is seeded SHUT — not locked (brief §MR-2a).
  assert.equal(front.state, 'shut', 'the wake cottage front door is seeded shut-not-locked');
});

// ── (b) an interior move through a LOCKED door is refused in-fiction ───────────
test('U505: an interior room-move through a LOCKED door is refused honestly (no bounce)', () => {
  let world = bootSlice();
  const mv = adjacentMove(world);
  assert.ok(mv.door, 'there is a canon door between the wake room and an adjacent room');

  // Lock the door via the canon op, then attempt the move.
  world = applyDeltas(world, [{ op: 'door', structId: mv.sk, doorId: mv.door.id, to: 'locked', how: '' }]);
  assert.equal(doorBetween(world.structures.byId[mv.sk], mv.here, mv.to).state, 'locked', 'the door is locked in canon');

  const cmd = mv.dir ? `go ${mv.dir}` : 'go through the doorway';
  const { world: after, output } = playerMove(world, PACKS, cmd);

  // The move is REFUSED — still in the origin room (no state to refuse on used to
  // mean the wall/lock could not stop you; now the locked door does).
  assert.equal(String(after.scene?.interior?.roomId || ''), mv.here,
    'a locked door refuses the room-move (the body did not pass through a wall/locked door)');
  // …and the answer is an HONEST in-fiction description, never a mechanical bounce.
  const narr = String(output?.narration || '').toLowerCase();
  assert.ok(/lock|barred|latch|won'?t|doesn'?t move|holds/.test(narr),
    `the refusal is narrated as a door fact, not "invalid move": ${output?.narration}`);
  assert.ok(!/invalid|no such|unknown|can'?t go that way|that way is blocked/.test(narr),
    `no mechanical bounce: ${output?.narration}`);
});

// ── The move is CLEAN when the door is open (the enforcement is state-driven) ──
test('U505: the same room-move SUCCEEDS when the door is open (state-driven, not blanket)', () => {
  const world = bootSlice();
  const mv = adjacentMove(world);
  assert.ok(mv.door && mv.door.state === 'open', 'interior doors seed open');
  const cmd = mv.dir ? `go ${mv.dir}` : 'go through the doorway';
  const { world: after } = playerMove(world, PACKS, cmd);
  assert.equal(String(after.scene?.interior?.roomId || ''), mv.to,
    'an OPEN door lets the room-move through (walls block, doors gate — not a blanket wall)');
});
