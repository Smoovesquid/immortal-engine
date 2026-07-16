// Object Query Layer — deterministic access to physical world state
// All functions are pure and use existing world data (no RNG, no IO).

import { ensureWorld } from '../state.js';
import { ensureMap } from '../map/mapState.js';
import { schema } from './schema.js';
import { isFurnitureDestroyed } from '../structures/authoredFurniture.js';

// Get all objects at a specific node
export function objectsAtNode(world, nodeId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const node = m.nodes.find(n => n.id === String(nodeId));
  if (!node) return [];

  const objects = [];
  const furniture = Array.isArray(node.furniture) ? node.furniture : [];
  for (let i = 0; i < furniture.length; i++) {
    const f = furniture[i];
    objects.push({
      type: 'furniture',
      nodeId: String(nodeId),
      index: i,
      id: `furniture:${nodeId}:${i}`,
      name: String(f.name || ''),
      material: schema.inferMaterial(f.name, f.tags),
      category: schema.inferCategory(f.name, f.tags),
      state: String(f.state || 'intact'),
      hp: 5, // TODO: store on furniture
      parts: Array.isArray(f.parts) ? f.parts.map(String) : [],
      tags: Array.isArray(f.tags) ? f.tags.map(String) : [],
      weight: Number(f.weight) || 2,
      bulk: Number(f.bulk) || 2,
      noise: Number(f.noise) || 0,
      light: Number(f.light) || 0
    });
  }
  return objects;
}

// Get all objects in the current world (expensive — rarely used)
export function allObjectsInWorld(world) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const all = [];
  for (const node of (m.nodes || [])) {
    all.push(...objectsAtNode(w, node.id));
  }
  return all;
}

// Query: can this object be broken?
export function canBreak(obj) {
  if (!obj) return false;
  const material = obj.material || schema.MATERIALS.WOOD;
  const progression = schema.getStateProgression(material);
  return progression.length > 2; // has more than one state
}

// Query: can this object be taken (carried)?
export function canTake(obj) {
  if (!obj) return false;
  return Number(obj.bulk || 2) <= 2;
}

// Query: can this object burn?
export function canBurn(obj) {
  if (!obj) return false;
  const material = obj.material || schema.MATERIALS.WOOD;
  const props = schema.MATERIAL_PROPERTIES[material];
  return props && props.flammable > 0;
}

// Query: does this object have disassemblable parts?
export function hasParts(obj) {
  if (!obj) return false;
  return Array.isArray(obj.parts) && obj.parts.length > 0;
}

// Query: is this object hollow (can contain items)?
export function isHollow(obj) {
  if (!obj) return false;
  const material = obj.material || schema.MATERIALS.WOOD;
  const props = schema.MATERIAL_PROPERTIES[material];
  return props && props.hollow === true;
}

// Find objects by name (case-insensitive substring match)
export function objectsByName(world, nodeId, searchStr) {
  const objects = objectsAtNode(world, nodeId);
  const search = String(searchStr || '').toLowerCase();
  if (!search) return objects;
  return objects.filter(obj => String(obj.name || '').toLowerCase().includes(search));
}

// Find objects by material
export function objectsByMaterial(world, nodeId, material) {
  const objects = objectsAtNode(world, nodeId);
  return objects.filter(obj => obj.material === material);
}

// Find breakable objects at a node
export function breakableObjects(world, nodeId) {
  return objectsAtNode(world, nodeId).filter(canBreak);
}

// Find flammable objects at a node
export function flammableObjects(world, nodeId) {
  return objectsAtNode(world, nodeId).filter(canBurn);
}

// Find objects that can be taken at a node
export function takeableObjects(world, nodeId) {
  return objectsAtNode(world, nodeId).filter(canTake);
}

// OBJ-RUBBLE-1 / DEATH-TRUTH-1 — node-scoped destruction memory, DERIVED from
// canon. Two shapes, one Set of stable objectIds:
//   (a) pieces destroyed-and-REMOVED by the salvage lane — the lane's own timeline
//       event ('salvage', pushed at the playloop emit site) now carries the piece's
//       objectId, so the removal is remembered by identity, never by name;
//   (b) pieces still STANDING in node.furniture with a terminal state (the
//       durability/rulings lanes mirror to state 'wrecked' in place).
// No new world field backs this — the timeline IS the record (Canon Log wins),
// and the overlay invariant deliberately forbids world.objects records for
// removed pieces. Pre-feature salvage events carry no objectId and are honestly
// invisible here (old destructions stay unlocatable rather than guessed at).
// A TAKEN piece (physics/take path — no salvage event) never appears.
export function destroyedObjectIdsAtNode(world, nodeId) {
  const w = ensureWorld(world);
  const nid = String(nodeId || '');
  const out = new Set();
  if (!nid) return out;
  for (const e of (Array.isArray(w.timeline) ? w.timeline : [])) {
    if (!e || e.kind !== 'salvage') continue;
    const d = e.data && typeof e.data === 'object' ? e.data : {};
    if (String(d.nodeId || '') !== nid) continue;
    const oid = String(d.objectId || '');
    if (oid) out.add(oid);
  }
  const node = (Array.isArray(w.map?.nodes) ? w.map.nodes : []).find(n => n && String(n.id) === nid);
  for (const p of (Array.isArray(node?.furniture) ? node.furniture : [])) {
    if (p && p.objectId && isFurnitureDestroyed(p)) out.add(String(p.objectId));
  }
  return out;
}

// U708 / DEATH-TRUTH-1 — the TERMINAL POSITION of each salvage-removed object,
// derived from the same canon record (the salvage event now captures the piece's
// live placement at the moment of destruction — playloop's trySalvage stamps
// `data.pos` BEFORE removeFurniture deletes the overlay, the only other holder
// of a moved position). Map<objectId, { cell:{x,y}, structureId?, room? } | null>:
// null means "no override — the piece died at its plan/base position" (also
// every pre-feature event, which is honest: nothing could move before
// OBJ-MOVE-1). Renderers position rubble by: live placed overlay (standing
// wreck) > this record (removed piece) > the plan anchor. Pure read; last event
// wins per identity.
export function destroyedObjectPositionsAtNode(world, nodeId) {
  const w = ensureWorld(world);
  const nid = String(nodeId || '');
  const out = new Map();
  if (!nid) return out;
  for (const e of (Array.isArray(w.timeline) ? w.timeline : [])) {
    if (!e || e.kind !== 'salvage') continue;
    const d = e.data && typeof e.data === 'object' ? e.data : {};
    if (String(d.nodeId || '') !== nid) continue;
    const oid = String(d.objectId || '');
    if (!oid) continue;
    const p = d.pos && typeof d.pos === 'object' ? d.pos : null;
    const cell = p && p.cell && Number.isFinite(+p.cell.x) && Number.isFinite(+p.cell.y)
      ? { x: +p.cell.x, y: +p.cell.y } : null;
    out.set(oid, cell ? {
      cell,
      ...(p.structureId != null ? { structureId: String(p.structureId) } : {}),
      ...(p.room != null ? { room: String(p.room) } : {}),
    } : null);
  }
  return out;
}

export const query = {
  objectsAtNode,
  allObjectsInWorld,
  canBreak,
  canTake,
  canBurn,
  hasParts,
  isHollow,
  objectsByName,
  objectsByMaterial,
  breakableObjects,
  flammableObjects,
  takeableObjects
};
