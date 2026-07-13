// U691 — BUILDER-PREVIEW-3: the adapter's PURE projection turns a finalized
// builder doc into a CANONICAL ink floorplan (the game's own graph-paper scene
// model) + authored prop transforms + isolated bounds — and NOTHING that smells
// of the rejected b155 dollhouse (no floor slabs, no raised wall meshes, no
// player/scale figure).
//
// projectBuilderDoc(doc) is PURE (no THREE, no canvas) so the doc→projection
// mapping Tim's acceptance bar depends on is unit-tested in node; the browser
// consumer (mountBuilderPreview3D) draws the ink and hands the projection to the
// real gameplay renderer (mountSlice3D). This locks: every drawn room becomes an
// ink-scene-model room at its authored geometry, every furniture piece keeps its
// authored CENTER (via the finalized ux/uy inside its room) and its rotation, and
// the building bounds are isolated to just what was drawn.

import test from 'node:test';
import assert from 'node:assert/strict';

import { projectBuilderDoc } from '../public/map/builderPreview3d.js';

// A two-room cottage: hall (8×6) + snug (5×6) sharing the x=13 wall, a front door
// on the hall's west wall and an interior door on the shared wall; furniture in each,
// one piece rotated. Furniture carries BOTH absolute x/y (top-left cells) AND the
// finalized room-fractional ux/uy — the projection must read ux/uy inside the room.
const doc = {
  kind: 'authored-structure', schema: 'house-builder/v10', name: 'Two-Room Cottage',
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'hall', name: 'Hall', shape: 'rect', material: 'timber', x: 5, y: 3, w: 8, h: 6 },
    { id: 'snug', name: 'Snug', shape: 'rect', material: 'stone', x: 13, y: 3, w: 5, h: 6 },
  ],
  openings: [
    { kind: 'door', x: 5, y: 6, angle: 90, orient: 'v', room: 'hall', entrance: true }, // front door, hall west
    { kind: 'door', x: 13, y: 6, angle: 90, orient: 'v', room: 'snug' },                 // interior door, shared wall
  ],
  furniture: [
    { type: 'hearth', room: 'hall', x: 8,  y: 3,   w: 2, h: 1, ux: 0.5, uy: 0.0833, rot: 0 },
    { type: 'table',  room: 'hall', x: 8,  y: 6,   w: 2, h: 2, ux: 0.5, uy: 0.6667, rot: 0 },
    { type: 'barrel', room: 'snug', x: 15, y: 4,   w: 1, h: 1, ux: 0.5, uy: 0.25,   rot: 0 },
    { type: 'bed',    room: 'snug', x: 14, y: 6,   w: 2, h: 3, ux: 0.5, uy: 0.7,    rot: 90 },
  ],
};

test('U691: every drawn room becomes a CANONICAL ink-scene-model room (center/size/name), not a floor slab', () => {
  const P = projectBuilderDoc(doc);
  assert.equal(P.sceneModel.rooms.length, 2, 'two rooms → two ink rooms');
  const hall = P.sceneModel.rooms.find(r => r.id === 'hall');
  assert.ok(hall, 'the hall room exists in the scene model');
  assert.equal(hall.cx, 5 + 8 / 2, 'room center X (cells) = x + w/2');
  assert.equal(hall.cy, 3 + 6 / 2, 'room center Y (cells) = y + h/2');
  assert.equal(hall.w, 8); assert.equal(hall.h, 6);
  assert.equal(hall.name, 'Hall', 'the drawn room name is carried for the ink label');
  // The scene model is the SHARED hand-drawn-interior shape (material + rooms +
  // doors + furniture) — NOT a geometry spec. No dollhouse fields anywhere.
  assert.ok(['timber', 'stone', 'fortified', 'cave'].includes(P.sceneModel.material), 'a real ink material');
});

test('U691: openings become ink doors (the canonical floorplan draws door swings)', () => {
  const P = projectBuilderDoc(doc);
  assert.equal(P.sceneModel.doors.length, 2, 'both openings become ink doors');
  for (const d of P.sceneModel.doors) {
    assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y), 'a door has a cell position');
    assert.ok(d.orient === 'h' || d.orient === 'v', 'a door carries an orientation the ink glyph reads');
  }
});

test('U691: furniture keeps its AUTHORED center (via finalized ux/uy in its room) and its rotation', () => {
  const P = projectBuilderDoc(doc);
  assert.deepEqual(P.props.map(f => f.kind), ['hearth', 'table', 'barrel', 'bed'], 'all four pieces, in order');

  const bed = P.props[3];
  assert.equal(bed.kind, 'bed');
  assert.equal(bed.rot, 90, 'the drawn rotation is preserved — NOT dropped');
  assert.equal(bed.room, 'snug');
  // snug is x13 y3 w5 h6; ux 0.5 uy 0.7 → center cell (15.5, 7.2).
  assert.ok(Math.abs(bed.cellX - (13 + 0.5 * 5)) < 1e-6, 'bed center X from ux inside the snug');
  assert.ok(Math.abs(bed.cellY - (3 + 0.7 * 6)) < 1e-6, 'bed center Y from uy inside the snug');

  const hearth = P.props[0]; // ux 0.5, uy 0.0833 → north of the hall
  assert.ok(hearth.cellY < 3 + 6 / 2, 'the hearth sits against the north wall, as drawn');
});

test('U691: bounds are ISOLATED to just the drawn building (cells)', () => {
  const P = projectBuilderDoc(doc);
  assert.deepEqual(P.bounds, { minX: 5, minY: 3, maxX: 18, maxY: 9 }, 'building extent = union of the two rooms only');
});

test('U691: the projection carries NO dollhouse geometry — no floor slabs, no raised walls, no player/scale figure', () => {
  const P = projectBuilderDoc(doc);
  // The b155 renderer produced these; the corrected projection must not.
  assert.ok(!('walls' in P), 'no raised wall-mesh spec');
  assert.ok(!('floors' in P), 'no colored floor-slab spec');
  assert.ok(!('player' in P), 'no player / scale figure');
  // The ink scene model draws no token either (the preview shows JUST the building).
  assert.deepEqual(P.sceneModel.tokens, [], 'no player/NPC token in the ink model');
});

test('U691: an empty draft yields an empty projection (the page shows a friendly message)', () => {
  const P = projectBuilderDoc({ rooms: [], openings: [], furniture: [] });
  assert.deepEqual(P.sceneModel.rooms, []);
  assert.deepEqual(P.props, []);
  assert.deepEqual(P.bounds, { minX: 0, minY: 0, maxX: 0, maxY: 0 });
});
