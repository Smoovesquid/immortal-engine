# TT-DRAW — the tabletop look: drawn structure, placed tokens, fog restored (Stage 3)

**Model:** Claude Sonnet (renderer lane — `public/map/`). **Your tests: U409–U411.**
**Spec of record:** `docs/TABLETOP_MAP.md` (the one rule: structure is DRAWN, entities are PLACED) ·
`docs/GRAPH_PAPER_UI.md` (the paper/ink aesthetic — palette, quadrille, pencil) · PACKETS §TABLETOP S3.
Decisions already made by Tim (do NOT relitigate): fog of war RESTORED (#2) · the aesthetic reference is
the hand-drawn quadrille the interior map already uses (`reference-dungeon.html` is the canonical sample).

## The mission (one breath)

At local zoom the outdoor sheet still draws buildings as filled art shapes (the roof-off-footprint class)
and scenery as ground ink. Make the local band a TABLETOP: buildings render as their REAL floor plans
(ink walls, doorway gaps), roads/water as ruled ink, and everything that occupies the world (people,
livestock, trees, notable props) as PLACED tokens on the grid — plus explored-vs-unexplored fog on the
drawn layer.

## The one rule (from the spec)

| Layer | What | How |
|---|---|---|
| **Drawn** | building walls & doorways (from `floorPlan`), roads, water, terrain edges | graph-paper ink — walls as lines, a doorway is a GAP in the wall, water filled contour, roads ruled bands |
| **Placed** | people, monsters, livestock, **trees**, notable objects | tokens set ON the grid — a tree is a piece you set down, not ground ink |

## Load-bearing detail — the fork you are resolving

WS-1 flagged it (PACKETS §TABLETOP S2): village art currently draws **catalog-plan room shapes**
(`placeFromNode.js` / `ALL_PLANS`) while movement and the interior projection use the REAL
`engine/structures/floorPlan.js`. The drawn layer MUST draw the real `floorPlan(structure)` fitted to the
building's world rect — WS-1 already built the transforms (`public/map/worldSpace.js`:
`structureWorldRect`, `interiorRoomToWu`; commit `cf9455e`). "Go through the doorway" must point at a
drawn gap the player can SEE. LOD is your call: far zoom may keep simple footprints; the ink plan resolves
as you close in.

## Scope

1. **Drawn-structure layer** at the local band of the continuous outdoor sheet: per-building real
   floor-plan ink (walls/door gaps; the building's shell in its material tone), roads as ruled bands,
   water as filled contours. Locate the local-band draw path first (`oneMap.js` / `continuousMap.js` /
   `placeFromNode.js` art) — grep, read slices.
2. **Placed-token layer**: people from the landed occupancy truth (`placeFromNode.js` already tokens
   `outdoorOccupants` — keep that source, upgrade the look to standing tokens with a base ring);
   livestock/creatures similarly; **trees become placed tokens** (not ground art) at the local band;
   notable outdoor props if the data exists (read-only — invent nothing).
3. **Fog of war restore**: explored-vs-unexplored on the drawn layer. Truth sources (read-only):
   node visit stamps (`map` visited — see U42-era stamps) and structure discovery
   (`engine/structures/discoveryState.js`). Unexplored = blank paper / faint pencil haze, explored = ink.
   Keep the floor simple: visited-area ink, unvisited haze; per-room interior fog stays the interior
   view's job (NOT yours — WS-3).

## Hard boundaries

- **Pure view.** No engine writes, no new state fields, no `Math.random` (seeded variants via the
  existing seed helpers). `worldHash` byte-identical across any render (prove in a test).
- **Engine files are READ-ONLY.** The interior branch (`drawInteriorV2`, `handDrawnInterior` usage for
  the inside view) is OUT of scope — WS-3 owns absorbing it.
- **Aesthetic:** the existing PAPER palette/ink idiom (`handDrawnPlace.js` / `handDrawnInterior.js` /
  `GRAPH_PAPER_UI.md`). This packet should look like MORE of the same hand, not a new style.
- `public/v1.js`: avoid; if a seam is truly required, minimal + prominently flagged.

## Tests (U409–U411) — test the pure MODEL, screenshot the look

- **U409:** drawn-model derivation — for the tallow boot world, every settlement structure yields a
  plan-model (rooms/walls/door gaps) derived from the REAL `floorPlan(structure)` fitted inside its
  `structureWorldRect`; deterministic across two builds; worldHash unchanged by derivation.
- **U410:** placed-token model — token set = occupancy truth (no roster scatter regression; reuse/extend
  U398's fixtures); trees present as tokens at the local band; determinism.
- **U411:** fog mask — a fresh boot marks only the starting area explored; a world with extra visit
  stamps reveals exactly those areas; pure function of world.

## Verification (Tim is AROUND today — this packet is taste-gated)

Headless screenshots from a lab page (import the REAL builders, `public/map-proto/` pattern) at 3 zooms
(settlement · street · building-plan) + one fog shot, INCLUDED in your report. Basecamp + Tim gate the
look on the live map after land; expect an iteration round — keep the ink parameters (line weights,
haze density) easy to tune in one place.

## Done-when

- Local band shows drawn plans (real floorPlan), ruled roads, water contours; people/livestock/trees as
  placed tokens; fog distinguishes explored/unexplored; U409–U411 green; full suite green; worldHash
  proof; screenshots in the report.
- One local commit on your branch (do NOT push).

## Rollback

Revert the commit (art returns to catalog shapes; fog stays off).

## Report (plain English for Tim)

What this is (the map at close zoom is now a hand-drawn battlemap: buildings are real floor plans you
can walk into, pieces stand on the grid, and unexplored ground stays blank paper), why it matters (the
map finally LOOKS like the game plays — and the doorway you're told to walk through is ink you can see).
