// U696 — OBJ-MOVE-1: authored furniture repositions to a legal tactical cell, and its
// single anchor cell of collision moves with it (FURN-1 anchor-only contract preserved).
// The FIRST consumer of the OBJ-STATE-1 overlay. Authored-only; generic/procgen visible
// movement is deferred to Model A↔B parity.
//
// Sections:
//   A  — pure helpers on the REAL authored building (loaderDemo): base-anchor join,
//        legal target, resolver → placed, live occupancy.
//   B  — the moveObject op: writes canonical cell + clears held; collision moves (old
//        cell freed, new blocked); the two HARD RULES (exact-target, held-not-movable).
//   C  — legalMoveTargetCell rejections: actor cell, occupied cell, door-reserved cells,
//        wrong room/frame, own cell, and no-free-cell (synthetic 1×1 room) → null.
//   D  — the drag capacity gate (weak can't, strong can).
//   E  — empty overlay → live occupancy == the static furniture anchors (FURN-1 walk
//        byte-identical); a moved object stops the walk at its new cell, frees the old.
//   F  — the movement verb end-to-end (evaluatePhysicsSync) emits moveObject with the
//        engine-chosen cell; a held object is not moved.
//   G  — save/load persists the move; worldHash stable under replay.
//   H  — the LIVE playerMove routing (not just the offline gate).
//   I  — the render projection (buildAuthoredSceneFurniture): Model B room-relative
//        fractions → scene-model top-left + LAYOUT-UNIT size, at the correct cell.
//   J  — render-branch SCOPING: the engine-furniture branch is gated on the durable
//        authoredPlan marker + f.authored===1, never "the floor plan has furniture"
//        (procgen keeps its catalog art; an empty authored building stays empty).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { evaluatePhysicsSync } from '../engine/llmPhysics.js';
import { resolvedObjectPlacement } from '../engine/objects/placement.js';
import { actorObjectCapacity } from '../engine/objects/capacity.js';
import { objectPhysics } from '../engine/objects/mobility.js';
import {
  authoredBaseAnchorCell, legalMoveTargetCell, liveAuthoredBlockedCells,
  reservedDoorCells, structCellFree, resolveTacticalWalk, roomRectCells, layoutToCells,
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { authoredObjectId } from '../engine/objects/identity.js';
import { PLACE_WU } from '../engine/map/spatial/tacticalPos.js';
import { buildAuthoredSceneFurniture, isFinalizedAuthored } from '../public/map/LocalMap.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));
const bootAuthored = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const STRUCT = 'authored:n8_2046891609';
const ROOM = 'room:authored:n8_2046891609:1';
const NODE = 'n8_2046891609';
const BARREL = `au:${STRUCT}:${ROOM}#a1`;
const BED = `au:${STRUCT}:${ROOM}#a0`;
const st = (w) => w.structures.byId[STRUCT];
const key = (c) => `${c.x},${c.y}`;
const moveDelta = (objectId, cell) => ({ op: 'moveObject', actorId: 'party', objectId, to: { node: NODE, structureId: STRUCT, room: ROOM, cell } });

// ── A. pure helpers on the real building ─────────────────────────────────────
test('U696-A authoredBaseAnchorCell joins objectId → pieceId → the plan anchor', () => {
  const w = bootAuthored();
  const a = authoredBaseAnchorCell(w, BARREL);
  assert.deepEqual(a, { x: 58, y: 54 });
  assert.equal(authoredBaseAnchorCell(w, 'pg:n8_2046891609:0'), null, 'non-authored piece → null');
  assert.equal(authoredBaseAnchorCell(w, 'nope'), null);
});

test('U696-A legalMoveTargetCell returns a free cell in the room, not the barrel\'s own cell', () => {
  const w = bootAuthored();
  const t = legalMoveTargetCell(w, BARREL, 'party');
  assert.ok(t, 'a legal target exists');
  assert.notDeepEqual(t, { x: 58, y: 54 }, 'never the object\'s own anchor');
  const rect = roomRectCells(floorPlan(st(w)).rooms.find(r => r.id === ROOM));
  assert.ok(t.x >= rect.minX && t.x <= rect.maxX && t.y >= rect.minY && t.y <= rect.maxY, 'inside the room rect');
  assert.ok(!liveAuthoredBlockedCells(w, st(w)).has(key(t)), 'not an occupied cell');
  assert.ok(!reservedDoorCells(floorPlan(st(w))).has(key(t)), 'not a reserved door cell');
});

// ── B. the moveObject op ─────────────────────────────────────────────────────
test('U696-B a move writes the canonical cell placement, clears held, resolver reads placed', () => {
  let w = bootAuthored();
  // seed a stale held flag to prove it is cleared
  w = { ...w, objects: { ...(w.objects || {}), [BARREL]: { heldByActorId: 'someone', keepMe: 1 } } };
  // held blocks the verb, so drop it back to base first for this op-level test
  w = { ...w, objects: { ...w.objects, [BARREL]: { keepMe: 1 } } };
  const t = legalMoveTargetCell(w, BARREL, 'party');
  const w2 = applyDeltas(w, [moveDelta(BARREL, t)]);
  const p = resolvedObjectPlacement(w2, BARREL);
  assert.equal(p.status, 'placed');
  assert.deepEqual(p.cell, t);
  assert.equal(w2.objects[BARREL].heldByActorId, undefined, 'held cleared');
  assert.equal(w2.objects[BARREL].keepMe, 1, 'unrelated overlay fields preserved');
});

test('U696-B collision moves with the object — old anchor freed, new anchor blocked', () => {
  const w = bootAuthored();
  const base = authoredBaseAnchorCell(w, BARREL);
  const t = legalMoveTargetCell(w, BARREL, 'party');
  assert.ok(structCellFree(st(w), t.x, t.y), 'target starts free (static plan)');
  const w2 = applyDeltas(w, [moveDelta(BARREL, t)]);
  const live = liveAuthoredBlockedCells(w2, st(w2));
  assert.ok(!live.has(key(base)), 'old anchor is now WALKABLE');
  assert.ok(live.has(key(t)), 'new anchor is now BLOCKED');
});

test('U696-B HARD RULE 1 — a supplied cell different from the engine target is rejected', () => {
  const w = bootAuthored();
  const t = legalMoveTargetCell(w, BARREL, 'party');
  const wrong = { x: t.x + 1, y: t.y }; // a legal-looking but not engine-chosen cell
  const w2 = applyDeltas(w, [moveDelta(BARREL, wrong)]);
  assert.equal(w2.objects?.[BARREL]?.placedAt, undefined, 'no override written for a mismatched cell');
});

test('U696-B HARD RULE 2 — a held authored object is not movable by this verb', () => {
  let w = bootAuthored();
  w = { ...w, objects: { ...(w.objects || {}), [BARREL]: { heldByActorId: 'party' } } };
  assert.equal(legalMoveTargetCell(w, BARREL, 'party'), null, 'held → no legal target');
  const t = authoredBaseAnchorCell(w, BARREL); // any cell — the op must still no-op
  const w2 = applyDeltas(w, [moveDelta(BARREL, t)]);
  assert.equal(w2.objects[BARREL].heldByActorId, 'party', 'still held — not silently placed down');
  assert.equal(w2.objects[BARREL].placedAt, undefined);
});

// ── C. legalMoveTargetCell rejections ────────────────────────────────────────
test('U696-C rejects the actor\'s own cell', () => {
  const w = bootAuthored();
  const t0 = legalMoveTargetCell(w, BARREL, 'party');
  // stand the actor ON the natural target; the mover must pick a different cell
  const w2 = { ...w, party: [{ ...w.party[0], pos: { frame: `struct:${STRUCT}`, gx: t0.x, gy: t0.y } }] };
  const t1 = legalMoveTargetCell(w2, BARREL, 'party');
  assert.ok(t1, 'still finds a cell');
  assert.notDeepEqual(t1, t0, 'not the actor-occupied cell');
});

test('U696-C rejects a cell occupied by another live object (uses the live projection)', () => {
  const w = bootAuthored();
  const t0 = legalMoveTargetCell(w, BARREL, 'party');
  // place the BED onto the barrel's natural target; the barrel must avoid it now
  const w2 = { ...w, objects: { ...(w.objects || {}), [BED]: { placedAt: { node: NODE, structureId: STRUCT, room: ROOM, cell: t0 } } } };
  const t1 = legalMoveTargetCell(w2, BARREL, 'party');
  assert.notDeepEqual(t1, t0, 'avoids the newly-occupied cell');
  assert.ok(!liveAuthoredBlockedCells(w2, st(w2)).has(key(t1)));
});

test('U696-C never returns a reserved door cell', () => {
  const w = bootAuthored();
  const t = legalMoveTargetCell(w, BARREL, 'party');
  assert.ok(!reservedDoorCells(floorPlan(st(w))).has(key(t)));
});

test('U696-C wrong frame / wrong structure → null', () => {
  const w = bootAuthored();
  const wOut = { ...w, party: [{ ...w.party[0], pos: { frame: 'region', gx: 0, gy: 0 } }] };
  assert.equal(legalMoveTargetCell(wOut, BARREL, 'party'), null, 'actor not indoors in this struct');
  const wElse = { ...w, party: [{ ...w.party[0], pos: { frame: 'struct:somewhere-else', gx: 50, gy: 50 } }] };
  assert.equal(legalMoveTargetCell(wElse, BARREL, 'party'), null);
});

test('U696-C no free cell (synthetic 1×1 room) → null', () => {
  // A room only one walkable cell wide: the object sits on the sole cell, its own cell
  // is excluded, so there is nowhere to move it. Deterministic refusal, no delta.
  const cx = 3, cy = 3;
  const centre = { x: layoutToCells(cx), y: layoutToCells(cy) };
  const world = {
    map: { currentNodeId: 'nT', nodes: [{ id: 'nT', furniture: [
      { name: 'crate', kind: 'crate', authored: true, structureId: 'authored:t', roomId: 'room:t:1', pieceId: 'p0', objectId: 'au:authored:t:p0' },
    ] }] },
    structures: { byId: { 'authored:t': { id: 'authored:t', nodeId: 'nT', authoredPlan: {
      type: 'building', rooms: [{ id: 'room:t:1', cx, cy, w: 0.5, h: 0.5, furniture: [{ id: 'p0', fx: 0.5, fy: 0.5, kind: 'crate' }] }], doors: [], corridors: [], nonAdjacent: [],
    } } } },
    party: [{ id: 'pc', pos: { frame: 'struct:authored:t', gx: centre.x, gy: centre.y } }],
    objects: {},
  };
  // sanity: the anchor resolves to the sole centre cell (which is then excluded as its own)
  assert.deepEqual(authoredBaseAnchorCell(world, 'au:authored:t:p0'), centre);
  assert.equal(legalMoveTargetCell(world, 'au:authored:t:p0', 'party'), null, 'no other legal cell → null');
});

// ── D. drag capacity gate ────────────────────────────────────────────────────
test('U696-D a weak actor cannot drag a heavy object; a strong actor can', () => {
  const heavy = objectPhysics({ name: 'strongbox', weight: 5, bulk: 4, material: 'wood' });
  assert.equal(actorObjectCapacity({ might: 6, size: 'Small' }, heavy, 'drag').verdict, 'impossible');
  assert.equal(actorObjectCapacity({ might: 18, size: 'Medium' }, heavy, 'drag').verdict, 'auto');
});

// ── E. FURN-1 byte-identical + walk stops at the new cell ────────────────────
test('U696-E empty overlay → live occupancy is exactly the authored furniture anchors', () => {
  const w = bootAuthored();
  const live = liveAuthoredBlockedCells(w, st(w));
  const expected = new Set([BED, BARREL].map(id => key(authoredBaseAnchorCell(w, id))));
  assert.deepEqual(new Set([...live]), expected, 'no more, no less than the two piece anchors');
});

test('U696-E the walk stops at a moved object\'s NEW cell and passes through its OLD one', () => {
  const w = bootAuthored();
  const base = authoredBaseAnchorCell(w, BARREL); // {58,54}
  const t = legalMoveTargetCell(w, BARREL, 'party');
  const w2 = applyDeltas(w, [moveDelta(BARREL, t)]);
  // Stand the actor one cell west of the NEW anchor and walk east — it must stop before it.
  const wWalk = { ...w2, party: [{ ...w2.party[0], pos: { frame: `struct:${STRUCT}`, gx: t.x - 1, gy: t.y } }] };
  const walk = resolveTacticalWalk(wWalk, { actorId: 'party', dir: 'east', cells: 3 });
  assert.ok(walk.pos.gx < t.x, `walk halts before the moved object\'s new cell (landed ${walk.pos.gx}, block ${t.x})`);
  // the OLD base cell is now walkable
  assert.ok(structCellFree(st(w2), base.x, base.y) || !liveAuthoredBlockedCells(w2, st(w2)).has(key(base)), 'old cell walkable');
});

// ── F. movement verb end-to-end ──────────────────────────────────────────────
test('U696-F "drag the barrel aside" emits a moveObject with the engine-chosen cell', () => {
  const w = bootAuthored();
  const t = legalMoveTargetCell(w, BARREL, 'party');
  const res = evaluatePhysicsSync(w, 'drag the barrel aside');
  const md = res.deltas.find(d => d.op === 'moveObject');
  assert.ok(md, `move verb produced a moveObject: ${res.description}`);
  assert.equal(md.objectId, BARREL);
  assert.deepEqual(md.to.cell, t, 'the engine chose the cell, not the parser');
});

test('U696-F a held barrel is not moved by the verb', () => {
  let w = bootAuthored();
  w = { ...w, objects: { ...(w.objects || {}), [BARREL]: { heldByActorId: 'party' } } };
  const res = evaluatePhysicsSync(w, 'drag the barrel aside');
  assert.equal(res.deltas.length, 0, 'held → no move delta');
});

// ── G. save/load + determinism ───────────────────────────────────────────────
test('U696-G a move persists through save/load and worldHash is stable under replay', () => {
  const w = bootAuthored();
  const t = legalMoveTargetCell(w, BARREL, 'party');
  const w2 = applyDeltas(w, [moveDelta(BARREL, t)]);
  const round = importWorld(exportWorld(w2));
  assert.deepEqual(resolvedObjectPlacement(round, BARREL).cell, t, 'placement survives save/load');
  // replay the same delta on a fresh boot → identical hash (deterministic).
  const w3 = applyDeltas(bootAuthored(), [moveDelta(BARREL, t)]);
  assert.equal(worldHash(w2), worldHash(w3), 'same move → same worldHash');
});

// ── H. the LIVE player gesture (real playerMove routing, not just the offline gate) ──
test('U696-H the LIVE playerMove path moves an authored object (drag → placed)', () => {
  const r = playerMove(bootAuthored(), PACKS, 'drag the barrel aside');
  const p = resolvedObjectPlacement(r.world, BARREL);
  assert.equal(p.status, 'placed', `barrel moved through the real player path: ${r.output?.narration}`);
  assert.ok(p.cell && Number.isInteger(p.cell.x) && Number.isInteger(p.cell.y), 'canonical integer cell');
});

test('U696-H a bare travel intent does NOT misfire the mover (furniture-name guard)', () => {
  const r = playerMove(bootAuthored(), PACKS, 'walk to the door');
  assert.deepEqual(r.world.objects || {}, {}, 'travel writes no placement override');
});

// ── I. render projection (Model B fractions → scene-model layout units) ───────
const sceneFurn = (w) => {
  const fp = floorPlan(st(w));
  return { fp, room: fp.rooms.find(r => r.id === ROOM), items: buildAuthoredSceneFurniture(fp, w, STRUCT) };
};
const item = (items, oid) => items.find(i => i.id === oid);
const center = (it) => ({ x: it.ux + it.uw / 2, y: it.uy + it.uh / 2 });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const SAFE_FALLBACK = 0.5; // mirrors LocalMap's malformed-data fallback

test('U696-I base furniture center matches its floor-plan anchor and lands on the engine cell (barrel + bed)', () => {
  const w = bootAuthored();
  const { room, items } = sceneFurn(w);
  for (const [oid, fid] of [[BARREL, '#a1'], [BED, '#a0']]) {
    const f = room.furniture.find(x => String(x.id).endsWith(fid));
    const it = item(items, oid);
    assert.ok(it, `${oid} projected`);
    assert.equal(it.id, authoredObjectId(STRUCT, f.id), 'scene id uses the engine identity contract');
    const c = center(it);
    const anchorX = room.cx + (f.fx - 0.5) * room.w;  // == furnitureAnchorCell's layout anchor
    const anchorY = room.cy + (f.fy - 0.5) * room.h;
    assert.ok(near(c.x, anchorX) && near(c.y, anchorY), `center ${c.x},${c.y} == anchor ${anchorX},${anchorY}`);
    // the recovered center rounds to the SAME tactical cell the engine stores
    assert.deepEqual({ x: layoutToCells(c.x), y: layoutToCells(c.y) }, authoredBaseAnchorCell(w, oid), 'center → engine anchor cell');
  }
});

test('U696-I a moved barrel projects at exactly placedAt.cell / PLACE_WU', () => {
  const w = bootAuthored();
  const t = legalMoveTargetCell(w, BARREL, 'party');
  const w2 = applyDeltas(w, [moveDelta(BARREL, t)]);
  const c = center(item(sceneFurn(w2).items, BARREL));
  assert.ok(near(c.x, t.x / PLACE_WU) && near(c.y, t.y / PLACE_WU), `moved center ${c.x},${c.y} == cell/${PLACE_WU}`);
  // and it lands back on the destination cell
  assert.deepEqual({ x: layoutToCells(c.x), y: layoutToCells(c.y) }, t, 'projected moved center → the destination cell');
});

test('U696-I dimensions are CONVERTED from Model B room-relative values, never passed raw', () => {
  const w = bootAuthored();
  const { room, items } = sceneFurn(w);
  // circle (barrel): diameter = r*2*roomW, round, never the raw r nor the 0.5 fallback
  const barrel = item(items, BARREL), bf = room.furniture.find(x => String(x.id).endsWith('#a1'));
  assert.ok(near(barrel.uw, bf.r * 2 * room.w) && near(barrel.uh, bf.r * 2 * room.w), 'barrel diameter = r*2*roomW');
  assert.equal(barrel.uw, barrel.uh, 'circle stays round');
  assert.notEqual(barrel.uw, bf.r, 'not the raw normalized radius');
  assert.notEqual(barrel.uw, SAFE_FALLBACK, 'not the malformed-data fallback');
  assert.ok(barrel.uw > 0.5 && barrel.uw < 1.5, `plausible layout-unit size (${barrel.uw})`);
  // rect (bed): uw = f.w*roomW, uh = f.h*roomH
  const bed = item(items, BED), df = room.furniture.find(x => String(x.id).endsWith('#a0'));
  assert.ok(near(bed.uw, df.w * room.w) && near(bed.uh, df.h * room.h), 'bed size = f.w*roomW, f.h*roomH');
  assert.notEqual(bed.uw, df.w, 'not the raw normalized width');
});

test('U696-I top-left is an independently-derived center minus half-size', () => {
  const w = bootAuthored();
  const { room, items } = sceneFurn(w);
  const barrel = item(items, BARREL), bf = room.furniture.find(x => String(x.id).endsWith('#a1'));
  const anchorX = room.cx + (bf.fx - 0.5) * room.w, anchorY = room.cy + (bf.fy - 0.5) * room.h;
  const half = (bf.r * 2 * room.w) / 2;
  assert.ok(near(barrel.ux, anchorX - half), `ux ${barrel.ux} == ${anchorX - half}`);
  assert.ok(near(barrel.uy, anchorY - half), `uy ${barrel.uy} == ${anchorY - half}`);
});

// ── J. render-branch scoping (authored vs procgen vs empty-authored) ──────────
const bootProcgen = () => beginAdventure(newWorld({ seed: 'aldermere', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U696-J a FINALIZED authored building selects the branch and returns its real bed + barrel', () => {
  const w = bootAuthored();
  const structure = st(w);
  assert.equal(isFinalizedAuthored(structure), true, 'authoredPlan marker present → engine-furniture branch');
  const items = buildAuthoredSceneFurniture(floorPlan(structure), w, STRUCT);
  const byId = new Map(items.map(i => [i.id, i]));
  assert.equal(byId.get(BARREL)?.type, 'barrel', 'the real barrel is a scene item');
  assert.equal(byId.get(BED)?.type, 'bed', 'the real bed is a scene item');
  assert.equal(items.length, 2, 'exactly the two authored pieces, no more');
});

test('U696-J a PROCGEN building does NOT select the branch and yields no authored scene items', () => {
  const w = bootProcgen();
  const proc = Object.values(w.structures?.byId || {}).find(s => !s.authoredPlan);
  assert.ok(proc, 'the slice has a procedural structure');
  assert.equal(isFinalizedAuthored(proc), false, 'no authoredPlan → NOT the engine-furniture branch');
  const fp = floorPlan(proc);
  const hasProcFurniture = fp.rooms.some(r => (r.furniture || []).length > 0);
  assert.ok(hasProcFurniture, 'the procgen plan really does carry roomDetail furniture (the old length-gate trap)');
  assert.deepEqual(buildAuthoredSceneFurniture(fp, w, String(proc.id)), [], 'yet NONE of it is authored → empty scene set');
});

test('U696-J an EMPTY authored building selects the branch but renders no furniture', () => {
  // A finalized authored plan whose room carries nothing placed. It must NOT borrow a
  // catalog room — it stays visibly empty.
  const st2 = { id: 'authored:empty', nodeId: 'nE', authoredPlan: { type: 'building', rooms: [
    { id: 'room:empty:1', cx: 5, cy: 5, w: 4, h: 4, furniture: [] },
  ], doors: [], corridors: [], nonAdjacent: [] } };
  assert.equal(isFinalizedAuthored(st2), true, 'authoredPlan present → the engine branch');
  const fp = { rooms: [{ id: 'room:empty:1', cx: 5, cy: 5, w: 4, h: 4, furniture: [] }] };
  assert.deepEqual(buildAuthoredSceneFurniture(fp, { objects: {} }, 'authored:empty'), [], 'empty authored building → no furniture drawn');
});
