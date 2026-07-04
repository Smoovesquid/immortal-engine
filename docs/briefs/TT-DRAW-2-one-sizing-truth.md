# TT-DRAW-2 — one sizing truth: every building draws at its world rect, and zoom reaches plan scale

**Model:** Claude Sonnet (renderer lane — `public/map/`). **Your tests: U416–U417** (U412–U415 are held by
an in-flight engine worker — do NOT use them even if the allocator offers them).
**Parent:** TT-DRAW (`6472388`, landed on `v2-polish` as `02c3721`) — read its brief
(`docs/briefs/TT-DRAW-tabletop-look.md`) and `docs/TABLETOP_MAP.md` first.

## The live finding (Basecamp taste-gate, 2026-07-04-pm2, screenshots on record)

TT-DRAW's drawn plan is CORRECT but composes wrong on the live sheet:
1. **Two sizing systems on one map.** The entered cottage draws at its TRUE world rect
   (`structureWorldRect` ≈ 10.7 × 9.1 wu) while every unentered building still draws at the old
   catalog-art scale — visually ~5–10× larger. Neighbors disagree in size; the old inflated art is also
   the ROOT of Tim's "extra roofs" sighting (art bigger than footprint truth = roof shapes overhanging).
2. **Max zoom is too shallow.** The camera clamps around the 5 m-scale band, so a true-scale cottage
   plan stays tiny — room names and door gaps illegible. (Verified: repeated wheel-in produced identical
   frames = hard clamp.)

## The fix

1. **ONE sizing source:** every settlement building — entered (plan ink) AND unentered (block) — draws
   at its `structureWorldRect` (the world-unit truth WS-1 built and the marker/entities already use).
   The catalog-art footprint sizing at the local band retires. Far-zoom LOD may keep simplified
   silhouettes but they too anchor to the true rects. NO art may exceed its structure's world rect —
   this kills the roof-overhang class at the root (an aligned roof-line ON the footprint is fine; Tim
   is being asked separately about the roof *style* for unentered buildings — do not remove the roof
   read entirely unless the answer arrives in your worktree docs; default = keep a subtle roof-line
   INSIDE the true rect).
2. **Deepen the zoom ceiling** so one cottage can fill ~2/3 of the frame (plan legibility: room names +
   door gaps readable). Find the z clamp in the camera (`oneMap.js`/`continuousMap.js`), raise it, and
   keep the value a named constant. Sanity: label font scaling at the new depth (names legible, not
   billboard-huge).
3. **Collision check:** with true rects, verify neighboring buildings don't overlap absurdly (they
   shouldn't — the rects come from the same layout anchors); if the *anchors* themselves collide, flag
   it in the report (that's village-layout data, not yours to fix).

## Boundaries

- Pure view; engine read-only; no state; no `Math.random`; worldHash byte-identical (extend the
  existing proof if a test exists).
- Do not touch the interior branch, `public/v1.js`, or engine files. A sibling OPUS engine lane is
  running — zero overlap.
- Keep all tunables (zoom ceiling, roof-line style, line weights) in the ONE ink-parameters place
  TT-DRAW established.

## Tests (U416–U417)

- **U416:** sizing unification — for the tallow boot settlement, every drawn building footprint
  (block or plan) lies INSIDE its `structureWorldRect` (no overhang); entered + unentered agree on the
  sizing source; deterministic ×2.
- **U417:** zoom ceiling — the camera's max-z constant admits a frame where a 10-wu building spans
  ≥60% of the shorter viewport axis (pure math on the camera model, no DOM).

## Verification

Lab screenshots (settlement · street · plan-fills-frame) + one unentered-building close-up (roof-line
inside the rect). Basecamp + Tim gate on the live map after land.

## Done-when

U416–U417 green; full suite green; screenshots show one consistent building scale and a legible
floor plan at max zoom; no art outside its world rect. One local commit, do NOT push, no version bump.

## Rollback

Revert the commit (art scale fork returns).

## Report (plain English for Tim)

What was wrong (the map drew your house at its real size but the neighbors at parade-balloon size, and
the camera couldn't get close enough to read a floor plan), what changed (every building now draws at
its true footprint — which also kills the overhanging-roof look at the root — and the camera can now
get close enough to read room names), why it matters (one map, one scale, one truth).
