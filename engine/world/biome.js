/**
 * Biomes for the canonical map — Living-World Merge, Phase 1.
 *
 * A pure, deterministic projection: every map node sits in a biome derived from
 * its position and the world seed. No stored state, so `worldHash` stays
 * replay-stable and no WORLD_VERSION bump is needed. Nearby nodes share a biome
 * (spatial coherence) so the world reads as forest country / marsh country rather
 * than a random patchwork.
 *
 * Biome names match engine/ecology/foodweb.js `biomeOf()` outputs, so the same
 * vocabulary drives both flavor (here) and biome-appropriate encounters (P2).
 */

// Core terrestrial biomes. (water/volcanic are special-cased elsewhere and left
// out of the general land roll.)
export const BIOMES = ['forest', 'plains', 'marsh', 'mountains', 'coastal', 'desert', 'arctic', 'wilderness'];

// Coarse cell size: nodes whose positions fall in the same cell share a biome.
const CELL = 14;

function h32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/**
 * biomeForNode(seed, node) -> one of BIOMES (deterministic).
 * Spatially coherent via a coarse grid cell; falls back to the node id when the
 * node has no position.
 */
export function biomeForNode(seed, node) {
  const n = node && typeof node === 'object' ? node : {};
  const hasPos = Number.isFinite(n.x) && Number.isFinite(n.y);
  const key = hasPos
    ? `${seed}|biome|${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`
    : `${seed}|biome|${String(n.id ?? '')}`;
  return BIOMES[h32(key) % BIOMES.length];
}

// Arrival/scene descriptor phrases per biome. Deterministic pick per node so the
// same place always reads the same way.
const FLAVOR = {
  forest: ['deep in old forest', 'under a close canopy of pine and oak', 'where the trees crowd the path'],
  plains: ['out on open grassland', 'where the grass runs to the horizon', 'under a wide, windswept sky'],
  marsh: ['in low marsh country', 'where the ground gives wet underfoot', 'among reeds and black standing water'],
  mountains: ['high among broken rock', 'where cold peaks bite the sky', 'amid scree and bare stone'],
  coastal: ['along a salt-bitten shore', 'where the sea works at the rocks', 'on the windward coast'],
  desert: ['out on the burning flats', 'where heat ripples off the sand', 'in a waste of dust and stone'],
  arctic: ['in a white silence of snow', 'where breath freezes on the air', 'across hard frozen ground'],
  wilderness: ['in trackless wild country', 'where no road has been cut', 'deep in untamed land']
};

/**
 * biomeFlavor(seed, node, biome?) -> a short descriptor clause (no leading caps,
 * no terminal punctuation) for weaving into narration: "you reach X, <flavor>."
 */
export function biomeFlavor(seed, node, biome = null) {
  const b = biome || biomeForNode(seed, node);
  const bank = FLAVOR[b] || FLAVOR.wilderness;
  const idx = h32(`${seed}|flavor|${String(node?.id ?? '')}`) % bank.length;
  return bank[idx];
}
