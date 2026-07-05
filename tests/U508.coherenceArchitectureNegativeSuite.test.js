// U508 — CG-ARCH negative suite (MR-2b, docs/briefs/MR-2-FUNCTIONAL-INK.md §2b).
// PRECISION DISCIPLINE, made load-bearing: an architecture-grounding gate that
// false-flags legitimate DM prose is worse than useless — it would fight the DM
// Test by rejecting good narration. This suite is the standing guard that
// CG-ARCH fires on INVENTED geometry ONLY, never on:
//   1. mood / atmosphere language (no architecture noun at all);
//   2. spatial qualifiers with no fixed architectural identity;
//   3. the DM correctly DENYING invented space (the WB-Q1 FIX's success signal);
//   4. rooms the structure genuinely HAS (incl. multi-word / plural / case);
//   5. an indefinite hypothetical ("a cellar would be handy") vs an assertion;
//   6. furniture and objects that merely sound structural.
//
// Under-flagging is the correct failure direction for a gate (precision over
// recall); this suite locks that intent so a future broadening of the lexicon
// can't silently start eating good prose. Pure functions, $0, deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';

import { detectArchitectureDesync } from '../engine/coherence/checks.js';

function turn(dm, canon) {
  return {
    type: 'turn', seed: 's', persona: 'neg', i: 1, player: 'I look around.',
    dm, mechanics: '', canon: { npcsPresent: [], ...canon },
  };
}

// The real wake-cottage plan (verified live).
const COTTAGE = {
  interior: { roomId: 'r2', roomName: 'Bedchamber' },
  roomPlan: { rooms: ['Hearth Room', 'Bedchamber', 'Pantry'], singleStorey: true },
  roomExits: { east: 'Pantry', south: 'Hearth Room' },
};

function assertClean(label, dm, canon = COTTAGE) {
  const flags = detectArchitectureDesync([turn(dm, canon)]);
  assert.equal(flags.length, 0, `${label} — must NOT flag, got: ${JSON.stringify(flags.map(f => f.narrated))}`);
}

// ── 1. Mood / atmosphere (no architecture noun) ──────────────────────────────
test('U508: atmospheric mood language never flags (shadowed alcoves, dim corners)', () => {
  assertClean('shadowed alcoves', 'Shadowed alcoves and dim corners swallow the lantern light at the far end of the room.');
  assertClean('gloom', 'The back of the room is lost in gloom, and cold breathes from the stone.');
  assertClean('dust motes', 'Dust motes drift in the shaft of light from the shutters; the air smells of tallow and old smoke.');
  assertClean('the far end', 'A single candle gutters at the far end, throwing long shadows across the boards.');
});

// ── 2. Spatial qualifiers with no architectural identity ─────────────────────
test('U508: bare spatial qualifiers (back of the room, the corner) never flag', () => {
  assertClean('the corner', 'In the corner, a straw pallet lies rumpled where you woke.');
  assertClean('across the room', 'Across the room, an oil lantern hangs from a peg.');
  assertClean('overhead beams', 'Overhead, rough-hewn beams cross the low ceiling.'); // "overhead" without a vertical NOUN
});

// ── 3. The DM DENYING invented space (WB-Q1 fix working) ─────────────────────
test('U508: the DM denying a staircase / upper floor never flags (the fix must not be punished)', () => {
  assertClean('no staircase', 'There is no staircase here — this is a single-storey cottage, and no way leads up.');
  assertClean('no upstairs', 'You look up, but there is no upstairs; the roof beams are all that lie above.');
  assertClean('no cellar / no way down', 'You look for a cellar, but the floor is solid earth; there is no way down.');
  assertClean('nowhere to climb', 'The walls are blank timber — nowhere to climb, no second floor, nothing overhead but thatch.');
  assertClean('one floor', 'This is a one-floor cottage; the only rooms are the ones around you.');
});

// ── 4. Rooms the structure genuinely HAS ─────────────────────────────────────
test('U508: real rooms of THIS structure are always legal (name, plural, case, multi-word)', () => {
  assertClean('the pantry', 'You step into the pantry, shelves crowding close with crocks and sacks.');
  assertClean('the hearth room', 'The hearth room opens ahead, warm with banked coals.');
  assertClean('the bedchamber', 'Back in the bedchamber, the straw pallet still holds the shape of you.');
  assertClean('lowercase', 'you cross into the pantry and reach for the topmost shelf.');
});

// ── 5. Indefinite / hypothetical vs assertion ────────────────────────────────
test('U508: an indefinite hypothetical room-noun is not an assertion the structure contains it', () => {
  // "a kitchen" (indefinite, not "the kitchen") — Tier B fires only on a DEFINITE
  // reference; a hypothetical/comparative mention is not a claim about THIS plan.
  assertClean('a kitchen (indefinite)', 'It is cramped for a kitchen, more a hearth than a proper cookhouse.');
  assertClean('comparison', 'The room is barely bigger than a pantry, though it holds a bed.');
});

// ── 6. Furniture / objects that merely sound structural ──────────────────────
test('U508: furniture and fittings are not architecture (a chest, a hearth, shelves)', () => {
  assertClean('chest', 'An iron-bound chest sits against the wall, its lid shut.');
  assertClean('hearth + shelves', 'A cold hearth fills the near wall; shelves climb beside it, stacked with clay jars.');
  assertClean('door leaf (no compass, no room)', 'The door stands shut, its planks grey with age.'); // a door with no invented room beyond it
});

// ── 7. A real interior room noun that also happens to be vertical-adjacent ────
// "loft" IS a vertical noun (Tier A), but a structure that genuinely has a
// "Loft" room in its roster must be fully legal — the roster wins (Tier A is
// roster-aware). This pins the precedence: Tier A fires only on INVENTED
// vertical space, never on a canon room that happens to be named for a level.
test('U508: a vertical noun that IS a named room of the structure is fully legal (roster precedence)', () => {
  const withLoft = {
    interior: { roomId: 'r1', roomName: 'Loft' },
    roomPlan: { rooms: ['Loft', 'Hall'], singleStorey: true },
  };
  const flags = detectArchitectureDesync([turn('You climb into the loft, straw prickling underfoot.', withLoft)]);
  assert.equal(flags.length, 0, 'a roster-present "Loft" is canon, not invented vertical space — no CG-ARCH flag of any tier');
});
