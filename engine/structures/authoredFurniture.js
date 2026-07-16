/**
 * FUNC-MINIS-1 — Builder-placed furniture is engine truth.
 *
 * Tim's hard bar (2026-07-09): "If a thing can be placed, the world must believe
 * in it." A piece drawn in the Building Builder must survive finalize/load with
 * its exact COUNT, KIND, IDENTITY, and DRAWN POSITION — never replaced by a
 * role-based loadout, never a visual-only mini. Rendering is a projection of
 * engine truth, not the source of truth (mesh/GLB metadata stays renderer-side,
 * keyed by `kind`; nothing in here names a model file).
 *
 * This module is the ONE contract joining the engine's two furniture surfaces:
 *
 *   Model B (spatial/visual truth) — plan/topology room `furniture` items
 *     ({ id, kind, label, shape, material, light, cover, loot, flat, fx, fy,
 *        w, h, r, authored }) read by the floor-plan render (LocalMap via
 *     floorPlan), cover (coverFeatures), blocking (tacticalPos FURN-1), and
 *     narration (roomDetail/roomState). `authoredPlanFurniture` builds these
 *     from the Builder's drawn pieces.
 *
 *   Model A (interaction truth) — node.furniture pieces ({ name, parts, bulk,
 *     weight, tags, notes, material, category, hardness }) read by objectsHere,
 *     llmPhysics (smash/search/burn — material + hardness drive DCs and
 *     outcomes), and mutated ONLY via effectsCore modifyFurniture /
 *     removeFurniture deltas. `authoredNodePieces` + `seedAuthoredNodeFurniture`
 *     build these from a materialized structure, once per structure per node.
 *
 * KNOWN, ACCEPTED DIVERGENCE: a bed renders cloth (Model B material tints the
 * ink) but SMASHES as wood (Model A material — a blow lands on the frame, and
 * splinters, not shreds, are the honest outcome).
 *
 * PURE + DETERMINISTIC. Same export in, same pieces out, forever; seeding is
 * append-only, name-unique per node (effectsCore ROM-4 resolves furniture ops
 * by name), idempotent via the node's `furnitureSeeded` marker so a piece the
 * player took or wrecked NEVER resurrects on a later structure pass.
 */

import { FURN } from './roomDetail.js';
import { floorPlan } from './floorPlan.js';
import { authoredObjectId } from '../objects/identity.js';

// Builder kind -> Model A physics. llmPhysics reads material/hardness straight
// off the node piece (explicit fields, never name-keyword inference — 'cookpot'
// would otherwise read as ceramic). category is the interaction class the DM
// infers affordances from: container → open/search/break-into; furniture →
// obstacle/cover. bulk > 2 = too heavy to take (generateFurniture convention).
// BUILDER-OBJ-1 (2026-07-11) extends the table to the full supported Builder
// palette. Light-bearing kinds are OBJECTS that carry fire — Model B's 'fire'
// render material must never leak into smash physics (a lantern is ironwork).
const KIND_PHYSICS = {
  barrel:     { material: 'wood',  category: 'container', hardness: 2, bulk: 3, weight: 3, parts: ['stave', 'hoop', 'lid'], notes: 'coopered oak, iron-hooped' },
  bed:        { material: 'wood',  category: 'furniture', hardness: 2, bulk: 4, weight: 3, parts: ['frame', 'slat', 'bedding'], notes: 'a timber frame under a straw tick' },
  cookpot:    { material: 'iron',  category: 'container', hardness: 4, bulk: 2, weight: 3, parts: ['belly', 'handle', 'lid'], notes: 'soot-blacked cast iron, meant for a fire' },
  dresser:    { material: 'wood',  category: 'container', hardness: 2, bulk: 4, weight: 4, parts: ['drawer', 'panel', 'knob'], notes: 'a drawered keeper of clothes and small things' },
  chest:      { material: 'iron',  category: 'container', hardness: 4, bulk: 3, weight: 4, parts: ['lid', 'hasp', 'band'], notes: 'iron-banded, built to keep what it holds' },
  crate:      { material: 'wood',  category: 'container', hardness: 2, bulk: 3, weight: 3, parts: ['slat', 'corner post', 'lid'], notes: 'nailed pine slats, pry-able' },
  shelf:      { material: 'wood',  category: 'furniture', hardness: 2, bulk: 4, weight: 3, parts: ['plank', 'bracket', 'upright'], notes: 'open shelving, pegged to the wall' },
  table:      { material: 'wood',  category: 'furniture', hardness: 2, bulk: 4, weight: 4, parts: ['top', 'leg', 'trestle'], notes: 'a plank top on trestle legs' },
  chair:      { material: 'wood',  category: 'furniture', hardness: 2, bulk: 2, weight: 2, parts: ['leg', 'back', 'seat'], notes: 'a joined wooden chair' },
  nightstand: { material: 'wood',  category: 'container', hardness: 2, bulk: 2, weight: 2, parts: ['drawer', 'top', 'leg'], notes: 'a small drawered stand for bedside things' },
  wardrobe:   { material: 'wood',  category: 'container', hardness: 2, bulk: 4, weight: 4, parts: ['door', 'rail', 'panel'], notes: 'a tall cupboard for hanging clothes' },
  rug:        { material: 'cloth', category: 'furniture', hardness: 0, bulk: 3, weight: 2, parts: ['fringe', 'backing'], notes: 'woven wool, laid flat underfoot' },
  runner:     { material: 'cloth', category: 'furniture', hardness: 0, bulk: 2, weight: 1, parts: ['fringe', 'backing'], notes: 'a long woven strip down the boards' },
  lantern:    { material: 'iron',  category: 'furniture', hardness: 3, bulk: 1, weight: 1, parts: ['pane', 'cage', 'handle'], notes: 'horn-paned ironwork that carries its own light' },
  candles:    { material: 'wax',   category: 'furniture', hardness: 0, bulk: 1, weight: 1, parts: ['taper', 'holder'], notes: 'soft wax tapers in a holder' },
  hearth:     { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['mantel', 'firebrick', 'flue'], notes: 'set masonry — part of the house more than furniture in it' },
  // FURN-PARITY-1 — the remaining roomDetail catalog kinds, so a PROCGEN loadout
  // piece seeds with explicit physics exactly like a Builder-placed one (U707-A
  // fails closed if a new FURN kind lands without a row here). Same conventions
  // as above: hardness 0..5 (cloth→stone), bulk > 2 = too heavy to take, the
  // KNOWN divergence rule holds (Model B render material may differ from smash
  // physics — a stall renders cloth but its frame smashes as wood).
  firepit:    { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['stone ring', 'ash bed'], notes: 'a ring of fire-blacked stones' },
  brazier:    { material: 'iron',  category: 'furniture', hardness: 4, bulk: 3, weight: 3, parts: ['bowl', 'tripod'], notes: 'cold ironwork on three legs' },
  longtable:  { material: 'wood',  category: 'furniture', hardness: 2, bulk: 5, weight: 5, parts: ['top', 'leg', 'trestle'], notes: 'a hall table of long planks' },
  counter:    { material: 'wood',  category: 'furniture', hardness: 3, bulk: 5, weight: 5, parts: ['top', 'panel', 'shelf'], notes: 'a joiner-built serving counter' },
  stall:      { material: 'wood',  category: 'storage',   hardness: 1, bulk: 4, weight: 3, parts: ['post', 'plank', 'awning'], notes: 'a plank stall under a cloth awning' },
  loom:       { material: 'wood',  category: 'furniture', hardness: 2, bulk: 4, weight: 4, parts: ['frame', 'beam', 'treadle'], notes: 'a standing weaver\'s loom' },
  anvil:      { material: 'iron',  category: 'furniture', hardness: 4, bulk: 3, weight: 5, parts: ['horn', 'face', 'base'], notes: 'a smith\'s anvil, one iron mass' },
  bedding:    { material: 'cloth', category: 'furniture', hardness: 0, bulk: 2, weight: 1, parts: ['ticking', 'straw'], notes: 'straw bedding under a wool tick' },
  basin:      { material: 'stone', category: 'furniture', hardness: 5, bulk: 4, weight: 5, parts: ['rim', 'bowl'], notes: 'a hewn stone basin' },
  font:       { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['bowl', 'pedestal'], notes: 'a carved stone font' },
  well:       { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['coping', 'windlass', 'rope'], notes: 'a stone-lipped well' },
  fountain:   { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['basin', 'spout'], notes: 'a carved stone fountain' },
  altar:      { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['slab', 'plinth'], notes: 'a consecrated stone slab' },
  throne:     { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['seat', 'arm', 'back'], notes: 'a seat cut from stone' },
  lectern:    { material: 'wood',  category: 'furniture', hardness: 2, bulk: 2, weight: 2, parts: ['desk', 'stem', 'foot'], notes: 'a reader\'s standing desk' },
  sarcoph:    { material: 'stone', category: 'container', hardness: 5, bulk: 5, weight: 5, parts: ['lid', 'coffer'], notes: 'a lidded stone coffin' },
  pillar:     { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['drum', 'capital'], notes: 'a load-bearing stone column' },
  statue:     { material: 'stone', category: 'furniture', hardness: 5, bulk: 5, weight: 5, parts: ['figure', 'plinth'], notes: 'a carved figure on a plinth' },
  bones:      { material: 'bone',  category: 'furniture', hardness: 1, bulk: 2, weight: 1, parts: ['skull', 'long bone'], notes: 'a heap of old bones' },
  rubble:     { material: 'stone', category: 'furniture', hardness: 2, bulk: 3, weight: 4, parts: ['block', 'shard'], notes: 'fallen masonry and broken stone' },
  web:        { material: 'web',   category: 'furniture', hardness: 0, bulk: 2, weight: 1, parts: ['strand', 'mass'], notes: 'a thick sheet of webbing' },
  eggsac:     { material: 'web',   category: 'furniture', hardness: 0, bulk: 3, weight: 2, parts: ['membrane', 'clutch'], notes: 'a swollen, glistening sac' },
  bench:      { material: 'wood',  category: 'furniture', hardness: 2, bulk: 3, weight: 3, parts: ['seat', 'leg'], notes: 'a plain plank bench' },
  pew:        { material: 'wood',  category: 'furniture', hardness: 2, bulk: 4, weight: 4, parts: ['seat', 'back', 'kneeler'], notes: 'a long worship bench' },
  rack:       { material: 'iron',  category: 'storage',   hardness: 3, bulk: 3, weight: 3, parts: ['upright', 'hook'], notes: 'an iron rack for arms and tools' },
};

// Narrow immutable census for cross-catalog coverage tests. The full interaction
// records stay private so tests cannot mutate Builder runtime physics by importing
// the table they are trying to verify.
export const AUTHORED_KIND_MATERIALS = Object.freeze(
  Object.entries(KIND_PHYSICS).map(([kind, def]) => Object.freeze({ kind, material: def.material }))
);

// Fallback hardness by material for kinds without an explicit physics row
// (mirrors generateFurniture.js's hardness scale).
const MATERIAL_HARDNESS = { cloth: 0, web: 0, fire: 0, glass: 1, bone: 1, ceramic: 1, wood: 2, iron: 4, stone: 5 };

// Damage states (rulings/index.js vocabulary) beyond which a piece stops being
// cover/blocking-worthy. 'damaged' (dents, a torn-off part) still stands;
// 'lit'/'burning' still stands (hazardous cover is still cover).
export const DESTROYED_STATES = new Set(['shattered', 'torn', 'broken', 'wrecked', 'destroyed', 'collapsed']);

export function isFurnitureDestroyed(piece) {
  if (!piece) return false;
  const state = String(piece.state || '');
  if (DESTROYED_STATES.has(state)) return true;
  // Wood's terminal condition (rulings/index.js resolveBreakRuling): parts are
  // torn away one smash at a time — each one a salvage item — with state
  // 'damaged' throughout. A damaged piece with NOTHING left to tear off is a
  // wreck. (An iron piece keeps its parts when dented, so it never trips this.)
  return state === 'damaged' && Array.isArray(piece.parts) && piece.parts.length === 0;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/**
 * furnitureByRoom(raw) -> Map<origRoomId, drawnPieces[]>
 * Which room each drawn piece belongs to. Prefers the export's own per-piece
 * `room` field (the Builder writes it); falls back to geometric containment of
 * the piece's center. Order within a room follows raw.furniture order — that
 * order is the pieces' identity, so it must stay stable.
 */
export function furnitureByRoom(raw) {
  const rooms = Array.isArray(raw?.rooms) ? raw.rooms : [];
  const byId = new Map(rooms.map(r => [String(r.id), r]));
  const out = new Map();
  for (const p of (Array.isArray(raw?.furniture) ? raw.furniture : [])) {
    if (!p || typeof p !== 'object') continue;
    let rid = String(p.room || '');
    if (!rid || !byId.has(rid)) {
      const cx = num(p.x, NaN) + num(p.w, 1) / 2;
      const cy = num(p.y, NaN) + num(p.h, 1) / 2;
      const hit = Number.isFinite(cx) && Number.isFinite(cy)
        ? rooms.find(r => cx >= +r.x && cx <= +r.x + +r.w && cy >= +r.y && cy <= +r.y + +r.h)
        : null;
      rid = hit ? String(hit.id) : '';
    }
    if (!rid) continue;
    if (!out.has(rid)) out.set(rid, []);
    out.get(rid).push(p);
  }
  return out;
}

/**
 * authoredPlanFurniture(pieces, rect, canonRoomId) -> Model B furniture items.
 * Drawn pieces (builder cells) -> the exact roomDetail/floorPlan item shape,
 * positioned where they were DRAWN: fx/fy prefer the export's own normalized
 * ux/uy center, else derive from the cell rect. Rect pieces keep their drawn
 * footprint (normalized to the room box); circles keep the catalog radius.
 * Ids are `${canonRoomId}#a${i}` — deterministic from plan order.
 */
export function authoredPlanFurniture(pieces, rect, canonRoomId) {
  const rw = Math.max(1e-6, rect.x1 - rect.x0);
  const rh = Math.max(1e-6, rect.y1 - rect.y0);
  const out = [];
  (Array.isArray(pieces) ? pieces : []).forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const kind = String(p.type || p.kind || '').trim();
    if (!kind) return;
    // Every placeable EXISTS — an unknown kind still becomes a real object with
    // sane wood defaults rather than silently vanishing (the hard bar).
    const base = FURN[kind] || { label: kind.replace(/[_-]+/g, ' '), shape: 'rect', material: 'wood', light: 0, cover: null, w: 0.1, h: 0.1 };
    const isCircle = base.shape === 'circle';
    const fx = Number.isFinite(+p.ux) ? +p.ux : (num(p.x, rect.x0) + num(p.w, 1) / 2 - rect.x0) / rw;
    const fy = Number.isFinite(+p.uy) ? +p.uy : (num(p.y, rect.y0) + num(p.h, 1) / 2 - rect.y0) / rh;
    out.push({
      id: `${canonRoomId}#a${i}`,
      kind,
      label: base.label,
      shape: base.shape,
      material: base.material,
      light: base.light || 0,
      cover: base.cover || null,
      loot: base.loot || 0,
      flat: base.flat ? 1 : 0,
      fx: clamp01(fx), fy: clamp01(fy),
      w: isCircle ? 0 : Math.max(0.02, Math.min(1, num(p.w, 0) / rw)) || (base.w || 0.1),
      h: isCircle ? 0 : Math.max(0.02, Math.min(1, num(p.h, 0) / rh)) || (base.h || 0.1),
      r: isCircle ? (base.r || 0.05) : 0,
      authored: 1,
    });
  });
  return out;
}

/**
 * authoredNodePieces(structure) -> Model A pieces for every authored plan item.
 * Names are the catalog labels (uniquified at seed time); each piece carries
 * explicit physics fields plus provenance { authored, structureId, roomId,
 * pieceId } so cover/blocking/assignment can join Model A state back to the
 * exact plan piece — never an affinity guess.
 */
export function authoredNodePieces(structure) {
  const rooms = Array.isArray(structure?.authoredPlan?.rooms) ? structure.authoredPlan.rooms : [];
  const out = [];
  for (const room of rooms) {
    const items = Array.isArray(room?.furniture) ? room.furniture : [];
    for (const f of items) {
      if (!f || f.authored !== 1) continue; // role-fallback loadouts are narration-only
      const kind = String(f.kind || '');
      const phys = KIND_PHYSICS[kind] || {};
      const material = String(phys.material || f.material || 'wood');
      const category = String(phys.category || (f.loot ? 'container' : 'furniture'));
      out.push({
        name: String(f.label || kind),
        kind,
        parts: Array.isArray(phys.parts) ? [...phys.parts] : [],
        bulk: Number.isFinite(phys.bulk) ? phys.bulk : 3,
        weight: Number.isFinite(phys.weight) ? phys.weight : 3,
        tags: [material, category],
        notes: String(phys.notes || 'placed by its builder'),
        material,
        category,
        hardness: Number.isFinite(phys.hardness) ? phys.hardness : (MATERIAL_HARDNESS[material] ?? 2),
        authored: true,
        structureId: String(structure.id),
        roomId: String(room.id),
        pieceId: String(f.id),
        // OBJ-STATE-1 — globally-unique stable identity, minted at birth from the
        // immutable structure+piece provenance (survives ROM-4 name-uniquify + splices).
        objectId: authoredObjectId(structure.id, f.id),
      });
    }
  }
  return out;
}

/**
 * seedAuthoredNodeFurniture(world, nodeId) -> world
 * Append the authored Model A pieces for every authored structure at this node,
 * ONCE per structure ever (node.furnitureSeeded marker): a piece the player
 * later takes (removeFurniture) or wrecks stays taken/wrecked — reseeding would
 * be a resurrection lie. Append-only: generic decompression furniture and every
 * existing mutation survive untouched. Deterministic: structures sorted by id,
 * pieces in plan order, name collisions resolved by stable ordinals.
 */
export function seedAuthoredNodeFurniture(world, nodeId) {
  const nid = String(nodeId || '');
  if (!nid) return world;
  const byId = world?.structures?.byId || {};
  const structures = Object.values(byId)
    .filter(s => s && typeof s === 'object' && String(s.nodeId || '') === nid && s.authoredPlan)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!structures.length) return world;

  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const node = nodes.find(n => n && String(n.id) === nid);
  if (!node) return world;

  const seeded = new Set(Array.isArray(node.furnitureSeeded) ? node.furnitureSeeded.map(String) : []);
  const pending = structures.filter(s => !seeded.has(String(s.id)));
  if (!pending.length) return world;

  const existing = Array.isArray(node.furniture) ? node.furniture : [];
  const names = new Set(existing.map(p => String(p?.name || '')));
  const added = [];
  for (const st of pending) {
    for (const c of authoredNodePieces(st)) {
      let name = c.name;
      for (let n = 2; names.has(name); n++) name = `${c.name} ${n}`; // ROM-4: unique per node
      names.add(name);
      added.push({ ...c, name });
    }
  }

  const marker = [...seeded, ...pending.map(s => String(s.id))].sort();
  return {
    ...world,
    map: {
      ...world.map,
      nodes: nodes.map(n => (n && String(n.id) === nid)
        ? { ...n, furniture: [...existing, ...added], furnitureSeeded: marker }
        : n),
    },
  };
}

/**
 * FURN-PARITY-1 — procgenNodePieces(structure) -> Model A pieces for every
 * roomDetail LOADOUT item of a PROCGEN structure (mirror of authoredNodePieces).
 * The loadout the map draws, cover shelters behind, and blocking masks IS the
 * furniture — one object per drawn item, identity objectId =
 * au:<structureId>:<planPieceId> (the same structure-scoped provenance law
 * authored pieces use; the `au:` namespace means "structure+piece provenance",
 * the `authored` FLAG means Builder-drawn — these pieces carry `planSourced`
 * instead, so every supported-domain verb gate (hold/drag/throw) stays
 * authored-only). Authored buildings return [] — their role-fallback loadout
 * rooms stay narration-only by the FUNC-MINIS ruling (an empty authored room
 * stays visibly empty). Pure + deterministic (floorPlan/roomDetail are pure).
 */
export function procgenNodePieces(structure) {
  if (!structure || typeof structure !== 'object' || structure.authoredPlan) return [];
  let plan; try { plan = floorPlan(structure); } catch { return []; }
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  const out = [];
  for (const room of rooms) {
    for (const f of (Array.isArray(room.furniture) ? room.furniture : [])) {
      if (!f || f.authored === 1 || f.id == null) continue;
      const kind = String(f.kind || '');
      if (!kind) continue;
      const phys = KIND_PHYSICS[kind] || {};
      const material = String(phys.material || f.material || 'wood');
      const category = String(phys.category || (f.loot ? 'container' : 'furniture'));
      out.push({
        name: String(f.label || kind),
        kind,
        parts: Array.isArray(phys.parts) ? [...phys.parts] : [],
        bulk: Number.isFinite(phys.bulk) ? phys.bulk : 3,
        weight: Number.isFinite(phys.weight) ? phys.weight : 3,
        tags: [material, category],
        notes: String(phys.notes || 'part of the room it stands in'),
        material,
        category,
        hardness: Number.isFinite(phys.hardness) ? phys.hardness : (MATERIAL_HARDNESS[material] ?? 2),
        planSourced: true,
        structureId: String(structure.id),
        roomId: String(room.id),
        pieceId: String(f.id),
        objectId: authoredObjectId(structure.id, f.id),
      });
    }
  }
  return out;
}

/**
 * seedProcgenNodeFurniture(world, nodeId) -> world
 * The procgen mirror of seedAuthoredNodeFurniture: append the loadout Model A
 * pieces for every PROCGEN structure at this node, ONCE per structure ever
 * (same node.furnitureSeeded marker — the two seams are disjoint by
 * authoredPlan, so a structure is ever claimed by exactly one). Append-only,
 * ROM-4 name-unique, deterministic (structures sorted by id, rooms/items in
 * plan order). A piece the player later takes or wrecks stays taken/wrecked.
 */
export function seedProcgenNodeFurniture(world, nodeId) {
  const nid = String(nodeId || '');
  if (!nid) return world;
  const byId = world?.structures?.byId || {};
  const structures = Object.values(byId)
    .filter(s => s && typeof s === 'object' && String(s.nodeId || '') === nid && !s.authoredPlan)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!structures.length) return world;

  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const node = nodes.find(n => n && String(n.id) === nid);
  if (!node) return world;

  const seeded = new Set(Array.isArray(node.furnitureSeeded) ? node.furnitureSeeded.map(String) : []);
  const pendingAll = structures.filter(s => !seeded.has(String(s.id)));
  if (!pendingAll.length) return world;

  const existing = Array.isArray(node.furniture) ? node.furniture : [];
  const names = new Set(existing.map(p => String(p?.name || '')));
  const added = [];
  const claimed = [];
  for (const st of pendingAll) {
    const candidates = procgenNodePieces(st);
    if (!candidates.length) continue; // topology-less structure: nothing to claim, retry when it grows rooms
    claimed.push(String(st.id));
    for (const c of candidates) {
      let name = c.name;
      for (let n = 2; names.has(name); n++) name = `${c.name} ${n}`; // ROM-4: unique per node
      names.add(name);
      added.push({ ...c, name });
    }
  }
  if (!claimed.length) return world;

  const marker = [...seeded, ...claimed].sort();
  return {
    ...world,
    map: {
      ...world.map,
      nodes: nodes.map(n => (n && String(n.id) === nid)
        ? { ...n, furniture: [...existing, ...added], furnitureSeeded: marker }
        : n),
    },
  };
}

/**
 * procgenPlanPieceStatus(world, structure) -> { seeded, destroyed:Set<pieceId>, present:Set<pieceId> }
 * The live status of a PROCGEN structure's plan pieces, for every projection:
 *   - !seeded            → treat every item as intact (an unvisited/legacy node
 *                          has no twins yet — the sheet must keep drawing it whole)
 *   - destroyed.has(id)  → the piece is a wreck (terminal twin in place, or
 *                          salvage-removed with its identity on the timeline) → rubble
 *   - !present.has(id) (and not destroyed) → the piece was TAKEN (legacy
 *                          remove+createItem leaves no salvage event) → draw
 *                          NOTHING, grant nothing; never rubble
 *   - otherwise          → intact.
 * Authored structures return { seeded:false } — destroyedAuthoredPieceIds owns
 * that domain byte-identically. Pure read; the timeline IS the removal record
 * (Canon Log wins — same ruling as destroyedObjectIdsAtNode).
 */
export function procgenPlanPieceStatus(world, structure) {
  const empty = { seeded: false, destroyed: new Set(), present: new Set() };
  const stId = String(structure?.id || '');
  if (!stId || !structure || structure.authoredPlan) return empty;
  const nid = String(structure?.nodeId || '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nid);
  if (!node || !Array.isArray(node.furnitureSeeded) || !node.furnitureSeeded.map(String).includes(stId)) return empty;

  const destroyed = new Set();
  const present = new Set();
  for (const p of (Array.isArray(node.furniture) ? node.furniture : [])) {
    if (!p || p.planSourced !== true || String(p.structureId) !== stId) continue;
    const pid = String(p.pieceId);
    present.add(pid);
    if (isFurnitureDestroyed(p)) destroyed.add(pid);
  }
  const prefix = `au:${stId}:`;
  for (const e of (Array.isArray(world?.timeline) ? world.timeline : [])) {
    if (!e || e.kind !== 'salvage') continue;
    const oid = String(e.data?.objectId || '');
    if (oid.startsWith(prefix)) destroyed.add(oid.slice(prefix.length));
  }
  return { seeded: true, destroyed, present };
}

/**
 * authoredIntactBedAt(world, nodeId) -> piece | null
 * The first placed, still-intact BED at this node — the rest resolver's hook:
 * a real bed the builder placed gives a real night (same band as a settlement
 * bed / a sound shelter — an existing rule, not a new number). A wrecked bed
 * is honestly no bed at all.
 */
export function authoredIntactBedAt(world, nodeId) {
  const nid = String(nodeId || '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nid);
  for (const p of (Array.isArray(node?.furniture) ? node.furniture : [])) {
    if (p && p.authored === true && String(p.kind) === 'bed' && !isFurnitureDestroyed(p)) return p;
  }
  return null;
}

/**
 * destroyedAuthoredPieceIds(world, structure) -> Set<planPieceId>
 * The plan-piece ids whose Model A twin is gone (taken/removed) or in a
 * destroyed state — the set cover and blocking subtract so a smashed barrel
 * stops sheltering and stops blocking. Only meaningful once the structure has
 * seeded (an unseeded structure has no twins and reports none destroyed).
 */
export function destroyedAuthoredPieceIds(world, structure) {
  const out = new Set();
  const stId = String(structure?.id || '');
  if (!stId) return out;
  const nid = String(structure?.nodeId || '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nid);
  if (!node || !Array.isArray(node.furnitureSeeded) || !node.furnitureSeeded.map(String).includes(stId)) return out;

  const twins = new Map();
  for (const p of (Array.isArray(node.furniture) ? node.furniture : [])) {
    if (p && p.authored === true && String(p.structureId) === stId) twins.set(String(p.pieceId), p);
  }
  const rooms = Array.isArray(structure?.authoredPlan?.rooms) ? structure.authoredPlan.rooms : [];
  for (const room of rooms) {
    for (const f of (Array.isArray(room?.furniture) ? room.furniture : [])) {
      if (!f || f.authored !== 1) continue;
      const twin = twins.get(String(f.id));
      if (!twin || isFurnitureDestroyed(twin)) out.add(String(f.id));
    }
  }
  return out;
}
