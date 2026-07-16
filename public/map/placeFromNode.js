/**
 * placeFromNode — the bridge from the engine's world to a walkable place.
 *
 * Turns an overworld node into the seed/type/tier for generatePlace, so the live
 * game can render the node as a walkable fog-of-war place instead of an abstract
 * dot. Tier is GEOGRAPHIC: the further a node sits from your home, the more
 * dangerous (and rewarding) — your "islands of safety, danger at the edges" rule,
 * deterministic so the same node always generates the same place.
 *
 * The app shell calls renderPlace(placeModelFromNode(world, nodeId)); wiring that
 * into v1.js is the one step that needs the running game to verify.
 */

import { generatePlace } from './generatePlace.js';
import { getPlan } from './plans/index.js';
import { buildingTypeFor } from '../../engine/structures/roomDetail.js';
import { outdoorOccupants } from '../../engine/structures/roomOccupancy.js';
// MAP-EGRESS-1 — the P-81b organic scatter now lives in the ENGINE
// (engine/world/settlementLayout.js), the single source of every building's DRAWN
// position, so the egress doorstep (tacticalPos.doorThresholdCells) lands on the
// building this file draws. This module consumes that layout and adds only the
// render-plan furniture + the outdoor-token layer.
import { settlementLayout } from '../../engine/world/settlementLayout.js';
// MR-1b — the player token reads the engine's canonical tactical `pos` instead of
// a fixed lane-entry seed. floorPlan is the REAL engine room graph for a
// struct-frame pos (NOT the catalog `getPlan()` plan this module draws buildings
// from — see the note above playerTokenPlaceUnit below); structCellToPlaceUnit is
// worldSpace.js's frame transform, factored out of structCellToWu so this
// place-unit-space renderer can consume the SAME pinned cell math oneMap.js's
// wu-space renderer already uses (one sizing truth, two output spaces).
import { floorPlan } from '../../engine/structures/floorPlan.js';
import { structCellToPlaceUnit } from './worldSpace.js';
// OBJ-HOLD-6A (release correction) — the LIVE sheet's flattened furniture is the
// ONE identity-keyed projection: held pieces leave the floor, placed pieces ink at
// their live cell, and every authored item carries its canonical objectId through
// to the 2D ink AND the 3D props (drawModel.placedTokenModel reads this array).
import { authoredObjectId } from '../../engine/objects/identity.js';
import { resolvedObjectPlacement } from '../../engine/objects/placement.js';
import { PLACE_WU as TAC_CELLS_PER_LAYOUT_UNIT } from '../../engine/map/spatial/tacticalPos.js';
// INK-WRECK-1 — the ONE live destroyed-state authority (the same Set cover and
// walk-blocking read). THIS sheet is the map the player actually looks at, so this
// is where the ink truth has to land.
import { destroyedAuthoredPieceIds } from '../../engine/structures/authoredFurniture.js';
// CORPSE-TRUTH-1b — the one canonical "what bodies lie here" read (deathFact.js).
import { remainsAtNode } from '../../engine/combat/deathFact.js';

const TIER_STEP = 5; // grid-distance per danger rung

// DEC-1 — settlement building name → true footprint now lives in ONE place:
// engine/structures/settlementFootprint.js (syntheticPlanForBuilding). The old
// name→catalog-plan map here sized decorative buildings by an authored ROOM bbox
// (a well became a whole cottage); it is retired.
//
// PLAN-SPLIT-1 — a REAL structure (has a world.structures record) now resolves
// its plan from the ENGINE's own floorPlan(st) (see engineBackedPlan below), not
// getPlan(buildingType)'s catalog art — the catalog plan survives ONLY as the
// no-topology fallback (a structure with no rooms yet, or a lookup failure).
// This is the actual fix for the wake-token-off-its-building bug (the oracle's
// PROJECTION_EQUALITY red): the building WALLS this file draws (handDrawnPlace.js
// reads b.plan.rooms directly) and the player TOKEN (playerTokenPlaceUnit, above)
// must come from the SAME plan, or the token measurably sits off its own ink.

// engineBackedPlan(st) -> a plan-shaped object `{ rooms, footprint, furniture }`
// wrapping floorPlan(st) for this module's building loop, or null if the
// structure has no drawable topology (the caller falls back to the catalog).
// `rooms` is floorPlan's own array — already `{ id, cx, cy, w, h, ... }`, the
// EXACT shape planExtent()/handDrawnPlace.js expect from a catalog plan's rooms
// (no `.r` radius field; engine/structures/floorPlan.js), so no reshape there.
// `furniture` is synthesized (flattenRoomFurniture below): floorPlan's rooms
// carry per-room, NORMALIZED (fx/fy in [0,1] of the room box) furniture — a
// different shape/frame than the catalog's absolute ABSOLUTE-anchor
// `{type,ux,uy,uw,uh}` array (TT-DRAW-2's catalogPlanBoundsInPlaceUnits /
// fitCatalogPointToRect and oneMap.js's outdoor-silhouette furniture loop read
// exactly that catalog shape) — flattening to the SAME absolute shape keeps
// those call sites working unchanged, now sized/positioned from the real room
// graph instead of an unrelated catalog cottage's fixtures.
function flattenRoomFurniture(rooms, world, st) {
  const out = [];
  const structureId = st?.id;
  // INK-WRECK-1 — the destroyed set, resolved ONCE per plan (it walks the node's
  // furniture). Keyed by plan pieceId, exactly as cover and blocking consume it.
  const dead = (world && st) ? destroyedAuthoredPieceIds(world, st) : null;
  for (const r of (rooms || [])) {
    for (const f of (r.furniture || [])) {
      // A circular piece (barrel, pillar, sarcophagus, …) carries `r` (radius)
      // instead of w/h — roomDetail.js's FURN table, same `.r ? .r*2 : w/h`
      // convention this file's own planExtent()/generatePlace already use for
      // room shapes. Without this, every circular item flattens to a w=0,h=0
      // point (still a valid, if degenerate, AABB — but not its true footprint).
      const w = Number(f.w) || (Number(f.r) ? Number(f.r) * 2 : 0);
      const h = Number(f.h) || (Number(f.r) ? Number(f.r) * 2 : 0);
      const fx = Number.isFinite(f.fx) ? f.fx : 0.5, fy = Number.isFinite(f.fy) ? f.fy : 0.5;
      let cx = r.cx - r.w / 2 + fx * r.w, cy = r.cy - r.h / 2 + fy * r.h;
      // OBJ-HOLD-6A (release correction) — an AUTHORED item resolves its LIVE
      // placement by identity: held → in someone's arms, no floor ink at all;
      // placed → inked at its live tactical cell (cells → the plan's own layout
      // units, the SAME conversion the engine render join uses — U696-I); base →
      // byte-identical to the static flatten. Non-authored items are untouched.
      let objectId = null;
      let isDead = false;
      if (f && f.authored === 1 && f.id != null && structureId) {
        // INK-WRECK-1 → OBJ-RUBBLE-1 — a DESTROYED piece draws as RUBBLE at the spot
        // it stood, never as its intact glyph and never as nothing. Same authority
        // (destroyedAuthoredPieceIds — the Set cover and blocking subtract), the
        // entry RE-TYPED in place. Inside the authored branch by construction, so
        // non-authored plan ink stays byte-identical.
        isDead = !!(dead && dead.has(String(f.id)));
        objectId = authoredObjectId(String(structureId), String(f.id));
        const ov = world ? resolvedObjectPlacement(world, objectId) : null;
        if (ov && ov.status === 'held') continue;
        if (ov && ov.status === 'placed' && ov.cell) {
          cx = ov.cell.x / TAC_CELLS_PER_LAYOUT_UNIT;
          cy = ov.cell.y / TAC_CELLS_PER_LAYOUT_UNIT;
        }
      }
      out.push({ type: isDead ? 'rubble' : String(f.kind || f.type || 'prop'), ux: cx - w / 2, uy: cy - h / 2, uw: w, uh: h, ...(objectId ? { objectId } : {}) });
    }
  }
  return out;
}

function engineBackedPlan(st, world) {
  let fp; try { fp = floorPlan(st); } catch { return null; }
  if (!fp || !Array.isArray(fp.rooms) || !fp.rooms.length) return null;
  return { rooms: fp.rooms, doors: fp.doors || [], footprint: fp.footprint, material: fp.shell, furniture: flattenRoomFurniture(fp.rooms, world, st) };
}

// ── TT-OCC THE RULE — no outdoor mini ever stands inside ink that isn't theirs ──
// Tim's ruling (2026-07-05, docs/MAP_REAL.md): floorplans stay ALWAYS-OPEN
// (roofless DM-screen look, locked), so a strict placement margin is the ONLY
// defense against a figure reading as "in the bedroom" when the engine says
// they're outdoors. NPC_MARGIN_LU is derived from the two things that actually
// eat into the visual gap between a token's coordinate and "clearly outside the
// wall": the wall stroke itself, and the token's own drawn footprint — not
// imported (drawModel.js imports FROM this file; importing back would cycle),
// but pinned to the same numbers so a future taste pass on either stays honest:
//   wall stroke:  INK_PARAMS.wallWeight.fortified = 3.4 world-units (widest of
//                 the five shells) ÷ PLACE_WU (4 wu/lu, worldSpace.js) = 0.85 lu
//   token base:   INK_PARAMS.tokenBaseRadiusWu = 0.34*PLACE_WU wu ÷ PLACE_WU
//                 = 0.34 lu (a token isn't a point; its own ring must clear too)
// Sum, rounded up a hair for a real setback rather than a graze: 1.2 lu. This is
// the exact class of miss that let Galen's 0.72-lu-from-cottage scatter point
// (aldermere boot, node n0_2935788122) pass a bare rect-edge check while still
// reading on screen as standing inside the wake cottage.
export const NPC_MARGIN_LU = 1.2;

// True if point (px,py) falls inside any rect in `rects`, each grown by `margin`
// on every side. Rects are the SAME `placed` AABBs the building-scatter loop
// above already computed (post ROADS-1 projection) — one footprint truth, no
// re-derivation. Exported (with pushClearOfBuildings below) so tests can drive
// the exclusion directly against synthetic tight-packed geometry, not just
// indirectly through a full settlement boot.
export function insideAnyRect(px, py, rects, margin) {
  for (const r of rects) {
    if (px >= r.minX - margin && px <= r.maxX + margin && py >= r.minY - margin && py <= r.maxY + margin) return true;
  }
  return false;
}

// Deterministically relocate (x,y) to the nearest point clear of every
// building rect (+margin) — a fixed ring/angle SPIRAL SEARCH outward from the
// original point, not a repulsion vector-field.
//
// Why a spiral and not "push away from the nearest/summed rect": a first draft
// tried exactly that (push directly away from whichever rect's centre — or
// nearest edge, or the summed away-vector of every claiming rect — was
// nearest), mirroring ROADS-1's buildings-vs-road projection. It broke on a
// realistic tight-packed village (several buildings only ~1-2 lu apart,
// margin-inflated zones overlapping in the gap between them): the point
// oscillates between two neighbours' opposing pulls, or settles into a stable
// EQUILIBRIUM where multiple rects' push vectors exactly cancel — a known
// failure mode of potential-field navigation, not a rare edge case (an
// adversarial-fixture sweep hit it on ~40-75% of trials). A vector field can
// get stuck; an exhaustive search cannot. Walking outward ring by ring and
// taking the FIRST clear point found is instead a monotonic search — no
// equilibrium is possible because nothing is being followed, every candidate
// point is independently tested. Verified against the same adversarial
// checkerboard (0/300 failures, vs. the vector approaches' 40-75%) plus a
// realistic 2-lu-gap grid and a "deep inside one giant building" case.
//
// Deterministic and pure: same (x,y,rects,margin) always yields the same
// escape point, no rng, nothing here reads world state. `angleSteps` scales
// with ring number so the arc-length between samples stays roughly bounded as
// the radius grows (a fixed angle count would under-sample a narrow clear
// wedge far out); `maxRadius`/`ringStep` cap the search — the country is
// unbounded off any settlement, so a clear point always exists well within
// range, and the cap only protects against a pathological caller.
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
  return { x, y }; // exhausted maxRadius — never hit in practice (see module doc); returns the original point rather than fabricating one
}


// MR-1b — the player token's place-unit position, read from the engine's
// canonical tactical `pos` (docs/POSITION_AS_CANON.md) instead of a fixed seed.
//
//   pos.frame === 'struct:<id>'  → project the cell into the SAME building this
//     village drew, via the frame transform (worldSpace.js's structCellToPlaceUnit)
//     — but grounded against the REAL engine plan (floorPlan(structure)), not the
//     catalog `getPlan()` plan the building entry carries for drawing. This mirrors
//     oneMap.js's resolveEntityWuFromWorld exactly (its plan is likewise re-derived
//     from world.structures, never the caller's drawn-plan reference) — one
//     projection contract, two output spaces (wu there, place-units here).
//   pos.frame === 'region'       → outdoors at this node. This module's village
//     layout is an independently-seeded micro-scatter (its own road spine, its own
//     local origin) with NO shared coordinate lattice against the engine's region
//     cells (unlike oneMap.js's wu space, which anchors everything to nodeToWu) —
//     there is no canonical sub-node point to project a region cell onto here, so
//     outdoors resolves to the fallback (documented, not a bug: "somewhere outside,
//     near the village entrance" is the honest resolution this layout can offer).
//   no pos / ungroundable pos    → the fallback (legacy lane-entry seed).
//
// Precedence vs. TT-OCC's no-foreign-ink rule (NPC_MARGIN_LU, above): the player
// is exempt from that exclusion by design (see the comment at the token push
// below) — but even so, a struct-frame projection can NEVER land in a room whose
// ink isn't the engine's own claim: the pos invariant (engine/map/spatial/
// tacticalPos.js's isTacticalPosConsistent) already guarantees
// roomOfStructCell(pos) === scene.interior.roomId BEFORE this function ever runs,
// and structCellToPlaceUnit performs a pure linear rescale of that SAME cell —
// it does not re-derive room ownership, so it cannot disagree with the engine's
// own room claim. The DOOR/doorstep cell (MR-1a's egress fix) is by construction
// the room the engine says you're in, so it always wins; there is no live case
// where this projection and the engine's room claim diverge.
//
// Pure: no mutation, no rng. Never throws — any lookup failure degrades to the
// fallback, matching every other projector in this file/worldSpace.js.
export function playerTokenPlaceUnit(world, buildings, fallback) {
  const pos = world?.party?.[0]?.pos;
  if (!pos || typeof pos !== 'object' || !Number.isInteger(pos.gx) || !Number.isInteger(pos.gy)) {
    return fallback;
  }
  const m = /^struct:(.+)$/.exec(String(pos.frame || ''));
  if (!m) return fallback; // region frame (or an unrecognized frame) — see note above
  const structId = m[1];
  const bld = (buildings || []).find(b => String(b?.structureKey || '') === structId);
  if (!bld) return fallback; // the pos's building isn't drawn in this village (e.g. a far node)
  const st = world?.structures?.byId?.[structId] || null;
  if (!st) return fallback;
  let plan; try { plan = floorPlan(st); } catch { return fallback; }
  if (!plan || !plan.footprint) return fallback;
  const u = structCellToPlaceUnit({ ox: bld.ox, oy: bld.oy }, plan, pos.gx, pos.gy);
  if (!Number.isFinite(u?.ux) || !Number.isFinite(u?.uy)) return fallback;
  return u;
}

// placeFromWorldNode — build a walkable place from the node's ACTUAL contents:
// the real structures (your home cottage), the settlement's buildings, and its
// people. So the village you see IS the village that's there. Deterministic.
//
// MAP-EGRESS-1 — the building SCATTER (every building's placed ox/oy, the road, the
// well, the settlement frame) now comes from engine/world/settlementLayout.js, the
// SINGLE source both this renderer and the egress doorstep read, so "go outside" lands
// the body on the door THIS file draws. This function adds only (a) the richer draw
// plan for a real structure (engineBackedPlan — the SAME room graph settlementLayout
// scattered, plus flattened furniture; identical extent, so no building moves), and
// (b) the outdoor-token layer, which continues the settlement rng from where the
// layout left off (returned live) so the NPC scatter stays byte-identical.
export function placeFromWorldNode(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;

  // MAP-OCC-1: the outdoor token set is LINE OF SIGHT, never the whole settlement roster.
  // outdoorOccupants(world) is the same occupancy model the DM's presence logic reads
  // (engine/structures/roomOccupancy.js) — it derives who is truly out in the open from
  // world.map.currentNodeId, so it's only valid for the node the player is actually AT.
  // For any other node (the overworld map draws every settlement's layout at once via
  // oneMap.js), we cannot correctly ask "who's outdoors there" without touching the
  // engine's occupancy module for an arbitrary node — so those draw no roster-scatter
  // NPCs at all (never-wrong-by-omission beats fabricating people who aren't there).
  const isCurrentNode = id === String((world && world.map && world.map.currentNodeId) || '');
  const outdoorNpcs = isCurrentNode ? outdoorOccupants(world) : [];

  // The engine's canonical settlement layout (the P-81b scatter). Null when the node
  // has no drawable settlement — then we fall through to a procedural place, exactly
  // as before (the old `if (!entries.length) return generatePlace(...)` branch).
  const layout = settlementLayout(world, id);
  if (!layout) return generatePlace({ seed, nodeType: nodeTypeFor(node), tier: tierForNode(world, node) });

  // The DRAWN buildings: the engine's placed ox/oy, with the RENDER plan attached. A
  // real structure draws from engineBackedPlan(st) (its floorPlan room graph + flattened
  // furniture) — the SAME rooms settlementLayout used for the scatter, so the extent (and
  // therefore ox/oy) is unchanged; only the furniture the sheet inks is added. A
  // decorative building keeps the synthetic plan the layout already carries.
  const buildings = layout.buildings.map(b => {
    const structId = String(b.structureKey || '');
    if (structId) {
      const st = world?.structures?.byId?.[structId] || null;
      // PLAN-SPLIT-1 / U562-B — a real structure DRAWS from its engineBackedPlan (the
      // floorPlan room graph the engine layout scattered, + flattened furniture; same
      // extent, so no building moves). When that structure has NO drawable engine
      // topology (floorPlan empty — a not-yet-generated or player-built shell), it still
      // draws SOMETHING real: the getPlan(type) CATALOG plan, the ONLY case the catalog
      // may drive a real structure's ink (the engine layout, which can't import the
      // public catalog, scattered it by a synthetic footprint — a non-live case; no live
      // world has a topology-less structure, so no drawn village moves).
      const rich = st ? engineBackedPlan(st, world) : null;
      if (rich) return { ...b, plan: rich };
      if (st) {
        const type = st.buildingType || buildingTypeFor(String(st.id || ''));
        const catalog = getPlan(type) || getPlan('cottage');
        if (catalog && catalog.rooms) return { ...b, plan: catalog };
      }
    }
    return b;
  });

  const { terrain, placed, roadY, rng, extent, footprintW } = layout;
  const { minX, maxX } = extent;
  const tokens = [];

  // MR-1b — the player token reads engine position truth when it's available;
  // the lane-entry seed (x0+1.5, roadY(...)) survives ONLY as the no-pos legacy
  // fallback (a fresh/legacy world with no party[0].pos, or a pos this module
  // can't ground — e.g. a structure not drawn in this village's buildings[]).
  // The player token is exempt from the TT-OCC exclusion below: the player may
  // legitimately be indoors (wake = your bed) — their token comes from position
  // truth (or the fallback), never routed through the outdoor-scatter building check.
  const laneX = terrain.paths?.[0]?.pts?.[0]?.[0] ?? 0; // the road's west end (== old x0)
  const fallbackPlayerUnit = { ux: laneX + 1.5, uy: roadY(laneX + 1.5) };
  tokens.push({ type: 'player', ...playerTokenPlaceUnit(world, buildings, fallbackPlayerUnit) });
  const shown = outdoorNpcs.filter(n => n && !n.hostile).slice(0, 12).concat(outdoorNpcs.filter(n => n && n.hostile).slice(0, 2).map(n => ({ ...n, name: '?' })));
  // CORPSE-TRUTH-1b — the ONE canonical corpse read flags dead NPCs' tokens.
  // Flagging, never filtering: the token rides the SAME iteration and the SAME
  // rng draws (filtering would shift every neighbour's seeded scatter), and the
  // draw side renders a fallen mark instead of a living figure — a dead hostile
  // must never keep haunting the map as a masked live ambusher.
  const deadNpcIds = new Set(remainsAtNode(world, String(node.id || '')).filter(r => r.sourceNpcId).map(r => String(r.sourceNpcId)));
  shown.forEach((n, i) => {
    const ax0 = minX + ((i + 1) / (shown.length + 1)) * (maxX - minX) + (rng.nextFloat() - 0.5) * 2;
    const ay0 = roadY(ax0) + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.8 + rng.nextFloat() * 1.4);
    // TT-OCC — outdoor scatter must never land inside a building's footprint
    // (+ NPC_MARGIN_LU). `placed` is the SAME building AABB set the engine scatter
    // resolved (post ROADS-1 projection); hostile-masked tokens (name '?') go through
    // this identical path — no exemption, an ambusher is still outdoors until the
    // fiction says otherwise.
    const { x: ax, y: ay } = pushClearOfBuildings(ax0, ay0, placed, NPC_MARGIN_LU);
    const tokenId = n.id || ('npc' + i);
    tokens.push({ type: 'npc', ux: ax, uy: ay, label: String(n.name || 'V').trim().charAt(0).toUpperCase() || 'V', npc: { id: tokenId, name: n.name, role: n.role }, ...(deadNpcIds.has(String(tokenId)) ? { dead: 1 } : {}) });
  });

  return { nodeType: node.nodeType || 'settlement', tier: tierForNode(world, node), seed, terrain, buildings, tokens, footprintW };
}

function nodeTypeFor(node) {
  const st = node && node.settlement;
  if (st) {
    const pop = Number(st.population || 0);
    const npcs = Array.isArray(st.npcs) ? st.npcs.length : 0;
    if (pop >= 300 || npcs >= 6) return 'town';
    return 'hamlet';
  }
  const t = String(node && node.nodeType || '').toLowerCase();
  if (t.includes('ruin')) return 'ruin';
  if (t.includes('keep') || t.includes('fort')) return 'keep';
  return 'wild';
}

export function tierForNode(world, node) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const homeId = String((world && world.meta && world.meta.homeNodeId) || (world && world.map && world.map.currentNodeId) || '');
  const home = nodes.find(n => String(n.id) === homeId);
  if (!home || !Number.isFinite(node.x) || !Number.isFinite(home.x)) return 1;
  const d = Math.abs(node.x - home.x) + Math.abs(node.y - home.y);
  return Math.max(1, Math.min(4, 1 + Math.floor(d / TIER_STEP)));
}

// placeModelFromNode(world, nodeId) -> a generatePlace() model for that node, or null.
export function placeModelFromNode(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;
  const nodeType = nodeTypeFor(node);
  const tier = tierForNode(world, node);
  return generatePlace({ seed, nodeType, tier });
}
