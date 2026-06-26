/**
 * placeNav — the one movement model for the local scale.
 *
 * The local map is a single continuous walkable space: terrain + buildings whose
 * interiors (walls, doors, rooms, furniture) sit in the same coordinate system as
 * the road outside. You move a token through it; walls stop you; doorways let you
 * through; stepping through a building's door puts you inside it — same scale, same
 * map, no "enter/leave" seam.
 *
 * This module is the shared spatial truth: it builds the occupancy grid (walls
 * block, doors/windows/mouths are open) and resolves continuous movement against
 * it. handDrawnPlace.js draws the same grid for fog; here we walk it.
 *
 * PURE + DETERMINISTIC (no canvas, no rng).
 */

function h32(s) { let h = 2166136261; const str = String(s); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Map extent in unit coords, padded — matches handDrawnPlace.placeBounds.
export function placeBounds(place) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const b of (place.buildings || [])) for (const r of b.plan.rooms) { const cx = r.cx + b.ox, cy = r.cy + b.oy, rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; ext(cx - rw, cy - rh); ext(cx + rw, cy + rh); }
  const T = place.terrain || {};
  (T.paths || []).concat(T.streams || []).forEach(s => s.pts.forEach(p => ext(p[0], p[1])));
  (T.groves || []).forEach(g => { ext(g.cx - g.r, g.cy - g.r); ext(g.cx + g.r, g.cy + g.r); });
  (T.fields || []).forEach(f => { ext(f.cx - f.w / 2, f.cy - f.h / 2); ext(f.cx + f.w / 2, f.cy + f.h / 2); });
  (T.props || []).forEach(p => ext(p.ux, p.uy));
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1, W: 1, H: 1 };
  minX = Math.floor(minX - 2); minY = Math.floor(minY - 2); maxX = Math.ceil(maxX + 2); maxY = Math.ceil(maxY + 2);
  return { minX, minY, maxX, maxY, W: maxX - minX, H: maxY - minY };
}

// Occupancy grid: 1 = blocked (wall / tree / rock), 0 = open (floor, road, doorway).
// Building walls are blocked, then doors/windows/mouths are carved open last — so
// you can only cross a wall where there's an opening.
function buildOccupancy(place, B) {
  const W = B.W, H = B.H, op = new Uint8Array(W * H);
  const at = (i, j) => (i >= 0 && j >= 0 && i < W && j < H) ? i * H + j : -1;
  const cux = i => B.minX + i + 0.5, cuy = j => B.minY + j + 0.5;
  const setU = (ux, uy, v) => { const k = at(Math.floor(ux - B.minX), Math.floor(uy - B.minY)); if (k >= 0) op[k] = v; };
  for (const b of (place.buildings || [])) for (const r of b.plan.rooms) {
    const cx = r.cx + b.ox, cy = r.cy + b.oy;
    if (r.shape === 'round') {
      for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { const d = Math.hypot(cux(i) - cx, cuy(j) - cy); if (d >= r.r - 0.6 && d <= r.r + 0.5) { const k = at(i, j); if (k >= 0) op[k] = 1; } }
    } else {
      const x0 = cx - r.w / 2, x1 = cx + r.w / 2, y0 = cy - r.h / 2, y1 = cy + r.h / 2;
      for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { const ux = cux(i), uy = cuy(j); const outer = ux >= x0 - 0.5 && ux <= x1 + 0.5 && uy >= y0 - 0.5 && uy <= y1 + 0.5; const inner = ux >= x0 + 0.5 && ux <= x1 - 0.5 && uy >= y0 + 0.5 && uy <= y1 - 0.5; if (outer && !inner) { const k = at(i, j); if (k >= 0) op[k] = 1; } }
    }
  }
  const T = place.terrain || {};
  (T.groves || []).forEach((g, gi) => { for (let k = 0; k < (g.n || 0); k++) { const a = h32('grv' + gi + k) % 1000 / 1000 * Math.PI * 2, rad = (h32('grr' + gi + k) % 1000 / 1000) * g.r; setU(g.cx + Math.cos(a) * rad, g.cy + Math.sin(a) * rad, 1); } });
  (T.props || []).forEach(p => { if (p.type === 'tree' || p.type === 'rock') setU(p.ux, p.uy, 1); });
  for (const b of (place.buildings || [])) { const carve = d => setU(d.x + b.ox, d.y + b.oy, 0); (b.plan.doors || []).forEach(carve); (b.plan.mouths || []).forEach(carve); (b.plan.windows || []).forEach(carve); }
  return { op, W, H, at, minX: B.minX, minY: B.minY };
}

// buildPlaceGrid(place) -> { op, W, H, at, minX, minY, B }
export function buildPlaceGrid(place) {
  const B = placeBounds(place);
  const grid = buildOccupancy(place, B);
  return { ...grid, B };
}

// walkable(grid, ux, uy) -> can a token stand at this unit point? (Out of bounds
// reads as open so the token can roam the surrounding ground.)
export function walkable(grid, ux, uy) {
  if (!grid) return true;
  const k = grid.at(Math.floor(ux - grid.minX), Math.floor(uy - grid.minY));
  return k < 0 ? true : grid.op[k] === 0;
}

/**
 * walkTo(grid, fromX, fromY, toX, toY, opts) -> { ux, uy } final position.
 *
 * March from the start toward the target in small steps, stopping at the last open
 * point before a wall. A path that runs through a doorway passes cleanly inside;
 * a path into a wall slides up to it. opts.maxStep caps the distance per call
 * (movement speed); default is the full distance.
 */
export function walkTo(grid, fromX, fromY, toX, toY, opts = {}) {
  const dx = toX - fromX, dy = toY - fromY, dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { ux: fromX, uy: fromY };
  const step = opts.step || 0.18;
  const cap = Math.min(dist, opts.maxStep != null ? opts.maxStep : dist);
  const nx = dx / dist, ny = dy / dist;
  let x = fromX, y = fromY, travelled = 0;
  while (travelled < cap - 1e-9) {
    const advance = Math.min(step, cap - travelled);
    const tx = x + nx * advance, ty = y + ny * advance;
    // Allow sliding: if the direct step is blocked, try axis-only steps so you can
    // round a corner / slide along a wall toward a doorway instead of dead-stopping.
    if (walkable(grid, tx, ty)) { x = tx; y = ty; }
    else if (walkable(grid, x + nx * advance, y)) { x = x + nx * advance; }
    else if (walkable(grid, x, y + ny * advance)) { y = y + ny * advance; }
    else break;
    travelled += advance;
  }
  return { ux: x, uy: y };
}

/**
 * exteriorAnchor(plan, ox, oy, M) -> { ux, uy } in place coords.
 *
 * Where a token stands after a PLAIN-DOOR exit: just outside the building's actual
 * exterior entrance. `plan.mouths` are the exterior openings (gaps in the outer
 * wall); `plan.doors` are interior room-to-room links (see plans/planTopology.js) —
 * so the MOUTH, not a door, is the way out. The mouth's `orient` selects the wall
 * axis (v = east/west wall, h = north/south wall) and its position vs. the nearest
 * footprint edge selects the side, so the token lands just beyond THAT edge — not a
 * hardcoded south. Falls back to the south edge (the pre-mouth behaviour) when a
 * plan has no usable mouth, and always returns a FINITE point (degenerate plans
 * included). PURE: no canvas, no rng, no mutation.
 */
export function exteriorAnchor(plan, ox = 0, oy = 0, M = 1.3) {
  const rooms = (plan && plan.rooms) || [];
  let nx = Infinity, xx = -Infinity, ny = Infinity, xy = -Infinity;
  for (const r of rooms) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; nx = Math.min(nx, r.cx - rw); xx = Math.max(xx, r.cx + rw); ny = Math.min(ny, r.cy - rh); xy = Math.max(xy, r.cy + rh); }
  const haveBounds = Number.isFinite(nx) && Number.isFinite(xx) && Number.isFinite(ny) && Number.isFinite(xy);
  const cx = haveBounds ? (nx + xx) / 2 : 0, cy = haveBounds ? (ny + xy) / 2 : 0;
  const mouth = pickMouth(plan, cx, cy);
  if (!mouth || !haveBounds) {
    // No exterior entrance recorded (or no footprint): keep the prior south-edge
    // behaviour so plain exits still land outside the footprint, finite always.
    return haveBounds ? { ux: ox + cx, uy: oy + xy + M } : { ux: ox, uy: oy + M };
  }
  // orient 'v' = vertical opening on the east/west wall; otherwise the north/south
  // wall. Side = whichever edge the mouth sits nearest (robust for off-centre rooms).
  if (String(mouth.orient) === 'v') {
    const west = Math.abs(mouth.x - nx) <= Math.abs(mouth.x - xx);
    return { ux: west ? ox + nx - M : ox + xx + M, uy: oy + mouth.y };
  }
  const north = Math.abs(mouth.y - ny) <= Math.abs(mouth.y - xy);
  return { ux: ox + mouth.x, uy: north ? oy + ny - M : oy + xy + M };
}

// The exterior entrance nearest the entry room — the front door for multi-mouth
// buildings (keeps/castles). Map plans identify the entry room by `r.id === plan.entry`
// (NOT an `isEntry` flag, which is an engine floorPlan field). Falls back to the first mouth.
function pickMouth(plan, cx, cy) {
  const mouths = (plan && plan.mouths) || [];
  if (mouths.length <= 1) return mouths[0] || null;
  const rooms = (plan && plan.rooms) || [];
  const entry = rooms.find(r => String(r.id) === String(plan.entry)) || rooms[0] || { cx, cy };
  let best = mouths[0], bestD = Infinity;
  for (const m of mouths) { const d = Math.hypot(m.x - entry.cx, m.y - entry.cy); if (d < bestD) { bestD = d; best = m; } }
  return best;
}
