#!/usr/bin/env node

/**
 * VIS-ORACLE — canonical scene harness (docs/briefs/VIS-ORACLE.md).
 *
 * The seven deterministic scene boots the screen-truth oracle asserts against,
 * plus the DRAWN-MODEL builders that read the world exactly as the live renderer
 * does. Mirror of scripts/positionProbe.mjs's bootSlice/runSequence discipline:
 * seeded engine, LLM OFF (parseIntent floor), zero Math.random, no world mutation
 * outside the engine's own turn path — two runs → byte-identical scenes.
 *
 * ── Why these builders ARE the drawn model (not a mock) ──────────────────────
 * The renderer never invents a position. Its people/props/buildings all come from
 * one of three PURE, read-only public/map projection rails, which this harness
 * calls directly:
 *
 *   • placeFromWorldNode(world, nodeId)      — the walkable place the 2-D fog view
 *       (public/map/handDrawnPlace.js) and the token/collision layer consume:
 *       { buildings:[{plan, ox, oy, structureKey?}], tokens:[{type,ux,uy,...}],
 *         terrain } in the village's PLACE-UNIT space.
 *   • drawnStructureModel / decorativeBuildingRects / placedTokenModel(world,node)
 *       (public/map/drawModel.js) — the WORLD-UNIT (wu) geometry oneMap.js's 2-D
 *       sheet AND render3d.js's 3-D board both draw: structure rects/rooms/walls,
 *       people tokens, prop minis, every point already through the engine floorPlan.
 *   • combatSceneFromWorld(world) (public/map/combatScene.js) — the tactical-board
 *       read contract the 3-D/2-D board consumes: { grid, player, enemies:[{cx,cy,
 *       defeated,...}] } in CELL space.
 *
 * The 3-D people scene-position is `worldPosFromWu(placedTokenModel.people[i].wu)`
 * — render3d.js line ~657 places each figure at exactly that point — so importing
 * `worldPosFromWu` (a pure ÷NODE_WU×TILE_WU bridge, no THREE at module load) lets
 * the oracle assert the 3-D layer's projection WITHOUT mounting WebGL (the
 * 0×0-canvas-black trap is thereby sidestepped entirely: there is no canvas).
 *
 * Renderer + engine are READ-ONLY here (VIS-ORACLE lane rule). Nothing in this
 * file writes public/** or engine/** state.
 */

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { outdoorOccupants } from '../engine/structures/roomOccupancy.js';

import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { drawnStructureModel, decorativeBuildingRects, placedTokenModel } from '../public/map/drawModel.js';
import { combatSceneFromWorld } from '../public/map/combatScene.js';
import { playerFocusWu } from '../public/map/oneMap.js';
import { worldPosFromWu } from '../public/map/render3d.js';
import {
  placeFrame, buildingAnchorInPlace,
  structureWorldRect,
} from '../public/map/worldSpace.js';

// ── The one minimal pack the slice boot needs (mirrors positionProbe.mjs) ─────
export const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

/** Boot the default slice world exactly as the live front door does. */
export function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({
    seed, fate: 0.2, campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

/** One player turn, LLM OFF (deterministic parseIntent floor). */
function turn(world, text) { return playerMove(world, PACKS, text).world; }

// ─────────────────────────────────────────────────────────────────────────────
//  planExtent — the SAME footprint-extent math placeFromNode.js's building-scatter
//  loop uses internally (and U494's building-rect check re-derives). A plan's
//  drawn rect in place-units is planExtent(plan) offset by the building's ox/oy.
//  This is the exact rect the walkable-place view (handDrawnPlace.js) collides and
//  draws buildings against, so a token asserted against it is asserted against the
//  same ink the sheet paints.
// ─────────────────────────────────────────────────────────────────────────────
export function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of (plan?.rooms || [])) {
    const rw = (r.w || (r.r ? r.r * 2 : 0)) / 2, rh = (r.h || (r.r ? r.r * 2 : 0)) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

// ─────────────────────────────────────────────────────────────────────────────
//  DRAWN MODEL — the read the renderer performs, in TWO spaces:
//    placeUnit — placeFromWorldNode's { buildings(rects), tokens } (the walkable
//                place view + the token/collision layer).
//    wu        — drawnStructureModel + decorativeBuildingRects + placedTokenModel
//                + the player marker (playerFocusWu) — what oneMap's 2-D sheet and
//                render3d's board draw. `scene3d` folds people through
//                worldPosFromWu, the exact point render3d places each figure at.
//  Both are pure functions of the world. Absent a settlement, placeUnit is null
//  (no village embedding) and only the wu people/marker apply.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * drawnModel(world, nodeId?) -> {
 *   nodeId,
 *   placeUnit: { buildings:[{key,name,structureKey,rect,ox,oy}],
 *                tokens:[{type,ux,uy,label,npc}] } | null,
 *   wu: { player: {wx,wy}|null,
 *         structures:[{structureKey,rect}], decoratives:[{key,name,rect}],
 *         people:[{id,name,wx,wy,hostile}], props:[{wx,wy,kind}] },
 *   scene3d: { people:[{id,name,x,z}], props:[{x,z,kind}], player:{x,z}|null },
 * }
 */
export function drawnModel(world, nodeId = null) {
  const id = String(nodeId || world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => String(n?.id) === id) || null;

  // COMBAT owns the scene: render3d's combat branch draws the tactical board and
  // SKIPS the settlement people/props/buildings entirely (the `!sceneData.combat`
  // guard). So when a fight is live the drawn scene is the BOARD, not the village —
  // the settlement layers are empty here to match what actually renders.
  const inCombat = !!(world?.combat && world.combat.active);

  // ── placeUnit space (the walkable-place view) — not drawn during combat ──
  let placeUnit = null;
  if (!inCombat && node && node.settlement) {
    const place = placeFromWorldNode(world, id);
    if (place) {
      const buildings = (place.buildings || []).map((b, i) => {
        const ext = planExtent(b.plan);
        const rect = ext
          ? { minX: ext.minX + b.ox, minY: ext.minY + b.oy, maxX: ext.maxX + b.ox, maxY: ext.maxY + b.oy }
          : null;
        return {
          key: b.structureKey ? `struct:${b.structureKey}` : `deco:${i}`,
          name: String(b.name || b.buildingName || ''),
          structureKey: b.structureKey ? String(b.structureKey) : null,
          rect, ox: b.ox, oy: b.oy,
        };
      });
      const tokens = (place.tokens || []).map(t => ({
        type: t.type, ux: t.ux, uy: t.uy,
        label: t.label || null,
        npc: t.npc ? { id: t.npc.id || null, name: t.npc.name || null } : null,
      }));
      placeUnit = { buildings, tokens };
    }
  }

  // ── wu space (the sheet + board draw) — settlement layers empty during combat ──
  const dsm = inCombat ? { structures: [] } : drawnStructureModel(world, id);
  const deco = inCombat ? { buildings: [] } : decorativeBuildingRects(world, id);
  const ptm = inCombat ? { people: [], props: [] } : placedTokenModel(world, id);
  // The player marker only resolves for the CURRENT node (playerFocusWu reads
  // world.map.currentNodeId); for any other node it is null (never fabricate).
  const isCurrent = id === String(world?.map?.currentNodeId || '');
  const pf = (!inCombat && isCurrent) ? playerFocusWu(world) : null;
  const wu = {
    player: pf ? { wx: pf.wx, wy: pf.wy } : null,
    structures: (dsm.structures || []).map(s => ({ structureKey: String(s.structureKey), rect: s.rect })),
    decoratives: (deco.buildings || []).map(b => ({ key: b.key, name: b.name, rect: b.rect })),
    people: (ptm.people || []).map(p => ({ id: String(p.id || ''), name: String(p.name || ''), wx: p.wx, wy: p.wy, hostile: !!p.hostile })),
    props: (ptm.props || []).map(p => ({ wx: p.wx, wy: p.wy, kind: String(p.kind || '') })),
  };

  // ── 3-D scene positions (render3d's exact placement) ──
  const scene3d = {
    people: wu.people.map(p => { const q = worldPosFromWu(p.wx, p.wy); return { id: p.id, name: p.name, x: q.x, z: q.z }; }),
    props: wu.props.map(p => { const q = worldPosFromWu(p.wx, p.wy); return { x: q.x, z: q.z, kind: p.kind }; }),
    player: pf ? worldPosFromWu(pf.wx, pf.wy) : null,
  };

  // ── combat board (render3d's buildTacticalBoard read: cell centers → wu) ──
  // CELL_WU cells; a cell center is (cx+0.5, cy+0.5)·CELL_WU in board-local wu
  // (render3d line ~1078 cellCenter). The board is a distinct drawn model — the
  // combat assertions read world.combat directly (via __world) for identity, and
  // the rasterizer draws the board grid; this field is the structured board view.
  let combat = null;
  if (inCombat) {
    const cs = combatSceneFromWorld(world);
    combat = {
      grid: cs.grid,
      player: cs.player,
      enemies: cs.enemies.map(e => ({ id: e.id, name: e.name, cx: e.cx, cy: e.cy, defeated: e.defeated })),
    };
  }

  return { nodeId: id, inCombat, placeUnit, wu, scene3d, combat };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENGINE TRUTH — the position facts the drawn model must match, per node.
//    interior      — the wake/re-enter structure the player is INSIDE (or null).
//    playerCell    — the player's canonical struct cell (gx,gy) when indoors.
//    playerRect    — the ENGINE floorPlan rect of the interior structure, in the
//                    drawn wu space (structureWorldRect over floorPlan) — the box
//                    the player marker must sit within.
//    playerPlaceUnitRect — the SAME interior structure's rect in place-unit space,
//                    built from the ENGINE floorPlan (planExtent) at the drawn
//                    building's anchor — the box the placeUnit player token must
//                    sit within.  (This is where the wake RED lives: the token is
//                    seated from the engine floorPlan but the building is DRAWN
//                    from getPlan's catalog plan, so the two rects disagree.)
//    outdoorNames  — outdoorOccupants(world) names (the people-token source set).
//    structureKeys — the real structures at the node (drawn-structure source set).
// ─────────────────────────────────────────────────────────────────────────────
export function engineTruth(world, nodeId = null) {
  const id = String(nodeId || world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => String(n?.id) === id) || null;
  const isCurrent = id === String(world?.map?.currentNodeId || '');

  const interior = (isCurrent && world?.scene && world.scene.interior && typeof world.scene.interior === 'object')
    ? { structureKey: String(world.scene.interior.structureKey || ''), roomId: String(world.scene.interior.roomId || '') }
    : null;

  const pos = world?.party?.[0]?.pos || null;
  const playerCell = (pos && Number.isInteger(pos.gx) && Number.isInteger(pos.gy))
    ? { frame: String(pos.frame || ''), gx: pos.gx, gy: pos.gy } : null;

  // The interior structure's ENGINE-plan rect, in BOTH drawn spaces.
  let playerRect = null, playerPlaceUnitRect = null;
  if (interior && interior.structureKey) {
    const st = world?.structures?.byId?.[interior.structureKey] || null;
    if (st) {
      let plan; try { plan = floorPlan(st); } catch { plan = null; }
      if (plan && plan.rooms?.length) {
        const place = (node && node.settlement) ? placeFromWorldNode(world, id) : null;
        const frame = place ? placeFrame(place) : null;
        const anchor = buildingAnchorInPlace(place, interior.structureKey) || { ox: 0, oy: 0 };
        playerRect = structureWorldRect(node, frame, anchor, plan);
        // PLAN-SPLIT-1 — this must use the SAME footprint-centered-at-anchor
        // convention as structureWorldRect just above (its wu-space sibling):
        // the building's ox/oy anchor is the footprint's CENTER (worldSpace.js's
        // structCellToPlaceUnit/structureWorldRect docstring: "footprint centered
        // at its anchor"; U400-C proves it), so the rect is anchor ± footprint/2 —
        // NOT the room-bbox's own min/max offset by the anchor (planExtent(plan)
        // here measures the WALL-inset room-ink bbox, which sits ~WALL/2 inside
        // the footprint's true corners; for a catalog plan the two conventions
        // coincided by the old seating math's own symmetry, which is exactly what
        // masked this formula bug until the drawn plan became the real engine
        // floorPlan). planExtent/ext kept only as the ok-precondition check.
        const ext = planExtent(plan);
        if (ext) {
          const fw = Number(plan?.footprint?.w) || 1, fh = Number(plan?.footprint?.h) || 1;
          playerPlaceUnitRect = {
            minX: anchor.ox - fw / 2, minY: anchor.oy - fh / 2,
            maxX: anchor.ox + fw / 2, maxY: anchor.oy + fh / 2,
          };
        }
      }
    }
  }

  const outdoorNames = (isCurrent ? outdoorOccupants(world) : []).map(n => String(n?.name || '')).filter(Boolean);
  const structureKeys = Object.values(world?.structures?.byId || {})
    .filter(s => String(s?.nodeId || '') === id).map(s => String(s.id));

  // Combat truth (identity — the board read contract IS the engine positions).
  const combat = (world?.combat && world.combat.active) ? {
    active: true,
    enemies: (world.combat.enemies || []).map((e, i) => ({ id: String(e?.id ?? `enemy_${i}`), name: String(e?.name ?? 'Foe'), defeated: !!e?.defeated })),
  } : { active: false, enemies: [] };

  return { nodeId: id, interior, playerCell, playerRect, playerPlaceUnitRect, outdoorNames, structureKeys, combat };
}

// ─────────────────────────────────────────────────────────────────────────────
//  THE SEVEN CANONICAL SCENES — each a deterministic (world, nodeId, timeOfDay).
//  buildScenes() boots them once and returns the list; two calls → identical
//  worlds (seeded, LLM off). timeOfDay is carried for the golden id + a forward
//  hook: the drawn model is NOT time-parameterized in the engine today (occupancy
//  and scatter take no clock), so 'morning' and 'evening' of the same node draw
//  identically — the oracle is READY to catch a divergence the instant the engine
//  makes placement time-dependent (flagged in the brief report).
// ─────────────────────────────────────────────────────────────────────────────

/** Set the fiction clock to a given hour. Occupancy IS time-of-day-driven
 *  (engine/structures/roomOccupancy.js: the settlement crowd differs night vs
 *  day — verified: hours 0 → Carl/Galen/Scarvein outdoors, hours 8+ → the daytime
 *  roster), so this is a REAL scene input, not a no-op: morning and evening boot
 *  the daytime schedule; the boot default (hours 0) is pre-dawn. Only sets the
 *  scalar clock; topology untouched. Pure w.r.t. determinism (a fixed hour → a
 *  fixed roster). */
function atHour(world, hours) {
  if (world?.time && typeof world.time === 'object') world.time.hours = hours;
  return world;
}

export const SCENE_IDS = [
  'wake_interior',
  'cottage_exterior',
  'settlement_square_morning',
  'settlement_square_evening',
  'wild_road_walking',
  'deep_wild_fog_edge',
  'combat_one_defeated',
];

export function buildScenes() {
  const scenes = [];

  // 1) wake interior — the boot state (player INSIDE the wake room).
  {
    const world = bootSlice();
    scenes.push({ id: 'wake_interior', world, nodeId: world.map.currentNodeId, timeOfDay: 'morning',
      note: 'boot: player inside the wake cottage room' });
  }

  // 2) cottage exterior — one honest step onto the doorstep (region frame).
  {
    const world = turn(bootSlice(), 'go outside');
    scenes.push({ id: 'cottage_exterior', world, nodeId: world.map.currentNodeId, timeOfDay: 'morning',
      note: 'go outside: doorstep of the wake cottage, home settlement' });
  }

  // 3) settlement square, morning — outdoors at the home settlement, daytime
  //    schedule (hours 8): the inhabited village square, the daytime crowd.
  {
    const world = atHour(turn(bootSlice(), 'go outside'), 8);
    scenes.push({ id: 'settlement_square_morning', world, nodeId: world.map.currentNodeId, timeOfDay: 'morning',
      note: 'Aldermere square, morning (daytime roster)' });
  }

  // 4) settlement square, evening — same node, evening clock (hours 19). Occupancy
  //    is time-of-day-driven, so this is a real distinct scene; the engine's
  //    schedule gives the same daytime roster at 8 and 19 (it distinguishes
  //    night vs day, not morning vs evening — the oracle asserts whatever the
  //    engine actually places, and will catch any future finer schedule).
  {
    const world = atHour(turn(bootSlice(), 'go outside'), 19);
    scenes.push({ id: 'settlement_square_evening', world, nodeId: world.map.currentNodeId, timeOfDay: 'evening',
      note: 'Aldermere square, evening (daytime roster)' });
  }

  // 5) wild road at walking zoom — travel out to the Greenwood (a wilderness node).
  {
    let world = turn(bootSlice(), 'go outside');
    world = turn(world, 'travel to the Greenwood');
    scenes.push({ id: 'wild_road_walking', world, nodeId: world.map.currentNodeId, timeOfDay: 'morning',
      note: 'The Greenwood, on the road at walking zoom' });
  }

  // 6) deep wild with the fog edge in frame — a step deeper into the wild after
  //    arriving (the fog bubble edge sits in frame around the player's pos).
  {
    let world = turn(bootSlice(), 'go outside');
    world = turn(world, 'travel to the Greenwood');
    world = turn(world, 'walk east');
    scenes.push({ id: 'deep_wild_fog_edge', world, nodeId: world.map.currentNodeId, timeOfDay: 'morning',
      note: 'deep in the Greenwood, the fog edge in frame' });
  }

  // 7) combat board with one defeated foe — a deterministic ambush on the doorstep,
  //    one enemy marked down (the corpse-swap). beginCombat is the engine entry;
  //    the drawn model reads the resulting world.combat cells.
  {
    let world = turn(bootSlice(), 'go outside');
    const res = beginCombat(world, {
      enemies: [
        { id: 'foe_bandit', name: 'Bandit', cx: 6, cy: 4 },
        { id: 'foe_wolf', name: 'Wolf', cx: 8, cy: 3 },
      ],
      reason: 'ambush',
    });
    world = res?.world || res || world;
    // Mark exactly one foe defeated (the corpse-swap the scene must show).
    if (world.combat?.enemies?.length) world.combat.enemies[0].defeated = true;
    scenes.push({ id: 'combat_one_defeated', world, nodeId: world.map.currentNodeId, timeOfDay: 'morning',
      note: 'tactical board, one foe down (corpse swap)' });
  }

  return scenes;
}
