# WS-1 — one world-space address for everything (`public/map/worldSpace.js`)

**Model:** Claude Sonnet. **Lane:** renderer, NEW module — no live wiring. **Your tests: U400–U401.**
**Spec of record:** `docs/MAP_PATH.md` Phase 1.1 + `docs/ONE_MAP.md` (coordinate model) +
`docs/TABLETOP_MAP.md` (the contract table). Read all three FIRST.

## Why (one breath)

The one-continuous-zoom map needs every drawable thing to resolve to ONE coordinate system
before the camera, LOD, and 3D-tilt work can unify. Today coordinates live in per-renderer
conventions (node grid, place layout, interior plan). This module is the single projection:
`entity → {wx, wy}` world units.

## The module (pure, read-only, seeded)

New `public/map/worldSpace.js`, consuming engine truth read-only:

- **Nodes:** `node.x, node.y × NODE_WU = 1000` (ONE_MAP's model).
- **Villages/places:** anchored at node centers, `PLACE_WU = 4` per place unit (ONE_MAP).
- **Interiors:** fitted to the building's footprint — transform `engine/structures/floorPlan.js`
  room `cx,cy,w,h` (+ `footprint.w,h`) into the building's world rect, so a room center maps to
  a stable `{wx,wy}` INSIDE its building.
- **Entities:** player/NPC/monster/object resolve through their engine location: node →
  place position → (if inside) structure/room center from `getRoomState` /
  `engine/structures/roomState.js` + `roomOccupancy`. Room-granular is CORRECT for now
  (per the 2026-07-04 decision; 5-ft squares arrive with the TAC contract,
  `docs/POSITION_AS_CANON.md`).
- **Pure + seeded:** same world → identical output; no engine writes; no state fields; no
  `Math.random`.

## Hard scope line (collision avoidance)

**Do NOT wire any call site.** No edits to `public/v1.js`, `public/map/continuousMap.js`, or any
live renderer — another lane is active there today. WS-1 = the module + tests (+ optionally a
tiny standalone lab page `public/map-proto/worldspace-lab.html` that imports the module and
plots the boot world's entities as dots, for visual sanity). Wiring the marker/camera through it
is WS-2, a separate packet.

## Tests (U400–U401)

- **U400:** for the `tallow` boot world — every node, structure, room, and present entity
  resolves to exactly one finite `{wx,wy}`; interiors land INSIDE their building's world rect;
  two independent builds of the same seed produce IDENTICAL coordinates (determinism); worldHash
  before/after projection calls is unchanged (read-only proof).
- **U401:** room tracking — drive a scripted interior move via the engine (pure calls, LLM off),
  assert the player's projected `{wx,wy}` moves from room A's center to room B's center, and an
  outside↔inside transition lands within the building rect. (This is the projection half of the
  old VG-F3 "marker doesn't track rooms" bug — WS-2 makes the live marker consume it.)

## Guardrails

- Engine files are READ-ONLY to you. No new state, no schema, no `WORLD_VERSION`.
- If floorPlan/roomState lacks something you need, do NOT extend the engine — note the gap in
  your report and project from what exists.

## Done-when

- Module + U400–U401 green; full suite green; zero live call-site changes.
- One local commit on your branch (do NOT push): `feat(map): WS-1 — worldSpace projection: one
  {wx,wy} address for nodes, places, interiors, entities`.

## Rollback

Delete the module + tests (nothing consumes it yet).

## Report (plain English for Tim)

What this is (every person, room, and building now has one agreed "where" on a single sheet of
coordinates), why it matters (it's the rail the one-camera zoom, the moving marker, and the 3D
tilt all run on next).
