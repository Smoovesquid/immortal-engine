/**
 * Plan -> topology. Derives a navigable room graph (the engine's {kind:'rooms',
 * rooms, edges} shape) from an authored plan's GEOMETRY: rooms that butt together
 * are linked (doors sit on their shared wall), and corridors link the rooms at
 * their endpoints. This lets the engine adopt a catalog plan as a structure's
 * actual interior so navigation, fog, and rendering all agree.
 *
 * PURE. (Wiring it into structure generation changes world shape — do that with
 * live verification; this module just provides the conversion + selector.)
 */

import { PLANS, getPlan } from './index.js';
import { LAIRS } from './lairs.js';
import { RACE_PLANS } from './races.js';

function box(r) {
  if (r.shape === 'round') return { x0: r.cx - r.r, y0: r.cy - r.r, x1: r.cx + r.r, y1: r.cy + r.r };
  return { x0: r.cx - r.w / 2, y0: r.cy - r.h / 2, x1: r.cx + r.w / 2, y1: r.cy + r.h / 2 };
}
const TOL = 0.35;

function touch(a, b) {
  const A = box(a), B = box(b);
  const yOverlap = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > TOL;
  const xOverlap = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > TOL;
  const vAdj = (Math.abs(A.x1 - B.x0) < TOL || Math.abs(B.x1 - A.x0) < TOL) && yOverlap; // share a vertical wall
  const hAdj = (Math.abs(A.y1 - B.y0) < TOL || Math.abs(B.y1 - A.y0) < TOL) && xOverlap; // share a horizontal wall
  return vAdj || hAdj;
}

function overlap(a, b) {
  const A = box(a), B = box(b);
  return (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > TOL) && (Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > TOL);
}

function nearestRoom(rooms, x, y) {
  let best = null, bd = Infinity;
  for (const r of rooms) { const b = box(r); const cx = Math.max(b.x0, Math.min(x, b.x1)), cy = Math.max(b.y0, Math.min(y, b.y1)); const d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = r; } }
  return best;
}

// Find the two rooms a door connects (one on each side of the wall it sits on).
function roomsAtDoor(rooms, d) {
  const tol = 1.3;
  if (d.orient === 'v') { // vertical wall at x=d.x — rooms to the left (x1≈d.x) and right (x0≈d.x)
    let left = null, right = null;
    for (const r of rooms) { const b = box(r); if (!(d.y >= b.y0 - tol && d.y <= b.y1 + tol)) continue; if (Math.abs(b.x1 - d.x) <= tol) left = r; if (Math.abs(b.x0 - d.x) <= tol) right = r; }
    return [left, right];
  }
  let top = null, bot = null; // horizontal wall at y=d.y — rooms above (y1≈d.y) and below (y0≈d.y)
  for (const r of rooms) { const b = box(r); if (!(d.x >= b.x0 - tol && d.x <= b.x1 + tol)) continue; if (Math.abs(b.y1 - d.y) <= tol) top = r; if (Math.abs(b.y0 - d.y) <= tol) bot = r; }
  return [top, bot];
}

export function planToTopology(plan) {
  const rooms = (plan.rooms || []).map(r => ({ id: String(r.id), tags: String(r.id) === String(plan.entry) ? ['entry'] : [] }));
  const ids = new Set(rooms.map(r => r.id));
  const edgeSet = new Set(), edges = [];
  const add = (a, b) => { a = String(a); b = String(b); if (a === b || !ids.has(a) || !ids.has(b)) return; const lo = a < b ? a : b, hi = a < b ? b : a, k = lo + '|' + hi; if (!edgeSet.has(k)) { edgeSet.add(k); edges.push({ a: lo, b: hi }); } };

  // doors are the authoritative link: each sits on the wall between two rooms
  for (const d of (plan.doors || [])) { const pair = roomsAtDoor(plan.rooms, d); if (pair[0] && pair[1]) add(pair[0].id, pair[1].id); }
  // butting OR overlapping rooms (organic lairs nest chambers into each other)
  for (let i = 0; i < plan.rooms.length; i++) for (let j = i + 1; j < plan.rooms.length; j++) {
    const a = plan.rooms[i], b = plan.rooms[j];
    if (touch(a, b) || overlap(a, b)) add(a.id, b.id);
  }
  // corridor endpoints link the rooms they touch
  for (const c of (plan.corridors || [])) {
    const p0 = c.pts[0], p1 = c.pts[c.pts.length - 1];
    const r0 = nearestRoom(plan.rooms, p0[0], p0[1]), r1 = nearestRoom(plan.rooms, p1[0], p1[1]);
    if (r0 && r1) add(r0.id, r1.id);
  }
  return { kind: 'rooms', rooms, edges };
}

// structurePlanFor(buildingType) -> an authored building-catalog plan (or null).
// Caller passes the engine's buildingTypeFor() result; lairs/races resolve separately.
export function structurePlanFor(buildingType) {
  return getPlan(String(buildingType || '')) || null;
}

export const ALL_PLANS = [...PLANS, ...LAIRS, ...RACE_PLANS];
