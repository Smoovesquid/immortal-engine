# FP-2 — walls with mass, windows with glass: the rich plan ink

**Model:** Opus (renderer lane — `public/map/` only; taste-critical port with canvas geometry).
**Your tests: U436–U438** (U396–U435 are ALL taken by landed/in-flight lanes — do not use them even if
the allocator offers them).
**Parents (all landed):** FP-1 `U429-431` (tiled floorplan geometry, WALL=0.12 shared-wall band) ·
WS-3 (one surface — the sheet's plan band is now THE interior view) · TT-DRAW/-2/-3 + DEC-1.

## Tim's sighting (2026-07-04 evening, verbatim — this is the acceptance)

> "So the buildings themselves have taken a huge step backwards. I want windows, doors, I want to be
> able to tell what walls are made of. We had all of this stuff at the beginning of the day. I do not
> want boxes in boxes as rooms. I want floorplans."

## Root cause (confirmed live + in Node — do not re-derive)

FP-1's geometry is CORRECT and locked (U429): rooms are floor polygons separated by a 0.12-layout-unit
shared-wall band (`engine/structures/floorPlan.js` WALL=0.12; ≈2.4 ft — real wall thickness); doors sit
IN the band (e.g. tallow cottage: Bedchamber y-ends 0.74, Hearth y-starts 0.86, door at y=0.80).
The regression is 100% PAINT: `oneMap.js`'s plan band (drawLayout, ~lines 868–990) strokes each room as
a thin closed outline and leaves the wall band as EMPTY PAPER → "boxes in boxes." It also never draws
windows, door swings, or wall-material character. The morning's rich look was
`public/map/handDrawnInterior.js` (retired from the live path by WS-3) — its visual language was never
ported to the sheet. WS-3's "keep the niceties" checklist named highlight/furniture/fog/marker and
missed windows/materials/door-swings; this packet closes that gap.

## The fix — port the hand-drawn language onto the honest geometry (renderer only)

All in `public/map/` (`oneMap.js` drawLayout plan-band section, `drawModel.js`, `planModel.js` if
needed). The style SOURCE to port from is `handDrawnInterior.js` (read it first — MATERIALS table,
window glazing, door swings, furniture palette, keyed-FNV wobble) and the authored window vocabulary in
`public/map/plans/races.js` (`casement`/`slit`/`barred`). The old renderer stays untouched on disk.

1. **Poché — walls read as MASS, not outlines.** At the plan band (cutaway open), the wall band —
   building shell minus the room floor polys — fills as solid wall mass in the material's ink, with the
   material's hatch character (port `MATERIALS`: stone=diag hatch/crisp, fortified=cross-hatch,
   timber=warm brown, cave=stipple). Room floors re-expose the warm paper+grid inside. The dead-paper
   gap between rooms CEASES TO EXIST — it is wall. Implementation freedom: even-odd fill of
   shell-minus-rooms, or thick strokes along the shared-wall centerlines — whichever stays crisp at
   both the compact map and fullscreen zoom. Bold ink outline on the wall/floor boundary (the old
   renderer's inkLoop passes) so it reads hand-drawn, not vector-CAD.
2. **Doorways pierce the mass + swing.** Every `floorPlan().doors` entry cuts a visible gap through the
   wall band (gap width ~0.3 lu, tune by eye) and draws a door-leaf swing arc (port the old renderer's
   door treatment). A doorway must read as "opens room into room" — Tim's FP-1 ruling.
3. **Windows — CANON, not decoration.** `engine/structures/roomWindows.js` exports pure per-room
   derivations: `roomWindows(world, {structureKey, roomId})` → `{count, shuttered, outlook}` and
   `roomWindowFacings(world, interior)` → compass facings. The fiction already uses these (climb out,
   night locks, shutter toggles are timeline canon). For every room of the OPEN (cutaway) building:
   draw `count` windows on the room's EXTERIOR wall at the derived facing — glazed double-tick when
   open (casement style), shutter marks when `shuttered`. Dark rooms (cellars) get none — the engine
   already says so. NEVER place a window on a shared (interior) wall; if a derived facing lands on a
   shared wall, snap along that wall to its exterior run or skip — verify how facings derive first and
   flag what you find. Read-only engine imports are fine; NO engine file edits expected — if a tiny
   pure accessor is truly unavoidable, keep it pure, zero state, and PROMINENTLY FLAGGED.
4. **Furniture reads by material.** Port the palette (WOODI/WOODF, STONEI/STONEF, METAL, CLOTH) so the
   bed/table/dresser marks look like furniture, not brown smudges.
5. **Hand-drawn wobble, deterministic.** Port the keyed-FNV jitter idiom (seed = structure id) for wall
   ink at the plan band — never `Math.random` (renderer honors the engine's determinism discipline; the
   map must not shimmer between redraws).
6. **Label LOD (fold-in nit, already queued):** room-name labels draw at the plan band only — never at
   street/settlement zoom where they collide.
7. **Rewrite the STALE comment** at `drawModel.js` roomWallSegments (~153–164) — it still describes the
   pre-FP-1 pad-and-corridor world and will mislead the next reader.
8. All new magic numbers go in `INK_PARAMS` (drawModel.js) as tunables — Tim tunes by eye later.

## Boundaries

- `public/map/` only. NO changes to `engine/structures/floorPlan.js` geometry (locked by U429–431 — do
  not relock them), no playloop, no state.js, no grace, no llmAdapter.
- Pure view: engine read-only, no state writes, worldHash byte-identical, no `Math.random`.
- The compact in-play map and fullscreen sheet share this code (one surface) — verify BOTH sizes; the
  compact map is small, so the poché must stay legible at low pixel counts (test at compact scale).
- No other lanes are in flight; you own `public/map/` this session.

## Tests (U436–U438; reshape distribution if needed but COVER all three)

- **U436 — poché:** for the tallow boot cottage, the drawn plan-band model fills the wall band between
  connected rooms as wall mass (not void), every floorPlan door pierces it with a gap, room floors are
  carved inside; deterministic ×2 (same model twice).
- **U437 — windows are canon:** per-room drawn window count equals `roomWindows()` count for every
  discovered room; windows sit on exterior walls only; dark rooms draw none; `shuttered` state changes
  the drawn variant. Model-level assertions.
- **U438 — material + LOD:** shell material selects the wall ink/hatch style; furniture entries carry
  the material palette; room-name labels present at plan band, absent at settlement band.

## Verification

Lab screenshots (paths in the report): the tallow cottage at plan band — walls with THICKNESS, door
gaps + swings, glazed windows, material hatch, furniture — at BOTH compact-map scale and fullscreen
zoom; plus one larger building (chapel/inn) proving it scales. Then the live boot flow via the real
page. Basecamp + Tim gate live.

## Done-when

Tim's sentence is true on screen: windows, doors, tell-what-walls-are-made-of, floorplans not
boxes-in-boxes. U436–U438 green; full suite + convergence + determinism green; `playtest:quick` clean.
One local commit (no push); package.json patch bump only (front-door line is integration's).

## Rollback

Revert the commit (thin-outline boxes return; geometry untouched).

## Report (plain English for Tim)

What was wrong (the map's new one-sheet view drew each room as a thin empty box floating inside the
building outline — the wall thickness the engine models was left as blank paper, and windows, door
swings, and wall materials never made the jump from the old interior renderer), what changed (walls now
draw as solid mass you could tell stone from timber by, doorways pierce them and swing, and the windows
the game already treats as real — you can climb out of them, shutter them, they lock at night — finally
appear on the map), why it matters (the map looks like a floorplan again AND it shows more canon than
it ever did — nothing here is decoration; every window on the map is a window in the world).
