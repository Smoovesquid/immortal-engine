/**
 * Tactical movement + turns — the XCom-style action layer.
 *
 * Tile movement with an action budget over a "blocked" grid (walls/obstacles
 * impassable). A careful step spends one move's worth; a bold dash spends the
 * whole turn for double range (and, combined with fog, is the gamble — you can
 * outrun your sight into an ambush). Turn order is seeded initiative.
 *
 * PURE + DETERMINISTIC. Grid: makeGrid from visibility.js (op=1 => impassable).
 */

import { makeRng, seedFromString } from '../rng.js';

const ORTHO = 1, DIAG = 1.5;
const NEI = [[1, 0, ORTHO], [-1, 0, ORTHO], [0, 1, ORTHO], [0, -1, ORTHO], [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG]];

// reachableTiles(blocked, sx,sy, budget) -> Map<"x,y", {cost,px,py}>
// Dijkstra; diagonals cost 1.5 and may not cut between two walls.
export function reachableTiles(blocked, sx, sy, budget) {
  const out = new Map();
  if (blocked.get(sx, sy)) return out;
  const key = (x, y) => x + ',' + y;
  out.set(key(sx, sy), { cost: 0, px: null, py: null });
  const frontier = [{ x: sx, y: sy, cost: 0 }];
  while (frontier.length) {
    // deterministic min pick (cost, then y, then x)
    let mi = 0; for (let i = 1; i < frontier.length; i++) { const a = frontier[i], b = frontier[mi]; if (a.cost < b.cost || (a.cost === b.cost && (a.y < b.y || (a.y === b.y && a.x < b.x)))) mi = i; }
    const cur = frontier.splice(mi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.cost > (out.get(ck)?.cost ?? Infinity)) continue;
    for (const [dx, dy, w] of NEI) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!blocked.inb(nx, ny) || blocked.get(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (blocked.get(cur.x + dx, cur.y) && blocked.get(cur.x, cur.y + dy))) continue; // no corner cut
      const nc = cur.cost + w;
      if (nc > budget + 1e-9) continue;
      const nk = key(nx, ny);
      if (nc < (out.get(nk)?.cost ?? Infinity)) { out.set(nk, { cost: nc, px: cur.x, py: cur.y }); frontier.push({ x: nx, y: ny, cost: nc }); }
    }
  }
  return out;
}

// reachable(blocked, sx,sy, move, mode) — careful = move budget, bold = 2*move.
export function reachable(blocked, sx, sy, move, mode = 'careful') {
  const budget = (mode === 'bold' || mode === 'dash') ? move * 2 : move;
  const r = reachableTiles(blocked, sx, sy, budget);
  return { tiles: r, budget, mode: budget > move ? 'bold' : 'careful', move };
}

// pathTo(reach, tx,ty) -> [[x,y]...] from start to target (empty if unreachable).
export function pathTo(reachResult, tx, ty) {
  const tiles = reachResult.tiles || reachResult;
  const k = tx + ',' + ty;
  if (!tiles.has(k)) return [];
  const path = []; let cx = tx, cy = ty;
  while (cx != null) { path.push([cx, cy]); const n = tiles.get(cx + ',' + cy); if (!n || n.px == null) break; cx = n.px; cy = n.py; }
  return path.reverse();
}

// rollInitiative(actors, seed) -> [actorId...] desc by d20+agility, seeded, stable ties.
export function rollInitiative(actors, seed = '') {
  const rng = makeRng(seedFromString(`${seed}|init`));
  const scored = (Array.isArray(actors) ? actors : []).map(a => ({ id: String(a.id), roll: rng.int(1, 20) + Math.trunc(Number(a.agility || 0)) }));
  scored.sort((x, y) => (y.roll - x.roll) || (x.id < y.id ? -1 : 1));
  return scored.map(s => s.id);
}

// Minimal turn queue over a fixed initiative order.
export function makeTurnQueue(order) {
  let i = 0, round = 1; const ord = order.slice();
  return {
    current: () => ord[i] || null,
    round: () => round,
    advance() { i++; if (i >= ord.length) { i = 0; round++; } return ord[i] || null; }
  };
}
