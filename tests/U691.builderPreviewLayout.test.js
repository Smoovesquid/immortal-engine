// U691 — BUILDER-PREVIEW-2: the interior renderer's pure layout core turns a
// builder doc into recognizable room-shell geometry.
//
// mountBuilderPreview3D() is Three.js (can't run headless), but its geometry is
// computed by buildPreviewLayout(doc) — a pure doc→world-space spec. This locks
// the mapping Tim's acceptance bar depends on: every drawn room becomes a floor,
// every room boundary becomes walls WITH a gap at each door, and every furniture
// piece lands INSIDE its room at the drawn (ux/uy) position.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPreviewLayout, PREVIEW_CELL_M } from '../public/map/builderPreview3d.js';

// A two-room cottage: hall (8×6) + snug (5×6) sharing the x=13 wall, a front door
// on the hall's west wall and an interior door on the shared wall; furniture in each.
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
    { type: 'hearth', room: 'hall', ux: 0.5, uy: 0.08, rot: 0, w: 2, h: 1 },
    { type: 'table',  room: 'hall', ux: 0.4, uy: 0.6, rot: 0, w: 2, h: 2 },
    { type: 'barrel', room: 'snug', ux: 0.5, uy: 0.3, rot: 0, w: 1, h: 1 },
    { type: 'bed',    room: 'snug', ux: 0.5, uy: 0.7, rot: 90, w: 2, h: 3 },
  ],
};

test('U691: every drawn room becomes a floor slab at real metres', () => {
  const L = buildPreviewLayout(doc);
  assert.equal(L.rooms.length, 2, 'two rooms → two floors');
  const hall = L.rooms.find(r => r.id === 'hall');
  assert.ok(hall, 'the hall floor exists');
  assert.ok(Math.abs(hall.w - 8 * PREVIEW_CELL_M) < 1e-6, 'the hall floor is 8 cells wide in metres');
  assert.ok(Math.abs(hall.d - 6 * PREVIEW_CELL_M) < 1e-6, 'the hall floor is 6 cells deep in metres');
  assert.equal(L.rooms.find(r => r.id === 'snug').material, 'stone', 'material is carried for the floor tint');
});

test('U691: room boundaries become walls WITH a gap at every door', () => {
  const L = buildPreviewLayout(doc);
  assert.ok(L.walls.length >= 8, `both rooms are walled (${L.walls.length} segments)`);

  // The hall's west edge (world X = its left edge) carries the front door — so its
  // wall is SPLIT into two short segments with a gap, not one full-height edge.
  const hall = doc.rooms[0];
  const cx = (5 + 18) / 2; // building bounds center X in cells (minX 5, maxX 18)
  const westXcells = hall.x;          // 5
  const westXworld = (westXcells - cx) * PREVIEW_CELL_M;
  const westWalls = L.walls.filter(w => !w.round
    && Math.abs(w.x1 - westXworld) < 1e-6 && Math.abs(w.x2 - westXworld) < 1e-6);
  assert.ok(westWalls.length >= 2, 'the hall west wall is split around the front door (a real opening)');

  // The total walled length on that edge is less than the full 6-cell edge (a gap exists).
  const walled = westWalls.reduce((s, w) => s + Math.hypot(w.x2 - w.x1, w.z2 - w.z1), 0);
  assert.ok(walled < 6 * PREVIEW_CELL_M - 0.3, 'the door leaves a real gap in the wall');
});

test('U691: furniture lands INSIDE its room at the drawn position', () => {
  const L = buildPreviewLayout(doc);
  assert.deepEqual(L.furniture.map(f => f.kind), ['hearth', 'table', 'barrel', 'bed'], 'all four pieces, in order');

  const snug = L.rooms.find(r => r.id === 'snug');
  const bed = L.furniture[3];
  assert.equal(bed.kind, 'bed');
  assert.equal(bed.rot, 90, 'the drawn rotation is carried');
  // bed ux/uy 0.5/0.7 within the snug → its world center sits inside the snug floor rect.
  assert.ok(Math.abs(bed.x - snug.cxW) <= snug.rxW + 1e-6, 'bed X is within the snug');
  assert.ok(bed.z > snug.czW - 1e-6, 'bed is toward the south half (uy 0.7), where it was drawn');

  const hearth = L.furniture[0]; // ux 0.5, uy 0.08 → top (north) of the hall
  const hall = L.rooms.find(r => r.id === 'hall');
  assert.ok(hearth.z < hall.czW, 'the hearth sits against the north wall, as drawn');
});

test('U691: the person stands in the entrance room, and bounds are sane', () => {
  const L = buildPreviewLayout(doc);
  const hall = L.rooms.find(r => r.id === 'hall');
  // entrance door is on the hall → player spawns at the hall center.
  assert.ok(Math.abs(L.player.x - hall.cxW) < 1e-6 && Math.abs(L.player.z - hall.czW) < 1e-6,
    'the person stands in the entrance room for scale');
  assert.ok(L.bounds.w > 0 && L.bounds.d > 0, 'the building has real extent to frame the camera on');
});

test('U691: an empty draft yields empty geometry (the page shows a friendly message)', () => {
  const L = buildPreviewLayout({ rooms: [], openings: [], furniture: [] });
  assert.deepEqual(L.rooms, []);
  assert.deepEqual(L.walls, []);
  assert.deepEqual(L.furniture, []);
});
