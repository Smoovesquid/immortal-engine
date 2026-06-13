// ONE MAP — the world-space embedding (docs/ONE_MAP.md, the load-bearing 20%).
//
// One coordinate system, in world units (wu). Everything on the map gets an
// address in it; the camera (oneMap.js) just draws what's in frame. Pure and
// deterministic: same world, same addresses, forever. Client-side projection
// only — the engine's canon coordinates (node.x,y, place units, plan units)
// are untouched, and nothing here is ever serialized or hashed.

export const NODE_WU = 1000;  // one node-lattice step ≈ 1 km (1 wu ≈ 1 m)
export const PLACE_WU = 4;    // one village place-unit ≈ 4 m (61-unit village ≈ 244 wu)

export const Z_MIN = 0.02;    // whole world in frame
export const Z_MAX = 16;      // street band, 1 place-unit = 64 px

// Semantic LOD thresholds (px per wu). Representations fade in across an
// octave around these — the camera never cuts.
export const BAND = {
  region: 0.08,     // roads + all discovered nodes + names
  settlement: 0.5,  // village footprints with real layouts (M2)
  street: 4         // walkable detail, tokens, interiors (M3)
};

/** Node lattice → world units. */
export function nodeToWu(node) {
  return { x: (Number(node?.x) || 0) * NODE_WU, y: (Number(node?.y) || 0) * NODE_WU };
}

/**
 * Village place-units → world units, centered on the node (M2 consumers).
 * `placeCenter` is the layout's own midpoint in place units.
 */
export function placeToWu(node, ux, uy, placeCenter = { x: 30.5, y: 30.5 }) {
  const c = nodeToWu(node);
  return {
    x: c.x + (Number(ux) - placeCenter.x) * PLACE_WU,
    y: c.y + (Number(uy) - placeCenter.y) * PLACE_WU
  };
}

/** Bounding box of the world's nodes in wu, with a margin. */
export function worldBounds(nodes, marginWu = 2 * NODE_WU) {
  const list = Array.isArray(nodes) ? nodes.filter(n => n && Number.isFinite(+n.x) && Number.isFinite(+n.y)) : [];
  if (!list.length) return { minX: -marginWu, minY: -marginWu, maxX: marginWu, maxY: marginWu };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of list) {
    const p = nodeToWu(n);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - marginWu, minY: minY - marginWu, maxX: maxX + marginWu, maxY: maxY + marginWu };
}

/** 0→1 fade as z crosses [a..b] (band transitions, never a pop). */
export function fadeIn(z, a, b) {
  if (z <= a) return 0;
  if (z >= b) return 1;
  return (z - a) / (b - a);
}

/** Discovery tiers: 'known' (discovered), 'rumor' (adjacent to known), 'dark'. */
export function discoveryTiers(map) {
  const known = new Set((Array.isArray(map?.discovered) ? map.discovered : []).map(String));
  const here = String(map?.currentNodeId || '');
  if (here) known.add(here);
  const rumor = new Set();
  for (const e of (Array.isArray(map?.edges) ? map.edges : [])) {
    const a = String(e?.a || ''), b = String(e?.b || '');
    if (known.has(a) && !known.has(b)) rumor.add(b);
    if (known.has(b) && !known.has(a)) rumor.add(a);
  }
  return { known, rumor };
}
