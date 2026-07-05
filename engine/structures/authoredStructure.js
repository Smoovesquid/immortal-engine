// LOAD-1 — the smallest loader: one hand-authored room becomes a walkable engine
// structure (docs/briefs/LOAD-1-smallest-loader.md).
//
// ENGINE LEADS. public/house-builder.html exports a `house-builder/v6` document
// (rooms/walls/openings/tunnels/corridors/furniture/secrets — see its btnExport
// handler). This module maps the SMALLEST useful subset of that export DOWN onto the
// engine's existing interior model — the SAME `{ kind, nodeId, anchors, topology,
// surfaces, tags, buildingType, authoredPlan }` structure object every other seam
// (movement, invariants, doors, roomDetail, structureMaterial) already reads for an
// MR-2c authored plan — and IGNORES/DEGRADES everything the engine can't represent
// yet. The goal is to prove the PATH end-to-end for ONE room: a room Tim drew is a
// room the player can walk into, look around in, and walk out of.
//
// ── What maps DOWN (v1, engine-leads) ────────────────────────────────────────────
//   • ONE room — the FIRST room in the export. Rectangular or round (the engine has
//     a 'round' shape). Its id is canonicalized to `room:<structId>:1` and tagged
//     'entry' so interiors.js drops the player into it (it picks topo.rooms[0] after
//     an alpha-sort, and a single `:1` room sorts first — the same convention
//     procgen and authoredPlans.js rely on).
//   • ROLE — room.role if present, else a sensible cottage default ('quarters').
//     The role + building='cottage' drive which furniture reads right and the
//     material line, exactly as roomDetail.js/structureMaterial.js do for procgen.
//   • MATERIAL — room.material 'timber'|'stone' selects the shell; anything else
//     falls back to timber (the cottage default). buildingType stays 'cottage' so
//     the whole read stack (furniture loadout, material prose) is coherent.
//   • A DOOR — the room is enterable because the engine's door tail (doors.js
//     deriveDoors, run by ensureWorld's backfillDoors) always authors exactly ONE
//     exterior front door on the entry room. We don't need to emit a door in the
//     plan for a single-room hut — the tail grounds the front door on the room's
//     outer wall. (An authored exterior door in the export is noted-degraded below.)
//
// ── What is IGNORED / DEGRADED (noted, not represented — future work) ─────────────
//   • EXTRA ROOMS — only the first room loads. A multi-room export degrades to its
//     first room. (Multi-room authored plans already have a path: authoredPlans.js's
//     makeAuthoredStructure, MR-2c — this loader is the smallest single-room proof.)
//   • WALLS[] (freeform/bowed wall segments), TUNNELS/CORRIDORS, SECRETS, WINDOWS,
//     room CURVES (bowed walls), SIZED/ANGLED door openings — all dropped. The one
//     room is a plain AABB; its front door is the seeded engine default.
//   • multi-FLOOR — the engine interior model is single-storey; not represented.
//
// ── Determinism + purity ─────────────────────────────────────────────────────────
// PURE and deterministic: same JSON in, byte-identical structure out, forever. No
// rng / Math.random, no I/O, no world mutation — the returned object is data the
// caller merges through the normal structures path (applyGeneratedStructuresForNode
// → ensureStructures). Authored content is FIXED data (like a pack), so worldHash
// stays stable under replay. MALFORMED JSON THROWS LOUDLY (a clear Error naming the
// problem) — it never silently corrupts state; the caller decides whether to surface
// or degrade (the demo wire-in try/catch-degrades to procgen, mirroring MR-2c).

// House-builder grid units → floorPlan layout units. Shares the MR-2c constant's
// value (authoredPlans.js HB_UNIT_TO_LAYOUT = 1) so a room drawn in the tool lands
// at the same layout scale whether it comes through this loader or MR-2c's.
const HB_UNIT_TO_LAYOUT = 1;
function hbToLayout(v) { return Number(v) * HB_UNIT_TO_LAYOUT; }

// The role a single authored room takes when the export doesn't name one. 'quarters'
// is a real cottage room role (roomDetail.js ROLES.quarters — a bed, nightstand,
// chest, lantern, rug), so an unroled hut reads like a lived-in room, not a void.
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
 * tunnels, secrets, extra rooms) — those are dropped, not errors.
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
  const first = rooms[0];
  const id = String(first?.id ?? '');
  if (!id) fail('the first room is missing an id');
  if (!(Number(first.w) > 0) || !(Number(first.h) > 0)) {
    fail(`room '${id}' must have w>0 and h>0`);
  }
  const shape = String(first.shape ?? 'rect');
  if (shape !== 'rect' && shape !== 'round') {
    fail(`room '${id}' has unsupported shape '${shape}' (expected rect or round)`);
  }
}

/**
 * loadAuthoredStructure(json, { nodeId, structureId }) -> a structure object ready
 * to merge into world.structures.byId (via ensureStructures / the normal structures
 * path), built from the FIRST room of a house-builder export. Pure + deterministic;
 * throws loudly on malformed input.
 *
 * @param json        a parsed house-builder/v6 (or v5) export object, OR a JSON string.
 * @param nodeId      the map node the structure attaches to (its anchors.nodeId).
 * @param structureId optional explicit id; defaults to a deterministic id derived
 *                    from the node (`authored:<nodeId>` — collision-free with procgen's
 *                    `stgen:...` ids, and stable so worldHash is replay-stable).
 */
export function loadAuthoredStructure(json, { nodeId, structureId } = {}) {
  const raw = coerceJson(json);
  validate(raw);

  const nid = String(nodeId || '');
  const explicitId = String(structureId || '');
  // A structureId must be resolvable: an explicit one, or a nodeId to derive
  // `authored:<nodeId>` from. Neither → fail loudly (a `authored:` id with no node
  // would ground nothing for movement/doors).
  if (!explicitId && !nid) fail('cannot derive a structureId (no structureId and no nodeId given)');
  const structId = explicitId || `authored:${nid}`;

  const room = raw.rooms[0];
  const origId = String(room.id);
  const roomId = `room:${structId}:1`; // entry sorts first — interiors.js convention

  // Role: the export's own role if present and non-empty, else the cottage default.
  const role = (typeof room.role === 'string' && room.role.trim()) ? room.role.trim() : DEFAULT_ROLE;
  const displayName = String(room.name || origId || 'Room');
  const shape = (room.shape === 'round') ? 'round' : 'rect';

  // Material: timber/stone select the shell family; anything else → timber (cottage
  // default). buildingType stays 'cottage' regardless, so roomDetail/structureMaterial
  // resolve a coherent cottage (a stone-walled cottage still reads as a cottage room).
  const mat = String(room.material || '').toLowerCase();
  const material = (mat === 'stone') ? 'stone' : 'timber';
  const shell = (material === 'stone') ? 'stone' : 'timber';

  // ── topology — one room, tagged 'entry' (interiors.js drops the player here) AND
  // 'role:<role>' so roomDetail reads the AUTHORED role (a bed-having 'quarters')
  // instead of the cottage entry's hearth room. No edges (a single room has no
  // interior doorways). normalizeTopology re-sorts/validates on store; emission order
  // here doesn't matter, only the deterministic id + tag VALUES.
  const topology = { kind: 'rooms', rooms: [{ id: roomId, tags: ['entry', `role:${role}`] }], edges: [] };

  // ── authoredPlan — floorPlan.js's OWN output shape, so floorPlan(structure)
  // returns Tim's DRAWN geometry verbatim (its override branch reads authoredPlan)
  // instead of re-tiling via placeOnGrid. One room: it IS the entry, at a compass
  // slot of (0,0) (interiorCompassLayout roots the entry at the origin). The exterior
  // front door is authored by the engine tail (doors.js deriveDoors), so doors: [].
  const x0 = hbToLayout(Number(room.x)), y0 = hbToLayout(Number(room.y));
  const w = hbToLayout(Number(room.w)), h = hbToLayout(Number(room.h));
  const cx = x0 + w / 2, cy = y0 + h / 2;
  // A single room roots at the compass origin (interiorCompassLayout puts the entry
  // at 0,0). Hardcoded for the trivial one-room case — no dependency on the layout's
  // return, and byte-identical to what it would give.
  const gx = 0, gy = 0;

  const authoredPlan = {
    type: 'cottage',
    name: String(raw.name || 'Authored House'),
    shell,
    dark: 0,
    footprint: { w, h },
    hull: { x: cx - w / 2, y: cy - h / 2, w, h, round: shape === 'round' },
    rooms: [{
      id: roomId,
      role: displayName,
      name: displayName,
      shape,
      dark: 0,
      isEntry: true,
      gx, gy,
      cx, cy, w, h,
      furniture: []
    }],
    doors: [],       // exterior front door authored by deriveDoors (engine tail)
    corridors: [],
    nonAdjacent: [],
    windows: []
  };

  return {
    id: structId,
    kind: 'building',
    nodeId: nid,
    anchors: { nodeId: nid },
    topology,
    surfaces: {},
    tags: ['authored', 'loader'],
    buildingType: 'cottage',
    authoredPlan
  };
}
