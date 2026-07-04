# TT-DRAW-3 — graph paper at closest view + REAL floor-plan ink (one drawing brain)

**Model:** Claude Sonnet (renderer lane — `public/map/`). **Your tests: U418–U419.**
**Parents:** TT-DRAW (`02c3721`) + TT-DRAW-2 (`33f8fa73`), both on `v2-polish`. Read their briefs and
`docs/TABLETOP_MAP.md` + `docs/GRAPH_PAPER_UI.md` first.

## Tim's live sighting (2026-07-04-pm3 — this packet's acceptance, verbatim)

> "The rooms are squares inside of squares. This seems like a step backwards. … In the preview, I do
> not see the graphpaper view, either. **At the closest view, we need the graphpaper and a realistic
> floorplan of the buildings.**"

He is right on both counts:
1. `drawModel.js` derives its own simplified per-room wall rects → rooms float as detached boxes with
   dead space between them. The IN-PLAY interior view already draws REAL architecture — rooms sharing
   walls, doorway gaps, corridors — via `floorPlan()` + `handDrawnInterior.js`
   (`floorPlanToSceneModel`). TT-DRAW built a THIRD, worse drawing brain instead of reusing that one.
2. The outdoor sheet has no quadrille at any zoom — flat cream paper.

## The fix

1. **One plan-drawing brain.** The outdoor sheet's building ink must be VISUALLY EQUIVALENT to the
   interior view's plan drawing: rooms TILE the footprint with SHARED walls, doorways are gaps in
   those shared walls, corridors render. Do this by REUSING the existing model — extract the shared
   plan-model/geometry derivation (from `floorPlan()` + the `handDrawnInterior.js` scene-model path)
   into a neutral module BOTH surfaces import (the "one shared core" pattern the coherence work used),
   then transform to world coordinates for the sheet. Do NOT keep a parallel wall derivation in
   `drawModel.js` — delete/replace its per-room `walls` construction.
2. **The graph paper at closest view.** A 5-ft quadrille fades in at the deep zoom band on the one
   sheet — and it is the REAL tactical grid: consume TAC-1's pinned constants
   (`engine/map/spatial/tacticalPos.js` — `CELL_FT` + the wu↔ft mapping; NEVER re-derive a
   conversion). Style per `GRAPH_PAPER_UI.md`: the teal quadrille rule the interior map uses, faint,
   under the ink. Fade-in band is a named tunable in the ONE ink-params place.
3. Fog, tokens, sizing-truth, and zoom ceiling from TT-DRAW/-2 stay as they are.

## Boundaries

Pure view; engine read-only (tacticalPos constants are IMPORTS, not copies); no state; no
`Math.random`; worldHash byte-identical. The in-play interior BRANCH stays untouched (WS-3 absorbs it
later) — but extracting its drawing/model core into a shared module IS in scope so long as the interior
view renders byte-identically (guard with a before/after canvas-model comparison or its existing
tests). `public/v1.js` untouched.

## Tests (U418–U419)

- **U418:** architecture property — for the tallow wake structure, the shared plan model has rooms that
  tile the footprint (adjacent rooms share wall segments; no dead void between adjacent rooms beyond
  the plan's own corridor/pad geometry), and every doorway is a gap ON a shared wall; the SAME model
  feeds both the interior view and the sheet (import-level assertion); deterministic ×2.
- **U419:** the quadrille band — grid visibility is a pure function of z (named threshold); grid pitch
  equals CELL_FT through the pinned wu↔ft mapping (assert numerically, round-trip exact); worldHash
  unchanged by rendering.

## Verification

Lab screenshots: closest view showing **graph paper + a realistic connected floor plan** (Tim's
sentence, literally), a street band, and the interior view unchanged. Include paths in the report.

## Done-when

Tim's acceptance sentence is true on screen; rooms share walls (no boxes-in-a-box); the interior view
is pixel-stable; U418–U419 green; full suite green. One local commit, do NOT push, no version bump.

## Rollback

Revert the commit (boxes + gridless paper return).

## Report (plain English for Tim)

What was wrong (the outdoor map drew rooms as floating boxes inside a bigger box — a worse artist than
the indoor map, working from the same blueprints — and the closest zoom had no graph paper), what
changed (both maps now draw with the SAME hand: real connected rooms, shared walls, doorway gaps — and
the closest view sits on true 5-foot graph paper), why it matters (this is the tabletop the whole
vision points at: one sheet, one artist, real architecture on real squares).
