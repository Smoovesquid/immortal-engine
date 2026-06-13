// ONE MAP — the world-space embedding (docs/ONE_MAP.md, the load-bearing 20%).
//
// One coordinate system, in world units (wu). Everything on the map gets an
// address in it; the camera (oneMap.js) just draws what's in frame. Pure and
// deterministic: same world, same addresses, forever. Client-side projection
// only — the engine's canon coordinates (node.x,y, place units, plan units)
// are untouched, and nothing here is ever serialized or hashed.

import { biomeForNode } from '../../engine/world/biome.js';

export const NODE_WU = 1000;  // one node-lattice step ≈ 1 km (1 wu ≈ 1 m)
export const PLACE_WU = 4;    // one village place-unit ≈ 4 m (61-unit village ≈ 244 wu)

export const Z_MIN = 0.012;   // whole world in frame (M6: ocean + far Heath fit at this zoom-out)
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
 * biomeAtWorld(seed, wx, wy) -> biome string. The `biomeForNode` projection in
 * world units: the ONE biome truth the map paints AND (later) the species/
 * travel-reaction logic reads. A node's wu position maps back through NODE_WU
 * to its exact node biome, so the painted ground AGREES with what the DM
 * narrates on arrival. Pure + deterministic; never serialized or hashed.
 */
export function biomeAtWorld(seed, wx, wy) {
  return biomeForNode(seed, { x: (Number(wx) || 0) / NODE_WU, y: (Number(wy) || 0) / NODE_WU });
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

/**
 * placeFrame(place) — the bounding frame of a placeFromWorldNode model in its
 * own place units, plus its midpoint. M2 anchors the midpoint on the node's
 * wu position; M4 will reuse this same frame as the position-unification
 * contract (one frame, one truth — keep this the only extent logic).
 */
export function placeFrame(place) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const b of (place?.buildings || [])) {
    for (const r of (b?.plan?.rooms || [])) {
      const rw = (r.w ?? (r.r ?? 1) * 2) / 2, rh = (r.h ?? (r.r ?? 1) * 2) / 2;
      grow(b.ox + r.cx - rw, b.oy + r.cy - rh);
      grow(b.ox + r.cx + rw, b.oy + r.cy + rh);
    }
  }
  for (const g of (place?.terrain?.groves || [])) {
    grow(g.cx - g.r, g.cy - g.r); grow(g.cx + g.r, g.cy + g.r);
  }
  for (const p of (place?.terrain?.paths || [])) {
    for (const [x, y] of (p?.pts || [])) grow(x, y);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Place-units → wu for a model anchored midpoint-on-node. */
export function placeUnitToWu(node, frame, ux, uy) {
  const c = nodeToWu(node);
  return {
    x: c.x + (Number(ux) - frame.cx) * PLACE_WU,
    y: c.y + (Number(uy) - frame.cy) * PLACE_WU
  };
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
