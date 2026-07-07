// U634 — MAP-EGRESS-1: the doorstep sits ADJACENT to the building's DRAWN footprint.
//
// The fix anchors the egress doorstep on the building's DRAWN position (the engine
// settlement layout the renderer draws from), not the phantom node centre. This test
// asserts the geometric consequence directly, in the engine's REGION-cell frame: the
// doorstep cell doorThresholdCells returns lands within a doorstep of the building's
// OWN drawn footprint — computed from the SAME layout the renderer draws, projected to
// region cells through the SAME algebra the doorstep uses. It holds for:
//   • the BOOT HOME (a real structure) on two seeds; and
//   • a SECOND real structure planted at the boot node, so it is drawn scattered AMONG
//     the decorative buildings (a storehouse/well/…) — proving the drawn anchor is
//     per-building, not a boot-home special case.
//
// "Adjacent" = within DOORSTEP_MARGIN_CELLS of the drawn footprint's edge — a real
// doorstep, never a teleport. LLM OFF, seeded. Siblings: U498, U499, U632, U633.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { doorThresholdCells } from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  settlementLayout, buildingAnchorFromLayout, placeUnitToRegionCell,
  PLACE_WU_WU, REGION_WU_PER_CELL,
} from '../engine/world/settlementLayout.js';
import { DOORSTEP_MARGIN_CELLS } from '../scripts/positionProbe.mjs';

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

function boot(seed) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

const K = PLACE_WU_WU / REGION_WU_PER_CELL; // place-unit → region-cell factor (== 4/5)

// The building's DRAWN footprint in REGION cells (centre + half-spans), from the engine
// layout — the SAME geometry the renderer draws and the doorstep now anchors on.
function drawnFootprintRegionCells(world, nodeId, structId) {
  const node = world.map.nodes.find(n => String(n.id) === String(nodeId));
  const layout = settlementLayout(world, nodeId);
  const anchor = buildingAnchorFromLayout(layout, structId);
  if (!anchor) return null;
  const plan = floorPlan(world.structures.byId[structId]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of (plan.rooms || [])) {
    const rw = (r.w || (r.r ? r.r * 2 : 0)) / 2, rh = (r.h || (r.r ? r.r * 2 : 0)) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  const mid = { mx: (minX + maxX) / 2, my: (minY + maxY) / 2 };
  const c = placeUnitToRegionCell(node, layout.frame, anchor.ox + mid.mx, anchor.oy + mid.my);
  return { cx: c.gx, cy: c.gy, halfW: ((maxX - minX) / 2) * K, halfH: ((maxY - minY) / 2) * K };
}

// Distance (region cells) from the doorstep cell to the drawn footprint's edge (0 inside).
function doorstepDistToFootprintEdge(outside, fp) {
  const dx = Math.max(0, Math.abs(outside.gx - fp.cx) - fp.halfW);
  const dy = Math.max(0, Math.abs(outside.gy - fp.cy) - fp.halfH);
  return Math.hypot(dx, dy);
}

// (a) the boot home's doorstep is adjacent to its own drawn footprint — two seeds.
for (const seed of ['aldermere', 'greywater']) {
  test(`U634: boot-home doorstep is adjacent to its DRAWN footprint — seed ${seed}`, () => {
    const world = boot(seed);
    const nodeId = String(world.map.currentNodeId);
    const homeKey = String(world.scene.interior.structureKey);

    const th = doorThresholdCells(world, homeKey, world.scene.interior.visited?.[0]);
    assert.ok(th && th.outside, 'the door threshold grounds for the boot home');

    const fp = drawnFootprintRegionCells(world, nodeId, homeKey);
    assert.ok(fp, 'the home is drawn in the settlement layout');
    const dist = doorstepDistToFootprintEdge(th.outside, fp);
    assert.ok(dist <= DOORSTEP_MARGIN_CELLS,
      `boot-home doorstep is a doorstep from its own drawn footprint: ${dist.toFixed(2)} cells ≤ ${DOORSTEP_MARGIN_CELLS}`);
  });
}

// (b) a SECOND real structure planted at the boot node — drawn scattered among the
// decoratives — gets a doorstep adjacent to ITS drawn footprint. Two seeds.
for (const seed of ['aldermere', 'thornfield']) {
  test(`U634: a second structure (drawn among decoratives) has an adjacent doorstep — seed ${seed}`, () => {
    const base = boot(seed);
    const nodeId = String(base.map.currentNodeId);
    const st2 = {
      id: 'synth:extra:0', nodeId, buildingType: 'cottage',
      topology: { kind: 'rooms', rooms: [{ id: 'x0', tags: ['entry'] }, { id: 'x1' }], edges: [{ a: 'x0', b: 'x1' }] },
    };
    base.structures.byId[st2.id] = st2;
    const world = ensureWorld(base);

    // It IS drawn in the settlement (scattered among the decorative buildings).
    const layout = settlementLayout(world, nodeId);
    assert.ok(buildingAnchorFromLayout(layout, st2.id), 'the second structure is drawn in the settlement layout');
    // And its neighbours include decorative buildings (the settlement roster).
    assert.ok(layout.buildings.some(b => b.buildingName), 'the settlement has decorative buildings alongside');

    const th = doorThresholdCells(world, st2.id);
    assert.ok(th && th.outside, 'the second structure grounds a doorstep');
    const fp = drawnFootprintRegionCells(world, nodeId, st2.id);
    const dist = doorstepDistToFootprintEdge(th.outside, fp);
    assert.ok(dist <= DOORSTEP_MARGIN_CELLS,
      `second-structure doorstep is a doorstep from ITS drawn footprint: ${dist.toFixed(2)} cells ≤ ${DOORSTEP_MARGIN_CELLS}`);
  });
}
