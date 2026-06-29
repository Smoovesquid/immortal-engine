// SLICE OVERWORLD SCENE — the bridge contract (MAP_PATH Phase 1→3 seam).
//
// A PURE READ of engine-owned positions into a plain-JSON "scene description"
// that a renderer (2D graph-paper OR the 3D tilt view) can consume. The engine
// owns position; this is a projection, never a write. Nothing here mutates the
// world, adds randomness, or touches anything worldHash/determinism depend on
// (U19/U21/U22/U27/U30). Building footprints, props and camera live in the
// renderer; this only carries the SOURCE OF TRUTH: node tiles, edges, the token.
//
// Coordinate convention (matches the 2D map's screen layout):
//   x = east (+),  y = south (+)   — same integer tile grid the overworld uses.
// A renderer maps (x,y) → its own ground plane; the RELATIVE geography (chapel
// east past the woods, camp branching south off the woods) is what must agree.
//
// Shape — slice-overworld-scene/v1:
//   {
//     schema:  'slice-overworld-scene/v1',
//     seed:    'aldermere',
//     bounds:  { minX, minY, maxX, maxY },        // node tile extents
//     nodes:   [ { id, name, nodeType, x, y, discovered } ],
//     edges:   [ { a, b, kind } ],                // a/b are node ids
//     player:  { nodeId, x, y }                   // the avatar's overworld tile
//   }

export const SLICE_SCENE_SCHEMA = 'slice-overworld-scene/v1';

/** Tile extents of the node set, with a one-tile margin for framing. */
function tileBounds(nodes, margin = 1) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = Number(n.x) || 0, y = Number(n.y) || 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}

/**
 * sceneFromWorld(world) → slice-overworld-scene/v1.
 * Pure: reads world.map only; returns a fresh plain object; mutates nothing.
 */
export function sceneFromWorld(world) {
  const map = world?.map || world || {};
  const rawNodes = Array.isArray(map.nodes) ? map.nodes : [];
  const discovered = new Set((Array.isArray(map.discovered) ? map.discovered : []).map(String));

  const nodes = rawNodes.map(n => ({
    id: String(n.id),
    name: String(n.name ?? n.id),
    nodeType: String(n.nodeType ?? 'wilderness'),
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    discovered: discovered.has(String(n.id)),
  }));

  const edges = (Array.isArray(map.edges) ? map.edges : []).map(e => ({
    a: String(e.a ?? e.from),
    b: String(e.b ?? e.to),
    kind: String(e.kind ?? 'path'),
  }));

  // The avatar's overworld tile: prefer an explicit map.pos tile if present,
  // else the current node's tile (the overworld token sits on the current node).
  const currentNodeId = String(map.currentNodeId ?? map.startNodeId ?? (nodes[0]?.id ?? ''));
  const here = nodes.find(n => n.id === currentNodeId) || nodes[0] || { x: 0, y: 0 };
  const posTile = map.pos && Number.isFinite(+map.pos.x) && Number.isFinite(+map.pos.y)
    ? { x: Number(map.pos.x), y: Number(map.pos.y) }
    : { x: here.x, y: here.y };

  return {
    schema: SLICE_SCENE_SCHEMA,
    seed: String(world?.meta?.seed ?? world?.seed ?? map.seed ?? ''),
    bounds: tileBounds(nodes),
    nodes,
    edges,
    player: { nodeId: currentNodeId, x: posTile.x, y: posTile.y },
  };
}
