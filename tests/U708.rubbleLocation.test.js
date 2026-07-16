// U708 — OBJ-RUBBLE-1 correction: rubble records the TERMINAL location, not the
// authored origin.
//
// THE LIE THIS CLOSES (DEATH-TRUTH-1 finish, evidence 2026-07-16): drag the
// loaderDemo barrel from its plan anchor (58,54) to the engine-chosen cell
// (57,53), salvage it — and the sheet drew rubble back at (14.50,13.50), the
// PLAN position, because removeFurniture deletes the overlay record (the only
// holder of the moved position) and the salvage event carried no position.
//
// THE FIX: the salvage emit captures the piece's live placement BEFORE the
// removal deltas run and stamps it on the event (`data.pos` — additive; old
// events lack it and honestly fall back to the plan position, which is correct
// for every pre-feature destruction because nothing could move before
// OBJ-MOVE-1 landed). destroyedObjectPositionsAtNode (engine/objects/query.js)
// is the canonical read; both projections (interior scene + village sheet)
// position rubble by: live placed overlay > salvage-event pos > plan anchor.
// The renderer PROJECTS the evidence; it never reconstructs it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { resolvedObjectPlacement } from '../engine/objects/placement.js';
import { destroyedObjectPositionsAtNode } from '../engine/objects/query.js';
import { buildAuthoredSceneFurniture } from '../public/map/LocalMap.js';
import { PLACE_WU } from '../engine/map/spatial/tacticalPos.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const STRUCT = 'authored:n8_2046891609';
const BARREL = `au:${STRUCT}:room:${STRUCT}:1#a1`;
const boot = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;
const rubbleFor = (w, oid) => buildAuthoredSceneFurniture(floorPlan(w.structures.byId[STRUCT]), w, STRUCT)
  .find(e => String(e.id) === String(oid) && e.type === 'rubble');
const center = (e) => ({ x: e.ux + e.uw / 2, y: e.uy + e.uh / 2 });

// The evidence route: drag (engine-owned cell), then salvage.
function dragThenSalvage() {
  let w = boot();
  w = say(w, 'drag the barrel aside');
  const ov = resolvedObjectPlacement(w, BARREL);
  assert.equal(ov?.status, 'placed', 'setup: the drag committed a placed overlay');
  const movedCell = { ...ov.cell };
  w = say(w, 'I smash the barrel to pieces.');
  assert.ok(!(w.map.nodes.find(n => n.id === w.map.currentNodeId).furniture || [])
    .some(f => String(f.objectId) === BARREL), 'setup: the salvage removed the piece');
  return { w, movedCell };
}

// ── A. moved, then destroyed → rubble at the MOVED position ─────────────────
test('U708-A drag then salvage: rubble draws at the moved cell, not the plan anchor', () => {
  const { w, movedCell } = dragThenSalvage();
  const ev = (w.timeline || []).filter(e => e.kind === 'salvage').map(e => e.data).pop();
  assert.ok(ev && ev.pos && ev.pos.cell, 'the salvage event captured the terminal position');
  assert.deepEqual({ x: ev.pos.cell.x, y: ev.pos.cell.y }, movedCell, 'and it is the engine-chosen moved cell');

  const pos = destroyedObjectPositionsAtNode(w, String(w.map.currentNodeId));
  assert.deepEqual(pos.get(BARREL)?.cell, movedCell, 'the canonical read hands the terminal cell back');

  const entry = rubbleFor(w, BARREL);
  assert.ok(entry, 'the interior scene draws rubble for the barrel');
  const c = center(entry);
  assert.ok(Math.abs(c.x - movedCell.x / PLACE_WU) < 1e-9 && Math.abs(c.y - movedCell.y / PLACE_WU) < 1e-9,
    `rubble centres on the moved cell (got ${c.x},${c.y}; want ${movedCell.x / PLACE_WU},${movedCell.y / PLACE_WU})`);
});

// ── B. destroyed at its original position → rubble at the original spot ─────
test('U708-B unmoved salvage keeps rubble at the plan anchor (regression pin)', () => {
  let w = boot();
  const st = w.structures.byId[STRUCT];
  const fp = floorPlan(st);
  const room = fp.rooms.find(r => String(r.id) === `room:${STRUCT}:1`);
  const item = (room.furniture || []).find(f => String(f.id) === `room:${STRUCT}:1#a1`);
  const planCenter = { x: room.cx + (item.fx - 0.5) * room.w, y: room.cy + (item.fy - 0.5) * room.h };
  w = say(w, 'I smash the barrel to pieces.');
  const ev = (w.timeline || []).filter(e => e.kind === 'salvage').map(e => e.data).pop();
  assert.equal(ev.pos ?? null, null, 'an unmoved piece records no override position — the plan is the truth');
  const c = center(rubbleFor(w, BARREL));
  assert.ok(Math.abs(c.x - planCenter.x) < 1e-9 && Math.abs(c.y - planCenter.y) < 1e-9, 'rubble at the plan anchor');
});

// ── C. moved, then wrecked IN PLACE → rubble at the moved position ───────────
test('U708-C drag then strike-to-wreck: the standing wreck draws at the moved cell', () => {
  let w = boot();
  w = say(w, 'drag the barrel aside');
  const moved = { ...resolvedObjectPlacement(w, BARREL).cell };
  for (let i = 0; i < 24; i++) {
    const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
    const b = (node.furniture || []).find(f => String(f.objectId) === BARREL);
    if (!b) assert.fail('the barrel must wreck in place, not vanish');
    if (b.state === 'wrecked') break;
    w = say(w, 'I attack the barrel with my blade.'); // the declared-attack object-strike lane (U697)
  }
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const b = (node.furniture || []).find(f => String(f.objectId) === BARREL);
  assert.equal(b?.state, 'wrecked', 'the strikes wrecked it in place');
  const entry = rubbleFor(w, BARREL);
  assert.ok(entry, 'the wreck draws rubble');
  const c = center(entry);
  assert.ok(Math.abs(c.x - moved.x / PLACE_WU) < 1e-9 && Math.abs(c.y - moved.y / PLACE_WU) < 1e-9,
    'at the moved cell (the live overlay is still the position truth for a standing wreck)');
});

// ── D. thrown (engine-owned landing), then destroyed → rubble at the landing ─
test('U708-D throw then salvage: rubble at the engine-owned landing cell', () => {
  let w = boot();
  // The throw needs real strength for a bulk-3 barrel: pin MIGHT (fixture surgery,
  // the U697 technique) — the THROW itself remains the production writer.
  w = { ...w, party: [{ ...w.party[0], stats: { ...(w.party[0].stats || {}), MIGHT: 24 } }, ...w.party.slice(1)] };
  w = say(w, 'I take the barrel.');
  w = say(w, 'I throw the barrel across the room.');
  const ov = resolvedObjectPlacement(w, BARREL);
  assert.equal(ov?.status, 'placed', `the throw landed the barrel on a cell (${JSON.stringify(ov)})`);
  const landing = { ...ov.cell };
  w = say(w, 'I smash the barrel to pieces.');
  const entry = rubbleFor(w, BARREL);
  assert.ok(entry, 'rubble drawn after the landing-spot salvage');
  const c = center(entry);
  assert.ok(Math.abs(c.x - landing.x / PLACE_WU) < 1e-9 && Math.abs(c.y - landing.y / PLACE_WU) < 1e-9,
    'rubble at the landing cell the engine chose');
});

// ── E. save/load keeps the terminal location ─────────────────────────────────
test('U708-E the moved-rubble position survives an export/import round-trip', () => {
  const { w, movedCell } = dragThenSalvage();
  const w2 = importWorld(exportWorld(w));
  const c = center(rubbleFor(w2, BARREL));
  assert.ok(Math.abs(c.x - movedCell.x / PLACE_WU) < 1e-9 && Math.abs(c.y - movedCell.y / PLACE_WU) < 1e-9,
    'the timeline is the record — the position rides the save');
});

// ── F. determinism: the full route replays to the same hash ──────────────────
test('U708-F worldHash equality across two fresh runs of drag+salvage', () => {
  assert.equal(worldHash(dragThenSalvage().w), worldHash(dragThenSalvage().w));
});
