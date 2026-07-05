// MINIATURE LIBRARY — the catalogue of placeable minis (props · creatures · corpses …).
//
// This is the shared "library of miniatures" the house-builder's mini palette lists
// and the tabletop renderer resolves a placed mini against. Unlike treeAssets.js's
// foliage REG (which eager-loads EVERY GLB the moment the map inits), entries here are
// LAZY: a mini's GLB is only fetched when a consumer actually places/renders one — so
// the library can grow to hundreds of minis without any boot cost.
//
// Each entry:
//   id        stable key (used in authored/exported data — never rename in place)
//   name      human label for the palette
//   category  'corpse' | 'monster' | 'prop' | 'npc' | …  (palette grouping)
//   url       the (decimated, uncompressed) GLB under /map/assets — plain GLTFLoader
//   fitLong   target size (m) of the longest horizontal dimension when placed
//   flat      true = lies on the ground (a splayed corpse), no "feet at 0" stand-up
//   footprint [w,h] in grid squares it occupies in the 2-D builder
//   tags      free search terms
//
// INTAKE: every GLB is decimated on the way in (Meshy exports run ~40–50 MB / 1M+ tris;
// the library target is ~1–3 MB / <70k tris, matching the existing assets). Pipeline:
// `scripts/mini-decimate.sh <in.glb> <out-name>` (weld → simplify → resize → prune,
// NO draco/meshopt compression — the game's GLTFLoader has no decoders wired).

export const MINI_LIBRARY = [
  {
    id: 'corpse_assemblage', name: 'Assemblage of the Fallen', category: 'corpse',
    url: '/map/assets/corpse_assemblage.glb', fitLong: 1.9, footprint: [2, 2],
    tags: ['gore', 'dungeon', 'dead', 'heap', 'bodies'],
  },
  {
    id: 'corpse_remains_red', name: 'Remains in Red', category: 'corpse',
    url: '/map/assets/corpse_remains_red.glb', fitLong: 1.9, flat: true, footprint: [2, 2],
    tags: ['gore', 'dungeon', 'dead', 'blood', 'gut pile'],
  },
];

export const miniById = (id) => MINI_LIBRARY.find((m) => m.id === id) || null;
export const minisByCategory = (cat) => MINI_LIBRARY.filter((m) => m.category === cat);
export const miniCategories = () => [...new Set(MINI_LIBRARY.map((m) => m.category))];
