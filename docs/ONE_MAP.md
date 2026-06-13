# ONE MAP — the continuous world camera

**Status:** specced 2026-06-12 (Tim's ask: "one infinitely zoomable map in the
way that googlemaps zoom in and out" — no World/Region/Local tabs).
**Law:** THE DM TEST governs. The map is an *aid*, never the interface of
record: zooming out and clicking a far city is travel *intent* the DM still
adjudicates (time, roads, encounters, "you know of no such place"). The camera
never teleports anyone.

## The problem it kills

Today the "map" is five renderers pretending to be one: `WorldMap` (a
*synthetic* ring layout — not even the real geography), `RegionMap`,
`LocalMap`, the walkable place (`handDrawnPlace`), and interiors — each with
its own coordinate system. The player's position is stitched across them
(`nodeId` + place `ux,uy` + `structureId/roomId`). Every boundary is a seam,
and the seam bugs are a genre by now: token stuck in bed while the prose moved
on, fog resets, interior/exterior mode juggling. One coordinate space and one
camera retire the genre, not the instances.

## Coordinate model (the load-bearing 20%)

One world space, in **world units (wu)**. Everything gets an address in it:

| Layer | Embedding rule | Constant |
|---|---|---|
| Nodes | engine `node.x,y` (small lattice, ±15) × `NODE_WU` | `NODE_WU = 1000` |
| Village layouts | `placeFromNode` place-units, anchored centered at the node: `world = node·NODE_WU + (place − placeCenter)·PLACE_WU` | `PLACE_WU = 4` |
| Interiors | building plan-units fit to the building's footprint rect (already in place-units via `ox,oy` + plan extents) | derived per building |

So a 61-unit village spans ≈244 wu — a quarter of the ~1000 wu gap between
nodes; if 1 wu ≈ 1 m, nodes sit ≈1 km apart and the county reads ≈20–30 km
across, which matches the old "Region (10k)" instinct. The embedding functions
are **pure and seeded** — same world, same footprints, forever. They live in
`public/map/worldSpace.js` (client-side projection; worldHash untouched — the
engine's canon coordinates remain `node.x,y` + place/interior units).

## Camera + LOD bands

Camera is `{cx, cy, z}` — center in wu, `z` = pixels per wu, wheel-zoomed on
the cursor, drag-panned, clamped to `Z_MIN..Z_MAX`. "Infinite zoom" honestly
stated: continuous across ~3 decades with **semantic level-of-detail** — the
camera never cuts; the *representation* swaps as you cross bands:

| Band | z (px/wu) | What draws |
|---|---|---|
| world | 0.02–0.08 | terrain wash, settlement icons + major names |
| region | 0.08–0.5 | + roads (edges), all discovered nodes + names |
| settlement | 0.5–4 | + village footprints with real layouts (M2) |
| street | ≥ 4 | + walkable detail, tokens, roof-cutaway interiors (M3) |

At `z = 4`, one place-unit = 16 px — the current walkable map's density, so
the street band IS today's local map, just addressed in world space.
Band transitions fade over a zoom octave (no popping). Discovery is honored at
every band: discovered nodes draw full; nodes adjacent to discovered draw as
rumors (faint, unnamed); the rest is unpainted parchment.

## Stages (each ships green + live-verified, PACKETS discipline)

- **M1 — the camera. ✅ DONE 2026-06-12** (`80ef24f`). `public/map/oneMap.js`:
  one canvas in the Map tab (now the default; old tabs stay as escape hatch).
  Real geography for the first time (`node.x,y`, not ringLayout), wheel zoom,
  drag pan, world/region bands, roads, discovery fog, player marker, scale bar.
- **M2 — villages in world space. ✅ DONE 2026-06-12.** `worldSpace.placeFrame`
  / `placeUnitToWu` embed `placeFromWorldNode` layouts midpoint-on-node;
  `oneMap.drawLayout` draws them across the settlement band (fade-in 0.55→1.1
  px/wu), handing the abstract glyph + footprint disc over to the real village
  — material-true roofs (timber/stone/fortified), multi-room footprints, paths,
  groves, capped well, NPC dots + labels at street zoom. Layouts cached per
  mount (deterministic). Live-verified: continuous dive county → "Wayfarers'
  Outpost" (cottage + 2 storehouses + workshop) → street, no cuts.
  *(Local view still present as a tab; it retires with the others at M4.)*
- **M3 — roofs come off.** Past the interior threshold, building plans render
  inside their footprints (cutaway), with interior fog/visited state intact.
- **M4 — one position, no tabs.** Player position becomes a single wu
  coordinate (engine field; WORLD_VERSION checklist); walk/travel/interior
  transitions all move the same dot on the same map; World/Region/Local
  buttons retire. The token-desync bug class closes structurally here.
- **M5 — the beauty pass.** Tim's satellite-map dream on this camera:
  terrain texture, grove art, per-material building fills (timber/stone/
  fortified), player-built quality visible. Rich illustrated parchment per
  DESIGN.md — *reads* satellite-real, never literal photography.

## Invariants

1. Embedding is pure + seeded; no `Math.random` anywhere in the projection.
2. The camera is client state — never serialized into the world, never hashed.
3. Canon position stays engine-owned until M4's deliberate version bump; the
   map *renders* state, it never writes it (clicks emit intents to playerMove).
4. Discovery semantics identical to the old views (no map-as-spoiler).
5. Old tabs keep working until M4 retires them — every stage is revertable by
   file (`public/map/oneMap.js`, `public/map/worldSpace.js`, MapView wiring).

## Out of scope (this track)

Minimap-in-play-screen replacement (the play screen's walkable canvas keeps
its own framing until M4), pathfinding previews, region-polygon borders
(regions are theme vectors with no geometry — terrain wash is seeded noise,
not region shapes).
