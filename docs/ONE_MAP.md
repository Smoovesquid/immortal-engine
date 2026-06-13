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
- **M3 — roofs come off. ✅ DONE 2026-06-12.** Past the street threshold
  (z≥4, full by ~7.2) an openable building's material roof fades to a furnished
  floor cutaway (rooms, ink walls, material-marked furniture, the bed's cloth,
  room-name labels at z≥6). Fog is honest: "openable" = the building you're
  *inside* (`scene.interior.structureKey`) or your *home* (node === homeNodeId,
  real structure) — settlement buildings you've never entered stay roofed, no
  map-spoiler. `interiorDiscovery` is empty in the live path, so it's NOT the
  fog source (would've shown nothing); the two presence-rules are. Fixed a
  frustum-cull bug surfaced here (node-center cull hid a village whose center
  sat off-screen at edge zoom — settlements now get a layout-sized margin).
  Added `wrap.__oneMapFocus(wx,wy,z)` — a camera deep-link seam (quest pins /
  "show me here" / tests). U135 ×6 locks the embedding contract. Live-verified:
  cottage lifts to Hearth Room + Larder + Bedroom (bed visible) while the
  next-door storehouse stays roofed.
- **M4 — no tabs (client). ✅ DONE 2026-06-12.** Scope split (Tim's call):
  the SAFE client-side half shipped — the World/Region/Local scale tabs are
  retired, the Map tab is one continuous map (scroll/drag), and the player
  marker reads the live walk position (`ui.place` → `placeUnitToWu`) so the dot
  sits where you stand, not at the node midpoint. No WORLD_VERSION bump, no
  determinism risk, revertable by file. The old renderers stay on disk (v1
  still uses `renderLocalMap` as the in-play walkable-map fallback).
- **M4b — one canonical position (engine). ✅ SATISFIED BY v21 (no bump).**
  Investigated 2026-06-12: the canonical field M4b meant to add already exists.
  `party[0].position.{zone, nodeId, ux, uy, interior}` was formalized at
  WORLD_VERSION 21 — normalized by `ensurePosition`, persisted through
  save/load, and `scene.interior` is already *derived* from `position.interior`
  (state.js ~v21). A bump now would be ceremony (every save migrates, the
  determinism suite churns, zero shape change), so it's explicitly NOT done.
  The tempting "single (wx,wy) wu coordinate" is strictly worse — gameplay keys
  off `nodeId`, so wu-only would lose info and need reverse-mapping; `nodeId` +
  place-units is the right representation. The only residual seam — the client
  `ui.place` being a parallel copy reconciled at save time (`persistAndRehash`)
  — is a *client* write-path projection, not an engine field; left as-is since
  the acute desync it caused is already fixed (`39315d3`) and the refactor
  touches the core movement loop for preventive-only benefit (Tim's call).
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
