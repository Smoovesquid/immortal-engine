// Authored plans — MR-2c (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c).
//
// Tim hand-draws floorplans in public/house-builder.html (walls, doors, windows,
// furniture — stone walls and curved rooms too). Its "Export JSON" button writes a
// `house-builder/v5` document (verified against the tool's own btnExport handler —
// see docs/briefs/MR-2-FUNCTIONAL-INK.md §2c + the file header). This module turns
// that export into the SAME shapes the rest of the engine already reads for a
// procgen structure:
//   • a `topology` (topology.js's { kind:'rooms', rooms, edges } compass graph —
//     what movement/adjacency/interiorCompassLayout consume);
//   • a `plan` (floorPlan.js's OWN output shape — { type, name, shell, dark,
//     footprint, hull, rooms, doors, corridors, nonAdjacent } — the geometry every
//     mask/invariant/renderer reads via floorPlan(structure)).
// floorPlan.js's override branch (this packet) returns `structure.authoredPlan`
// verbatim instead of computing geometry from topology, so an authored structure's
// rooms are drawn EXACTLY where Tim put them — not re-tiled by placeOnGrid.
//
// ── Why this is a STATIC IMPORT registry, not an fs/directory scan ───────────────
// engine/state.js (whose call graph includes this module, transitively, once
// wired) is loaded by BOTH the server and public/v1.js in the BROWSER (raw ESM
// script tags, no bundler — see server.js's express.static('/engine', ...)). A
// `fs.readFileSync` or `fetch` inside the pure engine path would either 404 in the
// browser or force every caller of floorPlan()/applyGeneratedStructuresForNode()
// async (that would touch engine/playloop.js, which this packet must not edit).
// content/arcs/*.arc.js and content/recipes/*.recipe.js already solved exactly this
// problem (engine/story/registry.js's header: "Data module (JSON-shaped, no logic)
// so the engine stays fs-free and the file loads identically in node and the
// browser") — this module mirrors that convention: each authored house is a plain
// `export default {...}` data file under packs/base/structures/authored/*.house.js,
// imported by name into BUILTIN_AUTHORED_PLANS below. Adding a new authored house is
// one new import line, same ritual as adding a new story arc.
//
// ── Determinism + purity ─────────────────────────────────────────────────────────
// Every function here is a pure, referentially-transparent read of the imported
// data (no rng.js, no Math.random, no world mutation) — same file in, same
// structure out, forever. Malformed authored JSON THROWS at module-evaluation time
// (import time) with a clear message: authored content is dev-side, and a broken
// fixture should fail loudly in `node --test`/server boot, never ship a silently
// wrong geometry to a player. A structure id simply ABSENT from the registry is the
// normal (99.9%-of-structures) case — every un-authored structure resolves to null
// here and the caller falls back to procgen without any warning noise.

// interiorCompassLayout is topology.js's spanning-tree compass assignment — reused
// below (compassSlotsFor) so an authored plan's ASCII rendering gets the SAME
// deterministic "north/east/south/west from the entry" integer slot a procgen
// building does. topology.js has no other engine imports (see its header), so
// importing it here creates no cycle with floorPlan.js (which will import THIS
// module for its override branch).
import { interiorCompassLayout } from './topology.js';

// ── The registry (static imports — see header) ───────────────────────────────────
import wakeCottage from '../../packs/base/structures/authored/wake_cottage.house.js';

const BUILTIN_AUTHORED_PLANS = [wakeCottage];

// House-builder grid units → floorPlan layout units. The tool's grid (CELL=28px,
// COLS=120, ROWS=90 — "large world, castle/mega-dungeon scale") has no canonical
// real-world foot scale documented yet (the tool shipped the same day as this
// packet); floorPlan layout units DO (tacticalPos.js: 1 layout unit = PLACE_WU(4)
// cells = 20 ft, and roomDetail.js's rooms run ~0.4–3.0 units — a 0.4 privy is 8ft,
// a 3.0 nave is 60ft). ONE named constant, easy to retune once Tim confirms real
// room sizes against the tool — never scattered magic numbers.
export const HB_UNIT_TO_LAYOUT = 1;

function hbToLayout(v) {
  return Number(v) * HB_UNIT_TO_LAYOUT;
}

// ── Validation (throws at load time — see header) ────────────────────────────────

function fail(structureId, msg) {
  throw new Error(`authoredPlans: malformed authored plan for '${structureId}': ${msg}`);
}

function validateRaw(raw, structureId) {
  if (!raw || typeof raw !== 'object') fail(structureId, 'not an object');
  if (String(raw.schema || '') !== 'house-builder/v5') {
    fail(structureId, `unsupported schema '${raw.schema}' (expected house-builder/v5)`);
  }
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : null;
  if (!rooms || !rooms.length) fail(structureId, 'no rooms');
  const seen = new Set();
  for (const r of rooms) {
    const id = String(r?.id ?? '');
    if (!id) fail(structureId, 'a room is missing an id');
    if (seen.has(id)) fail(structureId, `duplicate room id '${id}'`);
    seen.add(id);
    if (!(Number(r.w) > 0) || !(Number(r.h) > 0)) {
      fail(structureId, `room '${id}' must have w>0 and h>0`);
    }
  }
  for (const o of (Array.isArray(raw.openings) ? raw.openings : [])) {
    if (o.kind !== 'door' && o.kind !== 'window') {
      fail(structureId, `opening has unknown kind '${o.kind}' (must be door|window)`);
    }
    if (!Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) {
      fail(structureId, 'an opening is missing x/y');
    }
  }
}

// Validate + index every builtin plan ONCE at module-evaluation time — a broken
// fixture fails the very first import of this module (test boot / server boot),
// never a lazily-discovered runtime surprise.
const REGISTRY = new Map(); // structureId -> raw export JSON
for (const raw of BUILTIN_AUTHORED_PLANS) {
  const structureId = String(raw?.structureId || '');
  if (!structureId) fail('(unknown)', 'missing structureId (the field WE add — see the fixture header)');
  validateRaw(raw, structureId);
  if (REGISTRY.has(structureId)) fail(structureId, 'duplicate structureId across authored plans');
  REGISTRY.set(structureId, raw);
}

/** hasAuthoredPlan(structureId) -> bool. */
export function hasAuthoredPlan(structureId) {
  return REGISTRY.has(String(structureId || ''));
}

/** authoredRawFor(structureId) -> the raw house-builder export, or null. */
export function authoredRawFor(structureId) {
  return REGISTRY.get(String(structureId || '')) || null;
}

/** authoredStructureIds() -> string[] of every registered structure id. */
export function authoredStructureIds() {
  return [...REGISTRY.keys()];
}

// ── Geometry: room rects in house-builder units (AABB — matches the tool; round/
// curved rooms still get a bounding rect for hit-testing, same as floorPlan.js's
// own boxOf, which round rooms also just bound) ──────────────────────────────────

function roomRectHb(room) {
  const x0 = Number(room.x), y0 = Number(room.y);
  const w = Number(room.w), h = Number(room.h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

// Is a point ON (within a small tolerance of) a room's rectangle boundary?
// Openings sit exactly on the wall centerline the tool snapped them to, so the
// tolerance only needs to absorb float rounding — not real distance search.
const EDGE_EPS = 0.05;
function pointOnRectBoundary(rect, x, y) {
  const onVert = (Math.abs(x - rect.x0) < EDGE_EPS || Math.abs(x - rect.x1) < EDGE_EPS)
    && y >= rect.y0 - EDGE_EPS && y <= rect.y1 + EDGE_EPS;
  const onHoriz = (Math.abs(y - rect.y0) < EDGE_EPS || Math.abs(y - rect.y1) < EDGE_EPS)
    && x >= rect.x0 - EDGE_EPS && x <= rect.x1 + EDGE_EPS;
  return onVert || onHoriz;
}

/**
 * roomsAtOpening(rooms, opening) -> string[] of room ids whose rect boundary the
 * opening's point sits on. A standalone exterior wall opening touches exactly ONE
 * room; a shared interior wall (two rooms drawn abutting) touches exactly TWO —
 * the tool never records the second room explicitly (`opening.room` is a single
 * "nearest sample" tag — house-builder.html's wallSamples/nearestWall), so this
 * geometric membership test is how we recover it. Deterministic (pure geometry).
 */
function roomsAtOpening(rooms, opening) {
  const x = Number(opening.x), y = Number(opening.y);
  const out = [];
  for (const r of rooms) {
    const rect = roomRectHb(r);
    if (pointOnRectBoundary(rect, x, y)) out.push(String(r.id));
  }
  // Deterministic order regardless of authoring order.
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

// The outward-facing compass direction for an opening on a room's boundary, given
// the ONE room it borders (exterior) — the wall it sits on, read from which edge
// of that room's rect the point lands closest to.
function outwardDirFromRoom(rect, x, y) {
  const dLeft = Math.abs(x - rect.x0), dRight = Math.abs(x - rect.x1);
  const dTop = Math.abs(y - rect.y0), dBottom = Math.abs(y - rect.y1);
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return 'west';
  if (min === dRight) return 'east';
  if (min === dTop) return 'north';
  return 'south';
}

// The direction from room A to room B (A's side of a shared wall), from their
// rect centers — used for interior door `dir` (floorPlan.js's doors[].dir is "the
// direction id `a` exits toward id `b`", DELTA_DIR's inverse).
function dirAtoB(rectA, rectB) {
  const acx = (rectA.x0 + rectA.x1) / 2, acy = (rectA.y0 + rectA.y1) / 2;
  const bcx = (rectB.x0 + rectB.x1) / 2, bcy = (rectB.y0 + rectB.y1) / 2;
  const dx = bcx - acx, dy = bcy - acy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

// ── Entry room selection (mirrors floorPlan.js: tagged 'entry', else the room the
// front door borders, else lexicographically first) ─────────────────────────────

function pickEntryRoomId(raw) {
  const rooms = raw.rooms;
  const tagged = rooms.find(r => Array.isArray(r.tags) && r.tags.map(String).map(s => s.toLowerCase()).includes('entry'));
  if (tagged) return String(tagged.id);
  const doors = (raw.openings || []).filter(o => o.kind === 'door');
  for (const d of doors) {
    const at = roomsAtOpening(rooms, d);
    if (at.length === 1) return at[0]; // a door bordering exactly one room = the front door
  }
  return rooms.slice().map(r => String(r.id)).sort((a, b) => a.localeCompare(b))[0];
}

// ── Room-id canonicalization ──────────────────────────────────────────────────
// Tim names his own rooms in the tool ("hall", "bedchamber", …) — free text, no
// ordering guarantee. But engine/structures/interiors.js's enterStructureInterior
// (a file this packet must not touch) drops the player into `topo.rooms[0]` AFTER
// topology.js's normalizeTopology alpha-sorts the room array — NOT the entry-tagged
// room. generateStructures.js's procgen rooms dodge this by construction: they're
// minted `room:<structId>:1`, `:2`, … with the entry room ALWAYS `:1`, so the alpha
// sort of single-digit suffixes happens to keep it first. A free-text id ("hall")
// has no such guarantee ("bedchamber" < "hall" alphabetically) — so we mint the SAME
// procgen-shaped ids here, entry always `:1`, everything else `:2.. ` in a stable
// (sorted-by-original-id) order, and remap every reference (edges, doors[], windows)
// through this one table. Tim's own name is kept as the room's DISPLAY name/role —
// only the id changes, and only to satisfy a convention interiors.js already
// depends on for procgen structures.
function canonicalRoomIds(raw, structId) {
  const entryId = pickEntryRoomId(raw);
  const rest = raw.rooms.map(r => String(r.id)).filter(id => id !== entryId).sort((a, b) => a.localeCompare(b));
  const ordered = [entryId, ...rest];
  const map = new Map();
  ordered.forEach((origId, i) => map.set(origId, `room:${structId}:${i + 1}`));
  return map;
}

// ── Public conversions ────────────────────────────────────────────────────────────

/**
 * buildAuthoredTopology(raw, structId) -> topology.js's { kind:'rooms', rooms,
 * edges } shape. Rooms carry the 'entry' tag on the chosen entry room; edges are
 * the room PAIRS an interior door (an opening bordering exactly two rooms) joins.
 * Room ids are CANONICALIZED (canonicalRoomIds — see its header) to the same
 * `room:<structId>:<n>` shape procgen mints, entry always `:1`, so
 * engine/structures/interiors.js's enterStructureInterior (which picks
 * `topo.rooms[0]` after an alpha-sort, not the entry TAG) drops the player in the
 * right room regardless of what Tim named his rooms in the tool. Pure; the same
 * raw export + structId always yields the same topology (normalizeTopology
 * re-sorts on top of this, so emission order here doesn't matter for the
 * stored/hashed shape — only the id VALUES, which are deterministic).
 */
export function buildAuthoredTopology(raw, structId) {
  const entryId = pickEntryRoomId(raw);
  const idMap = canonicalRoomIds(raw, structId);
  const rooms = raw.rooms.map(r => ({
    id: idMap.get(String(r.id)),
    tags: String(r.id) === entryId ? ['entry'] : []
  }));
  const edgeSet = new Set();
  const edges = [];
  for (const o of (raw.openings || [])) {
    if (o.kind !== 'door') continue;
    const at = roomsAtOpening(raw.rooms, o);
    if (at.length !== 2) continue; // exterior (1) or ungrounded (0) — not an interior edge
    const [a, b] = [idMap.get(at[0]), idMap.get(at[1])].sort((x, y) => x.localeCompare(y));
    const key = `${a}|${b}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ a, b });
  }
  edges.sort((x, y) => (x.a + '|' + x.b).localeCompare(y.a + '|' + y.b));
  return { kind: 'rooms', rooms, edges };
}

/**
 * buildAuthoredFloorPlan(raw, structId) -> floorPlan.js's OWN output shape,
 * computed from Tim's drawn geometry instead of placeOnGrid's auto-tiler:
 *   • rooms keep their DRAWN position/size (hbToLayout of x/y/w/h), so the mask,
 *     roomOfStructCell, and door-cell projections all agree with what Tim drew;
 *   • room ids are CANONICALIZED the same way buildAuthoredTopology does (both
 *     read canonicalRoomIds independently — same raw+structId in, same map out,
 *     so the two shapes always agree on what a room is called);
 *   • gx/gy (the integer compass slot asciiMap.js keys its ASCII grid by) still
 *     comes from the topology's compass layout (interiorCompassLayout +
 *     placeOnGrid, floorPlan.js's own helpers) — Tim's rooms aren't necessarily on
 *     a uniform integer grid, but every room needs SOME distinct integer slot for
 *     that renderer, and the compass graph gives a deterministic one for free;
 *   • doors[] mirrors floorPlan.js's shape ({x,y,dir,a,b}), with b:'' for the
 *     single exterior/front door (deriveDoors' contract — doors.js, UNCHANGED —
 *     already turns "one door with b===''" into the canon exterior DoorRecord);
 *   • windows[] is ADDITIVE (not on floorPlan.js's contract) — a forward-compat
 *     home for MR-2d (windows-are-apertures); nothing else reads it, so it can't
 *     regress an existing consumer.
 * Pure; determinism proven by U512 (same raw in, same plan out, twice).
 */
export function buildAuthoredFloorPlan(raw, structId) {
  const rooms = raw.rooms;
  const entryId = pickEntryRoomId(raw);
  const idMap = canonicalRoomIds(raw, structId);
  const rectOf = new Map(rooms.map(r => [String(r.id), roomRectHb(r)]));

  // Compass slot (gx,gy) for the ASCII renderer — from the SAME topology/placement
  // helpers floorPlan.js itself uses, imported lazily here to avoid a module cycle
  // (floorPlan.js will import THIS module for the override branch).
  const topo = buildAuthoredTopology(raw, structId);

  const materials = new Set(rooms.map(r => String(r.material || '')).filter(Boolean));
  const shell = materials.has('stone') ? 'stone' : (materials.values().next().value || 'timber');

  const outRooms = [];
  const gxy = compassSlotsFor(topo, idMap.get(entryId));
  for (const r of rooms) {
    const origId = String(r.id);
    const id = idMap.get(origId);
    const rect = rectOf.get(origId);
    const cx = hbToLayout((rect.x0 + rect.x1) / 2);
    const cy = hbToLayout((rect.y0 + rect.y1) / 2);
    const w = hbToLayout(rect.x1 - rect.x0);
    const h = hbToLayout(rect.y1 - rect.y0);
    const slot = gxy.get(id) || { gx: 0, gy: 0 };
    outRooms.push({
      id, role: String(r.name || origId), name: String(r.name || origId),
      shape: (r.shape === 'round') ? 'round' : 'rect',
      dark: 0,
      isEntry: origId === entryId,
      gx: slot.gx, gy: slot.gy,
      cx, cy, w, h,
      furniture: []
    });
  }

  // hull: bounding box of every room's drawn box (mirrors floorPlan.js).
  let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
  for (const r of outRooms) {
    hx0 = Math.min(hx0, r.cx - r.w / 2); hx1 = Math.max(hx1, r.cx + r.w / 2);
    hy0 = Math.min(hy0, r.cy - r.h / 2); hy1 = Math.max(hy1, r.cy + r.h / 2);
  }
  const hull = Number.isFinite(hx0) ? { x: hx0, y: hy0, w: hx1 - hx0, h: hy1 - hy0, round: false } : null;

  // footprint: same bounding box, in the (0-based) layout units floorPlan.js emits.
  const footprint = Number.isFinite(hx0) ? { w: hx1 - hx0, h: hy1 - hy0 } : { w: 1, h: 1 };

  // doors[] — floorPlan.js shape. Interior doors (2 rooms) get x/y/dir/a/b; the
  // exterior/front door (1 room) gets b:''. A door touching 0 rooms (drawn off any
  // room's wall) is skipped — it grounds nothing for movement or the mask.
  const doors = [];
  let exteriorSeen = false;
  for (const o of (raw.openings || [])) {
    if (o.kind !== 'door') continue;
    const at = roomsAtOpening(rooms, o);
    const x = hbToLayout(Number(o.x));
    const y = hbToLayout(Number(o.y));
    if (at.length === 2) {
      const [a, b] = at;
      doors.push({ x, y, dir: dirAtoB(rectOf.get(a), rectOf.get(b)), a: idMap.get(a), b: idMap.get(b) });
    } else if (at.length === 1 && !exteriorSeen) {
      // Only the FIRST single-room door authors the exterior record — doors.js's
      // deriveDoors expects exactly one exterior door per structure (MR-2a
      // invariant); a house drawn with two street-facing doors keeps its first
      // (deterministic — openings[] authoring order) as canon front door and the
      // rest simply aren't emitted as doors[] entries (still fine to WALK through
      // in-fiction later; MR-2c's job is the loader, not multi-front-door canon).
      doors.push({ x, y, dir: outwardDirFromRoom(rectOf.get(at[0]), Number(o.x), Number(o.y)), a: idMap.get(at[0]), b: '' });
      exteriorSeen = true;
    }
  }

  // windows[] — ADDITIVE, see the header. Kept close to floorPlan.js's door shape
  // for a future MR-2d to consume with minimal translation.
  const windows = [];
  for (const o of (raw.openings || [])) {
    if (o.kind !== 'window') continue;
    const at = roomsAtOpening(rooms, o);
    if (!at.length) continue;
    windows.push({
      x: hbToLayout(Number(o.x)), y: hbToLayout(Number(o.y)),
      room: idMap.get(at[0]),
      exterior: at.length === 1
    });
  }

  return {
    type: 'cottage', name: String(raw.name || 'Authored House'), shell,
    dark: 0, footprint, hull,
    rooms: outRooms, doors, corridors: [], nonAdjacent: [],
    windows
  };
}

// A deterministic integer (gx,gy) compass slot per room, reusing topology.js's OWN
// spanning-tree compass layout (interiorCompassLayout, imported at the top of this
// file) so an authored plan's ASCII rendering walks the same "north/east/south/west
// from the entry" logic a procgen building does — NOT floorPlan.js's internal
// placeOnGrid (private/unexported), so this stays a leaf module floorPlan.js can
// safely import without a cycle.
const DIRS4 = ['north', 'east', 'south', 'west'];
const VEC4 = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
function compassSlotsFor(topology, entryId) {
  const exits = interiorCompassLayout(topology);
  const pos = new Map();
  const occ = new Set();
  const key = (x, y) => `${x},${y}`;
  const put = (id, x, y) => { pos.set(id, { gx: x, gy: y }); occ.add(key(x, y)); };
  const nearestFree = (x, y) => {
    if (!occ.has(key(x, y))) return [x, y];
    for (let r = 1; r < 24; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (!occ.has(key(x + dx, y + dy))) return [x + dx, y + dy];
        }
      }
    }
    return [x, y];
  };
  const queue = [];
  if (entryId) { put(entryId, 0, 0); queue.push(entryId); }
  while (queue.length) {
    const id = queue.shift();
    const here = pos.get(id);
    const ex = exits.get(id) || {};
    for (const dir of DIRS4) {
      const nb = ex[dir];
      if (!nb || pos.has(nb)) continue;
      const [vx, vy] = VEC4[dir];
      const [fx, fy] = nearestFree(here.gx + vx, here.gy + vy);
      put(nb, fx, fy);
      queue.push(nb);
    }
  }
  let stray = 0;
  for (const r of (topology.rooms || [])) {
    const id = String(r.id);
    if (!pos.has(id)) { const [fx, fy] = nearestFree(stray++, 99); put(id, fx, fy); }
  }
  return pos;
}

/**
 * makeAuthoredStructure(structureId, nodeId) -> a full structure object ready to
 * merge into world.structures.byId, or null when structureId isn't registered.
 * `authoredPlan` is the field floorPlan.js's override branch reads; `topology` is
 * still populated (movement/adjacentRooms/interiorCompassLayout all read it) so an
 * authored structure behaves identically to a procgen one everywhere EXCEPT its
 * drawn geometry. Pure + deterministic (no rng, no I/O — the raw plan is already
 * loaded data by the time this runs).
 */
export function makeAuthoredStructure(structureId, nodeId) {
  const raw = authoredRawFor(structureId);
  if (!raw) return null;
  const structId = String(structureId);
  const topology = buildAuthoredTopology(raw, structId);
  const plan = buildAuthoredFloorPlan(raw, structId);
  return {
    id: String(structureId),
    kind: 'building',
    nodeId: String(nodeId || ''),
    anchors: { nodeId: String(nodeId || '') },
    topology,
    surfaces: {},
    tags: ['authored'],
    buildingType: 'cottage',
    authoredPlan: plan
  };
}
