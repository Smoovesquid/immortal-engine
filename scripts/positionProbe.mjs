#!/usr/bin/env node

/**
 * MR-ORACLE — the position-truth probe (docs/MAP_REAL.md stage 0).
 *
 * The map must never lie about where the player's body is. This probe walks the
 * canonical transitions headless (engine in-process, LLM OFF — the deterministic
 * parseIntent floor) and, after each one, asserts that the engine's position
 * story is coherent with the fiction's anchor and with the structure topology.
 *
 * Two finding classes (mirroring scripts/playtest.js's report family):
 *
 *   POSITION_DESYNC   — the engine's canonical position disagrees with where the
 *                       fiction just put the body. Wake must be INSIDE the wake
 *                       room. "go outside" must land on the DOORSTEP of the
 *                       structure just left (same node, within a threshold of the
 *                       structure's footprint — NOT re-rolled to a random cell far
 *                       across the node). Journey arrival must sit within the
 *                       destination node's frame.
 *
 *   TOPOLOGY_BREACH   — an interior move landed in a room that is NOT adjacent by
 *                       door to the room it moved from, per the structure topology.
 *
 * ── The layer diagnosis (Deliverable A) ──────────────────────────────────────
 * The runtime CLI prints, after the exit turn, BOTH sides of the position story:
 *   (1) engine truth  — party pos (frame/gx/gy), position.interior, currentNodeId;
 *   (2) view-model    — the player token a marker consumes, from the renderer's
 *                       placeFromWorldNode(world, nodeId).tokens (public/map).
 * and states plainly WHICH layer holds the lie. This is MR-1's targeting data.
 *
 * ── Suite-green discipline ────────────────────────────────────────────────────
 * The exit-case assertion FAILS on today's build BY DESIGN (that is the whole
 * point — the 1 km / 235 ft teleport becomes a machine-printed finding before
 * anyone fixes it). So this ships as an OPTIONAL harness mode
 * (`npm run playtest:position`), NOT wired into `npm run check` until MR-1 lands.
 * The committed tests (U496/U497) stay green: U496 exercises the assertion
 * helpers on synthetic fixtures; U497 runs the real sequence but asserts only the
 * currently-TRUE invariants, with the known-red exit case marked as an expected
 * fail (todo) that MR-1 flips on.
 *
 * Usage:
 *   node scripts/positionProbe.mjs            # human report + layer diagnosis
 *   node scripts/positionProbe.mjs --json     # structured output (for piping)
 *   npm run playtest:position                 # the same, via the package script
 *
 * Determinism: seeded engine, LLM off, zero Math.random, no world mutation
 * outside the engine's own turn path. Two runs → byte-identical findings.
 */

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import {
  nodeGridToRegionCell, nearestNodeToRegionCell, roomOfStructCell,
  pathCrossesWallWithoutDoor, regionWalkCellFree,
  NODE_CELLS, PLACE_WU, CELL_FT
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { normalizeTopology, adjacentRooms } from '../engine/structures/topology.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

// ── The one minimal pack the slice boot needs (mirrors scripts/playtest.js) ──
const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

// ── Finding classes (parallel to scripts/playtest.js BUG_CLASSES) ────────────
export const FINDING_CLASSES = {
  POSITION_DESYNC:  'Engine position disagrees with the fiction anchor after a transition',
  TOPOLOGY_BREACH:  'An interior move landed in a room not adjacent-by-door to its origin',
  GEOMETRY_BREACH:  'A committed struct move crossed a wall without passing through a door (MR-2a)',
  FEATURE_BLOCK:    'A committed outdoor pos landed ON a blocking wild feature — a body inside a tree (MR-3a)',
};

// ── Thresholds (documented inline; all in engine-native units) ───────────────
//
// DOORSTEP_MARGIN_CELLS — how far outside a structure's footprint an honest
// "you step out onto your doorstep" may land. The struct→region unit is
// PLACE_WU cells per floorPlan layout unit (= 4 cells = 20 ft), so one layout
// unit of setback is a generous doorstep. We allow a small multiple of that so a
// door on the far face of a cottage still counts, but NOTHING like the ±50-cell
// (250 ft) node jitter the current exit path uses. 3 × PLACE_WU = 12 cells = 60 ft.
export const DOORSTEP_MARGIN_CELLS = 3 * PLACE_WU; // 12 cells = 60 ft
//
// EXIT_TELEPORT_CELLS — a self-powered exit can NEVER change which node you are
// at, and can never move the body more than a doorstep. If the exit pos sits
// more than this from the exited structure's footprint centre it is a teleport,
// not a doorstep. A cottage footprint is a handful of layout units across; 20
// cells (100 ft) comfortably exceeds any real building half-span + doorstep while
// staying far below the ±50-cell jitter. This is the ">100 place-units away"
// falsifier from the brief, denominated in cells.
export const EXIT_TELEPORT_CELLS = 20; // 20 cells = 100 ft — beyond this, it's a teleport

// ─────────────────────────────────────────────────────────────────────────────
//  Assertion helpers — PURE functions of a world (tested by U496 on fixtures).
//  Each returns an array of findings (possibly empty). No throw, no mutation.
// ─────────────────────────────────────────────────────────────────────────────

/** The player's canonical tactical pos, or null. */
export function playerPos(world) {
  const p = world?.party?.[0];
  return (p && p.pos) || null;
}

/** The structure record for a structureKey, or null. */
function structById(world, key) {
  return (world?.structures?.byId && world.structures.byId[String(key)]) || null;
}

/**
 * Footprint of a structure in REGION cells: the axis-aligned bounding box of its
 * floorPlan rooms, converted layout-units → cells (× PLACE_WU) and offset to the
 * structure's region-cell anchor (its node centre). Returns { cx, cy, halfW, halfH }
 * in region cells, or null if the plan can't be grounded.
 *
 * This is the doorstep reference: "just outside the building" means within a
 * margin of THIS box, at THIS node — the same math the renderer's exteriorAnchor
 * conceptually uses, but in the engine's own cell space.
 */
export function structFootprintRegionCells(world, structureKey) {
  const st = structById(world, structureKey);
  if (!st) return null;
  const node = (world?.map?.nodes || []).find(n => String(n.id) === String(st.nodeId));
  if (!node || !Number.isInteger(node.x) || !Number.isInteger(node.y)) return null;
  const plan = floorPlan(st);
  const rooms = (plan && plan.rooms) || [];
  if (!rooms.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    const rw = (r.w || (r.r ? r.r * 2 : 0)) / 2;
    const rh = (r.h || (r.r ? r.r * 2 : 0)) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  if (!Number.isFinite(minX)) return null;
  // floorPlan layout units → cells. The building's local origin maps to the
  // node's region-cell centre (the frame anchor); layout offsets scale by PLACE_WU.
  const centre = nodeGridToRegionCell(node.x, node.y);
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  return {
    cx: centre.gx + midX * PLACE_WU,
    cy: centre.gy + midY * PLACE_WU,
    halfW: ((maxX - minX) / 2) * PLACE_WU,
    halfH: ((maxY - minY) / 2) * PLACE_WU,
  };
}

/**
 * WAKE anchor: the player must be INSIDE the wake room. Assert pos is a struct
 * frame for the scene's interior structure, and that the cell resolves to a room
 * of that structure (a valid struct cell inside the plan). Returns findings.
 */
export function assertWakeInsideRoom(world, ctx = 'wake') {
  const findings = [];
  const pos = playerPos(world);
  const interior = world?.scene?.interior;
  if (!interior || typeof interior !== 'object') {
    findings.push({ class: 'POSITION_DESYNC', detail: `wake: scene.interior is not set (${JSON.stringify(interior)})`, context: ctx });
    return findings;
  }
  const wantFrame = `struct:${String(interior.structureKey)}`;
  if (!pos || pos.frame !== wantFrame) {
    findings.push({ class: 'POSITION_DESYNC', detail: `wake: pos frame ${JSON.stringify(pos && pos.frame)} != ${wantFrame} (body not inside the wake structure)`, context: ctx });
    return findings;
  }
  // The cell must land in a real room of the structure's plan.
  const st = structById(world, interior.structureKey);
  const plan = st && floorPlan(st);
  const roomAtCell = plan ? roomOfStructCell(plan, pos.gx, pos.gy) : null;
  if (!roomAtCell) {
    findings.push({ class: 'POSITION_DESYNC', detail: `wake: pos cell (${pos.gx},${pos.gy}) resolves to no room in ${interior.structureKey} (body inside walls, not a room)`, context: ctx });
  }
  return findings;
}

/**
 * EXIT anchor: after "go outside" the body must be on the DOORSTEP of the
 * structure it just left — same node, within DOORSTEP_MARGIN_CELLS of that
 * structure's footprint, and NEVER more than EXIT_TELEPORT_CELLS from the
 * footprint centre. `exitedStructureKey` is the structure the player was inside
 * BEFORE the exit (captured pre-turn).
 */
export function assertExitOnDoorstep(world, exitedStructureKey, ctx = 'exit') {
  const findings = [];
  const pos = playerPos(world);
  // After exit, pos must be a region frame (you left the building).
  if (!pos || pos.frame !== 'region') {
    findings.push({ class: 'POSITION_DESYNC', detail: `exit: pos frame ${JSON.stringify(pos && pos.frame)} != 'region' (exit did not return the body to the outdoors)`, context: ctx });
    return findings;
  }
  // Same node: the region cell must still project to the current node.
  const curNode = String(world?.map?.currentNodeId || '');
  const projNode = String(nearestNodeToRegionCell(world?.map, pos.gx, pos.gy) || '');
  if (projNode && curNode && projNode !== curNode) {
    findings.push({ class: 'POSITION_DESYNC', detail: `exit: region cell (${pos.gx},${pos.gy}) projects to node ${projNode}, not current node ${curNode} (exit crossed a node — forbidden by THE MOVEMENT LAW)`, context: ctx });
  }
  // Doorstep: within margin of the exited structure's footprint.
  const fp = structFootprintRegionCells(world, exitedStructureKey);
  if (!fp) {
    findings.push({ class: 'POSITION_DESYNC', detail: `exit: cannot ground footprint of exited structure ${exitedStructureKey} (unable to verify doorstep)`, context: ctx });
    return findings;
  }
  const distToCentre = Math.hypot(pos.gx - fp.cx, pos.gy - fp.cy);
  // distance from the pos to the footprint's edge (0 if inside the box).
  const dx = Math.max(0, Math.abs(pos.gx - fp.cx) - fp.halfW);
  const dy = Math.max(0, Math.abs(pos.gy - fp.cy) - fp.halfH);
  const distToFootprint = Math.hypot(dx, dy);
  if (distToCentre > EXIT_TELEPORT_CELLS) {
    findings.push({
      class: 'POSITION_DESYNC',
      detail: `exit: body is ${distToCentre.toFixed(0)} cells (${(distToCentre * CELL_FT).toFixed(0)} ft) from the exited structure ${exitedStructureKey} centre — a teleport, not a doorstep (threshold ${EXIT_TELEPORT_CELLS} cells)`,
      context: ctx,
    });
  } else if (distToFootprint > DOORSTEP_MARGIN_CELLS) {
    findings.push({
      class: 'POSITION_DESYNC',
      detail: `exit: body is ${distToFootprint.toFixed(0)} cells (${(distToFootprint * CELL_FT).toFixed(0)} ft) beyond the ${exitedStructureKey} footprint — past the doorstep margin (${DOORSTEP_MARGIN_CELLS} cells)`,
      context: ctx,
    });
  }
  return findings;
}

/**
 * REGION-FRAME anchor: the player's region pos must project to the current node
 * (used after a walk, and as the journey-arrival check: the body sits within the
 * destination node's frame). `expectNodeId` defaults to the current node.
 */
export function assertRegionAtNode(world, expectNodeId = null, ctx = 'region') {
  const findings = [];
  const pos = playerPos(world);
  if (!pos || pos.frame !== 'region') {
    // Not outdoors — nothing to assert here (an interior pos is a different check).
    return findings;
  }
  const want = String(expectNodeId || world?.map?.currentNodeId || '');
  const proj = String(nearestNodeToRegionCell(world?.map, pos.gx, pos.gy) || '');
  if (want && proj && want !== proj) {
    findings.push({ class: 'POSITION_DESYNC', detail: `region: cell (${pos.gx},${pos.gy}) projects to node ${proj}, expected ${want}`, context: ctx });
  }
  return findings;
}

/**
 * OUTDOOR FEATURE anchor (MR-3a): a committed outdoor `pos` must never land ON a
 * blocking wild feature (a tree, a boulder) — the body is never inside a tree.
 * regionWalkCellFree is the derivation's own mask predicate, so this asserts the same
 * truth the tactical walk honours: after any transition that leaves the player
 * outdoors (a walk, a journey arrival), the cell they rest on is FREE. A non-region
 * pos is skipped (indoors is a different mask). Pure; no throw, no mutation.
 */
export function assertRegionPosNotBlocked(world, ctx = 'region') {
  const findings = [];
  const pos = playerPos(world);
  if (!pos || pos.frame !== 'region') return findings; // indoors / absent — not this check
  if (!regionWalkCellFree(world, pos.gx, pos.gy)) {
    findings.push({
      class: 'FEATURE_BLOCK',
      detail: `outdoor pos (${pos.gx},${pos.gy}) sits ON a blocking wild feature — a body inside a tree/boulder`,
      context: ctx,
    });
  }
  return findings;
}

/**
 * TOPOLOGY_BREACH: given a structure and a (from → to) interior room move, assert
 * `to` is adjacent-by-door to `from` in the structure's topology. Returns findings.
 */
export function assertInteriorMoveAdjacent(world, structureKey, fromRoomId, toRoomId, ctx = 'interior-move') {
  const findings = [];
  if (!fromRoomId || !toRoomId || String(fromRoomId) === String(toRoomId)) return findings;
  const st = structById(world, structureKey);
  const topo = normalizeTopology(st?.topology);
  if (!topo) {
    findings.push({ class: 'TOPOLOGY_BREACH', detail: `interior move ${fromRoomId}→${toRoomId}: structure ${structureKey} has no topology to verify against`, context: ctx });
    return findings;
  }
  const adj = adjacentRooms(topo, String(fromRoomId)) || [];
  if (!adj.map(String).includes(String(toRoomId))) {
    findings.push({
      class: 'TOPOLOGY_BREACH',
      detail: `interior move ${fromRoomId}→${toRoomId} in ${structureKey}: destination is not adjacent-by-door (neighbours: ${JSON.stringify(adj)})`,
      context: ctx,
    });
  }
  return findings;
}

/**
 * GEOMETRY_BREACH (MR-2a): a committed struct-frame move whose straight cell path
 * crosses a wall segment without passing through a door cell = a body walked
 * through a wall. Given the world, the moved structure, and the (from → to) struct
 * cells the move committed, returns a finding when the path breaches a wall.
 * `fromCell`/`toCell` are { gx, gy } struct cells (the pos before/after the move).
 * A move that stays outdoors (region frame) or in one room is clean. Pure.
 */
export function assertNoGeometryBreach(world, structureKey, fromCell, toCell, ctx = 'geometry') {
  const findings = [];
  if (!fromCell || !toCell) return findings;
  if (fromCell.gx === toCell.gx && fromCell.gy === toCell.gy) return findings;
  const st = structById(world, structureKey);
  if (!st) return findings; // no structure to verify against
  if (pathCrossesWallWithoutDoor(st, fromCell, toCell)) {
    findings.push({
      class: 'GEOMETRY_BREACH',
      detail: `struct move (${fromCell.gx},${fromCell.gy})→(${toCell.gx},${toCell.gy}) in ${structureKey} crossed a wall without a door (walked through a wall)`,
      context: ctx,
    });
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  View-model probe — what a marker would consume (Deliverable A, layer 2).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The player token the renderer would draw, from placeFromWorldNode(world, nodeId).
 * Returns { ux, uy, footprintW } (place layout units) or null. Read-only: this
 * calls a pure public/map module; it never touches engine state.
 */
export function rendererPlayerToken(world, nodeId = null) {
  const id = String(nodeId || world?.map?.currentNodeId || '');
  let place = null;
  try { place = placeFromWorldNode(world, id); } catch { place = null; }
  if (!place) return null;
  const tok = (place.tokens || []).find(t => t && t.type === 'player') || null;
  if (!tok) return { ux: null, uy: null, footprintW: place.footprintW ?? null };
  return { ux: tok.ux, uy: tok.uy, footprintW: place.footprintW ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
//  The transition sequence — boots the slice and drives the canonical turns.
//  Returns { steps, findings, diagnosis }. Deterministic; LLM off (no llmPacket,
//  parseIntent floor). Exported so U497 can drive the same sequence in-process.
// ─────────────────────────────────────────────────────────────────────────────

/** Boot the default slice world exactly as the live front door does. */
export function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({
    seed,
    fate: 0.2,
    campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null },
    mode: 'escape',
  });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

/** Drive one player turn with the LLM OFF (deterministic parseIntent floor). */
function turn(world, text) {
  // No llmPacket → playerMove takes the deterministic path (the LLM-off floor).
  return playerMove(world, PACKS, text);
}

/** A compact snapshot of the position story at a step (both layers). */
function snapshot(world, label) {
  const p = world?.party?.[0];
  return {
    label,
    narration: '', // filled by caller
    engine: {
      pos: (p && p.pos) || null,
      positionInterior: (p && p.position && p.position.interior) || null,
      sceneInterior: world?.scene?.interior
        ? { structureKey: world.scene.interior.structureKey, roomId: world.scene.interior.roomId }
        : null,
      currentNodeId: world?.map?.currentNodeId || null,
    },
    renderer: rendererPlayerToken(world),
  };
}

/**
 * runSequence — the canonical transitions with per-step assertions.
 * wake → look → go outside → re-enter → walk → journey.
 *
 * Each step records a snapshot (both layers) and the findings its assertions
 * produced. Nothing throws; a failing invariant becomes a finding.
 */
export function runSequence({ seed = SLICE_SEED } = {}) {
  const steps = [];
  const findings = [];
  const push = (arr, stepLabel) => { for (const f of arr) findings.push({ ...f, step: stepLabel }); };

  // ── wake ──────────────────────────────────────────────────────────────────
  let world = bootSlice(seed);
  {
    const snap = snapshot(world, 'wake');
    snap.narration = '(boot)';
    push(assertWakeInsideRoom(world, 'wake'), 'wake');
    steps.push(snap);
  }

  // ── look (should not move the body) ─────────────────────────────────────────
  {
    const preInterior = world?.scene?.interior || null;
    const r = turn(world, 'look around');
    world = r.world;
    const snap = snapshot(world, 'look');
    snap.narration = (r.output?.narration || '').slice(0, 120);
    // Still inside the wake room after a pure look.
    push(assertWakeInsideRoom(world, 'look'), 'look');
    // A look must not silently change the interior room (topology safety).
    const postInterior = world?.scene?.interior || null;
    if (preInterior && postInterior && String(preInterior.roomId) !== String(postInterior.roomId)) {
      push(assertInteriorMoveAdjacent(world, postInterior.structureKey, preInterior.roomId, postInterior.roomId, 'look'), 'look');
    }
    steps.push(snap);
  }

  // ── go outside ──────────────────────────────────────────────────────────────
  // Capture the structure we're about to leave, for the doorstep check.
  const exitedStructureKey = world?.scene?.interior?.structureKey
    || world?.party?.[0]?.position?.interior?.structureId
    || null;
  {
    const r = turn(world, 'go outside');
    world = r.world;
    const snap = snapshot(world, 'go-outside');
    snap.narration = (r.output?.narration || '').slice(0, 120);
    snap.exitedStructureKey = exitedStructureKey;
    if (exitedStructureKey) push(assertExitOnDoorstep(world, exitedStructureKey, 'go-outside'), 'go-outside');
    else push([{ class: 'POSITION_DESYNC', detail: 'go-outside: no interior was active before the exit — cannot verify doorstep', context: 'go-outside' }], 'go-outside');
    steps.push(snap);
  }
  const afterExitWorld = world; // retained for the diagnosis

  // ── re-enter ────────────────────────────────────────────────────────────────
  {
    const preRoom = world?.scene?.interior?.roomId || null;
    const r = turn(world, 'go back inside');
    world = r.world;
    const snap = snapshot(world, 're-enter');
    snap.narration = (r.output?.narration || '').slice(0, 120);
    // If we're inside again, the body must be inside a real room.
    if (world?.scene?.interior) push(assertWakeInsideRoom(world, 're-enter'), 're-enter');
    void preRoom;
    steps.push(snap);
  }

  // ── walk (a self-powered tactical move; must stay at the same node) ──────────
  {
    // Step outside first if we ended up indoors, so the walk is on the region sheet.
    if (world?.scene?.interior) { const rr = turn(world, 'go outside'); world = rr.world; }
    const preNode = world?.map?.currentNodeId || null;
    const preInterior = world?.scene?.interior?.roomId || null;
    const r = turn(world, 'walk east');
    world = r.world;
    const snap = snapshot(world, 'walk');
    snap.narration = (r.output?.narration || '').slice(0, 120);
    // A walk can never change the node (THE MOVEMENT LAW).
    const postNode = world?.map?.currentNodeId || null;
    if (preNode && postNode && String(preNode) !== String(postNode)) {
      push([{ class: 'POSITION_DESYNC', detail: `walk: node changed ${preNode}→${postNode} on a self-powered move (THE MOVEMENT LAW forbids node travel from a walk)`, context: 'walk' }], 'walk');
    }
    // If still outdoors, the region cell must project to the current node.
    push(assertRegionAtNode(world, postNode, 'walk'), 'walk');
    // MR-3a — and the cell the walk stopped on must be FREE of any blocking wild
    // feature (a walk stops HONESTLY at a tree, never on it).
    push(assertRegionPosNotBlocked(world, 'walk'), 'walk');
    // If the walk happened to be an interior move, verify adjacency.
    const postInterior = world?.scene?.interior?.roomId || null;
    if (preInterior && postInterior && String(preInterior) !== String(postInterior)) {
      push(assertInteriorMoveAdjacent(world, world.scene.interior.structureKey, preInterior, postInterior, 'walk'), 'walk');
    }
    steps.push(snap);
  }

  // ── interior move (GEOMETRY_BREACH — a room→room move must go through a door) ──
  // Re-enter the wake structure and step to an adjacent room, asserting the
  // committed struct-cell path did not cross a wall without a door. This is the
  // MR-2a falsifier: walls block; doors are the only room↔room crossings.
  {
    if (!world?.scene?.interior) { const rr = turn(world, 'go back inside'); world = rr.world; }
    const structureKey = world?.scene?.interior?.structureKey || null;
    const preCell = playerPos(world);
    const preRoom = world?.scene?.interior?.roomId || null;
    // Move deeper: name a cardinal that has an interior exit, else "go inside/deeper".
    let moved = null;
    for (const cmd of ['go north', 'go east', 'go south', 'go west', 'go deeper']) {
      const r = turn(world, cmd);
      const toRoom = r.world?.scene?.interior?.roomId || null;
      if (toRoom && String(toRoom) !== String(preRoom)) { world = r.world; moved = r; break; }
    }
    const snap = snapshot(world, 'interior-move');
    snap.narration = moved ? (moved.output?.narration || '').slice(0, 120) : '(no adjacent room to step to)';
    const postCell = playerPos(world);
    const postRoom = world?.scene?.interior?.roomId || null;
    if (structureKey && preCell && postCell && preCell.frame === postCell.frame && String(preCell.frame).startsWith('struct:')) {
      push(assertNoGeometryBreach(world, structureKey, preCell, postCell, 'interior-move'), 'interior-move');
    }
    if (preRoom && postRoom && String(preRoom) !== String(postRoom)) {
      push(assertInteriorMoveAdjacent(world, structureKey, preRoom, postRoom, 'interior-move'), 'interior-move');
    }
    steps.push(snap);
  }

  // ── journey (DM-mediated fast travel to a far place; arrival within its frame) ─
  {
    const preNode = world?.map?.currentNodeId || null;
    const r = turn(world, 'travel to the Greenwood');
    world = r.world;
    const snap = snapshot(world, 'journey');
    snap.narration = (r.output?.narration || '').slice(0, 120);
    const postNode = world?.map?.currentNodeId || null;
    snap.journeyMovedNode = String(preNode) !== String(postNode);
    // Whatever node we ended at, if outdoors the body must sit within THAT node's frame.
    push(assertRegionAtNode(world, postNode, 'journey'), 'journey');
    // MR-3a — a journey ARRIVAL materializes a bubble; the drop cell must be FREE
    // (never inside a tree). This is the corridor-clearance falsifier end-to-end: the
    // arrival lands on the road, which the derivation keeps clear.
    push(assertRegionPosNotBlocked(world, 'journey'), 'journey');
    steps.push(snap);
  }

  const diagnosis = diagnoseLayers(afterExitWorld, exitedStructureKey);
  return { steps, findings, diagnosis, seed };
}

/**
 * diagnoseLayers — Deliverable A. Given the post-exit world, decide which layer
 * holds the position lie: the engine's canonical pos, the renderer's view-model,
 * or both. Returns a structured verdict plus a one-sentence plain statement.
 */
export function diagnoseLayers(worldAfterExit, exitedStructureKey) {
  const pos = playerPos(worldAfterExit);
  const fp = structFootprintRegionCells(worldAfterExit, exitedStructureKey);
  const tok = rendererPlayerToken(worldAfterExit);

  // Engine side: is pos a doorstep of the exited structure?
  let engineLies = false, engineWhy = '';
  if (!pos || pos.frame !== 'region') {
    engineLies = true; engineWhy = `pos frame is ${JSON.stringify(pos && pos.frame)}, expected 'region' at a doorstep`;
  } else if (fp) {
    const distToCentre = Math.hypot(pos.gx - fp.cx, pos.gy - fp.cy);
    if (distToCentre > EXIT_TELEPORT_CELLS) {
      engineLies = true;
      engineWhy = `pos is ${distToCentre.toFixed(0)} cells (${(distToCentre * CELL_FT).toFixed(0)} ft) from the exited structure — a teleport, not a doorstep`;
    }
  }

  // Renderer side: does the view-model player token track the exit at all?
  // The renderer places the player token at the lane entry (footprintW-relative),
  // independent of the exit — so it never consumes the engine's exit pos. We
  // report the token position for the record.
  let rendererWhy;
  if (!tok || tok.ux == null) {
    rendererWhy = 'renderer produced no player token';
  } else {
    rendererWhy = `renderer player token at place-units (${Number(tok.ux).toFixed(1)}, ${Number(tok.uy).toFixed(1)}) is derived from the lane entry, not the engine exit pos — placeFromWorldNode does not consume pos, so it cannot reflect a corrected doorstep`;
  }
  const rendererLies = true; // the token is never derived from engine pos in placeFromWorldNode

  let layer, sentence;
  if (engineLies && rendererLies) {
    layer = 'both';
    sentence = 'BOTH layers lie: the engine\'s canonical pos teleports away from the doorstep on exit, and the renderer\'s view-model token is pinned to the lane entry rather than derived from pos.';
  } else if (engineLies) {
    layer = 'engine';
    sentence = 'The ENGINE position is wrong: exit does not land the body on the doorstep of the structure it left.';
  } else if (rendererLies) {
    layer = 'view-model';
    sentence = 'The engine pos is honest, but the RENDERER view-model does not consume it, so the marker cannot reflect the true position.';
  } else {
    layer = 'none';
    sentence = 'Both layers agree: position is honest after exit.';
  }

  return {
    layer,
    sentence,
    engine: { lies: engineLies, why: engineWhy, pos, footprintRegionCells: fp },
    renderer: { lies: rendererLies, why: rendererWhy, token: tok },
    exitedStructureKey,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLI
// ─────────────────────────────────────────────────────────────────────────────

function isMain() {
  try { return import.meta.url === `file://${process.argv[1]}`; }
  catch { return false; }
}

function fmt(v) { return (v == null) ? 'null' : (typeof v === 'number' ? v.toFixed(2) : String(v)); }

function printHuman(result) {
  const line = (s = '') => process.stdout.write(s + '\n');
  line(`\n${'═'.repeat(70)}`);
  line('MR-ORACLE — POSITION-TRUTH PROBE');
  line(`${'═'.repeat(70)}`);
  line(`seed: ${result.seed}   (LLM off — deterministic parseIntent floor)`);
  line(`${'─'.repeat(70)}`);

  // Per-step position story (both layers).
  for (const s of result.steps) {
    line(`\n▸ ${s.label}`);
    if (s.narration) line(`   fiction: ${s.narration}`);
    const e = s.engine;
    line(`   engine : pos=${JSON.stringify(e.pos)}  node=${e.currentNodeId}  interior=${e.sceneInterior ? e.sceneInterior.roomId : 'null'}`);
    const r = s.renderer;
    line(`   marker : ${r ? `token(ux=${fmt(r.ux)}, uy=${fmt(r.uy)})  footprintW=${fmt(r.footprintW)}` : 'none'}`);
  }

  // The layer diagnosis (Deliverable A).
  const d = result.diagnosis;
  line(`\n${'─'.repeat(70)}`);
  line('LAYER DIAGNOSIS (Deliverable A — MR-1 targeting data)');
  line(`${'─'.repeat(70)}`);
  line(`   verdict : the lie is in → ${d.layer.toUpperCase()}`);
  line(`   ${d.sentence}`);
  line(`   engine  : ${d.engine.lies ? 'LIES — ' + d.engine.why : 'honest'}`);
  if (d.engine.footprintRegionCells) {
    const fp = d.engine.footprintRegionCells;
    line(`             exited footprint centre=(${fp.cx.toFixed(0)},${fp.cy.toFixed(0)}) half=(${fp.halfW.toFixed(0)},${fp.halfH.toFixed(0)}) region cells`);
  }
  line(`   renderer: ${d.renderer.lies ? 'LIES — ' + d.renderer.why : 'honest'}`);

  // Findings.
  line(`\n${'─'.repeat(70)}`);
  if (result.findings.length === 0) {
    line('  ✓ No position findings.');
  } else {
    line(`  ${result.findings.length} finding(s):\n`);
    const byClass = {};
    for (const f of result.findings) (byClass[f.class] = byClass[f.class] || []).push(f);
    for (const [cls, fs] of Object.entries(byClass)) {
      line(`  [${cls}] — ${FINDING_CLASSES[cls] || 'Unknown'}`);
      for (const f of fs) line(`    • (${f.step}) ${f.detail}`);
      line('');
    }
  }
  line(`${'═'.repeat(70)}\n`);
}

if (isMain()) {
  const asJson = process.argv.includes('--json');
  const result = runSequence();
  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    printHuman(result);
  }
  // Exit code communicates RED/GREEN so the mode is legible in a shell, but this
  // script is intentionally NOT wired into `npm run check` until MR-1 lands.
  process.exit(result.findings.length > 0 ? 1 : 0);
}
