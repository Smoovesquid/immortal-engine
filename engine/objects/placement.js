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
