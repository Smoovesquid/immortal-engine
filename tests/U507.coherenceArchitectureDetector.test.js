// U507 — CG-ARCH: the invented-architecture detector (MR-2b, docs/briefs/
// MR-2-FUNCTIONAL-INK.md §2b). The DETECTOR-CATCHES-IT test, written FIRST
// against the historical ROOT bug class: the live DM narrates a staircase, an
// upper floor, a cellar, or a room the building does NOT have, so the player
// walks into space the engine can't honor and SOFT-LOCKS (WHOLE_BUILDING_
// FINDINGS.md WB-Q1; project_dm_invents_geography, turns 7-9/17/21/23 of that
// playtest). Before this packet the coherence bank MISSED the archetypal line
// ("a narrow staircase climbs to the upper floor above") — CG-2b only fires on a
// COMPASS-directional exit, and CG-2a only catches a wrong current-room noun.
// CG-ARCH is the dedicated architecture-presence check keyed off the STRUCTURE's
// real room roster (canon.roomPlan).
//
// Pure-function unit tests over synthetic turn fixtures, mirroring U388/U393's
// shape exactly: positive (must flag) + guard (must NOT) per tier, PLUS the
// graceful-degradation guard (old bundles lacking roomPlan -> DORMANT). No LLM,
// no server, no engine boot — $0 and deterministic. (The false-positive NEGATIVE
// SUITE is U508; the LLM-off end-to-end floor is U509.)

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectArchitectureDesync, runDetectors, SINGLE_TURN_DETECTORS,
} from '../engine/coherence/checks.js';

// Minimal turn fixture builder — only the fields the detector reads (mirrors
// U393's `turn()` helper exactly).
function turn(i, persona, { player = '', dm = '', mechanics = '', canon = {} } = {}) {
  return {
    type: 'turn', seed: 's', persona, i, player, dm, mechanics, route: 'action',
    canon: { npcsPresent: [], ...canon }, judgeError: false, v1: null, v2: null,
  };
}

// The wake cottage's REAL roomPlan (verified live: seed tallow boots a 3-room
// single-storey cottage). NO cellar, NO stairs, NO upper floor.
const COTTAGE_PLAN = { rooms: ['Hearth Room', 'Bedchamber', 'Pantry'], singleStorey: true };
const insideCottage = (extra = {}) => ({
  interior: { roomId: 'r2', roomName: 'Bedchamber' },
  roomPlan: COTTAGE_PLAN,
  roomExits: { east: 'Pantry', south: 'Hearth Room' },
  ...extra,
});

// ── Tier A: vertical / multi-storey space in a single-storey building ────────
test('U507: CG-ARCH flags the archetypal WB-Q1 line — an invented staircase to an upper floor', () => {
  const session = [turn(9, 'newbie', {
    player: 'I look for another way through the house.',
    dm: 'A narrow staircase climbs to the upper floor above, where sleeping quarters wait in the dark.',
    canon: insideCottage(),
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.length, 1, 'the invented staircase must be caught');
  assert.equal(flags[0].class, 'CG-ARCH');
  assert.equal(flags[0].canonField, 'roomPlan.singleStorey');
  assert.equal(flags[0].severity, 'fail');
  assert.match(flags[0].narrated, /staircase/i);
});

test('U507: CG-ARCH flags an invented cellar/basement below a single-storey cottage', () => {
  const session = [turn(11, 'newbie', {
    player: 'I search for a way down.',
    dm: 'The cellar lies down a short flight of steps beyond this room, its barrels breathing cold.',
    canon: insideCottage(),
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].class, 'CG-ARCH');
  assert.equal(flags[0].severity, 'fail');
});

test('U507: CG-ARCH flags a "stairs overhead" phrasing with no leading article (the bare-noun form)', () => {
  const session = [turn(7, 'newbie', {
    player: 'What is up there?',
    dm: 'Stairs up lead to the loft where the family sleeps.',
    canon: insideCottage(),
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.length, 1, 'a bare "stairs up" is still an invented vertical space');
  assert.equal(flags[0].class, 'CG-ARCH');
});

// ── Tier B: a DEFINITE room-type noun the structure's roster lacks ───────────
test('U507: CG-ARCH flags a definite room-type noun the structure roster does not contain', () => {
  const session = [turn(12, 'newbie', {
    player: 'Where does this door lead?',
    dm: 'You cross into the kitchen, where a great hearth roars and pots hang from iron hooks.',
    canon: insideCottage(), // cottage has Hearth Room / Bedchamber / Pantry — NO "kitchen" room
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.length, 1, 'a "the kitchen" the plan lacks must be caught');
  assert.equal(flags[0].class, 'CG-ARCH');
  assert.equal(flags[0].canonField, 'roomPlan.rooms');
  assert.match(flags[0].narrated, /kitchen/i);
});

// ── The gap CG-ARCH fills: prove the existing bank MISSED this class ──────────
// The archetypal WB-Q1 line carries NO compass direction, so CG-2b (the only
// prior architecture check) cannot see it. This test asserts CG-ARCH is what
// catches it in the full single-turn bank — i.e. the coverage genuinely widened,
// not just a rename of an existing catch.
test('U507: the full single-turn bank now catches the compass-less invented staircase (CG-ARCH is the one that fires)', () => {
  const session = [turn(9, 'newbie', {
    player: 'I look around.',
    dm: 'A narrow staircase climbs to the sleeping loft above.', // no north/south/east/west anywhere
    canon: insideCottage(),
  })];
  const all = runDetectors(session, SINGLE_TURN_DETECTORS);
  const arch = all.filter(f => f.class === 'CG-ARCH');
  const exit = all.filter(f => f.class === 'CG-2b');
  assert.equal(arch.length, 1, 'CG-ARCH catches the invented staircase');
  assert.equal(exit.length, 0, 'CG-2b cannot see a compass-less staircase — this is the gap CG-ARCH closes');
});

// ── Graceful degradation (P-B negative control) ──────────────────────────────
test('U507: CG-ARCH is DORMANT (never a false flag) when roomPlan is absent from the bundle (pre-MR-2b shape)', () => {
  const session = [turn(9, 'newbie', {
    player: 'I look around.',
    dm: 'A grand staircase spirals up to a vaulted second storey.',
    canon: { interior: { roomId: 'r2', roomName: 'Bedchamber' } }, // no roomPlan key at all
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.length, 0, 'no roomPlan ground truth means no basis to flag — must stay silent');
});

test('U507: CG-ARCH stays DORMANT outdoors even if roomPlan happens to be present (interior-only surface)', () => {
  const session = [turn(3, 'newbie', {
    player: 'What do I see on the road?',
    dm: 'A staircase of stone climbs the hillside to a ruined tower above.',
    canon: { interior: null, roomPlan: COTTAGE_PLAN }, // stale/irrelevant outdoors
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.length, 0, 'architecture claims are checked only INSIDE a structure; outdoor stairs are a different surface');
});

// A multi-storey structure (should one ever exist) must NOT flag a real upper
// floor — singleStorey:false disables Tier A. This pins the guard so CG-ARCH
// never fights a genuinely multi-floor building if the topology ever grows one.
test('U507: CG-ARCH does NOT flag vertical space when the structure is genuinely multi-storey (singleStorey:false)', () => {
  const session = [turn(9, 'newbie', {
    player: 'I climb the stairs.',
    dm: 'The staircase carries you up to the second floor.',
    canon: {
      interior: { roomId: 'r1', roomName: 'Great Hall' },
      roomPlan: { rooms: ['Great Hall', 'Solar'], singleStorey: false },
    },
  })];
  const flags = detectArchitectureDesync(session);
  assert.equal(flags.filter(f => f.class === 'CG-ARCH').length, 0, 'a real upper floor in a multi-storey building is legal');
});
