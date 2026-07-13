// OBJ-STATE-1 — the single source of truth for a furniture object's GLOBALLY
// unique, deterministic, stable identity (`objectId`). Every Model A piece
// (node.furniture — the interaction truth) carries one, minted AT BIRTH:
//   - authored pieces at their seeding seam (authoredNodePieces)
//   - procgen pieces at their generation seam (generateNodeFurniture)
//   - legacy pieces (pre-feature saves) by an idempotent ensureWorld backfill
//
// The id is namespaced so an authored piece and a procgen piece can never
// collide even if a structureId string equals a nodeId string:
//   authored:  au:<structureId>:<pieceId>   (structureId scopes across buildings;
//                                             pieceId is unique within a structure)
//   procgen:   pg:<nodeId>:<slot>           (nodeId scopes across the map; slot is
//                                             the deterministic generation index at
//                                             birth, or a stable per-node ordinal at
//                                             backfill — both unique within the node)
// Both inputs to the authored id are immutable, so the id survives name-uniquifying
// (ROM-4 ` 2`/` 3` suffixes) and later array splices — the whole point of stable
// identity over the legacy index+name addressing.

export function authoredObjectId(structureId, pieceId) {
  return `au:${String(structureId)}:${String(pieceId)}`;
}

export function procgenObjectId(nodeId, slot) {
  return `pg:${String(nodeId)}:${String(slot)}`;
}

// True when a Model A piece already carries a stable id (so backfill is idempotent).
export function hasObjectId(piece) {
  return !!(piece && typeof piece.objectId === 'string' && piece.objectId.length > 0);
}

// Derive the id for a piece that lacks one. Authored pieces expose structureId +
// pieceId (exact provenance) → au:; anything else is procgen → pg: with the caller's
// deterministic ordinal for this node. Never mints randomness; pure of world state.
export function deriveObjectId(piece, nodeId, ordinal) {
  if (piece && piece.structureId != null && piece.pieceId != null) {
    return authoredObjectId(piece.structureId, piece.pieceId);
  }
  return procgenObjectId(nodeId, ordinal);
}
