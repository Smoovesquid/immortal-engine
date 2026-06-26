// U291 — a plain-door exit anchors at the building's ACTUAL exterior entrance
// (plan.mouths), not a hardcoded south edge.
//
// Follow-up to da2b528, whose "south" fallback was CONFOUNDED by tallow's cottage:
// cottage_wattle happens to have rooms[0] === plan.entry, a south mouth, AND a south
// entry room, so "south" looked correct. ~Half the building catalog (keeps, manors,
// prisons, lairs, towers…) has N/E/W mouths, where "south" places the token on the
// wrong side. mouths are EXTERIOR entrances; doors are INTERIOR links
// (public/map/plans/planTopology.js). exteriorAnchor is pure (public/map/placeNav.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import { exteriorAnchor } from '../public/map/placeNav.js';
import { getPlan } from '../public/map/plans/index.js';

// Footprint bounds in building-local units — same (r.w||r.r*2) geometry the renderer uses.
function bounds(plan) {
  let nx = Infinity, xx = -Infinity, ny = Infinity, xy = -Infinity;
  for (const r of plan.rooms) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; nx = Math.min(nx, r.cx - rw); xx = Math.max(xx, r.cx + rw); ny = Math.min(ny, r.cy - rh); xy = Math.max(xy, r.cy + rh); }
  return { nx, xx, ny, xy };
}
const outside = (a, b) => a.ux < b.nx || a.ux > b.xx || a.uy < b.ny || a.uy > b.xy;

test('U291: south-mouth cottage anchors SOUTH of the footprint at the mouth x (preserves the tallow fix)', () => {
  const p = getPlan('cottage_wattle'); const b = bounds(p);
  const a = exteriorAnchor(p, 0, 0, 1.3);
  assert.ok(outside(a, b), `must be outside footprint: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  assert.ok(a.uy > b.xy, 'south mouth → token south of the footprint');
  assert.ok(Math.abs(a.ux - p.mouths[0].x) < 1e-9, 'aligned with the actual mouth x, not a room centre guess');
});

test('U291: west-mouth keep anchors WEST of the footprint, NOT south', () => {
  const p = getPlan('keep_sunken'); const b = bounds(p);
  const a = exteriorAnchor(p, 0, 0, 1.3);
  assert.ok(outside(a, b), `outside footprint: ${JSON.stringify(a)}`);
  assert.ok(a.ux < b.nx, 'west mouth → token west of the footprint');
  assert.ok(a.uy >= b.ny && a.uy <= b.xy, 'and NOT shoved to the south edge (the da2b528 bug)');
});

test('U291: north-mouth manor anchors NORTH of the footprint, NOT south', () => {
  const p = getPlan('manor_house'); const b = bounds(p);
  const a = exteriorAnchor(p, 0, 0, 1.3);
  assert.ok(outside(a, b), `outside footprint: ${JSON.stringify(a)}`);
  assert.ok(a.uy < b.ny, 'north mouth → token north of the footprint');
});

test('U291: ox/oy purely offset into place coords; deterministic', () => {
  const p = getPlan('cottage_wattle');
  const a0 = exteriorAnchor(p, 0, 0, 1.3);
  const a1 = exteriorAnchor(p, 10, 5, 1.3);
  assert.deepEqual({ ux: a1.ux - 10, uy: a1.uy - 5 }, a0, 'a pure offset by (ox, oy)');
});

test('U291: degenerate plans return a FINITE anchor (no NaN/-Infinity — fixes the da2b528 edge case)', () => {
  const noMouth = { entry: 'r', rooms: [{ id: 'r', shape: 'rect', cx: 5, cy: 5, w: 4, h: 4 }] };
  const a = exteriorAnchor(noMouth, 0, 0, 1.3);
  assert.ok(Number.isFinite(a.ux) && Number.isFinite(a.uy), 'no-mouth → finite fallback');
  assert.ok(a.uy > 7, 'no-mouth fallback keeps the south-edge behaviour (outside the footprint)');
  const empty = exteriorAnchor({ rooms: [] }, 0, 0, 1.3);
  assert.ok(Number.isFinite(empty.ux) && Number.isFinite(empty.uy), 'empty rooms → finite, not NaN/-Infinity');
});
