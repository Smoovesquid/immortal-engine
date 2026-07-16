// DEATH-TRUTH-1d — the outdoor settlement SCATTER, engine-owned (docs/MAP_REAL.md).
//
// PEOPLE BECOME PLACES. Historically the outdoor-people scatter — where each
// villager stands along the road — lived ONLY in the renderer
// (public/map/placeFromNode.js). The engine placed the SAME people somewhere else
// entirely (engine/map/spatial/tacticalPos.placeNearNode: a ±250 m box of jitter,
// blind to the drawn layout), so a person's canonical board cell and the spot the
// map drew them at were decorrelated — a canon-true corpse could draw ~230 m
// outside its own village. This module promotes the renderer's scatter to engine
// truth: it computes, for a settlement node, the place-unit position of every
// outdoor person the sheet draws, so BOTH the engine (which canonises the cell,
// via placementForWorld → placeUnitToRegionCell) and the renderer (which draws it,
// via regionCellToPlaceUnit) read ONE geometry. This is the MAP-EGRESS-1 move
// (building scatter → engine truth) applied one level up: the people scatter.
//
// PURITY / BYTE-STABILITY (the prime constraint, mirrored from settlementLayout.js):
// the emitted ux/uy for every person on every seed is IDENTICAL to the
// pre-extraction renderer output. The `shown` set (outdoor occupants, alive,
// friendly ≤12 then hostile ≤2), the rng draw order (the settlement rng continued
// from settlementLayout, exactly where the renderer picked it up), and the
// pushClearOfBuildings escape are preserved EXACTLY. Proven byte-for-byte against
// the old renderer scatter across 20 seeds × 2 frames (U714). rng.js is the only
// randomness. This module reads world state and returns plain values; it never
// mutates and is never serialized or hashed.

import { settlementLayout } from './settlementLayout.js';
import { outdoorOccupants } from '../structures/roomOccupancy.js';
import { remainsAtNode } from '../combat/deathFact.js';

// TT-OCC — an outdoor token never lands inside a building's footprint (+ this
// margin). Moved verbatim from placeFromNode.js (its historical home); the renderer
// now re-exports it from here so there is ONE constant.
export const NPC_MARGIN_LU = 1.2;

// Is (px,py) inside any building rect, inflated by `margin`? Pure.
export function insideAnyRect(px, py, rects, margin) {
  for (const r of rects) {
    if (px >= r.minX - margin && px <= r.maxX + margin && py >= r.minY - margin && py <= r.maxY + margin) return true;
  }
  return false;
}

// Deterministically relocate (x,y) to the nearest point clear of every building
// rect (+margin) — a fixed ring/angle SPIRAL SEARCH outward from the original
// point (NOT a repulsion vector-field, which oscillates/settles into equilibria in
// tight villages). Walking outward ring by ring and taking the FIRST clear point is
// a monotonic search — no equilibrium is possible. Deterministic and pure: same
// (x,y,rects,margin) always yields the same escape point, no rng, no world reads.
// (Moved verbatim from placeFromNode.js; the full rationale lived there — see git
// history. `angleSteps` scales with ring number so arc-length between samples stays
// bounded; `maxRadius`/`ringStep` cap the search, never hit off an open settlement.)
export function pushClearOfBuildings(x, y, rects, margin, maxRadius = 200, ringStep = 0.5, angleSteps = 24) {
  if (!insideAnyRect(x, y, rects, margin)) return { x, y }; // already clear — most calls, zero work
  for (let ring = 1; ring * ringStep <= maxRadius; ring++) {
    const r = ring * ringStep;
    const steps = Math.min(angleSteps * ring, 720);
    for (let a = 0; a < steps; a++) {
      const theta = (a / steps) * Math.PI * 2;
      const px = x + Math.cos(theta) * r, py = y + Math.sin(theta) * r;
      if (!insideAnyRect(px, py, rects, margin)) return { x: px, y: py };
    }
  }
  return { x, y }; // exhausted maxRadius — never hit in practice; returns the original rather than fabricating one
}

/**
 * laneEntryPlaceUnit(layout) -> { ux, uy }
 * The player's outdoor anchor at a settlement: the lane's west end + 1.5, on the
 * road. This is the exact geometry placeFromNode.js draws as the player's no-pos
 * fallback (`fallbackPlayerUnit`); DEATH-TRUTH-1d promotes it to the player's
 * CANONICAL outdoor position at a settlement (the keystone: the combat board's
 * world origin is pinned to the player's canonical pos, so grounding the player
 * here makes every death fact sheet-true). Pure.
 */
export function laneEntryPlaceUnit(layout) {
  const laneX = layout?.terrain?.paths?.[0]?.pts?.[0]?.[0] ?? 0;
  const roadY = typeof layout?.roadY === 'function' ? layout.roadY : () => 0;
  return { ux: laneX + 1.5, uy: roadY(laneX + 1.5) };
}

/**
 * shownOutdoorPeople(world, nodeId) -> NPC[]
 * The ordered set of outdoor people the sheet actually draws at nodeId: outdoor
 * occupants (line-of-sight, current node only), minus located dead (they leave the
 * living feed and come back as pinned corpses), friendly first (≤12) then hostile
 * (≤2). This is the SAME slice placeFromNode.js draws — kept here so the engine's
 * canon and the renderer's ink share ONE list. Pure.
 */
export function shownOutdoorPeople(world, nodeId) {
  const id = String(nodeId);
  const isCurrent = id === String(world?.map?.currentNodeId || '');
  if (!isCurrent) return [];
  const outdoorNpcs = outdoorOccupants(world);
  if (!outdoorNpcs.length) return [];
  const remains = remainsAtNode(world, id);
  const locatedDeadIds = new Set(remains.filter(r => r.sourceNpcId && r.loc).map(r => String(r.sourceNpcId)));
  const outdoorAlive = outdoorNpcs.filter(n => !locatedDeadIds.has(String(n?.id || '')));
  return outdoorAlive.filter(n => n && !n.hostile).slice(0, 12)
    .concat(outdoorAlive.filter(n => n && n.hostile).slice(0, 2));
}

/**
 * settlementScatterPlaceUnits(world, nodeId[, layout]) -> Map<entityId, {ux, uy}>
 * The place-unit position of every SHOWN outdoor person at a settlement node,
 * byte-identical to the old renderer scatter (placeFromNode.js). The engine
 * canonises each into a region cell (placementForWorld); the renderer draws each
 * back from that cell (regionCellToPlaceUnit) — one geometry, two consumers.
 *
 * Pass `layout` when the caller already has it (avoids a second settlementLayout
 * call and, more importantly, guarantees the SAME rng state is consumed — the
 * scatter continues the settlement rng exactly where settlementLayout left off).
 * Pure; empty Map when the node has no drawable settlement or no outdoor people.
 */
export function settlementScatterPlaceUnits(world, nodeId, layout) {
  const id = String(nodeId);
  const lay = layout || settlementLayout(world, id);
  const out = new Map();
  if (!lay) return out;
  const { placed, roadY, rng, extent } = lay;
  const { minX, maxX } = extent;
  const shown = shownOutdoorPeople(world, id);
  shown.forEach((n, i) => {
    const ax0 = minX + ((i + 1) / (shown.length + 1)) * (maxX - minX) + (rng.nextFloat() - 0.5) * 2;
    const ay0 = roadY(ax0) + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.8 + rng.nextFloat() * 1.4);
    const { x: ax, y: ay } = pushClearOfBuildings(ax0, ay0, placed, NPC_MARGIN_LU);
    const tokenId = String(n.id || ('npc' + i));
    out.set(tokenId, { ux: ax, uy: ay });
  });
  return out;
}
