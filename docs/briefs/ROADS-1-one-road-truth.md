# ROADS-1 — one road truth: buildings off the road, roads go somewhere

**Model:** Opus (renderer lane — `public/map/` layout + road ink; deterministic geometry).
**Your tests: U439–U441** (U396–U438 are ALL taken by landed/in-flight lanes — do not use them even if
the allocator offers them).
**Serialization:** runs AFTER FP-2 lands (same `public/map/` lane — FP-2 owns `oneMap.js`/`drawModel.js`
until integrated). Rebase your worktree on the post-FP-2 `origin/v2-polish` before starting.

## Tim's rulings (2026-07-04 evening, verbatim — this is the acceptance)

> "Over and over again, we end up with buildings sitting on the roads. We need a rule that Buildings
> CANNOT be on the same squares as roads."
> "And roads must continue to other places. Right now, road stop right outside towns. This is
> something I've asked for repeatedly."

## Root causes (confirmed by code read — do not re-derive)

1. **Buildings on roads** — `public/map/placeFromNode.js` (~99–121): the P-81b scatter
   rejection-samples each building against ALREADY-PLACED FOOTPRINTS ONLY (`hits()`); the road
   corridor is never tested; side offsets start at 2 lu from the road CENTERLINE (road w=1.4 → the
   ribbon is ~0.7 lu each side, plus draw width) so real footprints lap onto it; and after 48 failed
   tries the loop PLACES THE BUILDING ANYWAY (`placed.push(aabb)` unconditionally). Dense villages
   guarantee violations. The well prop sits at `roadY(midX) + 1.4` — marginal by the same math.
2. **Roads dead-end at the town line** — two disconnected road systems: the village lane is a LOCAL
   polyline ending just past the layout bounds (x0/x1 ± a few units, N/S spurs to `minY-6`/`maxY+6`),
   while the region band draws SEPARATE dashed node-to-node tracks (`oneMap.js` ~1123–1142,
   `roadMeanderPts`) with their own seeded wiggle in their own alignment. They never meet. Every past
   road fix polished one system; the miss was structural — there is no ONE road.

## The fix

### A. THE RULE — buildings never share squares with roads (hard, enforced, no fallback-overlap)

In `placeFromNode.js`'s layout:
- Define the road corridor: the road polyline(s) (spine + exit spurs) swept to half-width + a margin
  (tunable; corridor must cover the DRAWN ribbon incl. its stroke). Rejection test = placed footprints
  AND the corridor (test the building's true AABB, the same footprint the sheet draws — DEC-1/WS-1
  sizing truth).
- Kill the give-up path: if sampling exhausts, PROJECT the footprint out of the corridor to the
  nearest clear seat (deterministic — no acceptance of overlap, ever). Building-vs-building overlap on
  exhaustion gets the same treatment (nudge to clear, bounded search) — flag if any village genuinely
  cannot seat its buildings (none should at true footprints).
- Props obey the rule too (the well and kin sit BESIDE the road, fully clear of the corridor).
- Village layout stays organic (clustered near the lane, irregular, terrain-following) — the rule
  changes WHERE a footprint may seat, not the character of the scatter. Same seed in = same village
  out (deterministic; expect layouts to shift once — that is the point, and layout is pure derivation:
  worldHash untouched).

### B. ONE ROAD NETWORK — the village lane IS the road to the next town

- Derive a world-unit road network ONCE from the map graph: for every node edge, a seeded meandering
  polyline from settlement A to settlement B in WORLD units (the continuous sheet's frame). Each
  polyline ENTERS the settlement and becomes/joins its local lane: use the place's actual road
  endpoints + exit spurs (projected via the place frame — `placeFrame`/`worldSpace.js` helpers exist)
  as the network's terminals, so the lane through the village and the road between towns are the SAME
  line with no seam at the frame edge.
- Draw the network at EVERY band from one source: dashed sepia cartographer's track at region zoom,
  the full ribbon at street/plan zoom — weight/dash/alpha vary by zoom (tunables in INK_PARAMS), the
  GEOMETRY never does. Retire the separate node-center `roadMeanderPts` ink in favor of the network
  (keep the function if labs use it; the live draw consumes the network).
- Roads reach the horizon: a road leaving the frame continues drawn toward its destination for as far
  as the viewport shows (no fade-to-nothing at the town line). Undiscovered-destination handling
  follows the existing known/unknown alpha convention (region ink already dims edges to unknown nodes
  — keep that grammar).
- Deterministic (seeded from edge ids, keyed hash / seeded rng only — no `Math.random`), pure
  derivation, engine read-only, worldHash byte-identical.

## Boundaries

- `public/map/` only (`placeFromNode.js`, `oneMap.js`, `worldSpace.js`/`drawModel.js` seams if
  needed). No engine edits; no playloop/state/grace/llmAdapter; no v1.js (front-door line is
  integration's).
- Do not disturb FP-2's fresh plan-band ink (poché walls/windows/doors) — roads are GROUND ink, under
  buildings and plans, per the existing paint order.
- Buildings keep their true footprints (no shrinking buildings to dodge the road).

## Tests (U439–U441; reshape if needed but COVER all three)

- **U439 — THE RULE:** for every settlement node in the tallow boot world (and a second seed for
  breadth): zero building-footprint ∩ road-corridor intersections; zero building-building overlaps;
  props clear of the corridor; deterministic ×2 (same layout twice).
- **U440 — one network:** every map edge yields exactly one world-unit road polyline whose terminals
  land on/join each settlement's local lane (no seam: the lane's frame-edge endpoint lies ON the
  network polyline); the drawn model at region band and street band consume the SAME polyline
  (geometry equality, styling aside).
- **U441 — continuity on the sheet:** for the boot village, the drawn road model extends beyond the
  place frame toward every road-connected neighbor (no polyline terminating at the frame edge);
  deterministic ×2.

## Verification

Lab screenshots (paths in the report): (1) the boot village at street band — every building clear of
the ribbon, well beside the road; (2) zoomed out — the lane continuing seamlessly out of town toward
the neighbor settlements as one continuous track; (3) region band — same roads, dashed grammar. Then
the live boot flow from your own worktree server.

## Done-when

Tim's two sentences are true on screen: no building shares squares with a road, and roads continue to
other places at every zoom. U439–U441 green; full suite + convergence + determinism green;
`playtest:quick` clean. One local commit (no push); package.json patch bump only.

## Rollback

Revert the commit (buildings may re-lap the road; the two road systems return).

## Report (plain English for Tim)

What was wrong (the village generator never checked the road when seating buildings — and if it
couldn't find a clear spot after 48 tries it gave up and dropped the building wherever, road or not;
separately, the lane through town and the roads between towns were two unrelated drawings that both
quit at the town line), what changed (a hard rule now forbids any building or prop from touching road
squares — with no give-up loophole — and there is now ONE road: the lane through the village is the
same line that runs to the next settlement, drawn continuously at every zoom), why it matters (the two
things you kept catching — buildings squatting on the road, roads that go nowhere — are now
structurally impossible, not just cleaned up for one seed).
