import { isFurnitureDestroyed } from '../structures/authoredFurniture.js';

// OBJ-STATE-1 — resolvedObjectPlacement: the ONE pure projection that answers
// "where is this object NOW?" by merging a piece's immutable base provenance with
// the canonical live-object overlay (world.objects[objectId]). Precedence:
//
//     held  >  placed  >  base
//
// FOUNDATION PACKET SCOPE: this resolver EXISTS and is fully tested, but no gameplay
// consumer is routed through it yet (that conversion happens deliberately, with live
// proof, in the packet that first MOVES an object — OBJ-MOVE-1). Nothing writes an
// override this packet, so in practice every object resolves to `base`. The overlay
// and the resolver are the scaffolding those later packets stand on.
//
// A NOTE ON base.cell: a Model A piece carries provenance (node / structureId /
// roomId), not a resolved floor cell — authored cells live in the plan (Model B),
// procgen room-object cells in the room layout. Resolving a base floor cell means
// joining to those models; that join is wired in the consumer-migration packet that
// first needs it. Until then base.cell is whatever the piece itself carries (usually
// null). A PLACED object, by contrast, always carries an explicit override cell.

// Find the Model A piece with this objectId anywhere on the map. Returns
// { piece, nodeId } or null. Linear scan — fine at this scale; a later packet may
// index if a hot path needs it (flagged, not premature).
export function findFurnitureByObjectId(world, objectId) {
  const id = String(objectId || '');
  if (!id) return null;
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  for (const n of nodes) {
    const furniture = Array.isArray(n?.furniture) ? n.furniture : [];
    for (const p of furniture) {
      if (p && String(p.objectId || '') === id) return { piece: p, nodeId: String(n.id) };
    }
  }
  return null;
}

const cellOf = (c) => (c && Number.isFinite(+c.x) && Number.isFinite(+c.y) ? { x: +c.x, y: +c.y } : null);

export function resolvedObjectPlacement(world, objectId) {
  const found = findFurnitureByObjectId(world, objectId);
  if (!found) return null;
  const { piece, nodeId } = found;

  // Immutable base provenance from the piece itself.
  const base = {
    node: nodeId || null,
    structureId: piece.structureId != null ? String(piece.structureId) : null,
    room: piece.roomId != null ? String(piece.roomId) : null,
    cell: cellOf(piece.cell),
    rot: Number.isFinite(+piece.rot) ? +piece.rot : 0,
  };

  const overlay = (world && world.objects && typeof world.objects === 'object') ? world.objects[String(objectId)] : null;
  const heldBy = overlay && overlay.heldByActorId != null ? String(overlay.heldByActorId) : null;
  const placedAt = overlay && overlay.placedAt && typeof overlay.placedAt === 'object' ? overlay.placedAt : null;

  // held > placed > base. A held object is carried — it is on NO floor cell (this is
  // the OBJ-MOVE-1 rule "a held object no longer blocks its old cell", encoded once).
  if (heldBy) {
    return {
      objectId: String(objectId), status: 'held',
      node: null, structureId: null, room: null, cell: null, rot: base.rot,
      heldByActorId: heldBy, base,
    };
  }
  if (placedAt) {
    return {
      objectId: String(objectId), status: 'placed',
      node: placedAt.node != null ? String(placedAt.node) : base.node,
      structureId: placedAt.structureId != null ? String(placedAt.structureId) : null,
      room: placedAt.room != null ? String(placedAt.room) : null,
      cell: cellOf(placedAt.cell),
      rot: Number.isFinite(+placedAt.rot) ? +placedAt.rot : 0,
      heldByActorId: null, base,
    };
  }
  return {
    objectId: String(objectId), status: 'base',
    node: base.node, structureId: base.structureId, room: base.room, cell: base.cell, rot: base.rot,
    heldByActorId: null, base,
  };
}

// ── OBJ-BARRICADE-6C — the ONE "is this door barricaded?" authority ───────────
//
// The overlay is keyed by objectId, so the door→object direction is a scan. It is
// deliberately a DERIVED read rather than a second stored index on the door: two
// stored truths about one fact is exactly the split-brain this arc keeps closing
// (FURN-PARITY-1). world.objects holds a handful of records, and this runs on
// traversal attempts, not per frame.
//
// A barricade only counts while the object can still hold the door:
//   • the piece must still exist (a removed/salvaged piece takes its record with it);
//   • a WRECKED piece stops obstructing — smashing the wardrobe IS how you get
//     through it, and rubble blocks nothing (OBJ-RUBBLE-1). This is derived, not
//     mutated on wreck: the record stays, the read stops honouring it, so a single
//     repair of the piece would restore the barricade with no bookkeeping.

/** The raw obstructs record for an object, or null. Pure. */
export function barricadeRecordOf(world, objectId) {
  const overlay = (world && world.objects && typeof world.objects === 'object')
    ? world.objects[String(objectId)] : null;
  const rec = overlay && overlay.obstructs && typeof overlay.obstructs === 'object' ? overlay.obstructs : null;
  if (!rec) return null;
  const structureId = String(rec.structureId || '');
  const doorId = String(rec.doorId || '');
  if (!structureId || !doorId) return null;
  return { structureId, doorId };
}

/**
 * barricadeOnDoor(world, structureId, doorId) -> { objectId, name, piece } | null
 *
 * What is shoved against this door right now, if anything. Pure; never throws.
 */
export function barricadeOnDoor(world, structureId, doorId) {
  const sid = String(structureId || '');
  const did = String(doorId || '');
  if (!sid || !did) return null;
  const objects = (world && world.objects && typeof world.objects === 'object') ? world.objects : {};
  for (const objId of Object.keys(objects)) {
    const rec = barricadeRecordOf(world, objId);
    if (!rec || rec.structureId !== sid || rec.doorId !== did) continue;
    const found = findFurnitureByObjectId(world, objId);
    const piece = found?.piece;
    if (!piece) continue;                        // stale record — piece is gone
    if (isFurnitureDestroyed(piece)) continue;   // wreckage holds no door
    return { objectId: objId, name: String(piece.name || piece.kind || 'something'), piece };
  }
  return null;
}
