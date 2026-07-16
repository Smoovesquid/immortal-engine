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
//     player:  { cx, cy, name, archetype:'player', elite:false },
//     enemies: [ { id, name, cx, cy, defeated, archetype, elite } ]
//   }
// `archetype` ('player'|'humanoid'|'beast'|'undead') + `elite` (leader/boss read)
// let the renderer pick a stylized figure WITHOUT guessing in the view layer
// (MAPNINJA Step 5). They are derived here from the combat enemy's SURVIVING
// structured signals — traits, condition-immunities, cr, legendary/lair actions —
// with name only as a last-resort tiebreaker. (Heads-up: ensureCombat strips the
// bestiary `tags`/`type`/`ref` from combat enemies — see the project note on that
// trap — so creature-type lives in those proxies, not a clean `type` field.)
// When combat is not active, `active:false` (grid/player still valid defaults,
// enemies empty) so a caller can cheaply branch on `scene.active`.

export const COMBAT_SCENE_SCHEMA = 'combat-scene/v1';

const trunc = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; };
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, trunc(v)));

// ── archetype derivation (structured signals first, name as last resort) ──────
// CORPSE-TRUTH-1 finish (2026-07-16): the derivation moved VERBATIM to
// engine/combat/creatureArchetype.js so the death fact can mint the victim's
// archetype at the killing moment (engine can't import from public/). Behavior
// here is byte-identical — same function, one authority.
import { deriveArchetype } from '../../engine/combat/creatureArchetype.js';

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
    archetype: 'player',
    elite: false,
  };

  const enemies = (Array.isArray(c.enemies) ? c.enemies : []).map((e, i) => ({
    id: String(e?.id ?? `enemy_${i}`),
    name: String(e?.name ?? 'Foe'),
    cx: clampInt(e?.cx, 0, grid.w - 1),
    cy: clampInt(e?.cy, 0, grid.h - 1),
    defeated: Boolean(e?.defeated),
    ...deriveArchetype(e),
  }));

  return { schema: COMBAT_SCENE_SCHEMA, active, grid, player, enemies };
}
