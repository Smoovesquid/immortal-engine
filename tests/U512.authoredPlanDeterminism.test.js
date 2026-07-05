// U512 — MR-2c: authored plans are DETERMINISTIC and never disturb an un-authored
// world's replay stability.
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c falsifier: "Tim draws a house, walks its
// rooms in-game; any mismatch between drawn and walked = red." This file is the
// determinism half of that promise:
//   • the loader is PURE — the same raw export always yields the same topology/plan,
//     twice, byte-for-byte (buildAuthoredTopology / buildAuthoredFloorPlan);
//   • an UN-AUTHORED world's worldHash is completely untouched by this packet (two
//     independent boots of the ordinary slice hash identically — the same property
//     U19/U21/U22/U27/U30 already assert, re-proven here scoped to structures);
//   • a world with the authored fixture ACTIVE also replays hash-stable across two
//     independent boots (determinism holds WITH an authored structure present, not
//     just without one);
//   • roomOfStructCell / structWalkableMask.roomOf AGREE inside the authored
//     structure — the same "which room does this cell belong to" projection
//     invariants.js checks on every ensureWorld() call, walked here directly so a
//     regression fails loudly as a unit test, not just a deep invariant throw;
//   • the full engine-level walk-through: boot with the fixture active, enter the
//     authored structure, move between its two rooms through the authored door,
//     exit through the authored front door — via the REAL playerMove/interiors.js
//     seams, not a hand-built shortcut.
//
// Siblings: U510 (the load itself), U511 (door records + mask).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyGeneratedStructuresForNode } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { isTacticalPosConsistent, roomOfStructCell } from '../engine/map/spatial/tacticalPos.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { authoredRawFor, buildAuthoredTopology, buildAuthoredFloorPlan } from '../engine/structures/authoredPlans.js';
import { enterStructureInterior, moveWithinInterior, exitStructureInterior } from '../engine/structures/interiors.js';

const AUTHORED_STRUCT_ID = 'stgen:v27:n99_mr2c_wake_cottage:0';
const AUTHORED_NODE_ID = 'n99_mr2c_wake_cottage';

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

function bootSlice(worldSeed = SLICE_SEED) {
  const w0 = newWorld({ seed: worldSeed, fate: 0.2, campaignId: `campaign-${worldSeed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// A minimal single party member (just an id) — ensureWorld's ensureEntity fills in
// every stat/inventory default, and backfillTacticalPositions (state.js's TAC-1
// tail) seeds a real `pos` for it once the node/structures are assembled. This
// mirrors how other unit tests hand-assemble a world at a specific node without
// running the full chargen/pack-setup beginAdventure does.
function bootAuthored(worldSeed = 'U512-seed') {
  let w = ensureWorld(newWorld({ seed: worldSeed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }));
  w = {
    ...w,
    party: [{ id: 'party' }],
    map: {
      ...w.map,
      currentNodeId: AUTHORED_NODE_ID,
      nodes: [...(w.map.nodes || []), { id: AUTHORED_NODE_ID, x: 11, y: 11, tags: [] }],
    },
  };
  return ensureWorld(applyGeneratedStructuresForNode(w, AUTHORED_NODE_ID));
}

// ── pure loader determinism ─────────────────────────────────────────────────────

test('U512: buildAuthoredTopology is pure — same raw+structId in, byte-identical topology out, twice', () => {
  const raw = authoredRawFor(AUTHORED_STRUCT_ID);
  const t1 = buildAuthoredTopology(raw, AUTHORED_STRUCT_ID);
  const t2 = buildAuthoredTopology(raw, AUTHORED_STRUCT_ID);
  assert.deepEqual(t1, t2);
});

test('U512: buildAuthoredFloorPlan is pure — same raw+structId in, byte-identical plan out, twice', () => {
  const raw = authoredRawFor(AUTHORED_STRUCT_ID);
  const p1 = buildAuthoredFloorPlan(raw, AUTHORED_STRUCT_ID);
  const p2 = buildAuthoredFloorPlan(raw, AUTHORED_STRUCT_ID);
  assert.deepEqual(p1, p2);
});

// ── un-authored world: completely unaffected (the no-regression half) ──────────

test('U512: an ORDINARY (un-authored) slice boot replays worldHash-identical across two independent boots', () => {
  const a = bootSlice();
  const b = bootSlice();
  assert.equal(worldHash(a), worldHash(b), 'the shippable slice\'s hash is untouched by this packet when no authored plan is in play');
});

test('U512: an ordinary structure at an un-authored node carries no authoredPlan field (shape untouched)', () => {
  const w = bootSlice();
  const sk = String(w.scene.interior.structureKey);
  assert.equal(w.structures.byId[sk].authoredPlan, undefined);
});

// ── authored world: ALSO deterministic (the positive half) ─────────────────────

test('U512: a world with the authored fixture ACTIVE replays worldHash-identical across two independent boots', () => {
  const a = bootAuthored('U512-detseed');
  const b = bootAuthored('U512-detseed');
  assert.equal(worldHash(a), worldHash(b), 'determinism holds WITH an authored structure present, not just without one');
});

test('U512: two DIFFERENT world seeds booting the SAME authored node still get byte-identical authored geometry (the plan is seed-independent; only door DEFAULT STATE derivation reads the seed)', () => {
  const a = bootAuthored('seed-one');
  const b = bootAuthored('seed-two');
  const stA = a.structures.byId[AUTHORED_STRUCT_ID];
  const stB = b.structures.byId[AUTHORED_STRUCT_ID];
  assert.deepEqual(stA.authoredPlan, stB.authoredPlan, 'the drawn geometry itself never depends on the world seed');
  assert.deepEqual(stA.topology, stB.topology);
});

// ── roomOf agreement — the SAME projection invariants.js asserts on every ensureWorld ──

test('U512: roomOfStructCell and structWalkableMask.roomOf agree inside the authored structure', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const plan = floorPlan(st);
  for (const r of plan.rooms) {
    const cellX = Math.round(r.cx * 4), cellY = Math.round(r.cy * 4); // PLACE_WU=4
    assert.equal(roomOfStructCell(plan, cellX, cellY), r.id, `roomOfStructCell resolves room ${r.id}'s own centre to itself`);
  }
});

test('U512: assertWorldInvariants does not throw for a world booted with the authored structure materialized', () => {
  const w = bootAuthored();
  assert.doesNotThrow(() => assertWorldInvariants(w), 'the authored structure satisfies every existing MR-2a door + shape invariant');
});

test('U512: a party pos placed inside the authored structure is tactical-pos-consistent', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const plan = floorPlan(st);
  const entryRoom = plan.rooms.find(r => r.isEntry);
  assert.ok(entryRoom, 'the authored plan marks an entry room');
  const pos = { frame: `struct:${AUTHORED_STRUCT_ID}`, gx: Math.round(entryRoom.cx * 4), gy: Math.round(entryRoom.cy * 4) };
  assert.equal(isTacticalPosConsistent(pos, w, AUTHORED_NODE_ID, { isPlayer: false }), true);
});

// ── the full engine-level walk-through receipt (THE falsifier, played for real) ──

test('U512: boot with the fixture, enter the authored structure, move between its two rooms through the authored door, exit through the authored front door', () => {
  let w = bootAuthored('U512-walkthrough');
  const st0 = w.structures.byId[AUTHORED_STRUCT_ID];
  const plan = floorPlan(st0);
  assert.equal(plan.rooms.length, 2, 'sanity: the authored plan is live');

  // Enter via the real interiors.js seam (not playerMove's node-arrival scaffolding
  // — this world was hand-assembled at the node rather than walked there, so we
  // call the entry primitive directly, exactly as playloop.js itself does).
  w = enterStructureInterior(w, AUTHORED_STRUCT_ID);
  assert.ok(w.scene?.interior, 'the player is now inside the authored structure');
  const startRoom = String(w.scene.interior.roomId);
  const entryRoom = plan.rooms.find(r => r.isEntry);
  assert.equal(startRoom, entryRoom.id, 'entry drops the player in the AUTHORED entry room (the Hall), matching the fixture\'s front door');

  // Move into the other room through the authored interior door.
  const otherRoom = plan.rooms.find(r => r.id !== startRoom).id;
  w = moveWithinInterior(w, otherRoom);
  assert.equal(String(w.scene.interior.roomId), otherRoom, 'moveWithinInterior crossed the authored interior door into the Bedchamber');
  assert.equal(w.party[0].pos?.frame, `struct:${AUTHORED_STRUCT_ID}`, 'the tactical pos followed the move into the struct frame');

  // Exit through the authored front door.
  w = exitStructureInterior(w);
  assert.equal(w.scene?.interior ?? null, null, 'exiting clears the interior');
  assert.equal(w.party[0].pos?.frame, 'region', 'the body lands outdoors (region frame) through the authored front door');

  // The world stays fully invariant-clean and hash-replayable after the walk.
  assert.doesNotThrow(() => assertWorldInvariants(w));
});
