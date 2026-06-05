/**
 * Tactical visibility — line-of-sight fog of war (the XCom rule).
 *
 * Pure, deterministic, grid-based. Walls and cover block sight; you see only what
 * you have a clear line to. This is the load-bearing module the whole tactical
 * layer (movement, abilities, cover, enemy AI, narration) sits on. The browser
 * place renderer has a copy of this logic for drawing; this is the engine's
 * authoritative, tested version.
 *
 * Grid: row-major, index = y*W + x. opacity[i] truthy => that cell blocks sight.
 */

export function makeGrid(W, H) {
  W = Math.max(1, W | 0); H = Math.max(1, H | 0);
  const op = new Uint8Array(W * H);
  return {
    W, H, op,
    idx: (x, y) => y * W + x,
    inb: (x, y) => x >= 0 && y >= 0 && x < W && y < H,
    get: (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? op[y * W + x] : 1,
    set: (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) op[y * W + x] = v ? 1 : 0; }
  };
}

// losClear(grid, x0,y0,x1,y1) -> boolean. Clear if no opaque cell lies STRICTLY
// between the two endpoints (so you can see the wall you're looking at, but not
// past it). Bresenham, symmetric enough for tactical use.
export function losClear(g, x0, y0, x1, y1) {
  let cx = x0, cy = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx - dy;
  while (!(cx === x1 && cy === y1)) {
    const e2 = 2 * e;
    if (e2 > -dy) { e -= dy; cx += sx; }
    if (e2 < dx) { e += dx; cy += sy; }
    if (cx === x1 && cy === y1) break;     // reached target — endpoint not counted
    if (g.get(cx, cy)) return false;        // opaque cell between origin and target
  }
  return true;
}

// computeVisibility(grid, ox,oy, radius) -> Set<"x,y"> of cells in sight.
export function computeVisibility(g, ox, oy, radius) {
  const vis = new Set([ox + ',' + oy]);
  const R2 = radius * radius;
  const x0 = Math.max(0, ox - radius), x1 = Math.min(g.W - 1, ox + radius);
  const y0 = Math.max(0, oy - radius), y1 = Math.min(g.H - 1, oy + radius);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const ddx = x - ox, ddy = y - oy;
    if (ddx * ddx + ddy * ddy > R2) continue;
    if (losClear(g, ox, oy, x, y)) vis.add(x + ',' + y);
  }
  return vis;
}

// canSee(grid, ox,oy, tx,ty, radius) -> boolean (range + clear line).
export function canSee(g, ox, oy, tx, ty, radius) {
  const dx = tx - ox, dy = ty - oy;
  if (dx * dx + dy * dy > radius * radius) return false;
  return losClear(g, ox, oy, tx, ty);
}
