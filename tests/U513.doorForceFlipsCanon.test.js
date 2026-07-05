// U513 — DOOR-FORCE-1: a BARE "force the door" flips the canon door state.
//
// docs/PACKETS.md (MR-2a honest-scope flag). MR-2a (v0.29.0) made door states canon and
// wired the NAMED seams: room-moves and egress consult {open|shut|barred|locked} and
// forcing/picking THROUGH those paths flips state via the `door` op + mints a witness
// fact. Its honest flag: a BARE "force the door" / "I break it down" / "kick it open" —
// no named room, just the door in front of you — was classified kind:'none' by
// inferInteriorAction (a barrier-force is not a move) and fell PAST that seam to the
// PRE-EXISTING generic physics-force resolver, which predates door canon: it rolled and
// narrated "the door gives" but NEVER flipped the canon state. So a player could "break
// down" a locked door, hear success, and the door was still canonically locked — the DM
// prose and the canon disagreed. This is the failing baseline that lie closed.
//
// REPRODUCE-FIRST: this asserts that a bare force at a LOCKED interior door, driven
// through the same entry the playtest harness uses (LLM off, deterministic floor), on a
// SUCCESSFUL roll (a) flips the door to open in canon, (b) mints a ledger witness fact,
// and (c) narrates the door yielding (prose and canon AGREE). Pre-fix all three failed:
// the door stayed locked, no fact, and the generic resolver's "it gives" was a lie.
//
// LLM OFF. Siblings: U514 (the phrasing family + the non-door regression), U505/U504
// (the MR-2a named-door canon this reuses).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { doorsOf, exteriorDoorOf } from '../engine/structures/doors.js';
import { moveWithinInterior } from '../engine/structures/interiors.js';

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

// The first interior door touching the player's current room (the door in front of you).
function adjacentInteriorDoor(world) {
  const sk = String(world.scene.interior.structureKey);
  const here = String(world.scene.interior.roomId);
  const door = doorsOf(world.structures.byId[sk])
    .find(d => d && !d.exterior && (String(d.a) === here || String(d.b) === here));
  return { sk, here, door };
}

function factsOf(world) {
  return (world.ledger?.facts || []).map(f => (typeof f === 'string' ? f : f && f.text)).filter(Boolean);
}

// ── (a) a bare force at a LOCKED interior door FLIPS the canon state ───────────
test('U513: a bare "force the door" at a LOCKED door flips it open in canon (was: stayed locked)', () => {
  let world = bootSlice();
  assert.ok(world.scene?.interior, 'the wake boot starts indoors');
  const { sk, door } = adjacentInteriorDoor(world);
  assert.ok(door, 'there is a canon interior door in front of the player');

  // Lock the door the player faces via the canon op.
  world = applyDeltas(world, [{ op: 'door', structId: sk, doorId: door.id, to: 'locked', how: '' }]);
  const stateBefore = doorsOf(world.structures.byId[sk]).find(d => d.id === door.id).state;
  assert.equal(stateBefore, 'locked', 'the door is locked in canon before the force');

  // Drive the BARE force through the real player entry (LLM off, deterministic floor).
  const { world: after, output } = playerMove(world, PACKS, 'force the door');

  // The mechanics prove this took the DOOR resolution path (DC from the door's
  // hardness), not the generic furniture resolver — and the roll SUCCEEDED
  // (success or mixed both open the door, mirroring MR-2a's named-door force).
  const mech = String(output?.mechanics || '');
  assert.match(mech, /roll:\d+ vs DC:\d+/, `a real force roll fired: ${mech}`);
  const succeeded = /→ (?:success|mixed)/.test(mech);
  assert.ok(succeeded, `the deterministic baseline roll is a success/mixed (so the flip is observable): ${mech}`);

  // (a) CANON FLIPPED — the lie was: this stayed "locked" while prose said it opened.
  const stateAfter = doorsOf(after.structures.byId[sk]).find(d => d.id === door.id).state;
  assert.equal(stateAfter, 'open',
    `a successful bare force flips the canon door locked→open (was: stayed ${stateAfter})`);

  // (b) a ledger WITNESS fact is minted (a broken door is a fact the world can react to).
  const forcedFact = factsOf(after).find(f => /forced open|picked/i.test(f));
  assert.ok(forcedFact, `a forced-entry witness fact is minted: ${JSON.stringify(factsOf(after))}`);

  // (c) narration and canon AGREE — the DM line acknowledges the door yielding, and
  // does NOT claim it "holds fast" (the generic-resolver lie when the state didn't move).
  const narr = String(output?.narration || '').toLowerCase();
  assert.match(narr, /burst|bang|open|give|tears?\s+free|splinter|through/,
    `the DM line acknowledges the door yielding: ${output?.narration}`);
  assert.doesNotMatch(narr, /holds fast|doesn'?t budge|won'?t give|still (?:shut|locked)/,
    `no success-narration-over-unchanged-canon lie: ${output?.narration}`);
});

// ── determinism: the same bare force from the same world is byte-identical ─────
test('U513: the bare-force resolution is deterministic (same world + input → same output)', () => {
  let world = bootSlice();
  const { sk, door } = adjacentInteriorDoor(world);
  world = applyDeltas(world, [{ op: 'door', structId: sk, doorId: door.id, to: 'locked', how: '' }]);

  const a = playerMove(world, PACKS, 'force the door');
  const b = playerMove(world, PACKS, 'force the door');
  assert.equal(a.output.narration, b.output.narration, 'same narration under replay');
  assert.equal(a.output.mechanics, b.output.mechanics, 'same mechanics under replay');
  const sa = doorsOf(a.world.structures.byId[sk]).find(d => d.id === door.id).state;
  const sb = doorsOf(b.world.structures.byId[sk]).find(d => d.id === door.id).state;
  assert.equal(sa, sb, 'same resulting door state under replay');
});

// ── failure is a real partial event, never a mechanical bounce (THE DM TEST) ───
test('U513: a FAILED bare force leaves the door secured and narrates an honest partial', () => {
  let world = bootSlice();
  const { sk, door } = adjacentInteriorDoor(world);
  world = applyDeltas(world, [{ op: 'door', structId: sk, doorId: door.id, to: 'locked', how: '' }]);

  // "kick it down" is the deterministic FAILURE on this seed/turn (rawDie below DC).
  const { world: after, output } = playerMove(world, PACKS, 'kick it down');
  const mech = String(output?.mechanics || '');
  assert.match(mech, /→ failure/, `this phrasing is the deterministic failure baseline: ${mech}`);

  const stateAfter = doorsOf(after.structures.byId[sk]).find(d => d.id === door.id).state;
  assert.equal(stateAfter, 'locked', 'a failed force leaves the door canonically locked (honest)');

  const narr = String(output?.narration || '').toLowerCase();
  // A real partial: the door holds / it didn't budge / noise carried — NOT a
  // mechanical bounce ("invalid", "no such", "you can't do that").
  assert.match(narr, /holds|doesn'?t budge|resists|stays shut|rattled|carried/,
    `failure reads as a physical partial event: ${output?.narration}`);
  assert.doesNotMatch(narr, /invalid|no such|unknown|can'?t do that|not a valid/,
    `no mechanical bounce on failure: ${output?.narration}`);
});

// ── the exterior/front door, forced from the entry room, also flips canon ──────
test('U513: a bare force at the LOCKED front door (from the entry room) flips it open', () => {
  let world = bootSlice();
  const sk = String(world.scene.interior.structureKey);
  // POSITION the player in the entry room the front door fronts on (its `a` side),
  // so the front door is the one "in front of you". moveWithinInterior is a test-setup
  // teleport through the open interior graph — the FORCE itself still goes through the
  // real playerMove seam under test.
  const entryRoomId = String(exteriorDoorOf(world.structures.byId[sk]).a);
  world = moveWithinInterior(world, entryRoomId);
  assert.equal(String(world.scene.interior.roomId), entryRoomId,
    'the player stands in the entry room the front door fronts on');

  world = applyDeltas(world, [{ op: 'door', structId: sk, doorId: exteriorDoorOf(world.structures.byId[sk]).id, to: 'locked', how: '' }]);
  assert.equal(exteriorDoorOf(world.structures.byId[sk]).state, 'locked', 'the front door is locked in canon');

  const { world: after, output } = playerMove(world, PACKS, 'force the door');
  const mech = String(output?.mechanics || '');
  assert.match(mech, /roll:\d+ vs DC:\d+/, `a real force roll fired at the front door: ${mech}`);
  assert.match(mech, /→ (?:success|mixed)/, `the deterministic baseline roll succeeds (flip observable): ${mech}`);

  const st = exteriorDoorOf(after.structures.byId[sk]).state;
  assert.equal(st, 'open', `a successful force flips the front door open in canon: ${mech}`);
  // Forcing the front door opens the way OUT — the player is NOT teleported outside
  // (no room to step into); they still stand in the entry room, door now open.
  assert.equal(String(after.scene?.interior?.roomId || ''), entryRoomId,
    'forcing the front door opens it in place (no forced exit)');
  const narr = String(output?.narration || '').toLowerCase();
  assert.match(narr, /open|burst|give|tears?\s+free/, `the front door is narrated as yielding: ${output?.narration}`);
});
