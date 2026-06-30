/**
 * MX-4 — TALK→TOKEN: deterministic spatial-move resolver.
 *
 * A spoken command in combat ("charge the captain", "fall back", "circle to its
 * flank", "move east") moves the player's mini to a cell that is a PURE FUNCTION
 * of the current positions on the grid (engine/combat/grid.js) plus the intent.
 * Spatial physics is Road-A — the engine resolves the cell, never the LLM.
 *
 * THE LAW (docs/DND_XCOM.md): the resolver returns structure (a cell, an implied
 * tactical tag, a reason); the caller narrates the READ. No cells/coords/numbers
 * ever reach the player as prose.
 *
 * PURE + DETERMINISTIC. No rng, no state, no I/O. Ties are broken by a fixed
 * positional order (lowest cx, then lowest cy), so replay is hash-stable with
 * zero draws from the turn's rng stream.
 *
 *   kind ∈ 'toward' | 'away' | 'flank' | 'compass-north|south|east|west'
 *
 * Returns { cell, tag, targetName, reached, reason }:
 *   cell       {cx,cy} destination, or null when no move resolves
 *   tag        'flank' when the move implies a tactical tag, else null
 *   targetName the foe the move references (for the read), or null
 *   reached    true when the intended destination was reached (vs a partial close)
 *   reason     'moved' | 'already-there' | 'no-room' | 'too-far' | 'no-target'
 */

import {
  normalizeCombatGrid,
  normalizeCombatCell,
  combatGridDistance,
  combatCellKey,
  COMBAT_CELL_FEET,
  DEFAULT_COMBAT_SPEED_FEET
} from './grid.js';

// The player's combat stride. Matches moveCombatant's default so the resolver's
// reach and the commit's reach agree (30 ft → 6 cells).
export const PLAYER_COMBAT_SPEED_FEET = DEFAULT_COMBAT_SPEED_FEET;

export function playerReachCells(speedFeet = PLAYER_COMBAT_SPEED_FEET) {
  return Math.max(0, Math.floor((Number(speedFeet) || 0) / COMBAT_CELL_FEET));
}

const isLive = (e) => e && !e.defeated && (Number(e.hp) || 0) > 0;

// Every enemy (alive OR downed) holds its cell — moveCombatant blocks moving onto
// any of them, and the invariants reject overlap, so the resolver must too.
function occupiedCells(enemies, grid) {
  const occ = new Set();
  for (const e of enemies) {
    if (!e) continue;
    occ.add(combatCellKey(normalizeCombatCell(e, { cx: 0, cy: 0 }, grid)));
  }
  return occ;
}

// All in-bounds, unoccupied cells within `reach` Manhattan steps of `from`
// (includes `from` itself at cost 0 — "stay put").
function reachableCells(from, grid, reach, occupied) {
  const out = [];
  for (let cy = 0; cy < grid.h; cy++) {
    for (let cx = 0; cx < grid.w; cx++) {
      const cost = Math.abs(cx - from.cx) + Math.abs(cy - from.cy);
      if (cost > reach) continue;
      if (occupied.has(`${cx},${cy}`)) continue;
      out.push({ cx, cy, cost });
    }
  }
  return out;
}

const sameCell = (a, b) => a.cx === b.cx && a.cy === b.cy;

// Pick the target foe: the named one if it's live, else the nearest live foe.
// Nearest ties break by lowest cx, then lowest cy, then array order.
function pickTarget(from, enemies, grid, targetIdx) {
  if (targetIdx >= 0 && isLive(enemies[targetIdx])) {
    return { idx: targetIdx, enemy: enemies[targetIdx] };
  }
  let best = null;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!isLive(e)) continue;
    const c = normalizeCombatCell(e, { cx: 0, cy: 0 }, grid);
    const d = combatGridDistance(from, c);
    if (!best
      || d < best.d
      || (d === best.d && (c.cx < best.c.cx || (c.cx === best.c.cx && c.cy < best.c.cy)))) {
      best = { idx: i, enemy: e, c, d };
    }
  }
  return best ? { idx: best.idx, enemy: best.enemy } : null;
}

const COMPASS = Object.freeze({
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 }
});

/**
 * resolveSpatialMove — the intent→cell interface (MX-4).
 *
 * @param {object} args
 * @param {string} args.kind        'toward' | 'away' | 'flank' | 'compass-<dir>'
 * @param {{cx,cy}} args.playerCell  current player cell
 * @param {Array}  args.enemies      combat enemies (need cx/cy; defeated still block)
 * @param {{w,h}}  args.grid         combat grid
 * @param {number} [args.targetIdx]  named-target index (-1 = nearest live)
 * @param {number} [args.speedFeet]  player stride (defaults to 30 ft → 6 cells)
 * @returns {{cell, tag, targetName, reached, reason}}
 */
export function resolveSpatialMove({
  kind,
  playerCell,
  enemies = [],
  grid,
  targetIdx = -1,
  speedFeet = PLAYER_COMBAT_SPEED_FEET
} = {}) {
  const g = normalizeCombatGrid(grid);
  const from = normalizeCombatCell(playerCell, { cx: 0, cy: 0 }, g);
  const reach = playerReachCells(speedFeet);
  const list = Array.isArray(enemies) ? enemies : [];
  const occupied = occupiedCells(list, g);
  const none = { cell: null, tag: null, targetName: null, reached: false, reason: 'no-room' };

  if (typeof kind === 'string' && kind.startsWith('compass-')) {
    return resolveCompass(kind.slice('compass-'.length), from, g, reach, occupied);
  }
  if (kind === 'toward') return resolveToward(from, list, g, reach, occupied, targetIdx);
  if (kind === 'away') return resolveAway(from, list, g, reach, occupied);
  if (kind === 'flank') return resolveFlank(from, list, g, reach, occupied, targetIdx);
  return none;
}

// Toward / charge: close on the named-or-nearest foe. Land on the reachable cell
// CLOSEST to the foe (its own cell is occupied, so the floor is melee range);
// ties break by least movement, then lowest cx/cy. A foe beyond reach yields a
// partial close (reached:false); already adjacent yields 'already-there'.
function resolveToward(from, enemies, grid, reach, occupied, targetIdx) {
  const tgt = pickTarget(from, enemies, grid, targetIdx);
  if (!tgt) return { cell: null, tag: null, targetName: null, reached: false, reason: 'no-target' };
  const T = normalizeCombatCell(tgt.enemy, { cx: 0, cy: 0 }, grid);
  const cells = reachableCells(from, grid, reach, occupied);
  let best = null;
  for (const c of cells) {
    const dToT = Math.abs(c.cx - T.cx) + Math.abs(c.cy - T.cy);
    const key = { dToT, cost: c.cost, cx: c.cx, cy: c.cy };
    if (!best || better(key, best.key)) best = { c, key, dToT };
  }
  const targetName = tgt.enemy?.name || null;
  if (!best || sameCell(best.c, from)) {
    return { cell: null, tag: null, targetName, reached: best?.dToT === 1, reason: 'already-there' };
  }
  return { cell: { cx: best.c.cx, cy: best.c.cy }, tag: null, targetName, reached: best.dToT === 1, reason: 'moved' };
}

// Away / fall back / retreat: maximize total Manhattan distance to the whole live
// pack. Ties break by lowest cx/cy. Cornered (can't increase distance) → no-room.
function resolveAway(from, enemies, grid, reach, occupied) {
  const live = enemies.filter(isLive).map(e => normalizeCombatCell(e, { cx: 0, cy: 0 }, grid));
  if (!live.length) return { cell: null, tag: null, targetName: null, reached: false, reason: 'no-target' };
  const totalTo = (c) => live.reduce((s, t) => s + Math.abs(c.cx - t.cx) + Math.abs(c.cy - t.cy), 0);
  const cells = reachableCells(from, grid, reach, occupied);
  let best = null;
  for (const c of cells) {
    const score = totalTo(c);
    const key = { score, cx: c.cx, cy: c.cy };
    if (!best || betterAway(key, best.key)) best = { c, key };
  }
  if (!best || sameCell(best.c, from)) {
    return { cell: null, tag: null, targetName: null, reached: false, reason: 'no-room' };
  }
  return { cell: { cx: best.c.cx, cy: best.c.cy }, tag: null, targetName: null, reached: true, reason: 'moved' };
}

// Compass step: stride as far as reach allows in one cardinal direction, stopping
// before the first wall or occupied cell. No room to step → no-room.
function resolveCompass(dir, from, grid, reach, occupied) {
  const v = COMPASS[dir];
  if (!v) return { cell: null, tag: null, targetName: null, reached: false, reason: 'no-room' };
  let last = from;
  for (let k = 1; k <= reach; k++) {
    const cx = from.cx + v.dx * k;
    const cy = from.cy + v.dy * k;
    if (cx < 0 || cx >= grid.w || cy < 0 || cy >= grid.h) break;
    if (occupied.has(`${cx},${cy}`)) break;
    last = { cx, cy };
  }
  if (sameCell(last, from)) {
    return { cell: null, tag: null, targetName: null, reached: false, reason: 'no-room' };
  }
  return { cell: { cx: last.cx, cy: last.cy }, tag: null, targetName: null, reached: true, reason: 'moved' };
}

// Flank: circle to an orthogonal neighbor of the foe — preferring the cell
// FARTHEST from where you stand (around to its rear). Implies the 'flank' tag.
// No reachable open neighbor → 'too-far' (a neighbor exists but is out of reach)
// or 'no-room' (the foe is hemmed in on every side). The caller sets the tactical
// tag regardless (geometry-gating is deferred to MX-2); the resolver only finds
// the cell to move the mini to.
function resolveFlank(from, enemies, grid, reach, occupied, targetIdx) {
  const tgt = pickTarget(from, enemies, grid, targetIdx);
  if (!tgt) return { cell: null, tag: 'flank', targetName: null, reached: false, reason: 'no-target' };
  const T = normalizeCombatCell(tgt.enemy, { cx: 0, cy: 0 }, grid);
  const targetName = tgt.enemy?.name || null;
  // The four orthogonal neighbors, in a fixed compass order (E,S,W,N) for tie-break.
  const neighbors = [
    { cx: T.cx + 1, cy: T.cy },
    { cx: T.cx, cy: T.cy + 1 },
    { cx: T.cx - 1, cy: T.cy },
    { cx: T.cx, cy: T.cy - 1 }
  ].filter(c => c.cx >= 0 && c.cx < grid.w && c.cy >= 0 && c.cy < grid.h
    && !occupied.has(`${c.cx},${c.cy}`));
  if (!neighbors.length) {
    return { cell: null, tag: 'flank', targetName, reached: false, reason: 'no-room' };
  }
  // Among open neighbors, prefer the one reachable this turn that is farthest from
  // `from` (circling to the rear). Compass order above is the tie-break.
  let best = null;
  for (const nb of neighbors) {
    const cost = Math.abs(nb.cx - from.cx) + Math.abs(nb.cy - from.cy);
    if (cost > reach) continue;
    const dFromYou = cost; // Manhattan from current position
    if (!best || dFromYou > best.dFromYou) best = { nb, dFromYou };
  }
  if (!best) {
    return { cell: null, tag: 'flank', targetName, reached: false, reason: 'too-far' };
  }
  if (sameCell(best.nb, from)) {
    // Already standing on a flank cell — tag holds, no move needed.
    return { cell: null, tag: 'flank', targetName, reached: true, reason: 'already-there' };
  }
  return { cell: { cx: best.nb.cx, cy: best.nb.cy }, tag: 'flank', targetName, reached: true, reason: 'moved' };
}

// toward comparator: closer to the foe wins; then least movement; then lowest cx/cy.
function better(a, b) {
  if (a.dToT !== b.dToT) return a.dToT < b.dToT;
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (a.cx !== b.cx) return a.cx < b.cx;
  return a.cy < b.cy;
}

// away comparator: more total distance from the pack wins; then lowest cx/cy.
function betterAway(a, b) {
  if (a.score !== b.score) return a.score > b.score;
  if (a.cx !== b.cx) return a.cx < b.cx;
  return a.cy < b.cy;
}
