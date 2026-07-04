# WS-3 — one surface: the interior branch dissolves into the continuous zoom

**Model:** Claude Sonnet (renderer lane — `public/map/` + the one v1.js branch). **Your tests: U432–U433.**
**Parents (all landed):** a1b4bea (the interior branch — the stopgap you are retiring) · WS-2 `e45c045`
(one camera, follow-the-player) · TT-DRAW/-2/-3 + FP-1 (the sheet now draws REAL tiled floor plans with
graph paper at closest zoom). Read `docs/TABLETOP_MAP.md` (decision #3: indoor↔outdoor is CONTINUOUS)
and PACKETS §TABLETOP (WS-3 acceptance).

## Tim's acceptance (pinned from his live sighting, 2026-07-04)

> Expanding the map while indoors currently SWAPS SURFACES (interior plan → overworld, "I am no longer
> in my bedroom") and the two views disagree. done_when: expand-from-indoors opens the SAME sheet zoomed
> at your room; zooming out pulls up THROUGH the roofless plan to the settlement; the compact and
> fullscreen views can never disagree because they are one surface at two sizes.

## Why now (the ground has shifted under the branch)

The v0.28.8 branch (`renderLocalMap`/`drawInteriorV2` INSIDE, continuous map OUTSIDE) was a stopgap
while the outdoor sheet couldn't draw interiors. It now can — FP-1 tiled plans + TT-DRAW-3's shared
brain + real quadrille mean the sheet at plan zoom IS a proper interior view. The branch is the last
source of "two versions of the map."

## Scope

1. **The in-play compact map and the fullscreen Map screen both render the continuous sheet, always.**
   While `scene.interior` is set, the camera (WS-2's `playerFocusWu` follow) centers the player's room
   at a plan-scale default zoom — the player sees their room on the SAME sheet the overworld lives on.
   Retire the `isInterior` renderer branch in `renderLocalMap`'s play-surface path / v1.js seam — this
   is the ONE v1.js hunk you're licensed for; keep it minimal and flag it in the report.
2. **Default zoom bands:** indoors → plan scale framing the current room/building; outdoors → the
   current street/settlement band (whatever WS-2 does today). Expanding (⤢) changes SIZE, never
   surface or framing.
3. **Continuity check:** zooming out from inside pulls up through the roofless plan into the
   settlement without a renderer switch (this already works on the fullscreen sheet — prove it holds
   from the indoor default).
4. **Keep, don't lose, the interior niceties:** the retired branch drew current-room highlight,
   furniture, visited-room fog, "you are here." Verify the sheet's plan band carries equivalents
   (TT-DRAW/FP-1 built most: furniture, fog mask, marker). If one is genuinely missing (e.g.
   current-room emphasis), add it to the sheet's plan band — in the shared-brain idiom, tunables in
   INK_PARAMS. Do NOT resurrect the old renderer for it.
5. `drawInteriorV2`/`createInteriorMap` stay on disk as dead fallbacks (delete no code paths other
   than the live branch wiring; the old renderer may still serve labs).

## Boundaries

Pure view; engine read-only; no state; no `Math.random`; worldHash byte-identical. A sibling engine
lane (DEC-1, `engine/structures`) runs in parallel — zero file overlap. Do not touch playloop, grace,
llmAdapter.

## Tests (U432–U433)

- **U432:** surface unity — with `scene.interior` set, the play-surface map model resolves to the
  continuous-sheet renderer (not the legacy interior renderer) with camera centered on the player's
  room at plan zoom; stepping outside keeps the SAME renderer with the outdoor band; deterministic ×2.
- **U433:** nothing lost — for the boot interior, the sheet's plan band model contains the room the
  player is in (highlighted/emphasized per your implementation), its furniture, the marker at the
  player's room, and the fog state matching visited rooms — asserted at model level.

## Verification

Live-flow screenshots: boot (indoors — the compact map shows the room ON the sheet) → expand (same
sheet, bigger) → zoom out (through the plan to the settlement, no switch) → walk a room (camera
follows) → step outside (band widens, same surface). Paths in the report. Basecamp + Tim gate live.

## Done-when

Tim's acceptance paragraph is true on screen end-to-end; U432–U433 green; full suite green; one local
commit (no push); package.json patch bump only (front door line is integration's).

## Rollback

Revert the commit (the branch returns).

## Report (plain English for Tim)

What this is (there is now only ONE map — the room you wake in is just the closest zoom of the same
sheet the whole region lives on; expanding makes it bigger, zooming out lifts you through the roofless
house into the street), why it matters (the two disagreeing maps you caught are structurally
impossible now — they're one surface at two sizes).
