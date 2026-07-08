// LOAD-1/LOAD-2/MR-2c — the authored-structure loader: a hand-drawn building becomes
// a walkable engine structure (docs/briefs/LOAD-1-smallest-loader.md +
// docs/briefs/LOAD-2-multiroom-realnode.md + docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c).
//
// ── LOADER-MERGE (this file is the SINGLE survivor) ─────────────────────────────────
// Two conductors independently built a house-builder loader the same day: this module
// (LOAD-1/LOAD-2 — the PROVEN-LIVE path, wired via applyGeneratedStructuresForNode,
// walked at a real node LLM-off, tolerant of house-builder/v5+..v7) and the now-deleted
// engine/structures/authoredPlans.js (MR-2c — which added the NODE/id REGISTRY
// convention: a plain data file under packs/base/structures/authored/*.house.js carrying
// a `structureId` field, imported by name, validated at module-evaluation time, so a plan
// Tim authored FOR a procgen candidate id substitutes for that structure one id at a time).
// LOADER-MERGE keeps THIS module's wiring point + format tolerance + depth (multi-room,
// doors→adjacency, abutment fallback, orphan repair, authored roles, roomDetail furniture,
// windows-are-never-doors) and ABSORBS authoredPlans' registry (bottom of this file):
// ONE module, ONE materialization branch (loadAuthoredStructure), ONE registry. The MR-2c
// door-canon records (a front-door DoorRecord with a seeded default state + interior door
// states) and the walkable mask were NEVER separate loader logic — both loaders emit the
// same floorPlan `doors[]` shape ({x,y,dir,a,b}, b:'' for the front door), and ensureWorld's
// existing tail (backfillDoors → doors.js deriveDoors + structWalkableMask, all UNTOUCHED)
// derives the canon records + mask from THAT. Routing the registry through this richer
// loader therefore yields the identical canon (verified: front door 'shut', interior 'open',
// one crossable crossing) while gaining roles/furniture/multi-room/repair for free.
//
// ENGINE LEADS. public/house-builder.html exports a `house-builder/v7` document
// (rooms/walls/openings/tunnels/corridors/furniture/secrets — see its btnExport
// handler). This module maps that export DOWN onto the engine's existing interior
// model — the SAME `{ kind, nodeId, anchors, topology, surfaces, tags, buildingType,
// authoredPlan }` structure object every other seam (movement, invariants, doors,
// roomDetail, structureMaterial) already reads for an MR-2c authored plan — and
// IGNORES/DEGRADES everything the engine can't represent yet.
//
// LOAD-1 proved the PATH for ONE room. LOAD-2 makes a WHOLE building walkable: ALL
// its rooms, connected by its authored DOORS as reciprocal-compass doorways, so a
// player can walk in from the map and move room-to-room. loadAuthoredStructure now
// consumes every room and builds the room graph the engine's compass topology needs.
//
// ── What maps DOWN (engine-leads) ─────────────────────────────────────────────────
//   • ALL rooms (LOAD-2). Each becomes a topology room `room:<structId>:<n>` (entry
//     canonicalized to `:1` so interiors.js drops the player there — it picks
//     topo.rooms[0] after an alpha-sort). Rectangular or round (the engine has a
//     'round' shape); a round room keeps its bounding box for movement/mask.
//   • ROLE per room — room.role if it names a KNOWN engine role (roomDetail.js ROLES),
//     carried as a `role:<role>` tag so roomDetail reads the AUTHORED role (a
//     bed-having 'bedchamber', a 'scullery' with a basin) instead of the cottage
//     blueprint's by-index default. An unknown/absent role falls to the cottage
//     default per position (entry → hearth room, others → bedchamber). LOAD-1 pattern,
//     now per-room.
//   • DOORS → ADJACENCY (the LOAD-2 crux). The tool records an opening as
//     `{kind:'door', x, y, room}` — a SINGLE room tag (house-builder's nearest-wall
//     sample). roomsAtOpening recovers BOTH rooms a door joins by geometric boundary
//     membership: a door on a SHARED interior wall sits on TWO rooms' rects → that
//     pair is a topology edge (the doorway the player "goes through"); a door on an
//     OUTER wall sits on ONE room → the exterior front door. Where the drawn data is
//     ambiguous (a room the doors don't reach), we FALL BACK to abutment — two rooms
//     that share a wall segment get an edge — and finally REPAIR any still-orphaned
//     room by joining it to its nearest neighbour, so the graph is always connected
//     and a room you can see is a room you can reach (never a soft-lock).
//   • MATERIAL — 'stone' anywhere → stone shell, else timber (the cottage default).
//     buildingType stays 'cottage' so the whole read stack is coherent.
//   • FURNITURE — each room's authoredPlan furniture is the roomDetail loadout for
//     its role, so the drawn floor plan shows role-appropriate furniture and the
//     prose ("look around") and the map agree.
//
// ── What is IGNORED / DEGRADED (noted, not represented — future work) ─────────────
//   • WALLS[] (freeform/bowed wall segments), per-wall CURVES (bowed room walls),
//     TUNNELS/CORRIDORS, SECRETS, SIZED/ANGLED door openings (len/angle) — dropped.
//     Rooms are plain AABBs joined by doorways; a tunnel between two rooms is NOT an
//     edge (only wall-sharing doors + abutment are), so a tunnel-only link degrades
//     to the abutment/repair pass rather than a modelled passage.
//   • WINDOWS — carried onto authoredPlan.windows (additive; roomWindows derives
//     presence). Not load-bearing for movement.
//   • The DRAWN per-piece furniture POSITIONS (ux/uy) — narration/furniture is
//     regenerated from the room ROLE (roomDetail), so a bed drawn in a corner reads
//     as "a bed" but at the role's canonical layout, not the exact drawn spot.
//   • multi-FLOOR — the engine interior model is single-storey; a multi-floor export
//     degrades to one storey (all rooms coplanar). Noted per the report.
//
// ── Determinism + purity ─────────────────────────────────────────────────────────
// PURE and deterministic: same JSON in, byte-identical structure out, forever. No
// rng / Math.random, no I/O, no world mutation — the returned object is data the
// caller merges through the normal structures path (applyGeneratedStructuresForNode
// → ensureStructures). Authored content is FIXED data (like a pack), so worldHash
// stays stable under replay. The reciprocal-compass slots are assigned by the ENGINE
// (interiorCompassLayout, topology.js) from the edges this loader supplies —
// deterministic, seeded, and reused here so the plan's door directions AGREE with the
// directions movement resolves. MALFORMED JSON THROWS LOUDLY (a clear Error naming the
// problem) — it never silently corrupts state; the caller decides whether to surface
// or degrade (the demo wire-in try/catch-degrades to procgen, mirroring MR-2c).

// interiorCompassLayout is topology.js's spanning-tree compass assignment. Reused
// here so the authored plan's door directions and (gx,gy) slots are the SAME
// deterministic "north/east/south/west from the entry" the engine's movement +
// getInteriorView independently compute — they agree by construction. topology.js is
// a leaf module (no engine imports beyond rng.js — see its header), so importing it
// creates no cycle with floorPlan.js (which imports THIS module for its override).
import { interiorCompassLayout } from './topology.js';
import { roomDetail } from './roomDetail.js';

// ── The authored-plan REGISTRY (absorbed from the deleted authoredPlans.js) ─────────
// A static-import registry of hand-drawn houses keyed by the procgen structure id each
// one OVERRIDES. Static imports (not an fs/directory scan) because engine/state.js's
// call graph loads in BOTH node and the BROWSER (raw ESM, no bundler) — an fs.readFileSync
// in the pure engine path would 404 in the browser. Mirrors content/arcs/*.arc.js and
// content/recipes/*.recipe.js (engine/story/registry.js's convention): each authored house
// is a plain `export default {...}` data file carrying the one field WE add, `structureId`.
// Adding a house is one import line + one array entry. Validated ONCE at module-evaluation
// time (a broken fixture fails test/server boot loudly, never a lazily-discovered surprise).
import wakeCottage from '../../packs/base/structures/authored/wake_cottage.house.js';

const BUILTIN_AUTHORED_PLANS = [wakeCottage];

// House-builder grid units → floorPlan layout units. Shares the MR-2c constant's
// value (authoredPlans.js HB_UNIT_TO_LAYOUT = 1) so a room drawn in the tool lands
// at the same layout scale whether it comes through this loader or MR-2c's.
const HB_UNIT_TO_LAYOUT = 1;
function hbToLayout(v) { return Number(v) * HB_UNIT_TO_LAYOUT; }

// The role a single unroled authored room takes. 'quarters' is a real cottage room
// role (roomDetail.js ROLES.quarters — a bed, nightstand, chest, lantern, rug), so an
// unroled hut reads like a lived-in room, not a void. Multi-room defaults key off
// entry vs non-entry below.
const DEFAULT_ROLE = 'quarters';

function fail(msg) {
  throw new Error(`authoredStructure: malformed authored plan: ${msg}`);
}

/**
 * Coerce the loader input to a plain object. Accepts either a parsed object (the
 * common case — a `require`/import of a .json, or an already-parsed export) or a
 * raw JSON string (so callers can hand it a fs.readFileSync result). A string that
 * isn't valid JSON fails loudly, not silently.
 */
function coerceJson(json) {
  if (typeof json === 'string') {
    try { return JSON.parse(json); }
    catch (err) { fail(`input is a string but not valid JSON (${err?.message || err})`); }
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) fail('input is not an object');
  return json;
}

/**
 * validate(raw) — the loud well-formedness gate. Throws on anything that would
 * produce a nonsense structure; permissive about the fields we IGNORE (walls,
 * tunnels, secrets) — those are dropped, not errors. Validates ALL rooms (LOAD-2),
 * not just the first, so a malformed later room fails loudly too.
 */
function validate(raw) {
  const schema = String(raw.schema || '');
  // Accept house-builder/v5 or NEWER. The room subset this loader reads
  // (id/name/role/shape/material/x/y/w/h) is stable from v5 on, and by design this
  // loader consumes a subset and DEGRADES the rest (engine-leads) — so a newer schema
  // is always safe (v7 added the optional room.role this loader already reads). Older
  // (v4 and below) predate this shape and are rejected.
  const ver = schema.match(/^house-builder\/v(\d+)$/);
  if (!ver || Number(ver[1]) < 5) {
    fail(`unsupported schema '${raw.schema}' (expected house-builder/v5 or newer)`);
  }
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : null;
  if (!rooms || !rooms.length) fail('no rooms (need at least one)');
  const seen = new Set();
  for (const r of rooms) {
    const id = String(r?.id ?? '');
    if (!id) fail('a room is missing an id');
    if (seen.has(id)) fail(`duplicate room id '${id}'`);
    seen.add(id);
    if (!(Number(r.w) > 0) || !(Number(r.h) > 0)) {
      fail(`room '${id}' must have w>0 and h>0`);
    }
    const shape = String(r.shape ?? 'rect');
    if (shape !== 'rect' && shape !== 'round') {
      fail(`room '${id}' has unsupported shape '${shape}' (expected rect or round)`);
    }
  }
  for (const o of (Array.isArray(raw.openings) ? raw.openings : [])) {
    if (o.kind !== 'door' && o.kind !== 'window') {
      fail(`opening has unknown kind '${o.kind}' (must be door|window)`);
    }
    if (!Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) {
      fail('an opening is missing x/y');
    }
  }
}

// ── Geometry (house-builder units; AABB — round rooms keep a bounding rect, the same
// way floorPlan.js/authoredPlans.js bound a round room for hit-testing) ────────────

function roomRectHb(room) {
  const x0 = Number(room.x), y0 = Number(room.y);
  const w = Number(room.w), h = Number(room.h);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

// Is a point ON (within a small tolerance of) a room's rectangle boundary? Openings
// sit exactly on the wall centerline the tool snapped them to, so the tolerance only
// absorbs float rounding — not real distance search.
const EDGE_EPS = 0.05;
function pointOnRectBoundary(rect, x, y) {
  const onVert = (Math.abs(x - rect.x0) < EDGE_EPS || Math.abs(x - rect.x1) < EDGE_EPS)
    && y >= rect.y0 - EDGE_EPS && y <= rect.y1 + EDGE_EPS;
  const onHoriz = (Math.abs(y - rect.y0) < EDGE_EPS || Math.abs(y - rect.y1) < EDGE_EPS)
    && x >= rect.x0 - EDGE_EPS && x <= rect.x1 + EDGE_EPS;
  return onVert || onHoriz;
}

/**
 * roomsAtOpening(rooms, opening) -> string[] of ORIGINAL room ids whose rect
 * boundary the opening's point sits on. A standalone exterior wall opening touches
 * exactly ONE room; a shared interior wall (two rooms drawn abutting) touches TWO —
 * the tool never records the second room explicitly (`opening.room` is a single
 * "nearest sample" tag), so this geometric membership test recovers it. Deterministic.
 */
function roomsAtOpening(rooms, opening) {
  const x = Number(opening.x), y = Number(opening.y);
  const out = [];
  for (const r of rooms) {
    if (pointOnRectBoundary(roomRectHb(r), x, y)) out.push(String(r.id));
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

// Do two rects ABUT — share a wall SEGMENT of positive length (not merely touch at a
// corner)? Used as the fallback edge source when the drawn doors don't reach a room.
function rectsAbut(A, B) {
  const overlapY = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
  const overlapX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
  // Vertical shared wall: A.right == B.left (or vice-versa) with a y-overlap.
  const sharedVert = (Math.abs(A.x1 - B.x0) < EDGE_EPS || Math.abs(B.x1 - A.x0) < EDGE_EPS) && overlapY > EDGE_EPS;
  // Horizontal shared wall: A.bottom == B.top (or vice-versa) with an x-overlap.
  const sharedHoriz = (Math.abs(A.y1 - B.y0) < EDGE_EPS || Math.abs(B.y1 - A.y0) < EDGE_EPS) && overlapX > EDGE_EPS;
  return sharedVert || sharedHoriz;
}

// Squared centre-to-centre distance between two rects (for nearest-neighbour repair).
function rectDist2(A, B) {
  const acx = (A.x0 + A.x1) / 2, acy = (A.y0 + A.y1) / 2;
  const bcx = (B.x0 + B.x1) / 2, bcy = (B.y0 + B.y1) / 2;
  const dx = bcx - acx, dy = bcy - acy;
  return dx * dx + dy * dy;
}

// The outward-facing compass direction for an opening on a room's OUTER wall, from
// which edge of that room's rect the point lands closest to (used for the exterior
// front door's direction — independent of the interior compass).
function outwardDirFromRoom(rect, x, y) {
  const dLeft = Math.abs(x - rect.x0), dRight = Math.abs(x - rect.x1);
  const dTop = Math.abs(y - rect.y0), dBottom = Math.abs(y - rect.y1);
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return 'west';
  if (min === dRight) return 'east';
  if (min === dTop) return 'north';
  return 'south';
}

// ── Role selection ────────────────────────────────────────────────────────────────
// A room's role: its own `role` if it names a KNOWN engine role (so roomDetail reads
// it), else a cottage default by position — entry rooms get the hearth room, other
// rooms a bedchamber (a lived-in default, never a void).
function roleForRoom(room, isEntry) {
  const declared = (typeof room?.role === 'string') ? room.role.trim() : '';
  if (declared && KNOWN_ROLES.has(declared)) return declared;
  if (isEntry) return 'hearthroom';
  return DEFAULT_ROLE;
}

// The set of roles roomDetail.js recognizes — mirrored here so an unknown role
// degrades to a default rather than producing an empty room. Kept in sync with
// roomDetail.js ROLES; a role not here simply isn't carried as a role: tag (the
// room still loads, at its positional default).
const KNOWN_ROLES = new Set([
  'narthex', 'nave', 'crossing', 'apse', 'chapel', 'vestry', 'crypt', 'belltower',
  'taproom', 'kitchen', 'cellar', 'quarters', 'pantry', 'privy',
  'plaza', 'stallrow', 'counting', 'storeroom',
  'greathall', 'tower', 'armory', 'barracks', 'solar', 'dungeon',
  'hearthroom', 'bedchamber', 'scullery',
  'mead', 'hearthrow', 'sleeping', 'larder', 'loomroom',
  'maw', 'tunnel', 'den', 'hoard', 'warren', 'pit', 'nest',
  'foyer', 'study', 'library', 'lab', 'observ', 'vault',
  'mouth', 'gallery', 'broodcell', 'royalchamber', 'cocoonstore',
]);

// ── Entry room + canonical ids ─────────────────────────────────────────────────────
// Entry = the room tagged 'entry', else the room the exterior (single-room) front
// door borders, else lexicographically first. Mirrors floorPlan.js/authoredPlans.js.
function pickEntryRoomId(raw) {
  const rooms = raw.rooms;
  const tagged = rooms.find(r => Array.isArray(r.tags) && r.tags.map(String).map(s => s.toLowerCase()).includes('entry'));
  if (tagged) return String(tagged.id);
  for (const d of (raw.openings || []).filter(o => o.kind === 'door')) {
    const at = roomsAtOpening(rooms, d);
    if (at.length === 1) return at[0]; // a door bordering exactly one room = the front door
  }
  return rooms.map(r => String(r.id)).sort((a, b) => a.localeCompare(b))[0];
}

// Canonicalize free-text room ids to procgen's `room:<structId>:<n>` shape, entry
// ALWAYS `:1`. interiors.js's enterStructureInterior drops the player into
// topo.rooms[0] AFTER an alpha-sort (NOT the entry TAG); procgen dodges this because
// its ids are `:1`,`:2`,… with entry `:1` sorting first, and a free-text id ("hall")
// has no such guarantee. Tim's own name stays the DISPLAY name; only the id changes.
function canonicalRoomIds(raw, structId) {
  const entryId = pickEntryRoomId(raw);
  const rest = raw.rooms.map(r => String(r.id)).filter(id => id !== entryId).sort((a, b) => a.localeCompare(b));
  const ordered = [entryId, ...rest];
  const map = new Map();
  ordered.forEach((origId, i) => map.set(origId, `room:${structId}:${i + 1}`));
  return map;
}

// ── The adjacency graph (doors → edges, + abutment fallback + orphan repair) ────────
/**
 * buildEdges(raw, idMap) -> { edges: [{a,b}] (canonical ids, sorted), repaired: [...] }
 *
 * The room graph the engine's reciprocal-compass topology needs. Three passes, in
 * priority order, each ADDING edges the earlier passes didn't already produce:
 *   1. DOORS — every opening that borders exactly TWO rooms is the doorway the player
 *      goes through: a topology edge. (The primary, authored source.)
 *   2. ABUTMENT FALLBACK — when the drawn doors leave a room's connection ambiguous,
 *      two rooms that SHARE A WALL SEGMENT get an edge, so a room you drew touching
 *      the hall is reachable even if you forgot to draw the interior door.
 *   3. ORPHAN REPAIR — any room still unreachable from the entry is joined to its
 *      nearest neighbour (centre-to-centre). Guarantees a CONNECTED graph — never an
 *      orphaned room / soft-lock. Repairs are reported (the report flags them).
 * Deterministic (pure geometry + sorted iteration); no rng.
 */
function buildEdges(raw, idMap) {
  const rooms = raw.rooms;
  const rectOf = new Map(rooms.map(r => [String(r.id), roomRectHb(r)]));
  const edgeSet = new Set();
  const edges = [];
  const addEdge = (origA, origB, why, sink) => {
    if (origA === origB) return false;
    const a = idMap.get(origA), b = idMap.get(origB);
    if (!a || !b) return false;
    const [lo, hi] = [a, b].sort((x, y) => x.localeCompare(y));
    const key = `${lo}|${hi}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    edges.push({ a: lo, b: hi });
    if (sink) sink.push({ a: origA, b: origB, why });
    return true;
  };

  const ids = rooms.map(r => String(r.id)).sort((a, b) => a.localeCompare(b));
  const entryId = pickEntryRoomId(raw);
  // canonical id → original id, so the reachability BFS runs in original-id space
  // (rectOf, ids, entryId are all original) while `edges` are canonical.
  const canonToOrig = new Map([...idMap.entries()].map(([o, c]) => [c, o]));
  const reachableFromEntry = () => {
    const adj = new Map(ids.map(id => [id, []]));
    for (const e of edges) {
      const oa = canonToOrig.get(e.a), ob = canonToOrig.get(e.b);
      if (oa && ob) { adj.get(oa).push(ob); adj.get(ob).push(oa); }
    }
    const seen = new Set([entryId]);
    const q = [entryId];
    while (q.length) {
      const u = q.shift();
      for (const v of (adj.get(u) || [])) if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
    return seen;
  };

  // Pass 1 — doors bordering exactly two rooms. The PRIMARY, authored adjacency: a
  // drawn interior door is a doorway. (Walls without a door BLOCK — they are not
  // edges here, so "walls block; doors gate" holds for a fully-doored building.)
  for (const o of (raw.openings || [])) {
    if (o.kind !== 'door') continue;
    const at = roomsAtOpening(rooms, o);
    if (at.length !== 2) continue; // exterior (1) or ungrounded (0)
    addEdge(at[0], at[1], 'door');
  }

  // Pass 2 — abutment fallback, applied ONLY where it is load-bearing for connectivity
  // (a true fallback, not a blanket "every shared wall is a doorway" — that would
  // punch phantom doorways through walls the author left solid). An abutting pair is
  // connected only when at least one of the two rooms is otherwise UNREACHABLE from the
  // entry via the door graph — i.e. the author drew the rooms touching but forgot the
  // interior door, and without this the room would be orphaned. Rooms already reachable
  // keep their solid shared walls. Deterministic: sorted ids, nearest abutting anchor
  // first, re-checking reachability so each fallback edge earns its place.
  const abutted = [];
  for (let guard = 0; guard <= ids.length; guard++) {
    const reached = reachableFromEntry();
    // The lexicographically-first unreachable room that ABUTS a reachable one.
    const orphan = ids.find(id => !reached.has(id)
      && ids.some(other => reached.has(other) && rectsAbut(rectOf.get(id), rectOf.get(other))));
    if (!orphan) break;
    // Connect it to its nearest reachable abutting neighbour.
    let best = null, bestD = Infinity;
    for (const cand of ids) {
      if (!reached.has(cand) || !rectsAbut(rectOf.get(orphan), rectOf.get(cand))) continue;
      const d = rectDist2(rectOf.get(orphan), rectOf.get(cand));
      if (d < bestD) { bestD = d; best = cand; }
    }
    if (best == null || !addEdge(orphan, best, 'abut', abutted)) break;
  }

  // Pass 3 — orphan repair. Any room STILL unreachable (it neither has a door nor abuts
  // a reachable room — a floating room, or one linked only by a tunnel we degrade) is
  // joined to its nearest reachable neighbour. Guarantees a CONNECTED graph — never an
  // orphaned room / soft-lock. Repairs are reported (flagged, never hidden).
  const repaired = [];
  // Guard against a pathological loop; at most one repair per room.
  for (let guard = 0; guard <= ids.length; guard++) {
    const reached = reachableFromEntry();
    const orphans = ids.filter(id => !reached.has(id));
    if (!orphans.length) break;
    // Repair the lexicographically-first orphan → its nearest ALREADY-REACHED room
    // (so each repair grows the connected component toward the entry).
    const orphan = orphans[0];
    let best = null, bestD = Infinity;
    for (const cand of ids) {
      if (!reached.has(cand)) continue;
      const d = rectDist2(rectOf.get(orphan), rectOf.get(cand));
      if (d < bestD) { bestD = d; best = cand; }
    }
    if (best == null) {
      // No reached room to attach to (entry itself orphaned by a bug) — attach to the
      // entry as a last resort so the graph is still connected.
      best = entryId === orphan ? (ids.find(id => id !== orphan) || orphan) : entryId;
    }
    if (!addEdge(orphan, best, 'repair', repaired)) break; // no progress → stop (defensive)
  }

  edges.sort((x, y) => (x.a + '|' + x.b).localeCompare(y.a + '|' + y.b));
  return { edges, abutted, repaired };
}

// ── Topology ───────────────────────────────────────────────────────────────────────
function buildTopology(raw, structId, idMap, edges) {
  const entryId = pickEntryRoomId(raw);
  const rooms = raw.rooms.map(r => {
    const origId = String(r.id);
    const isEntry = origId === entryId;
    const tags = [];
    if (isEntry) tags.push('entry');
    const role = roleForRoom(r, isEntry);
    if (KNOWN_ROLES.has(role)) tags.push(`role:${role}`);
    return { id: idMap.get(origId), tags };
  });
  return { kind: 'rooms', rooms, edges };
}

// ── authoredPlan (drawn geometry + compass-agreeing doors + role furniture) ─────────
const DIRS4 = ['north', 'east', 'south', 'west'];
const VEC4 = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// A deterministic integer (gx,gy) compass slot per room, reusing topology.js's OWN
// spanning-tree compass layout (interiorCompassLayout) so the ASCII renderer + the
// door directions walk the SAME "north/east/south/west from the entry" logic movement
// resolves. (Mirrors authoredPlans.js compassSlotsFor + floorPlan.js placeOnGrid.)
function compassSlotsFor(topology, entryCanonId) {
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
  if (entryCanonId) { put(entryCanonId, 0, 0); queue.push(entryCanonId); }
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

function buildAuthoredPlan(raw, structId, idMap, topology) {
  const rooms = raw.rooms;
  const entryId = pickEntryRoomId(raw);
  const entryCanon = idMap.get(entryId);
  const rectOf = new Map(rooms.map(r => [String(r.id), roomRectHb(r)]));

  // 'stone' anywhere → the stone shell; otherwise the cottage timber default.
  const materials = new Set(rooms.map(r => String(r.material || '')).filter(Boolean));
  const shell = materials.has('stone') ? 'stone' : 'timber';

  // Compass slots (gx,gy) + the reciprocal exits map — the SAME the engine uses, so
  // door directions below match what getInteriorView/movement resolve.
  const exits = interiorCompassLayout(topology);
  const gxy = compassSlotsFor(topology, entryCanon);

  // roomDetail furniture per room (so the drawn plan shows role-appropriate furniture
  // and the prose stack + the map agree). roomDetail reads the topology room's tags.
  const topoRoomById = new Map((topology.rooms || []).map(r => [String(r.id), r]));

  const outRooms = [];
  for (const r of rooms) {
    const origId = String(r.id);
    const id = idMap.get(origId);
    const rect = rectOf.get(origId);
    const cx = hbToLayout((rect.x0 + rect.x1) / 2);
    const cy = hbToLayout((rect.y0 + rect.y1) / 2);
    const w = hbToLayout(rect.x1 - rect.x0);
    const h = hbToLayout(rect.y1 - rect.y0);
    const slot = gxy.get(id) || { gx: 0, gy: 0 };
    const isEntry = origId === entryId;
    const topoRoom = topoRoomById.get(id) || { id, tags: [] };
    const det = roomDetail(topoRoom, 'cottage');
    // roomDetail's furniture is normalized 0..1 of the room box — floorPlan consumers
    // read exactly this shape (fx/fy/w/h/r), so pass it through verbatim.
    outRooms.push({
      id, role: det.name, name: String(r.name || origId),
      shape: (r.shape === 'round') ? 'round' : 'rect',
      dark: isEntry ? 0 : (det.dark || 0),
      isEntry,
      gx: slot.gx, gy: slot.gy,
      cx, cy, w, h,
      furniture: det.furniture,
    });
  }

  // hull + footprint: bounding box of every drawn room box.
  let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
  for (const r of outRooms) {
    hx0 = Math.min(hx0, r.cx - r.w / 2); hx1 = Math.max(hx1, r.cx + r.w / 2);
    hy0 = Math.min(hy0, r.cy - r.h / 2); hy1 = Math.max(hy1, r.cy + r.h / 2);
  }
  const hull = Number.isFinite(hx0) ? { x: hx0, y: hy0, w: hx1 - hx0, h: hy1 - hy0, round: false } : null;
  const footprint = Number.isFinite(hx0) ? { w: hx1 - hx0, h: hy1 - hy0 } : { w: 1, h: 1 };

  // doors[] — floorPlan.js shape { x, y, dir, a, b }. Interior doors come from the
  // topology EDGES (every edge → one door), with `dir` taken from the ENGINE's
  // compass layout so it agrees with movement + the exit labels. The doorway point
  // is the midpoint of the two rooms' shared-wall overlap when they abut, else the
  // segment between their centres (a repaired/diagonal pair). The exterior/front door
  // is the first single-room door (b:''), its direction outward from that room's wall.
  const canonToOrig = new Map([...idMap.entries()].map(([o, c]) => [c, o]));
  const doors = [];
  for (const e of (topology.edges || [])) {
    const oa = canonToOrig.get(e.a), ob = canonToOrig.get(e.b);
    if (!oa || !ob) continue;
    const rectA = rectOf.get(oa), rectB = rectOf.get(ob);
    // Direction a→b from the compass layout (authoritative). Fall back to geometry if
    // the compass didn't assign a slot for this edge (should not happen for tree/loop
    // edges the layout covers).
    const exA = exits.get(e.a) || {};
    let dir = DIRS4.find(d => exA[d] === e.b) || dirFromRects(rectA, rectB);
    const { x, y } = doorwayPoint(rectA, rectB);
    doors.push({ x: hbToLayout(x), y: hbToLayout(y), dir, a: e.a, b: e.b });
  }
  // Exterior front door — the first door opening bordering exactly one room.
  let exteriorSeen = false;
  for (const o of (raw.openings || [])) {
    if (o.kind !== 'door' || exteriorSeen) continue;
    const at = roomsAtOpening(rooms, o);
    if (at.length !== 1) continue;
    const rect = rectOf.get(at[0]);
    doors.push({
      x: hbToLayout(Number(o.x)), y: hbToLayout(Number(o.y)),
      dir: outwardDirFromRoom(rect, Number(o.x), Number(o.y)),
      a: idMap.get(at[0]), b: '',
    });
    exteriorSeen = true;
  }

  // windows[] — ADDITIVE (roomWindows derives presence; not load-bearing here).
  const windows = [];
  for (const o of (raw.openings || [])) {
    if (o.kind !== 'window') continue;
    const at = roomsAtOpening(rooms, o);
    if (!at.length) continue;
    windows.push({
      x: hbToLayout(Number(o.x)), y: hbToLayout(Number(o.y)),
      room: idMap.get(at[0]), exterior: at.length === 1,
    });
  }

  return {
    type: 'cottage', name: String(raw.name || 'Authored House'), shell,
    dark: 0, footprint, hull,
    rooms: outRooms, doors, corridors: [], nonAdjacent: [], windows,
  };
}

// The direction from rect A to rect B (A's side of a shared/near wall), from centres.
function dirFromRects(rectA, rectB) {
  const acx = (rectA.x0 + rectA.x1) / 2, acy = (rectA.y0 + rectA.y1) / 2;
  const bcx = (rectB.x0 + rectB.x1) / 2, bcy = (rectB.y0 + rectB.y1) / 2;
  const dx = bcx - acx, dy = bcy - acy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

// The point a doorway between two rooms sits at: the centre of their shared-wall
// overlap when they abut on a vertical/horizontal wall, else the midpoint of their
// centres (a repaired/diagonal pair — the door lands where they come closest).
function doorwayPoint(A, B) {
  const overlapY0 = Math.max(A.y0, B.y0), overlapY1 = Math.min(A.y1, B.y1);
  const overlapX0 = Math.max(A.x0, B.x0), overlapX1 = Math.min(A.x1, B.x1);
  // Vertical shared wall (A.right == B.left or vice-versa).
  if ((Math.abs(A.x1 - B.x0) < EDGE_EPS || Math.abs(B.x1 - A.x0) < EDGE_EPS) && overlapY1 > overlapY0) {
    const x = Math.abs(A.x1 - B.x0) < EDGE_EPS ? A.x1 : B.x1;
    return { x, y: (overlapY0 + overlapY1) / 2 };
  }
  // Horizontal shared wall (A.bottom == B.top or vice-versa).
  if ((Math.abs(A.y1 - B.y0) < EDGE_EPS || Math.abs(B.y1 - A.y0) < EDGE_EPS) && overlapX1 > overlapX0) {
    const y = Math.abs(A.y1 - B.y0) < EDGE_EPS ? A.y1 : B.y1;
    return { x: (overlapX0 + overlapX1) / 2, y };
  }
  return { x: ((A.x0 + A.x1) / 2 + (B.x0 + B.x1) / 2) / 2, y: ((A.y0 + A.y1) / 2 + (B.y0 + B.y1) / 2) / 2 };
}

/**
 * loadAuthoredStructure(json, { nodeId, structureId }) -> a structure object ready
 * to merge into world.structures.byId (via ensureStructures / the normal structures
 * path), built from ALL rooms of a house-builder export, connected by its doors as
 * reciprocal-compass doorways. Pure + deterministic; throws loudly on malformed input.
 *
 * @param json        a parsed house-builder/v5+ export object, OR a JSON string.
 * @param nodeId      the map node the structure attaches to (its anchors.nodeId).
 * @param structureId optional explicit id; defaults to `authored:<nodeId>`
 *                    (collision-free with procgen's `stgen:...` ids, stable so
 *                    worldHash is replay-stable).
 *
 * Also exposes the loader diagnostics (edges added by abutment fallback / orphan
 * repair) on a non-enumerable `__loaderInfo` so tests/the report can assert HOW the
 * graph was connected without changing the structure's hashed shape.
 *
 * @param strictFinalized when true, treat the export as FINALIZED canon: a plan that
 *                        needs pass-3 orphan repair throws instead of loading
 *                        (BUILDING_CANON_CONTRACT §14). Off by default — drafts,
 *                        demos, and the registry keep today's tolerant behavior.
 */
export function loadAuthoredStructure(json, { nodeId, structureId, strictFinalized } = {}) {
  const raw = coerceJson(json);
  validate(raw);

  const nid = String(nodeId || '');
  const explicitId = String(structureId || '');
  if (!explicitId && !nid) fail('cannot derive a structureId (no structureId and no nodeId given)');
  const structId = explicitId || `authored:${nid}`;

  const idMap = canonicalRoomIds(raw, structId);
  const { edges, abutted, repaired } = buildEdges(raw, idMap);

  // BUILDING_CANON_CONTRACT §14 — finalized authored canon is never repaired at load.
  // Under { strictFinalized: true } a plan that NEEDED pass-3 orphan repair is rejected:
  // the invented connection is a doorway the author never drew, so the fix belongs in
  // the Builder (add the doorway, or mark the room sealed) — not in runtime. Abutment
  // fallback (pass 2) stays tolerated at v0 — the author DREW the rooms touching — and
  // remains visible on __loaderInfo.abutted. Default (non-strict) behavior is unchanged.
  if (strictFinalized && repaired.length) {
    const pairs = repaired.map(r => `'${r.a}'→'${r.b}'`).join(', ');
    fail(`finalized structure required orphan repair (${repaired.length} invented connection${repaired.length === 1 ? '' : 's'}: ${pairs}) — an unreachable room must be given a doorway or marked sealed in the Builder; finalized canon is never repaired at load`);
  }
  const topology = buildTopology(raw, structId, idMap, edges);
  const authoredPlan = buildAuthoredPlan(raw, structId, idMap, topology);

  const structure = {
    id: structId,
    kind: 'building',
    nodeId: nid,
    anchors: { nodeId: nid },
    topology,
    surfaces: {},
    tags: ['authored', 'loader'],
    buildingType: 'cottage',
    authoredPlan,
  };

  // Loader diagnostics — non-enumerable so it never enters ensureStructures / the
  // hashed shape (ensureStructure rebuilds the object field-by-field anyway; this is
  // purely for the loader's caller/tests to inspect the connection strategy).
  Object.defineProperty(structure, '__loaderInfo', {
    value: {
      roomCount: raw.rooms.length,
      edgeCount: edges.length,
      abutted,   // edges added because two rooms shared a wall (no drawn door)
      repaired,  // edges added to reconnect an otherwise-orphaned room
    },
    enumerable: false,
  });

  return structure;
}

// ── BUILDER-SIDE VALIDATION / FINALIZATION (BUILDING_CANON_CONTRACT §13–§14) ─────────
// The strict-finalized gate (above) is runtime's HALF of the contract: finalized canon
// is never repaired at load. These two helpers are the AUTHORING half: the Builder runs
// the SAME loader (the one algorithm — never a duplicated geometry pass) over a draft
// export and surfaces the orphan-repair problem to the AUTHOR, before finalization.
// Pure + deterministic: no rng, no I/O, no world mutation, no timestamps — same input,
// byte-identical output, forever (finalized artifacts stay replay/worldHash-safe).

/**
 * validateAuthoredExport(json, { structureId }) -> a validation report the Builder can
 * show the author. NEVER throws — malformed input becomes errors[], not an exception
 * (this is the author-facing path; the report IS the interface).
 *
 *   ok        true ⇔ loadAuthoredStructure(json, { strictFinalized: true }) would load —
 *             the report and the runtime gate agree by construction (same loader).
 *   errors    author-facing blocking failures (malformed input, or one line per
 *             orphan-repaired room naming the unreachable room + the invented
 *             connection + the fix: add a doorway in the Builder).
 *   repaired  the raw pass-3 repair list [{a,b,why}] in ORIGINAL room-id space.
 *   abutted   pass-2 abutment fallbacks — TOLERATED at v0 (the author drew the rooms
 *             touching; only the door glyph is missing) but reported so the author sees
 *             which connections were inferred rather than drawn.
 */
export function validateAuthoredExport(json, { structureId = 'builder:validate' } = {}) {
  let st;
  try {
    st = loadAuthoredStructure(json, { structureId: String(structureId) });
  } catch (err) {
    return { ok: false, errors: [String(err?.message || err)], repaired: [], abutted: [], roomCount: 0, edgeCount: 0 };
  }
  const info = st.__loaderInfo || {};
  const repaired = info.repaired || [];
  const errors = repaired.map(r =>
    `room '${r.a}' is unreachable from the entrance — finalizing would require inventing a connection to '${r.b}' the plan never drew. Add a doorway to it in the Builder.`);
  return {
    ok: errors.length === 0,
    errors,
    repaired,
    abutted: info.abutted || [],
    roomCount: info.roomCount || 0,
    edgeCount: info.edgeCount || 0,
  };
}

/**
 * finalizeAuthoredExport(json, { structureId }) -> the FINALIZED artifact: a deep copy
 * of the draft export carrying the provenance/validation block the contract requires
 * (§12 export pipeline / §14 repair policy). Throws (author-facing message, naming the
 * unreachable rooms) when the draft is not clean — finalization is a GATE, never a
 * repair. The input draft is NOT mutated.
 *
 * The provenance block is additive (the loader ignores unknown fields) and carries NO
 * timestamps/hashes-of-the-moment — a re-finalized identical draft is byte-identical,
 * so finalized artifacts are stable data (like a pack). `finalized: true` is the flag a
 * future runtime opt-in packet will read to choose { strictFinalized: true } at load;
 * nothing reads it yet (this packet does not activate strict loading anywhere).
 */
export function finalizeAuthoredExport(json, { structureId = 'builder:finalize' } = {}) {
  const raw = coerceJson(json);
  const report = validateAuthoredExport(raw, { structureId });
  if (!report.ok) {
    fail(`cannot finalize: ${report.errors.join(' ')}`);
  }
  const out = JSON.parse(JSON.stringify(raw)); // deep copy — never mutate the draft
  out.provenance = {
    finalized: true,
    authoredBy: 'house-builder',
    validation: {
      validator: 'engine/structures/authoredStructure.js#validateAuthoredExport',
      ok: true,
      roomCount: report.roomCount,
      edgeCount: report.edgeCount,
      repaired: [],               // by definition — a finalized artifact needed none
      abutted: report.abutted,    // tolerated at v0, recorded so nothing is hidden
    },
  };
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════
// THE REGISTRY (absorbed from authoredPlans.js under LOADER-MERGE) — a plan Tim authored
// FOR a specific procgen structure id substitutes for that structure. Every function here
// derives from the ONE materialization branch above (loadAuthoredStructure), so the
// registry path and the direct-load path can never diverge (U510's "MATCHES" assertion
// holds by construction). Pure + deterministic reads of already-loaded data — no rng, no
// I/O, no world mutation; malformed authored JSON throws at import time (see below).
// ════════════════════════════════════════════════════════════════════════════════════

function registryFail(structureId, msg) {
  throw new Error(`authoredStructure(registry): malformed authored plan for '${structureId}': ${msg}`);
}

// Validate + index every builtin plan ONCE at module-evaluation time. Reuses the loader's
// own validate() (house-builder/v5+ tolerance) via a trial load, and additionally requires
// the `structureId` field the registry keys on (the one field WE add, not in the tool's
// export). A broken fixture fails the very first import of this module — never a runtime
// surprise. A structure id simply ABSENT from the registry is the normal (99.9%) case:
// every un-authored structure resolves to null here and the caller falls back to procgen
// with no warning noise.
const REGISTRY = new Map(); // structureId -> raw house-builder export JSON
for (const raw of BUILTIN_AUTHORED_PLANS) {
  const structureId = String(raw?.structureId || '');
  if (!structureId) registryFail('(unknown)', 'missing structureId (the field WE add — see the fixture header)');
  if (REGISTRY.has(structureId)) registryFail(structureId, 'duplicate structureId across authored plans');
  // Loud well-formedness gate — a trial load through the real loader (throws on any
  // malformed room/opening) so the registry validates with the SAME rules the live path uses.
  try { loadAuthoredStructure(raw, { structureId }); }
  catch (err) { registryFail(structureId, err?.message || String(err)); }
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

/**
 * makeAuthoredStructure(structureId, nodeId) -> a full structure object ready to merge
 * into world.structures.byId, or null when structureId isn't registered. Delegates to
 * loadAuthoredStructure (the ONE materialization branch) with the registered raw export,
 * so a registered authored structure carries the SAME depth (authored roles, roomDetail
 * furniture, doors→adjacency, orphan repair) a directly-loaded one does. Pure +
 * deterministic (no rng, no I/O). Never throws for an absent id (returns null); a
 * registered-but-malformed plan already failed at import time above.
 */
export function makeAuthoredStructure(structureId, nodeId) {
  const raw = authoredRawFor(structureId);
  if (!raw) return null;
  return loadAuthoredStructure(raw, { nodeId, structureId: String(structureId) });
}

/**
 * buildAuthoredTopology(raw, structId) -> the topology.js { kind:'rooms', rooms, edges }
 * shape, extracted from loadAuthoredStructure's output so it AGREES with the materialized
 * structure by construction (U510 asserts st.topology deep-equals this). Kept as a named
 * export for the tests/report that call it directly; pure + deterministic.
 */
export function buildAuthoredTopology(raw, structId) {
  const st = loadAuthoredStructure(raw, { structureId: String(structId) });
  return st.topology;
}

/**
 * buildAuthoredFloorPlan(raw, structId) -> floorPlan.js's OWN output shape (the drawn
 * geometry + compass-agreeing doors + role furniture), extracted from the SAME
 * loadAuthoredStructure output as buildAuthoredTopology so the two shapes always agree on
 * what a room is called. Kept as a named export for the tests/report; pure + deterministic.
 */
export function buildAuthoredFloorPlan(raw, structId) {
  const st = loadAuthoredStructure(raw, { structureId: String(structId) });
  return st.authoredPlan;
}
