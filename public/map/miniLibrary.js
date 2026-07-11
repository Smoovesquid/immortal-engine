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
//   sheet     true = AUDITED multi-object catalog sheet (several loose objects in one
//             GLB) — NEVER placeable as a single mini; the split pass re-cuts it first.
//             The Building Builder reads this flag for its "needs split" status label.
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
  {
    id: 'gothic_gate_collection', name: 'Gothic Gate Collection', category: 'architecture',
    url: '/map/assets/gothic_gate_collection.glb', fitLong: 2.8, footprint: [2, 1], sheet: true,
    tags: ['gate', 'gothic', 'fence', 'entry', 'architecture'],
  },
  {
    id: 'fence_run_weathered', name: 'Weathered Fence Run', category: 'architecture',
    url: '/map/assets/fence_run_weathered.glb', fitLong: 2.5, footprint: [2, 1], sheet: true,
    tags: ['fence', 'wood', 'weathered', 'yard', 'pen'],
  },
  {
    id: 'fence_fragment_weathered', name: 'Weathered Fence Fragment', category: 'architecture',
    url: '/map/assets/fence_fragment_weathered.glb', fitLong: 1.8, footprint: [1, 1], sheet: true,
    tags: ['fence', 'fragment', 'wood', 'weathered', 'ruin'],
  },
  {
    id: 'deadfall_driftwood_weathered', name: 'Weathered Driftwood Deadfall', category: 'wild',
    url: '/map/assets/deadfall_driftwood_weathered.glb', fitLong: 2.0, flat: true, footprint: [2, 1], sheet: true,
    tags: ['deadfall', 'driftwood', 'log', 'wilderness', 'cover'],
  },
  {
    id: 'bridges_of_stone', name: 'Bridges of Stone', category: 'architecture',
    url: '/map/assets/bridges_of_stone.glb', fitLong: 3.0, footprint: [3, 1], sheet: true,
    tags: ['bridge', 'stone', 'crossing', 'road', 'architecture'],
  },
  {
    id: 'roofed_wells', name: 'Roofed Wells', category: 'architecture',
    url: '/map/assets/roofed_wells.glb', fitLong: 2.0, footprint: [1, 1], sheet: true,
    tags: ['well', 'roofed', 'village', 'square', 'water'],
  },
  {
    id: 'stone_archways_timber', name: 'Stone Archways and Timber', category: 'architecture',
    url: '/map/assets/stone_archways_timber.glb', fitLong: 2.6, footprint: [2, 1], sheet: true,
    tags: ['archway', 'stone', 'timber', 'gate', 'ruin'],
  },
  {
    id: 'stonewell_ensemble', name: 'Stonewell Ensemble', category: 'architecture',
    url: '/map/assets/stonewell_ensemble.glb', fitLong: 2.2, footprint: [1, 1], sheet: true,
    tags: ['well', 'stone', 'village', 'water', 'settlement'],
  },
  // Armory trio (2026-07-10) — SINGLE-object weapon racks (island-checked, upright,
  // Y-up). Candidates for the `rack` furniture type's mini once the buildPropMini GLB
  // path exists (the 39-type packet) — until then library-placeable props only.
  {
    id: 'armory_iron', name: 'The Iron Armory', category: 'prop',
    url: '/map/assets/armory_iron.glb', fitLong: 1.3, footprint: [1, 1],
    tags: ['rack', 'weapon', 'armory', 'iron', 'martial'],
  },
  {
    id: 'wall_of_blades', name: 'Wall of Blades', category: 'prop',
    url: '/map/assets/wall_of_blades.glb', fitLong: 1.7, footprint: [2, 1],
    tags: ['rack', 'weapon', 'blades', 'spears', 'martial'],
  },
  {
    id: 'armory_arcane', name: 'Arcane Armory', category: 'prop',
    url: '/map/assets/armory_arcane.glb', fitLong: 2.2, footprint: [2, 1],
    tags: ['rack', 'weapon', 'arcane', 'display', 'magic'],
  },
];
// NOT registered (on disk awaiting a split pass): furniture_sheet_rustic_a/b.glb and
// furniture_sheet_hearth_a/b.glb are SHEETS of 6–11 loose furniture pieces (crates,
// shelves, tables, hearth, firepits, brazier, basin, anvil …) — placing one would drop
// the whole disconnected spread on the board; split into per-piece GLBs first (see the
// MINIS_WISHLIST.md 2026-07-10 receipts). AUDIT 2026-07-10: the eight architecture/wild
// entries above are ALSO multi-object catalog sheets (5–14 islands each; screenshot-
// verified) — latent, since only the corpse category is consumed today; the split-pass
// packet owns re-cutting them before anything places one.

export const miniById = (id) => MINI_LIBRARY.find((m) => m.id === id) || null;
export const minisByCategory = (cat) => MINI_LIBRARY.filter((m) => m.category === cat);
export const miniCategories = () => [...new Set(MINI_LIBRARY.map((m) => m.category))];
