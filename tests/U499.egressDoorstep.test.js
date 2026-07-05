// U499 — MR-1a: stepping out lands the body on the doorstep (engine-level).
//
// The live bug (MR-ORACLE): typing "go outside" narrated "you step back outside"
// but the body TELEPORTED — the exit path cleared the interior, then ensureWorld's
// backfill re-seeded the now-stale struct pos via placeNearNode's ±50-cell jitter
// (measured 49 cells / 247 ft on the default seed). This test drives the REAL
// playerMove exit path on the default slice boot and asserts the fix: after "go
// outside" the party's canonical `pos` is a REGION cell, within the door's doorstep
// threshold of the exited structure, still projecting to the current node (no node
// crossing — THE MOVEMENT LAW), and it MATCHES the door threshold the geometry maps.
//
// Pre-MR-1a this FAILED (pos was ~49 cells away). Post-fix it passes because
// exitStructureInterior commits the doorstep through applyDeltas ({op:'pos'}).
//
// docs/POSITION_AS_CANON.md §2/§3. LLM OFF (deterministic parseIntent floor).
// Siblings: U497 (the probe sequence), U498 (the pure threshold), U500 (backfill).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import {
  doorThresholdCells,
  nearestNodeToRegionCell,
  CELL_FT,
} from '../engine/map/spatial/tacticalPos.js';
import { structFootprintRegionCells, EXIT_TELEPORT_CELLS, DOORSTEP_MARGIN_CELLS } from '../scripts/positionProbe.mjs';

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

test('U499: default boot — the player wakes INSIDE the wake structure (struct frame)', () => {
  const world = bootSlice();
  const pos = playerPos(world);
  assert.ok(pos && String(pos.frame).startsWith('struct:'), `wake pos is a struct frame; got ${JSON.stringify(pos)}`);
  assert.ok(world.scene?.interior?.structureKey, 'an interior is active at wake');
});

test('U499: "go outside" lands the body on the doorstep — a region cell within the door threshold, not a teleport', () => {
  let world = bootSlice();
  const exitedKey = String(world.scene.interior.structureKey);

  // The doorstep the geometry maps for this structure's entry door (the target).
  const th = doorThresholdCells(world, exitedKey, world.scene.interior.visited?.[0]);
  assert.ok(th && th.outside, 'the door threshold grounds for the wake structure');

  // Drive the REAL exit path (LLM off — no llmPacket → deterministic floor).
  ({ world } = playerMove(world, PACKS, 'go outside'));

  const pos = playerPos(world);
  // 1) The exit returned the body OUTDOORS.
  assert.ok(pos && pos.frame === 'region', `exit lands on the region frame; got ${JSON.stringify(pos)}`);
  assert.equal(world.scene?.interior ?? null, null, 'the interior is cleared after exit');

  // 2) The body is on the DOORSTEP — within the probe's teleport threshold and
  //    doorstep margin of the exited structure's footprint (NOT the 247-ft jitter).
  const fp = structFootprintRegionCells(world, exitedKey);
  assert.ok(fp, 'the exited footprint grounds');
  const distToCentre = Math.hypot(pos.gx - fp.cx, pos.gy - fp.cy);
  assert.ok(distToCentre <= EXIT_TELEPORT_CELLS,
    `body is a doorstep, not a teleport: ${distToCentre.toFixed(1)} cells (${(distToCentre * CELL_FT).toFixed(0)} ft) ≤ ${EXIT_TELEPORT_CELLS}`);
  const dx = Math.max(0, Math.abs(pos.gx - fp.cx) - fp.halfW);
  const dy = Math.max(0, Math.abs(pos.gy - fp.cy) - fp.halfH);
  assert.ok(Math.hypot(dx, dy) <= DOORSTEP_MARGIN_CELLS,
    `body is within the doorstep margin of the footprint edge (${Math.hypot(dx, dy).toFixed(1)} ≤ ${DOORSTEP_MARGIN_CELLS})`);

  // 3) No node crossing — the doorstep still belongs to the current node (THE LAW).
  assert.equal(nearestNodeToRegionCell(world.map, pos.gx, pos.gy), String(world.map.currentNodeId),
    'the doorstep projects to the current node (exit is a threshold crossing, not node travel)');

  // 4) The committed pos is EXACTLY the door threshold the geometry mapped.
  assert.deepEqual(pos, th.outside, 'the committed pos is the mapped door threshold (egress writes the door)');
});

test('U499: the exit is deterministic — two independent boots land on the same doorstep', () => {
  let a = bootSlice(); let b = bootSlice();
  ({ world: a } = playerMove(a, PACKS, 'go outside'));
  ({ world: b } = playerMove(b, PACKS, 'go outside'));
  assert.deepEqual(playerPos(a), playerPos(b), 'both boots land on an identical doorstep pos');
});
