// U514 — DOOR-FORCE-1: the force-phrasing FAMILY routes to the door op; furniture
// force is unchanged (docs/PACKETS.md MR-2a honest-scope flag; sibling of U513).
//
// The bare "force the door" family — "force the door", "kick it down", "shoulder it
// open", "smash the lock", "I break it down" — must ALL resolve against the canon door
// the player faces (the same door-force resolution path, DC set by the door's hardness),
// so a success flips the `door` op state and mints a witness fact. The pre-existing
// generic physics-force resolver they used to hit predates door canon and never touched
// it. Meanwhile a force aimed at a NAMED non-door object (chest/crate/barrel/lid) must
// keep the LEGACY physics path byte-for-byte — the door intercept must not steal it.
//
// Determinism: driven through playerMove with the LLM off (parseIntent floor). Uses the
// mechanics line as the observable path signature: the door path rolls at stake:action
// with a hardness DC (14 locked / 16 barred); the legacy furniture path is stake:time.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { doorsOf } from '../engine/structures/doors.js';

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

function adjacentInteriorDoor(world) {
  const sk = String(world.scene.interior.structureKey);
  const here = String(world.scene.interior.roomId);
  const door = doorsOf(world.structures.byId[sk])
    .find(d => d && !d.exterior && (String(d.a) === here || String(d.b) === here));
  return { sk, here, door };
}

function lockAdjacent(world, state = 'locked') {
  const { sk, door } = adjacentInteriorDoor(world);
  const w = applyDeltas(world, [{ op: 'door', structId: sk, doorId: door.id, to: state, how: '' }]);
  return { world: w, sk, door };
}

// The mechanics-line signature of the DOOR resolution path (vs the legacy furniture
// path). MR-2a's door force rolls at stake:action with a hardness-set DC (14 / 16);
// the generic furniture resolver rolls at stake:time.
function tookDoorPath(mech) {
  const m = String(mech || '');
  return /approach:force/.test(m) && /stake:action/.test(m) && /DC:1[46]\b/.test(m);
}

// ── the FAMILY: every bare force/pick phrasing routes to the door op path ──────
const FORCE_FAMILY = [
  'force the door',
  'kick it down',
  'shoulder it open',
  'smash the lock',
  'I break it down',
  'kick the door open',
  'ram it',
  'break down the door',
];

for (const phrase of FORCE_FAMILY) {
  test(`U514: "${phrase}" routes to the canon door-force path (not the generic resolver)`, () => {
    const { world } = lockAdjacent(bootSlice(), 'locked');
    const { output } = playerMove(world, PACKS, phrase);
    const mech = String(output?.mechanics || '');
    assert.ok(tookDoorPath(mech),
      `"${phrase}" must roll against the door's hardness (stake:action, DC 14/16), got: ${mech}`);
  });
}

// ── every phrasing that SUCCEEDS flips canon + mints a fact; every FAILURE keeps
//    the door secured and never claims it opened (prose ⇔ canon on both outcomes) ──
test('U514: across the family, canon state ALWAYS agrees with the narration', () => {
  for (const phrase of FORCE_FAMILY) {
    const { world, sk, door } = lockAdjacent(bootSlice(), 'locked');
    const { world: after, output } = playerMove(world, PACKS, phrase);
    const mech = String(output?.mechanics || '');
    const stateAfter = doorsOf(after.structures.byId[sk]).find(d => d.id === door.id).state;
    const narr = String(output?.narration || '').toLowerCase();
    const claimsOpen = /burst|bang(?:s|ed)?\s+open|the door (?:bursts|bangs) open|tears?\s+free|springs?\s+open|gives with|step through/.test(narr);

    if (/→ (?:success|mixed)/.test(mech)) {
      assert.equal(stateAfter, 'open', `"${phrase}" succeeded → canon must be open: ${mech}`);
    } else {
      // Failure: the door is still secured, and the prose must NOT claim it opened.
      assert.equal(stateAfter, 'locked', `"${phrase}" failed → canon stays locked: ${mech}`);
      assert.ok(!claimsOpen, `"${phrase}" failed → prose must not claim the door opened: ${output?.narration}`);
    }
  }
});

// ── a BARRED door resolves at the stouter DC (16) and flips on success ─────────
test('U514: a bare force at a BARRED door uses the stouter bar DC (16)', () => {
  const { world, sk, door } = lockAdjacent(bootSlice(), 'barred');
  const { world: after, output } = playerMove(world, PACKS, 'force the door');
  const mech = String(output?.mechanics || '');
  assert.match(mech, /DC:16\b/, `a barred door is stouter (DC 16): ${mech}`);
  if (/→ (?:success|mixed)/.test(mech)) {
    assert.equal(doorsOf(after.structures.byId[sk]).find(d => d.id === door.id).state, 'open',
      'a successful force on a barred door flips it open');
  }
});

// ── NON-DOOR REGRESSION: forcing a named furniture piece is UNCHANGED ──────────
// Byte-identical to pre-fix: the door intercept must not claim a chest/crate/barrel.
// A secured door in the same room must NOT be flipped when the force names furniture.
const FURNITURE_FORCE = ['kick the chest', 'smash the crate', 'bash the barrel', 'pry the lid open'];

for (const phrase of FURNITURE_FORCE) {
  test(`U514: "${phrase}" does NOT take the door path (furniture force unchanged)`, () => {
    // Even with a LOCKED door in the room, a named-furniture force stays off the door path.
    const { world, sk, door } = lockAdjacent(bootSlice(), 'locked');
    const { world: after, output } = playerMove(world, PACKS, phrase);
    const mech = String(output?.mechanics || '');
    // EVOLVED 2026-07-16 (FURN-PARITY-1): tookDoorPath's mechanics heuristic
    // (approach:force + stake:action + DC 14/16) can no longer discriminate —
    // the room now holds a REAL iron chest (plan-sourced Model A piece), and a
    // furniture physics check on iron rolls hardness-derived DC 16 at
    // stake:action too (rollPhysicsCheck), textually identical to a door force.
    // The claim this test owns is that the force NEVER lands on the DOOR — so
    // assert the world's door truth directly (state untouched) and that the
    // reply doesn't narrate a door, rather than fingerprinting the roll line.
    assert.ok(!/\bdoor\b/i.test(String(output?.narration || '')),
      `"${phrase}" must not resolve against the door: ${output?.narration} | ${mech}`);
    // …and the secured door is untouched by a furniture-directed force.
    const stateAfter = doorsOf(after.structures.byId[sk]).find(d => d.id === door.id).state;
    assert.equal(stateAfter, 'locked',
      `a furniture-directed force leaves the door's canon state alone: ${phrase}`);
  });
}

// ── the legacy furniture-force path is byte-identical with/without a door present ─
test('U514: furniture force output is identical whether or not a locked door is in the room', () => {
  for (const phrase of FURNITURE_FORCE) {
    const plain = playerMove(bootSlice(), PACKS, phrase); // no door locked
    const { world: withDoor } = lockAdjacent(bootSlice(), 'locked'); // a locked door faces the player
    const withLocked = playerMove(withDoor, PACKS, phrase);
    assert.equal(plain.output.narration, withLocked.output.narration,
      `"${phrase}" narration must not change because a door is locked nearby`);
    assert.equal(plain.output.mechanics, withLocked.output.mechanics,
      `"${phrase}" mechanics must not change because a door is locked nearby`);
  }
});
