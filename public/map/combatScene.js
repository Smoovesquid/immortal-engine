// COMBAT SCENE — the tactical-board read contract (MAP_PATH MX step).
//
// A PURE READ of engine-owned combat positions into a plain-JSON "scene
// description" the renderer (3D board or the 2D fallback grid) consumes. The
// engine owns the grid + every combatant's cell; this is a projection, never a
// write. Nothing here mutates the world, adds randomness, or touches anything
// worldHash/determinism depend on — the same guarantee sliceScene.js has.
//
// Coordinate convention (matches engine/combat/grid.js AND sliceScene.js):
//   cx = east (+),  cy = south (+)   — integer cells, 0..w-1 / 0..h-1.
//
// Shape — combat-scene/v1:
//   {
//     schema:  'combat-scene/v1',
//     active:  boolean,                       // world.combat.active
//     grid:    { w, h },                      // board dimensions in cells
//     player:  { cx, cy, name },              // the party avatar's cell
//     enemies: [ { id, name, cx, cy, defeated } ]
//   }
// When combat is not active, `active:false` (grid/player still valid defaults,
// enemies empty) so a caller can cheaply branch on `scene.active`.

export const COMBAT_SCENE_SCHEMA = 'combat-scene/v1';

const trunc = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; };
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, trunc(v)));

/**
 * combatSceneFromWorld(world) → combat-scene/v1.
 * Pure: reads world.combat (+ the party avatar's name) only; returns a fresh
 * plain object; mutates nothing.
 */
export function combatSceneFromWorld(world) {
  const c = (world && typeof world.combat === 'object' && world.combat) || {};
  const active = Boolean(c.active);

  const grid = {
    w: Math.max(1, trunc(c.grid?.w) || 12),
    h: Math.max(1, trunc(c.grid?.h) || 10),
  };

  const pc = world?.party?.[0] || world?.pc || null;
  const playerName = String(pc?.name || 'You');
  const pcCell = c.playerCell || {};
  const player = {
    cx: clampInt(pcCell.cx, 0, grid.w - 1),
    cy: clampInt(pcCell.cy, 0, grid.h - 1),
    name: playerName,
  };

  const enemies = (Array.isArray(c.enemies) ? c.enemies : []).map((e, i) => ({
    id: String(e?.id ?? `enemy_${i}`),
    name: String(e?.name ?? 'Foe'),
    cx: clampInt(e?.cx, 0, grid.w - 1),
    cy: clampInt(e?.cy, 0, grid.h - 1),
    defeated: Boolean(e?.defeated),
  }));

  return { schema: COMBAT_SCENE_SCHEMA, active, grid, player, enemies };
}
