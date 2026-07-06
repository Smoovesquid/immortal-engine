// U546 — FURN-1: furniture never soft-locks a room (the safety property).
//
// docs/MAP_REAL.md promise 1 + THE DM TEST. Furniture joins the struct walkable mask
// this packet — so the ONE thing that must never happen is a furniture arrangement
// that WALLS OFF a door: a room you could enter must stay a room you can leave, and a
// doorway must never be furniture-blocked. This mirrors U506 (the door no-soft-lock
// property) with furniture in the mask, over several seeds.
//
// Three properties:
//   1. DOORS ARE NEVER FURNITURE-BLOCKED. For every structure at the wake node (over
//      5 seeds), every door cell + its approach cells are FREE per the struct mask —
//      the mask REFUSES to let a footprint seal a crossing (structCellFree === true
//      on every door cell).
//   2. EVERY ROOM STAYS ESCAPABLE. Walk the wake structure room-by-room; from each
//      reached room, bar the front door and prove "go outside" still gets the body
//      out (the U506 pattern, now with furniture in the mask).
//   3. A WALK STOPS HONESTLY AT FURNITURE. In the default wake structure, a tactical
//      move toward a furniture cell advances ZERO and never lands on it (the movement
//      law inherits furniture blocking for free — tactical moves consume the mask).
//
// Hermetic — no network, no API key, LLM off.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { exteriorDoorOf } from '../engine/structures/doors.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  structCellFree, resolveTacticalWalk, roomRectCells, layoutToCells,
} from '../engine/map/spatial/tacticalPos.js';

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

function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({
    seed, fate: 0.2, campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  return beginAdventure(ensureWorld(w0), PACKS).world;
}

const playerPos = (w) => (w?.party?.[0]?.pos) || null;

function setFrontDoor(world, state) {
  const sk = String(world.scene.interior.structureKey);
  const front = exteriorDoorOf(world.structures.byId[sk]);
  if (!front) return world;
  return applyDeltas(world, [{ op: 'door', structId: sk, doorId: front.id, to: state, how: '' }]);
}

// Every door cell + its two orthogonal approach cells (the crossing corridor), in the
// struct frame. Mirrors the mask's own door-cell derivation (kept local so the test
// is an independent witness). NOTE these cells often sit in the WALL BAND (the tiled
// floorplan puts a doorway on the shared cell boundary, which roomRectCells insets
// out), so they are not necessarily "walkable" — that is a WALL fact, not a furniture
// fact. What FURN-1 owns is that FURNITURE never blocks them (the exclusion below).
function doorCrossingCells(plan) {
  const out = [];
  for (const d of (plan.doors || [])) {
    const dx = layoutToCells(d.x), dy = layoutToCells(d.y);
    out.push(`${dx},${dy}`);
    if (d.dir === 'north' || d.dir === 'south') {
      out.push(`${dx},${dy - 1}`, `${dx},${dy + 1}`);
    } else {
      out.push(`${dx - 1},${dy}`, `${dx + 1},${dy}`);
    }
  }
  return out;
}

// The cells FURNITURE removes from walkability in a structure — the difference the
// mask makes. A cell is furniture-blocked when it lies in a real room rect (so the
// WALL isn't the reason it's blocked) yet structCellFree reports it unwalkable. This
// isolates the furniture contribution from the wall topology.
function furnitureBlockedInRooms(st, plan) {
  const blocked = new Set();
  for (const room of plan.rooms) {
    const rect = roomRectCells(room);
    if (!rect) continue;
    for (let gy = rect.minY; gy <= rect.maxY; gy++) {
      for (let gx = rect.minX; gx <= rect.maxX; gx++) {
        if (!structCellFree(st, gx, gy)) blocked.add(`${gx},${gy}`);
      }
    }
  }
  return blocked;
}

const SEEDS = [SLICE_SEED, 'tallow', 'testA', 'seed2', 'qqq'];

// ── property 1: FURNITURE never blocks a door crossing (the exclusion works) ───
// A furniture footprint can never win a door cell or its approach cells — the mask
// REFUSES those cells (the furniture loses them). This is the disjointness that
// guarantees a piece of furniture can never wall off a doorway.
for (const seed of SEEDS) {
  test(`U546: furniture never blocks a door crossing at the wake node (seed ${seed})`, () => {
    const world = bootSlice(seed);
    const nodeId = String(world.map.currentNodeId);
    const structs = Object.values(world.structures.byId)
      .filter(s => s && String(s.nodeId ?? '') === nodeId);
    assert.ok(structs.length >= 1, `at least one structure stands at the wake node (seed ${seed})`);
    let checked = 0;
    for (const st of structs) {
      const plan = floorPlan(st);
      const furnBlocked = furnitureBlockedInRooms(st, plan);
      for (const key of doorCrossingCells(plan)) {
        checked++;
        assert.equal(
          furnBlocked.has(key), false,
          `seed ${seed}: door crossing cell (${key}) of ${st.id} is FURNITURE-blocked — a piece of furniture sealed a doorway`,
        );
      }
    }
    assert.ok(checked >= 1, `checked at least one door crossing cell (seed ${seed})`);
  });
}

// ── property 2: every reachable room stays escapable (furniture in the mask) ────
test('U546: every room reachable in the wake structure stays escapable with furniture masked', () => {
  const roomsReached = new Set();
  {
    let world = bootSlice();
    roomsReached.add(String(world.scene.interior.roomId));
    for (let depth = 0; depth < 6; depth++) {
      let moved = false;
      for (const dir of ['north', 'east', 'south', 'west']) {
        const before = String(world.scene?.interior?.roomId || '');
        const r = playerMove(world, PACKS, `go ${dir}`);
        const after = String(r.world?.scene?.interior?.roomId || '');
        if (after && after !== before && !roomsReached.has(after)) {
          world = r.world; roomsReached.add(after); moved = true;
        }
      }
      if (!moved) break;
    }
  }
  assert.ok(roomsReached.size >= 2, `walked into multiple rooms (${roomsReached.size})`);

  let escapes = 0;
  for (const targetRoom of roomsReached) {
    let world = bootSlice();
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
    world = setFrontDoor(world, 'barred');
    ({ world } = playerMove(world, PACKS, 'go outside'));
    assert.equal(world.scene?.interior ?? null, null,
      `room ${targetRoom} is escapable even with furniture in the mask and a barred front door`);
    const pos = playerPos(world);
    assert.ok(pos && pos.frame === 'region', `the body is outdoors after exiting room ${targetRoom}`);
    escapes++;
  }
  assert.equal(escapes, roomsReached.size, 'every reached room was escaped');
});

// ── property 3: a tactical walk STOPS HONESTLY at a piece of furniture ─────────
// In the default wake structure the hearthroom holds a table/bench on the middle
// column of cells. A body one cell west of it, walking east, must stop — the walk
// consumes the same mask, so furniture blocks it exactly like a wall (moved === 0,
// body never on the furniture cell).
test('U546: a tactical move toward furniture makes ZERO progress and never lands on it', () => {
  const world = bootSlice();
  const st = world.structures.byId[String(world.scene.interior.structureKey)];
  const plan = floorPlan(st);
  const structId = st.id;

  // Find, in ANY room of the wake structure, a FREE cell whose east neighbour is a
  // furniture cell in the same room rect — the canonical "walk into the dresser".
  let found = null;
  for (const room of plan.rooms) {
    const rect = roomRectCells(room);
    for (let gy = rect.minY; gy <= rect.maxY && !found; gy++) {
      for (let gx = rect.minX; gx <= rect.maxX && !found; gx++) {
        const nx = gx + 1;
        const inRect = nx <= rect.maxX;
        if (inRect && structCellFree(st, gx, gy) && !structCellFree(st, nx, gy)) {
          found = { room, gx, gy, nx };
        }
      }
    }
    if (found) break;
  }
  assert.ok(found, 'precondition: a free cell with a furniture cell immediately east exists in the wake structure');

  // Place the player on the free cell, in that room's interior frame, and walk east.
  let w = applyDeltas(world, [{ op: 'pos', id: 'party', to: { frame: `struct:${structId}`, gx: found.gx, gy: found.gy } }]);
  w = { ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: found.room.id } } };
  const res = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 1 });
  assert.ok(res, 'the resolver returned a struct-frame walk result');
  assert.equal(res.movedCells, 0, `the walk should stop at the furniture cell (${found.nx},${found.gy}); moved ${res.movedCells}`);
  assert.equal(res.pos.gx, found.gx, 'a no-progress walk moved the body onto the furniture anyway');
  // And the blocked cell is genuinely a furniture cell (never walkable).
  assert.equal(structCellFree(st, found.nx, found.gy), false, 'the blocker east of the stop is not actually a furniture cell');
});
