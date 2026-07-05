# TABLETOP MAP — drawn structure, placed miniatures

**Status:** BUILDING (Tim locked the model 2026-07-04; **re-confirmed + extended 2026-07-05** — see
"The 2026-07-05 directive" below. Packets `TT-WORLD` / `TT-INK` / `TT-PROPS`, one renderer lane;
successors to the landed 2-D `TT-DRAW` arc, reusing its drawing brain).

## The 2026-07-05 directive (Tim, verbatim intent — supersedes where it sharpens)

Post-MAP-3DR fallout: *"Tilt and 3D work is great. We seem to have lost the rest of the map."*
(Root: at the tilt band the opaque 3-D diorama covers the 2-D sheet and only contains the local
slice — the drawn layer below was never built. Diagnosed 2026-07-05, code + live.)

The final push: **the ENTIRE WORLD is rendered on graph paper at the 3-D view.** No 3-D houses,
walls, or dungeon geometry (*yet*) — everything architectural is **DRAWN in ink on the paper**, as
at a real table. The map is then **populated with miniatures**: trees, barrels, beds, dressers,
NPCs, monsters — every discrete standing thing is a placed piece. The paper is the tabletop law:
the sheet is FLAT; terrain reads as ink (washes/contours/edges), not as relief geometry.

**Fog of war — build-phase amendment (Tim, 2026-07-05):** fog stays **OFF for the build portion**
so Tim can watch the whole map render end-to-end. The 2026-07-04 RESTORE decision stands as the
*follow-up* (a flag flip + review), not part of the build.
**Ask (Tim):** the map is a tabletop. One continuous sheet that, as you zoom all
the way in, **tilts into a low-angle 3-D tabletop**: a graph-paper battlemap on
the table with miniatures standing on it. Two representations, one surface.
**Law:** presentation only — **no engine / server / world state is touched** by
this track (it *draws* positions the engine already owns). THE DM TEST + DM-is-
the-only-verb still govern: the map is a read-only aid; you play by talking.

Sibling docs: [`GRAPH_PAPER_UI.md`](GRAPH_PAPER_UI.md) (the paper *substrate* +
palette — the whole UI is already ink-on-quadrille), [`DND_XCOM.md`](DND_XCOM.md)
(the tactical destination this sets the table for), and the map path/MAPNINJA
track. This doc is the **map depiction model** those don't cover.

## The one rule: structure is DRAWN, entities are PLACED

Everything on the map is exactly one of two things, and they render differently:

| Layer | What | How it's drawn | Source of truth |
|---|---|---|---|
| **Structure** (drawn) | building walls & doorways, dungeon layout, roads/paths, rivers & water, terrain edges | **graph-paper ink** — walls as lines on the grid, a doorway is a *gap* in a wall, water as a filled contour, roads as ruled bands | engine topology (rooms + reciprocal exits/doorways), map edges, region features |
| **Entities** (placed) | heroes, NPCs, monsters, objects, **trees** | **miniatures** — standing tokens set *on* the grid, each on a square, with a base + soft shadow (sells the tilt) | engine-owned position per entity (node → room → grid square) |

The tell is **trees are miniatures**: scenery is a *piece you set down*, not part
of the map's ink. If it acts, moves, can be interacted with, or occupies a
square → mini. If it's the fixed shape of the world → drawn.

**This is why the "building silliness" dies.** Today buildings are textured 3-D
meshes, so at zoom the roof floats off the footprint (the artifact from the
2026-07-04 playtest). When a building *is* a graph-paper floor plan, there is no
roof to detach — walls are lines, the interior is rooms-and-doorways on the grid.

## The zoom → tilt (continuous, one surface)

One semantic-zoom map (no zoom button). Far out = the region/world sheet
(`oneMap.js`). Zoom in continuously; past a threshold the surface **tilts** from
top-down into the tabletop diorama and the drawn structure + minis resolve.

- The crossover **already exists in code**: `public/map/continuousMap.js` blends
  2-D → 3-D with `smoothstep(Z_3D_START, Z_3D_CROSS, cam.z)` into
  `render3d.js` (`mountSlice3D`). It is currently **pinned off**
  (`MAP_3D_ENABLED = false`) — not because the idea is wrong but because the
  per-turn full DOM rebuild remounted the 3-D layer every turn and flashed
  unrelated views (see the map-layer-landed decision). **Reconnecting it behind
  a persistent mount is the `MAP-3DR` packet** — this spec is what that mount
  should render.

## The contract (so the engine stays sacred)

This is a **renderer swap over engine-owned positions** — the determinism line:

- **Engine owns** (deterministic, `worldHash`-safe): each entity's position
  (node → structure/room → **grid square**), and the structure topology (rooms,
  reciprocal doorways, road/water features). The renderer never invents a
  position or a wall.
- **Renderer owns** (presentation only): drawing the grid + ink structure,
  placing a mini at each entity's engine square, the tilt/camera, mini art.
- **Hard constraint:** do **not** write render coordinates onto world state.
  Direct `ux/uy` writes on the marker broke determinism before (`U21`); precise
  placement is renderer + v1 walk-pos work, not an engine field. See the
  map-marker note.
- **Dependency — precise squares need position-as-canon.** Node-level position
  exists today; a *mini on a specific 5-ft square* needs the tactical-grid
  "position-as-canon" contract (the `TAC` two-tier-travel packet, unblocked now
  that INT-4a landed). Until then, minis can place at **room granularity**
  (which room you're in) — already enough to fix the doorway-movement bug.
- **THE MOVEMENT LAW + the camera (Tim, 2026-07-04-pm):** self-powered movement
  is ≤6 squares (30 ft)/turn — never node travel; far places = DM fast travel
  with a risk premium (`JR-1`). The camera keeps the **player centered** — the
  sheet re-orients around you; there are no per-place sheets and no edges. Full
  text: `POSITION_AS_CANON.md` §3/§6. Enforcement: `NODE-DESYNC-1`; camera: `WS-2`.

## What this fixes beyond looks

- **The movement bug** (2026-07-04 playtest: "go through the doorway" didn't
  move you, and there were no doorways on the map). Once a building is a
  graph-paper floor plan with rooms and doorway-gaps, "go through the doorway"
  has a literal square to walk your mini into — and the doorway is *visible*.
  Map and interior-movement stop being two problems (the DM-invents-geography
  class, resolved at the render layer).

## Scope — the nice start vs. full XCOM

**In (the nice start):** the tabletop diorama over positions we already track —
drawn structure, placed minis, the zoom-tilt, room-granular placement. Retires
the building-render artifact; reinforces the tabletop feel.

**Out (the later layer this sets the table for):** true 5-ft-square tactical play
— cover, elevation, line-of-sight, initiative/turn order on the grid, movement
budgets. That's the full [`DND_XCOM.md`](DND_XCOM.md) direction and depends on
the `TAC` position-as-canon work. We do **not** owe it now; this spec is chosen
so it doesn't block it — the same engine squares feed both.

## Miniature art direction

Solid, full-color, **alive** (Dejarik-style idle behavior), not low-poly — per
the locked figurine art direction; prototypes under `public/map-proto/`. The
mini is a *standing token on a base with a shadow* (the base + shadow are what
sell "standing on the tilted table").

## Open questions — **ALL DECIDED (Tim, 2026-07-04)**

1. **Tilt trigger:** RETUNE at Stage-4/`MAP-3DR` time, by eye, AFTER the drawn-structure
   layer lands (flatter world → tilt can come earlier). A taste pass, not a constant to
   pick now.
2. **Fog of war:** RESTORE — explored-vs-unexplored on the drawn layer (discovery is half
   the tabletop feel). Work rides the drawn-structure packet (`TT-DRAW`).
3. **Indoor ↔ outdoor:** CONTINUOUS — the sheet zooms *into* the building's drawn
   footprint; one camera, no renderer switch. (The v0.28.8 inside/outside branch is an
   approved *stopgap* until the one-camera work — `WS-2` — absorbs it as an LOD band.)
4. **Placement granularity:** CONFIRMED — minis place at room granularity first; exact
   5-ft squares arrive when the `TAC` position-as-canon contract lands
   (`docs/POSITION_AS_CANON.md`).

## Build path (when greenlit)

`MAP-3DR` (persistent 3-D mount) → drawn-structure layer from engine topology →
mini placement at room granularity → zoom-tilt wiring → live-verify on the
player map (a map fix isn't done until it registers on the screen). Renderer lane
(Sonnet) over engine-owned positions; Homebase owns the determinism check.
