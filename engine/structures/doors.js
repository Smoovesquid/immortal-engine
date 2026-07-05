// MR-2a — DOORS ARE CANON (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a).
//
// Tim's ruling: drawn architecture is functionally real — "doors = FULL CRUNCH".
// A structure's floorPlan (floorPlan.js) draws doorways as INK: {x,y,dir,a,b}
// gaps in shared walls, plus an implicit front door the entry room fronts on.
// That ink had no state — nothing recorded whether a door was open or barred, and
// nothing stopped movement through a wall. This module gives every door a CANON
// record with a state the engine adjudicates from: {open|shut|barred|locked}.
//
// What lives here (all PURE — no world mutation, rng.js only for the seeded
// default derivation; the module returns plain values, state.js/effectsCore.js
// write them):
//   • the door-state ENUM + the canonical door-record shape;
//   • deriveDoors(structure): the deterministic door LIST for a structure — every
//     room-to-room door of the floorPlan PLUS exactly one EXTERIOR (front) door,
//     with seeded default states. This is what ensureWorld backfills onto a
//     structure that carries no stored doors[] (legacy saves, procgen structures);
//   • normalizeDoors(...): canonicalize a stored doors[] (validate the enum, drop
//     doors whose rooms the plan lacks, ensure exactly one exterior door), so a
//     round-tripped save is byte-identical and the invariants hold by construction;
//   • doorCells(world, structId, door): the inside/outside CELLS a door maps,
//     DERIVED from the plan (POSITION_AS_CANON §1 — geometry is the single source;
//     cells are a projection, never stored);
//   • crossable(state): whether a door in a given state lets a body pass.
//
// The exterior door RECORD is what MR-1a asked for: MR-1a derived the doorstep from
// the entry room's outer wall because "there is NO explicit exterior door record"
// (tacticalPos.doorThresholdCells' comment). This packet mints that record so the
// front door is canon; doorThresholdCells now consumes the RECORD, keeping the
// entry-room derivation only as the no-record legacy fallback.

import { seedFromString, makeRng } from '../rng.js';
import { floorPlan } from './floorPlan.js';
import { isNight } from '../dayNight.js';
import {
  roomRectCells,
  doorThresholdCells,
} from '../map/spatial/tacticalPos.js';

// ── The door-state enum (canon) ──────────────────────────────────────────────
// open   — stands open; a body passes freely.
// shut   — closed but unsecured; opening it is part of the move (no roll).
// barred — held from ONE side (a bar/brace); from the barred side it blocks and
//          must be forced; from the far side you simply lift the bar and pass.
// locked — secured both ways; must be picked or forced to cross from either side.
export const DOOR_STATES = Object.freeze(['open', 'shut', 'barred', 'locked']);
const DOOR_STATE_SET = new Set(DOOR_STATES);

export function isDoorState(s) {
  return DOOR_STATE_SET.has(String(s));
}

// A door a body can walk through without any action. `shut` is deliberately NOT
// crossable-for-free here — the MOVE PATH opens a shut door as a narrated part of
// the move (see the enforcement seam), but the raw walkable-mask derivation treats
// only genuinely-passable states as crossings. barred/locked never cross for free.
export function crossable(state) {
  return String(state) === 'open';
}

// A door that needs a real resolution (a force/pick roll) to cross, in the
// direction that faces its secured side. `shut` is a free open-first; `open` is
// nothing; `barred`/`locked` are the play. (Directionality — a bar only holds from
// its own side — is handled at the enforcement seam, which knows which side the
// mover stands on; this predicate is the "is there a lock to beat at all" test.)
export function needsForcing(state) {
  const s = String(state);
  return s === 'barred' || s === 'locked';
}

// ── Deterministic default state ──────────────────────────────────────────────
// Seeded f(seed, structId, doorId, buildingType, exterior) → a default state, so
// a legacy save and a fresh procgen structure derive the SAME doors[] and the hash
// is stable under replay. Policy (brief §MR-2a): homes shut, shops open by daylight
// segments, the wake cottage's front door shut-not-locked; interior doors open (you
// do not bar the doors inside your own home). No door defaults to locked/barred —
// that is content/quest/householder authorship (a later `door` op), never the seed.

const SHOP_TYPES = new Set(['tavern', 'market']);
const OPEN_INTERIOR = 'open';

// The building type a structure presents (mirrors floorPlan's forcedType/hash path
// without recomputing the whole plan when the caller already has it).
function typeOf(structure, plan) {
  if (plan && plan.type) return String(plan.type);
  return String(floorPlan(structure)?.type || 'building');
}

/**
 * defaultExteriorState(world, structure, structId, plan) -> DoorState
 * The FRONT door's seeded default. Homes and keeps sit shut; shops stand open by
 * day and shut at night; dens/hives gape open. Deterministic — a small seeded
 * wobble only ever chooses between open/shut, never a secured state.
 */
function defaultExteriorState(world, structure, structId, plan) {
  const type = typeOf(structure, plan);
  const seed = String(world?.meta?.seed ?? '');
  // A per-door stream so two structures of the same type at the same node still
  // differ, and the same door is identical every call.
  const rng = makeRng(seedFromString(`${seed}|${structId}|door:exterior|state`));
  if (SHOP_TYPES.has(type)) {
    // Shops: open during daylight, shut after dark. isNight reads world.time.
    return isNight(world) ? 'shut' : 'open';
  }
  if (type === 'lair' || type === 'hive') return 'open'; // a den has no door to shut
  // Homes, keeps, chapels, towers, longhouses, cottages: shut. (A seeded coin is
  // consumed so the stream advances deterministically even though homes are always
  // shut — keeps the derivation uniform and future-proof if a type wants a wobble.)
  void rng.int(0, 1);
  return 'shut';
}

// ── Door id ──────────────────────────────────────────────────────────────────
// A stable, deterministic id for a door so the `door` op can address it and a
// round-trip preserves it. Room-to-room doors are keyed by their sorted room pair
// (matches floorPlan's once-per-pair emission); the exterior door is keyed by the
// entry room it fronts.

function interiorDoorId(structId, a, b) {
  const [lo, hi] = [String(a), String(b)].sort((x, y) => x.localeCompare(y));
  return `door:${structId}:${lo}|${hi}`;
}
function exteriorDoorId(structId, entryRoomId) {
  return `door:${structId}:ext:${String(entryRoomId)}`;
}

// Orientation of a door from the compass direction it opens by. A door on a
// north/south wall separates cells stacked vertically (a 'ns' threshold); east/west
// separates horizontally ('ew'). Used by the mask + the renderer later.
function orientForDir(dir) {
  const d = String(dir);
  return (d === 'north' || d === 'south') ? 'ns' : 'ew';
}

/**
 * deriveDoors(world, structure) -> DoorRecord[]
 *
 * The full canonical door list for a structure, derived PURELY from its floorPlan:
 *   • one record per room-to-room doorway (floorPlan.doors — each undirected edge
 *     once), state defaulted OPEN (interior doors of an ordinary dwelling stand open);
 *   • exactly ONE exterior door, fronted on the entry room, state seeded by type.
 *
 * DoorRecord = { id, a, b, orient, exterior, state }
 *   a, b   — the room ids the door joins; for the exterior door, b === '' (outside).
 *   orient — 'ns' | 'ew' (wall orientation).
 *   exterior — true for the single front door.
 *   state  — one of DOOR_STATES.
 *
 * Deterministic + idempotent (same structure → same list). Returns [] when the
 * structure has no groundable plan (no rooms) — such a structure carries no doors
 * and the "exactly one exterior door" invariant is scoped to structures WITH rooms.
 */
export function deriveDoors(world, structure) {
  const plan = floorPlan(structure);
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  if (!rooms.length) return [];
  const structId = String(structure?.id ?? '');
  const out = [];

  // Interior doors — one per floorPlan doorway (already once-per-pair).
  for (const d of (Array.isArray(plan.doors) ? plan.doors : [])) {
    const a = String(d.a ?? '');
    const b = String(d.b ?? '');
    if (!a || !b) continue;
    out.push({
      id: interiorDoorId(structId, a, b),
      a, b,
      orient: orientForDir(d.dir),
      exterior: false,
      state: OPEN_INTERIOR,
    });
  }

  // The exterior (front) door — fronted on the entry room, opening outward. Its
  // outward direction is the doorstep direction MR-1a already computes.
  const entryRoom = rooms.find(r => r.isEntry) || rooms.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
  const entryId = String(entryRoom?.id ?? '');
  const th = entryId ? doorThresholdCells(world, structId, null) : null;
  const dir = th?.dir || 'south';
  out.push({
    id: exteriorDoorId(structId, entryId),
    a: entryId,
    b: '',
    orient: orientForDir(dir),
    exterior: true,
    state: defaultExteriorState(world, structure, structId, plan),
  });

  // Sort for a stable, replay-identical order (id is unique + deterministic).
  out.sort((x, y) => String(x.id).localeCompare(String(y.id)));
  return out;
}

/**
 * normalizeDoors(world, structure, stored) -> DoorRecord[]
 *
 * Canonicalize a structure's stored doors[] against its live plan:
 *   • keep only doors whose rooms exist in the plan (an interior door needs both
 *     a and b to be real rooms; the exterior door needs its `a` room);
 *   • coerce state to the enum (an unknown state falls to the seeded default);
 *   • guarantee EXACTLY ONE exterior door — if the stored set has none (legacy /
 *     partial), synthesize the derived one; if it has several, keep only doors that
 *     correspond to the single derived exterior record (the rest are dropped);
 *   • backfill any MISSING door the plan now has (so a plan change adds doors
 *     rather than leaving walls uncrossable), preserving stored states for the
 *     doors that persist.
 *
 * When `stored` is absent/empty this returns deriveDoors(...) outright. Pure +
 * deterministic; the output is sorted by id so the hash image is stable.
 */
export function normalizeDoors(world, structure, stored) {
  const derived = deriveDoors(world, structure);
  const arr = Array.isArray(stored) ? stored : [];
  if (!arr.length) return derived;

  // Index the derived (authoritative geometry) by id; a stored door is kept only
  // if it corresponds to a derived door (its rooms still exist, and — for the
  // exterior — it is THE single derived front door), inheriting the stored STATE
  // but the derived structural fields.
  const byId = new Map(derived.map(d => [d.id, d]));
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id ?? '');
    const base = byId.get(id);
    if (!base || seen.has(id)) continue; // door no longer in the plan, or a dupe
    seen.add(id);
    const state = isDoorState(s.state) ? String(s.state) : base.state;
    out.push({ ...base, state });
  }
  // Backfill derived doors the stored set didn't carry (new plan doors, or a
  // missing exterior door), at their seeded defaults.
  for (const d of derived) {
    if (!seen.has(d.id)) out.push(d);
  }
  out.sort((x, y) => String(x.id).localeCompare(String(y.id)));
  return out;
}

// ── Door cells (DERIVED from the plan — never stored) ─────────────────────────

/**
 * doorCells(world, structure, door) -> { inside, outside } | null
 *
 * The cells a door threshold maps, POSITION_AS_CANON §1 (geometry is the single
 * source; cells are a projection). For the EXTERIOR door this reuses MR-1a's
 * doorThresholdCells (the entry-room doorstep) — inside is the struct-frame door
 * cell, outside is the region-frame doorstep. For an INTERIOR door, `inside` is the
 * struct cell on the `a` side and `outside` the struct cell on the `b` side (both
 * struct-frame — "outside" is just "the far side" for a room-to-room door).
 *
 * Returns null when the plan can't ground the door (missing rooms / node). Pure.
 */
export function doorCells(world, structure, door) {
  if (!door || typeof door !== 'object') return null;
  const structId = String(structure?.id ?? '');
  if (door.exterior) {
    return doorThresholdCells(world, structId, null);
  }
  // Interior door: the shared-wall cell between the two rooms' rects, on each side.
  const plan = floorPlan(structure);
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  const roomA = rooms.find(r => String(r.id) === String(door.a));
  const roomB = rooms.find(r => String(r.id) === String(door.b));
  if (!roomA || !roomB) return null;
  const rectA = roomRectCells(roomA);
  const rectB = roomRectCells(roomB);
  if (!rectA || !rectB) return null;
  return {
    inside: { frame: `struct:${structId}`, gx: rectA.cx, gy: rectA.cy },
    outside: { frame: `struct:${structId}`, gx: rectB.cx, gy: rectB.cy },
  };
}

// ── Lookups ──────────────────────────────────────────────────────────────────

// The stored door list for a structure (already normalized by ensureStructures),
// or [] when the structure carries none.
export function doorsOf(structure) {
  return Array.isArray(structure?.doors) ? structure.doors : [];
}

// The single exterior (front) door record of a structure, or null.
export function exteriorDoorOf(structure) {
  return doorsOf(structure).find(d => d && d.exterior) || null;
}

// The interior door joining two rooms (order-independent), or null.
export function doorBetween(structure, roomA, roomB) {
  const a = String(roomA), b = String(roomB);
  return doorsOf(structure).find(d =>
    d && !d.exterior &&
    ((String(d.a) === a && String(d.b) === b) || (String(d.a) === b && String(d.b) === a))
  ) || null;
}

// ── Walkable mask (pure derivation) ──────────────────────────────────────────

/**
 * structWalkableMask(world, structure) -> {
 *   contains(gx, gy) -> bool,          // is this struct cell inside SOME room rect
 *   crossings: [{ id, a, b, from, to, state, crossable }],  // door crossings between rooms
 *   roomOf(gx, gy) -> roomId | ''      // which room a cell belongs to
 * }
 *
 * The mask a movement resolver consumes: walls block (a cell not in any room rect
 * is not walkable), and the ONLY room↔room crossings are door cells whose state
 * lets a body pass. The FP-1 wall band already carves the inter-room void out of
 * every room rect, so "inside a room rect" IS the walkable interior; this layer
 * adds the door crossings ON TOP so a mover can pass from room to room only through
 * a door (and only when its state permits). Pure — a function of the plan + the
 * structure's canon door states. (Tactical-mask CONSUMPTION for the ≤6-cell walk
 * lands with TAC-2/TAC-2-mask; MR-2a derives the mask and enforces it at the
 * existing room-move + egress seams — see the playloop enforcement.)
 */
export function structWalkableMask(world, structure) {
  const plan = floorPlan(structure);
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  const rects = rooms.map(r => roomRectCells(r)).filter(Boolean);
  const doors = doorsOf(structure);

  const ordered = rects.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const roomOf = (gx, gy) => {
    for (const rect of ordered) {
      if (gx >= rect.minX && gx <= rect.maxX && gy >= rect.minY && gy <= rect.maxY) return rect.id;
    }
    return '';
  };
  const contains = (gx, gy) => roomOf(gx, gy) !== '';

  const crossings = [];
  for (const d of doors) {
    if (d.exterior) continue; // exterior crossing is the region threshold, not a room↔room cell
    const cells = doorCells(world, structure, d);
    if (!cells) continue;
    crossings.push({
      id: d.id, a: d.a, b: d.b,
      from: cells.inside, to: cells.outside,
      state: d.state, crossable: crossable(d.state),
    });
  }
  return { contains, crossings, roomOf };
}
