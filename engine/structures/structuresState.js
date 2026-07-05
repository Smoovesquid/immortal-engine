import { normalizeAnchor } from './anchors.js';
import { normalizeTopology } from './topology.js';
import { isDoorState } from './doors.js';

function ensureInteriorDiscovery(x) {
  const obj = x && typeof x === 'object' ? x : {};
  const byStructureIdIn = (obj.byStructureId && typeof obj.byStructureId === 'object') ? obj.byStructureId : {};
  const byStructureId = {};

  for (const [sidRaw, recRaw] of Object.entries(byStructureIdIn)) {
    const sid = String(sidRaw);
    if (!sid) continue;
    const rec = recRaw && typeof recRaw === 'object' ? recRaw : {};
    const seenRoomIdsIn = (rec.seenRoomIds && typeof rec.seenRoomIds === 'object') ? rec.seenRoomIds : {};
    const visitedRoomIdsIn = (rec.visitedRoomIds && typeof rec.visitedRoomIds === 'object') ? rec.visitedRoomIds : {};

    const seenRoomIds = {};
    const visitedRoomIds = {};
    for (const [rid, turn] of Object.entries(seenRoomIdsIn)) {
      const key = String(rid);
      if (!key) continue;
      seenRoomIds[key] = clampInt(turn ?? 0, 0, 999999999);
    }
    for (const [rid, turn] of Object.entries(visitedRoomIdsIn)) {
      const key = String(rid);
      if (!key) continue;
      visitedRoomIds[key] = clampInt(turn ?? 0, 0, 999999999);
    }

    byStructureId[sid] = {
      enteredTurn: clampInt(rec.enteredTurn ?? 0, 0, 999999999),
      seenRoomIds,
      visitedRoomIds,
      lastRoomId: String(rec.lastRoomId ?? '')
    };
  }

  return { byStructureId };
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const v of (Array.isArray(arr) ? arr : [])) {
    const s = String(v);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function ensureStructures(x) {
  const obj = x && typeof x === 'object' ? x : {};
  const byIdIn = (obj.byId && typeof obj.byId === 'object') ? obj.byId : {};
  const byId = {};

  for (const [k, v] of Object.entries(byIdIn)) {
    const s = ensureStructure(v, k);
    if (s) byId[s.id] = s;
  }

  const nextId = clampInt(obj.nextId ?? 1, 1, 1000000000);
  const interiorDiscovery = ensureInteriorDiscovery(obj.interiorDiscovery);

  return { byId, nextId, interiorDiscovery };
}

function ensureStructure(v, fallbackId) {
  const x = v && typeof v === 'object' ? v : {};
  const id = String(x.id ?? fallbackId ?? '');
  if (!id) return null;

  const kind = String(x.kind ?? 'building');
  const nodeId = String(x.nodeId ?? '');

  const anchors = normalizeAnchor(x.anchors);
  const topology = normalizeTopology(x.topology);

  const surfaces = (x.surfaces && typeof x.surfaces === 'object') ? x.surfaces : {};
  const tags = uniqStrings(x.tags).sort((a, b) => a.localeCompare(b));
  // Optional declared building type (e.g. the player's home cottage). Only kept
  // when set so other structures' shape — and their worldHash — is unchanged.
  const buildingType = (typeof x.buildingType === 'string' && x.buildingType) ? x.buildingType : null;
  // P-72 — provenance for player-built structures (lean-to, palisade…). Like
  // buildingType, kept only when set so existing structures' shape and hash are
  // untouched (no WORLD_VERSION bump: old saves carry no player builds).
  const build = ensureBuild(x.build);
  // MR-2a (v31) — canon door records. SHAPE-ONLY normalization here (no world
  // context is available mid-ensureStructures): validate/round each stored door's
  // fields and keep the array only when present, so a structure that carries no
  // stored doors[] is byte-identical to its pre-v31 shape. The AUTHORITATIVE
  // derivation — deriving the full door list (interior doors + the exterior front
  // door) with seeded defaults, and completing a partial one — runs at the TAIL of
  // ensureWorld (backfillDoors, state.js), once the map/floorPlan geometry the door
  // cells project onto is fully assembled. This mirrors TAC-1's tactical-pos backfill.
  const doors = ensureDoorsShape(x.doors);
  // MR-2c — Tim's own drawn floorplan (authoredPlans.js), stored VERBATIM on the
  // structure. floorPlan.js's override branch reads this instead of computing
  // geometry from topology. Like buildingType/build/doors: kept only when it's a
  // well-formed floorPlan-shaped object (has a rooms[] — the one field every
  // consumer of floorPlan() actually reads), so a structure that carries none is
  // byte-identical to its pre-MR-2c shape (no WORLD_VERSION bump: old saves and
  // every un-authored structure never had this field).
  const authoredPlan = ensureAuthoredPlanShape(x.authoredPlan);

  return {
    id,
    kind,
    nodeId,
    anchors,
    topology,
    surfaces,
    tags,
    ...(buildingType ? { buildingType } : {}),
    ...(build ? { build } : {}),
    ...(doors ? { doors } : {}),
    ...(authoredPlan ? { authoredPlan } : {})
  };
}

// MR-2c — shape-only normalization for a stored authoredPlan. This is a TRUSTED,
// engine-produced blob (authoredPlans.js's buildAuthoredFloorPlan, never hand-typed
// by a player or an LLM), so normalization here is a light well-formedness check —
// not a field-by-field re-validation — mirroring how `surfaces` is treated above.
// Round-trips the object unchanged when it looks like a floorPlan (has rooms[]);
// drops it (returns null) when the stored value has been corrupted into something
// that isn't, so a malformed save degrades to procgen rather than throwing deep in
// a renderer.
function ensureAuthoredPlanShape(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  if (!Array.isArray(x.rooms) || !x.rooms.length) return null;
  return x;
}

// MR-2a — shape-only door normalization (no world context). Keeps a well-formed
// stored doors[] round-trippable: each door needs a non-empty id and an `a` room,
// a boolean `exterior`, an 'ns'|'ew' orient, and a valid state (else the enum's
// default 'shut' — the tail backfill re-derives the true seeded default anyway).
// Returns a sorted array, or null when there is nothing well-formed to keep (so the
// field is omitted and the structure's shape stays pre-v31 until the tail authors it).
function ensureDoorsShape(x) {
  if (!Array.isArray(x)) return null;
  const out = [];
  const seen = new Set();
  for (const d of x) {
    if (!d || typeof d !== 'object') continue;
    const id = String(d.id ?? '');
    const a = String(d.a ?? '');
    if (!id || !a || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      a,
      b: String(d.b ?? ''),
      orient: (d.orient === 'ns' || d.orient === 'ew') ? d.orient : 'ew',
      exterior: Boolean(d.exterior),
      state: isDoorState(d.state) ? String(d.state) : 'shut'
    });
  }
  if (!out.length) return null;
  out.sort((p, q) => String(p.id).localeCompare(String(q.id)));
  return out;
}

// P-72 — normalize a player-built structure's provenance. quality is the
// material+skill+time outcome; restBand is the rest payoff (shelters only);
// labor records the moral fork (solo/hired/coerced); materials is the bill.
function ensureBuild(b) {
  if (!b || typeof b !== 'object') return null;
  const plan = String(b.plan ?? '');
  if (!plan) return null;
  const quality = ['poor', 'sound', 'fine'].includes(b.quality) ? b.quality : 'sound';
  const labor = ['solo', 'hired', 'coerced'].includes(b.labor) ? b.labor : 'solo';
  const builtDay = clampInt(b.builtDay ?? 0, 0, 999999999);
  const restBand = ['short', 'good', 'long'].includes(b.restBand) ? b.restBand : null;
  const matsIn = (b.materials && typeof b.materials === 'object') ? b.materials : {};
  const materials = {};
  for (const k of Object.keys(matsIn).sort((a, c) => a.localeCompare(c))) {
    const v = clampInt(matsIn[k] ?? 0, 0, 1000000000);
    if (v > 0) materials[String(k)] = v;
  }
  return {
    plan,
    quality,
    ...(restBand ? { restBand } : {}),
    labor,
    builtDay,
    materials
  };
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
