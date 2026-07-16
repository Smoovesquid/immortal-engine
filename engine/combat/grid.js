/**
 * MX-1 — combat tactical grid.
 *
 * Coordinates are integer cells: x = east(+), y = south(+). The grid is engine
 * state, not narration text. One cell is five feet for movement reach.
 */

export const COMBAT_CELL_FEET = 5;
export const DEFAULT_COMBAT_SPEED_FEET = 30;
export const DEFAULT_COMBAT_GRID = Object.freeze({ w: 12, h: 10 });

const MAX_GRID_W = 64;
const MAX_GRID_H = 64;

export function defaultCombatGrid() {
  return { ...DEFAULT_COMBAT_GRID };
}

export function normalizeCombatGrid(grid) {
  const g = grid && typeof grid === 'object' ? grid : {};
  return {
    w: clampInt(g.w ?? DEFAULT_COMBAT_GRID.w, 1, MAX_GRID_W),
    h: clampInt(g.h ?? DEFAULT_COMBAT_GRID.h, 1, MAX_GRID_H)
  };
}

export function defaultPlayerCell(grid = DEFAULT_COMBAT_GRID) {
  const g = normalizeCombatGrid(grid);
  return { cx: Math.min(1, g.w - 1), cy: Math.floor(g.h / 2) };
}

export function defaultEnemyCell(index = 0, grid = DEFAULT_COMBAT_GRID) {
  const g = normalizeCombatGrid(grid);
  const i = Math.max(0, Math.trunc(Number(index) || 0));
  const baseX = Math.max(0, g.w - 3);
  const centerY = Math.floor(g.h / 2);
  const lane = i % 3;
  const row = centerY + (lane === 0 ? 0 : lane === 1 ? -1 : 1) + Math.floor(i / 3);
  return {
    cx: clampInt(baseX - Math.floor(i / 3), 0, g.w - 1),
    cy: clampInt(row, 0, g.h - 1)
  };
}

export function normalizeCombatCell(cell, fallback, grid = DEFAULT_COMBAT_GRID) {
  const g = normalizeCombatGrid(grid);
  const fb = fallback && typeof fallback === 'object' ? fallback : { cx: 0, cy: 0 };
  const src = cell && typeof cell === 'object' ? cell : {};
  return {
    cx: clampInt(src.cx ?? fb.cx ?? 0, 0, g.w - 1),
    cy: clampInt(src.cy ?? fb.cy ?? 0, 0, g.h - 1)
  };
}

export function hasExplicitCombatCell(value) {
  if (!value || typeof value !== 'object') return false;
  const cx = Number(value.cx);
  const cy = Number(value.cy);
  return Number.isFinite(cx) && Number.isFinite(cy);
}

export function combatCellKey(cell) {
  return `${cell.cx},${cell.cy}`;
}

export function inCombatBounds(grid, cell) {
  const g = normalizeCombatGrid(grid);
  return Number.isInteger(cell?.cx) && Number.isInteger(cell?.cy)
    && cell.cx >= 0 && cell.cx < g.w
    && cell.cy >= 0 && cell.cy < g.h;
}

export function combatGridDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(Number(a.cx) - Number(b.cx)) + Math.abs(Number(a.cy) - Number(b.cy));
}

export function firstOpenCellNear(preferred, grid, occupied = new Set()) {
  const g = normalizeCombatGrid(grid);
  const start = normalizeCombatCell(preferred, { cx: 0, cy: 0 }, g);
  const maxRadius = Math.max(g.w, g.h);
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        const cell = { cx: start.cx + dx, cy: start.cy + dy };
        if (!inCombatBounds(g, cell)) continue;
        if (occupied.has(combatCellKey(cell))) continue;
        return cell;
      }
    }
  }
  return start;
}

// ── DEATH-TRUTH-1c — THE BOARD'S WORLD ORIGIN ────────────────────────────────
//
// Until now the board was an ABSTRACT frame: cells 0..w-1 / 0..h-1 with no world
// anchor at all, which is exactly why deathFact.js could write "the combat grid
// is an abstract board... its cells are NOT world positions". They weren't — but
// only because nobody ever gave the board an origin. Pin ONE cell to ONE world
// position and every other cell has a true world address by construction, with
// no seed, no noise and no scatter.
//
// The pin is the PLAYER: the player's board cell IS the player's canonical pos.
// Everything else follows by integer offset.
//
// THE UNIT (UNIT-CLASH-1, public/map/worldSpace.js:36): the projection is 1:1 —
// one board cell == one region cell. Both frames step by 5 (COMBAT_CELL_FEET's 5
// is D&D rules-FLAVOUR used only for speed→squares; REGION_WU_PER_CELL's 5 is
// 5 wu ≈ 5 m of real ground). They are two different fives that both mean "one
// square", so the square index carries across unchanged. Do NOT multiply by
// 0.3048 here — converting flavour-feet into metres would put every corpse ~3.28×
// too close and would be UNIT-CLASH-1 wearing a new coat.
//
// Axis convention matches on both sides: cx/gx = east(+), cy/gy = south(+)
// (grid.js header ↔ combatScene.js ↔ tacticalPos), so the offset is a plain add.

/** boardOriginFrom(playerPos, playerCell) -> {frame,gx,gy} | null
 *  The world position of board cell (0,0), derived so that projecting the
 *  player's own cell returns the player's own canonical pos exactly.
 *  Null (honest absence) when either input is not real — never a guess. */
export function boardOriginFrom(playerPos, playerCell) {
  const p = playerPos && typeof playerPos === 'object' ? playerPos : null;
  if (!p || !Number.isInteger(p.gx) || !Number.isInteger(p.gy) || typeof p.frame !== 'string' || !p.frame) return null;
  const c = playerCell && typeof playerCell === 'object' ? playerCell : null;
  if (!c || !Number.isFinite(Number(c.cx)) || !Number.isFinite(Number(c.cy))) return null;
  return { frame: String(p.frame), gx: p.gx - Math.trunc(Number(c.cx)), gy: p.gy - Math.trunc(Number(c.cy)) };
}

/** boardCellToWorldPos(origin, cell) -> {frame,gx,gy} | null
 *  THE projection: board cell -> canonical world position, 1:1. Pure, integer,
 *  rng-free. Null when the board has no origin (a fight begun with no canonical
 *  player pos) — degrade honestly, never substitute. */
export function boardCellToWorldPos(origin, cell) {
  const o = origin && typeof origin === 'object' ? origin : null;
  if (!o || !Number.isInteger(o.gx) || !Number.isInteger(o.gy) || typeof o.frame !== 'string' || !o.frame) return null;
  const c = cell && typeof cell === 'object' ? cell : null;
  if (!c || !Number.isFinite(Number(c.cx)) || !Number.isFinite(Number(c.cy))) return null;
  return { frame: String(o.frame), gx: o.gx + Math.trunc(Number(c.cx)), gy: o.gy + Math.trunc(Number(c.cy)) };
}

export function combatGridForCount(enemyCount = 0) {
  const n = Math.max(0, Math.trunc(Number(enemyCount) || 0));
  return {
    w: Math.max(DEFAULT_COMBAT_GRID.w, Math.min(18, 10 + Math.ceil(n / 2))),
    h: Math.max(DEFAULT_COMBAT_GRID.h, Math.min(14, 8 + Math.ceil((n + 1) / 3)))
  };
}

export function placeCombatants({ enemies = [], reason = '', rng } = {}) {
  const list = Array.isArray(enemies) ? enemies : [];
  const grid = combatGridForCount(list.length);
  const r = rng && typeof rng.int === 'function' ? rng : { int: (lo) => lo };
  const surprise = /\b(?:ambush|surprise|surprised|caught|road|wild|camp)\b/i.test(String(reason || ''));
  const playerCell = {
    cx: r.int(0, Math.min(2, grid.w - 1)),
    cy: clampInt(Math.floor(grid.h / 2) + r.int(-1, 1), 0, grid.h - 1)
  };
  const occupied = new Set([combatCellKey(playerCell)]);
  const spacing = surprise ? 3 : 5;
  const anchor = {
    cx: clampInt(playerCell.cx + spacing + r.int(0, 2), 0, grid.w - 1),
    cy: clampInt(playerCell.cy + r.int(-2, 2), 0, grid.h - 1)
  };
  const offsets = [
    [0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [1, 1], [-1, -1], [-1, 1]
  ];
  const placed = [];
  for (let i = 0; i < list.length; i++) {
    const [ox, oy] = offsets[i % offsets.length];
    const band = Math.floor(i / offsets.length);
    const preferred = {
      cx: anchor.cx + ox + band,
      cy: anchor.cy + oy
    };
    const cell = firstOpenCellNear(preferred, grid, occupied);
    occupied.add(combatCellKey(cell));
    placed.push({ ...list[i], cx: cell.cx, cy: cell.cy });
  }
  return { grid, playerCell, enemies: placed };
}

export function moveCombatant(combat, id, cx, cy, opts = {}) {
  if (!combat || typeof combat !== 'object') return combat;
  const grid = normalizeCombatGrid(combat.grid);
  const target = {
    cx: Math.trunc(Number(cx)),
    cy: Math.trunc(Number(cy))
  };
  if (!inCombatBounds(grid, target)) return combat;

  const actorId = String(id ?? '');
  const isPlayer = actorId === 'player' || actorId === 'party';
  const enemies = Array.isArray(combat.enemies) ? combat.enemies : [];
  const enemy = isPlayer ? null : enemies.find(e => String(e?.id) === actorId);
  if (!isPlayer && !enemy) return combat;

  const from = isPlayer
    ? normalizeCombatCell(combat.playerCell, defaultPlayerCell(grid), grid)
    : normalizeCombatCell(enemy, defaultEnemyCell(enemies.indexOf(enemy), grid), grid);
  const speedFeet = Number.isFinite(Number(opts.speedFeet))
    ? Number(opts.speedFeet)
    : Number.isFinite(Number(enemy?.speedFeet))
      ? Number(enemy.speedFeet)
      : DEFAULT_COMBAT_SPEED_FEET;
  const reachCells = Math.max(0, Math.floor(speedFeet / COMBAT_CELL_FEET));
  if (combatGridDistance(from, target) > reachCells) return combat;

  const occupied = new Set();
  const playerCell = normalizeCombatCell(combat.playerCell, defaultPlayerCell(grid), grid);
  if (!isPlayer) occupied.add(combatCellKey(playerCell));
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    if (String(e.id) === actorId) continue;
    occupied.add(combatCellKey(normalizeCombatCell(e, defaultEnemyCell(i, grid), grid)));
  }
  if (occupied.has(combatCellKey(target))) return combat;

  if (isPlayer) {
    return { ...combat, grid, playerCell: target };
  }
  return {
    ...combat,
    grid,
    enemies: enemies.map(e => String(e?.id) === actorId ? { ...e, cx: target.cx, cy: target.cy } : e)
  };
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
