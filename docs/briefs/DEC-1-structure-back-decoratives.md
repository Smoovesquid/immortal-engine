# DEC-1 — every settlement building gets a TRUE footprint (no more parade-balloon neighbors)

**Model:** Opus (engine/structures lane — village data, deterministic gen). **Your tests: U434–U435.**
**Parents:** TT-DRAW-2 `33f8fa73` (one sizing truth for structure-backed buildings — and its honest
flag that DECORATIVE-ONLY buildings have no rect to clamp to) · WS-1 `cf9455e` (`structureWorldRect`).
Read PACKETS §TABLETOP S3 (the DEC-1 row) and the TT-DRAW-2 brief first.

## The problem (Tim has seen it three times today)

Some settlement buildings (tallow: the well, workshop, smithy — plus kin) exist only as
`node.settlement.buildings` entries with NO `world.structures.byId` record → no `structureWorldRect`
→ they still draw at old inflated catalog-art scale (2–10× too big) beside true-scale neighbors. They
are the LAST visible root of the "extra roofs / wrong sizes" class.

## The fix — footprint truth first, enterability where it makes sense

Design intent (decide details yourself, flag taste calls): every settlement building resolves to a
TRUE world-unit footprint from ONE deterministic source. Two acceptable shapes — pick the least
invasive that satisfies the tests, or combine:
- **(a) Canonical per-type footprint table** (engine-side, deterministic, seed-stable): a well ≈ 1×1
  cell, a smithy ≈ a small workshop's real dimensions, etc. — consumed by the renderer for sizing AND
  by any future materialization. No new structure records; NO `STRUCTURE_SCHEMA_VERSION` implications.
- **(b) Real structure records** for the buildings that plausibly HAVE interiors (workshop, smithy):
  generated deterministically like other structures. ⚠️ This touches structure-gen logic →
  `STRUCTURE_SCHEMA_VERSION` (pinned 27) protocol — if you go here, STOP first and re-read the
  version-bump rules (bump + sweep `stgen:v27` test strings); prefer (a) for THIS packet and leave (b)
  as a flagged follow-up if the scope balloons. A well is not enterable; it should never get an
  interior.
- Renderer: the sizing-unification from TT-DRAW-2 then applies to EVERY building (extend U416's
  "no art outside its rect" to the formerly-decorative set). Kill any remaining catalog-scale draw at
  the local band.

## Boundaries

- Deterministic + seed-stable (rng.js only if randomness is truly needed — prefer pure derivation);
  worldHash: if footprints enter world state, replay equality must hold (U19/21/22/27/30) — a pure
  derivation table (a) keeps state untouched, which is the cheaper path.
- A sibling renderer lane (WS-3, `public/map` + one v1.js hunk) runs in parallel — your renderer
  touches are `placeFromNode.js`/`drawModel.js` sizing seams ONLY if needed; if you find yourself in
  `oneMap.js`/`continuousMap.js`/`v1.js`, STOP and flag (those are WS-3's this hour).
- No playloop, no grace, no llmAdapter.

## Tests (U434–U435)

- **U434:** every `node.settlement.buildings` entry for the tallow boot village resolves to exactly
  one finite true footprint (world units) from the one source; the well is SMALL (≤ ~2×2 cells); no
  drawn art exceeds its footprint (extend/parallel U416's assertion to the full building set);
  deterministic ×2.
- **U435:** the sheet's drawn model contains NO catalog-scale entries at the local band — block or
  plan, every building's rect comes from the one sizing source; worldHash unchanged by derivation.

## Verification

Lab screenshots: the settlement band BEFORE-equivalent (cite TT-DRAW-2's report) vs AFTER — the well
as a small feature, the smithy at plausible size, nothing dwarfing the true-scale cottage. Paths in
the report.

## Done-when

No building draws beyond its true footprint at any zoom; the well/workshop/smithy read at sane sizes
next to the cottage; U434–U435 green; full suite + convergence + determinism green; one local commit
(no push); package.json patch bump only.

## Rollback

Revert the commit (parade balloons return).

## Report (plain English for Tim)

What was wrong (a handful of village buildings — the well, the workshop, the smithy — were stage
props with no real dimensions, so they drew at parade-balloon scale next to your true-sized house),
what changed (every building now has one true footprint, and nothing may draw bigger than it really
is), why it matters (the last root of the oversized-building look is gone — the village finally agrees
with itself about how big things are).
