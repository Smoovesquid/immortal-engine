// U506 — MR-2a: NO SOFT-LOCKS (the safety property).
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a; THE DM TEST. Doors become real
// obstacles this packet — so the ONE thing that must never happen is a soft-lock:
// a player trapped in a room they walked into. The property: a room you could ENTER
// is always a room you can LEAVE. A locked/barred FRONT door keeps people OUT, not
// in — from inside you lift the bar / turn the latch and leave. This drives the REAL
// playerMove exit path against adversarial door states and asserts the body always
// gets out (interior cleared, pos on the region frame).
//
// Siblings: U503 (schema), U504 (mask + op), U505 (front-door record + refusal).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { exteriorDoorOf, doorsOf } from '../engine/structures/doors.js';
import { DOOR_STATES } from '../engine/structures/doors.js';

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

const playerPos = (w) => (w?.party?.[0]?.pos) || null;

// Set the front door of the current interior structure to a given state.
function setFrontDoor(world, state) {
  const sk = String(world.scene.interior.structureKey);
  const front = exteriorDoorOf(world.structures.byId[sk]);
  return applyDeltas(world, [{ op: 'door', structId: sk, doorId: front.id, to: state, how: '' }]);
}

// ── the property: any front-door state, the body always gets out ──────────────
for (const state of DOOR_STATES) {
  test(`U506: the player can ALWAYS leave — front door ${state} does not soft-lock`, () => {
    let world = bootSlice();
    assert.ok(world.scene?.interior, 'the boot starts indoors');
    world = setFrontDoor(world, state);
    const sk = String(world.scene.interior.structureKey);
    assert.equal(exteriorDoorOf(world.structures.byId[sk]).state, state, `front door is ${state}`);

    ({ world } = playerMove(world, PACKS, 'go outside'));

    // The body LEFT: interior cleared, pos on the region frame. (Unbarring/unlocking
    // is part of the exit — you're inside, you let yourself out.)
    assert.equal(world.scene?.interior ?? null, null, `exit clears the interior even with a ${state} front door`);
    const pos = playerPos(world);
    assert.ok(pos && pos.frame === 'region', `the body is outdoors (region frame) after exit; got ${JSON.stringify(pos)}`);
  });
}

// ── the deeper property: any room you can ENTER, you can LEAVE ─────────────────
// Walk deeper into the wake structure room-by-room through the open interior doors;
// from EACH room actually reached, bar the front door and assert "go outside" still
// gets the body out. A room you could walk into is a room you can walk out of.
test('U506: every room reachable in the wake structure is escapable (walked, not assumed)', () => {
  const roomsReached = new Set();
  {
    // Discover reachable rooms by walking a BFS-ish path of directional moves from
    // the boot room, recording each distinct room the player lands in.
    let world = bootSlice();
    roomsReached.add(String(world.scene.interior.roomId));
    // Greedily probe each cardinal a few hops deep to visit several rooms.
    for (let depth = 0; depth < 6; depth++) {
      let movedThisPass = false;
      for (const dir of ['north', 'east', 'south', 'west']) {
        const before = String(world.scene?.interior?.roomId || '');
        const r = playerMove(world, PACKS, `go ${dir}`);
        const after = String(r.world?.scene?.interior?.roomId || '');
        if (after && after !== before && !roomsReached.has(after)) {
          world = r.world; roomsReached.add(after); movedThisPass = true;
        }
      }
      if (!movedThisPass) break;
    }
  }
  assert.ok(roomsReached.size >= 2, `walked into multiple rooms (${roomsReached.size})`);

  // From each reached room, re-walk to it, bar the door, and prove escape.
  let escapes = 0;
  for (const targetRoom of roomsReached) {
    let world = bootSlice();
    // Walk to the target room (breadth probe again until we land there).
    if (String(world.scene.interior.roomId) !== targetRoom) {
      let hops = 0;
      outer: while (String(world.scene.interior.roomId) !== targetRoom && hops < 12) {
        for (const dir of ['north', 'east', 'south', 'west']) {
          const before = String(world.scene?.interior?.roomId || '');
          const r = playerMove(world, PACKS, `go ${dir}`);
          const after = String(r.world?.scene?.interior?.roomId || '');
          if (after && after !== before) { world = r.world; hops++; if (after === targetRoom) break outer; }
        }
        hops++;
      }
    }
    // Bar the front door (the strongest interior trap) and leave.
    world = setFrontDoor(world, 'barred');
    ({ world } = playerMove(world, PACKS, 'go outside'));
    assert.equal(world.scene?.interior ?? null, null,
      `room ${targetRoom} is escapable even with a barred front door`);
    escapes++;
  }
  assert.equal(escapes, roomsReached.size, 'every reached room was escaped');
});

// ── a locked front door: enter is gated, but exit is never gated ──────────────
test('U506: a locked front door blocks ENTRY from outside but never traps you inside', () => {
  // From inside: lock the door, leave (succeeds), then the door stands open behind you.
  let world = bootSlice();
  const sk = String(world.scene.interior.structureKey);
  world = setFrontDoor(world, 'locked');
  ({ world } = playerMove(world, PACKS, 'go outside'));
  assert.equal(world.scene?.interior ?? null, null, 'a locked front door does not trap the player inside');
  // The exit opened the front door (you unlocked it on the way out).
  assert.equal(exteriorDoorOf(world.structures.byId[sk]).state, 'open',
    'leaving through a locked door leaves it open behind you (you unlocked it)');
});
