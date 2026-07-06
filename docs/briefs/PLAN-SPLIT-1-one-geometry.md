# PLAN-SPLIT-1 — one building, ONE geometry: the drawn ink derives from the engine plan

**The bug (the oracle's first catch — MAP-REAL falsifier #3):** the wake building's walls are DRAWN
from the catalog `getPlan()` ("Wattle Cottage") while the figure is SEATED from the engine's real
`floorPlan(structure)` — two different-scale plans for one building; the token sits measurably off
its own walls (place-unit `(1.179,−0.305)` vs wall rect `[1.739,−0.445..3.619,1.035]`).
REND-TRUTH-1 (b100) fixed the sheet-transform scale; this is the OTHER split and it SURVIVED that fix.

**Spec sources (read FIRST):** the PLAN-SPLIT-1 row in `docs/PACKETS.md` · `docs/MAP_REAL.md`
(the one-law: the engine plan is the single geometry — drawn ink must derive from it) ·
`scripts/screenTruth.mjs` EXPECTED_RED comment (the precise finding) · `scripts/screenTruth.scenes.mjs`
(how the wake scene builds the drawn model).

**Step 0 (mandatory).** Your worktree is branched from `main`, **~900 commits STALE** behind
`v2-polish`. Before ANY work: `git fetch origin && git reset --hard origin/v2-polish`; confirm
`git log --oneline -1` shows v0.30.4+ (`31ba90ba` or newer). Do NOT work in the main checkout.
Then follow `docs/WORKER_BRIEF.md` (Step-0 self-assemble, verification ladder, output contract).

## The seam (located — start here)

- `public/map/placeFromNode.js:296` — `const plan = getPlan(type) || getPlan('cottage')` (the draw
  site; the file's own comments at lines 15–37 admit the struct-frame vs catalog-plan split).
- `public/map/generatePlace.js:53` — same catalog read.
- The engine's truth: `floorPlan(structure)` (engine side — trace from where the figure is seated;
  the screen-truth scene builder shows the exact call).

## Deliverable

For engine-backed structures, the drawn building ink derives from the ENGINE plan — kill the catalog
`getPlan()` read at the draw site or project it through the engine plan's geometry (worker's judgment;
pick the reversible option and flag it). Catalog plans may remain ONLY for structures that have no
engine plan. One building = one geometry, at every zoom.

## Done-when (machine-checkable — the oracle IS the gate, in this order)

1. `npm run playtest:screen` → the wake scene goes GREEN (PROJECTION_EQUALITY passes).
2. Remove the `wake_interior` entry from `EXPECTED_RED` in `scripts/screenTruth.mjs` → the run must
   show ZERO expected-red and ZERO unexpected findings.
3. Flip U553's todo (the U497-todo pattern) — it now asserts green.
4. Capture the wake golden: `npm run screen-goldens:accept` (the deliberate-accept ritual; commit the
   new `tests/goldens/screen/wake_interior.pgm`).
5. Wire `playtest:screen` into `npm run check` (`scripts/check.mjs`) as a standing rung — the
   all-scenes-green precondition is now met (position-probe precedent).
6. Full `node --test` green · determinism green · `npm run playtest:quick` clean · live playtest per
   `docs/PLAYTEST_PROTOCOL.md` — verify on the REAL player map (map-fidelity rule: not done until it
   registers on the screen Tim sees; screenshot receipt in your report).

## Tests — U561–U562 (your assigned numbers; use ONLY these)

- **U561** one-geometry law: for an engine-backed structure, the drawn model's building rect and the
  engine `floorPlan` rect are the SAME geometry (pure-rails assertion, no browser).
- **U562** regression: a catalog-only structure (no engine plan) still draws its catalog plan;
  nothing else in the six existing golden scenes drifts (goldens stay byte-identical).

## Constraints

- Renderer/map lane: stay OFF `engine/morality/`, `engine/playloop.js` (MP-2's serial lane is live),
  `server.js` test fixtures (U381 session), and all hot files. `worldHash` must be untouched (this is
  a draw-side read; if you believe engine state must change, STOP and flag it in the report instead).
- The six committed goldens are law: if any drifts, that is YOUR regression — fix the change, never
  re-accept a golden to make red go away (deliberate-accept is for the NEW wake golden only).
- Commit in YOUR WORKTREE ONLY; do NOT push; atomic commits by path.

## Standing conduct

Make ALL judgment calls yourself; never wait on Tim; reversible option + flag when blocked.
Final report: commit SHA, files changed, tests run with pass counts, oracle before/after colors,
and a plain-English paragraph for Tim (not a coder — translate jargon on first use).
