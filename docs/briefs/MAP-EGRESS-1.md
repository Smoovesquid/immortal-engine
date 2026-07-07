# MAP-EGRESS-1 — the doorstep lands beside the building you actually left

**Worker lane, executed end-to-end alone. Opus.**
**Your tests: U632, U633, U634, U635** (pre-allocated — use ONLY these).

## Step 0 — ground yourself (worktree base trap)
Your `isolation: worktree` branches from `main`, ~886 commits STALE behind `v2-polish` (the mainline).
FIRST, in your worktree: `git fetch origin && git reset --hard origin/v2-polish` and confirm
`git log --oneline -1` shows a recent v2-polish commit (HEAD at dispatch: `a0676c2c`, v0.32.10 b130).
Baseline: `npm run check` must be GREEN before you touch anything. Commit locally; do NOT push;
Basecamp cherry-picks. Do NOT work in the main checkout. `preview_start` serves the MAIN checkout,
never your worktree — any browser proof must be a worktree-rooted PORT=52xx server you start yourself.

## The mission (one breath)
Exiting a building teleports the body across the settlement. The engine computes "just outside the
front door" as if every building sat at the node CENTRE, but the map DRAWS buildings scattered along a
curved road (the P-81b organic layout). The two disagree, so "go outside" from the boot home lands the
player 77 m from their own drawn house — 14 m east of a storehouse (Tim's live sighting, verbatim).
Governing law: **the drawn world IS the simulated world** (docs/MAP_REAL.md; the PLAN-SPLIT-1 / MR-1b
lineage — one geometry, engine-owned, renderer draws it). This closes the last frame where the ink and
the canon body disagree.

## Evidence (self-contained — reproduced headlessly, numbers exact)
Boot the Bryn quickstart (`SLICE_SEED`, `buildPreRolledCharacter(PRE_ROLLED.find(/bryn/i))`,
`beginAdventure`), then `playerMove(world, packs, 'go outside')` (NOTE arg order: `playerMove(world,
packsById, text)` — the sig is `(world, packsById, text, { llmPacket })`):
- After exit: `party[0].pos = { frame: 'region', gx: 9, gy: 4 }` → `regionCellToWu(node,9,4) = wu(45, 20)`.
- The DRAWN home (via `playerFocusWu` indoors, and confirmed by ranking every drawn building's centre)
  sits at ≈ `wu(-12, -32)` — **77 m from the landing**.
- The NEAREST drawn building to the landing is a **storehouse at wu(31, 21), 14 m to the landing's WEST**
  → the body lands "just east of the storehouse." Exactly Tim's report.
- Every egress verb LLM-off lands the same phantom cell: `go outside / step outside / leave the house /
  exit the house / leave` → `region (9,4)`. **But bare `go out` FAILS to classify as an exit** — it
  falls to the atmosphere d20 bank ("...the Aldermere still air tastes of lanternlit dust (11)"). That
  is a second, smaller bug (rider below).

## Root cause (confirmed, to the meter)
Two independent computations of "where is building X in the settlement":
1. **Renderer** `public/map/placeFromNode.js:334–463` — the P-81b organic scatter: `makeRng(seedFromString(
   `${seed}|placelayout`))` seats each building along a seeded curved road by rejection-sampling against
   placed footprints + the road corridor, emitting `{ plan, ox, oy, ...meta }` per building in place-unit
   space. Real structs first (from `structs`), THEN decorative settlement buildings (`sbld`) — the entry
   ORDER drives the rng draw order.
2. **Engine egress** `engine/map/spatial/tacticalPos.js` `doorThresholdCells()` — derives the doorstep
   from `nodeGridToRegionCell(node.x, node.y)` (the node CENTRE) + the entry room's outward edge × PLACE_WU.
   It never consults the scatter. So the building is DRAWN scattered but the doorstep is COMPUTED centred.

**Why the standing position probe stayed green:** it validates the doorstep against the SAME centre-anchored
frame (`structFootprintRegionCells`, the sibling of `doorThresholdCells`). The two phantom computations
agree with each other and both disagree with the drawn screen — self-consistent, screen-blind. This is the
exact "self-consistent lie" class the screen-truth oracle exists to kill; the probe just never had the
drawn footprint to compare against.

## Read first (targeted — grep to locate, read slices, never whole files)
- `public/map/placeFromNode.js:334–463` — the layout to EXTRACT (entries assembly, rng, road spine,
  rejection loop, `ox/oy` emit). Helpers it uses: `planExtent`, `aabbHitsCorridor`, `CORRIDOR_LU`,
  `exitsFrom`, `ensureMap`, `makeRng`, `seedFromString` — trace each; the last four are already
  `engine/` imports.
- `engine/map/spatial/tacticalPos.js` — `doorThresholdCells` (the consumer to fix) + `structFootprintRegionCells`
  (the probe's frame; must move to the true anchor with it) + `nodeGridToRegionCell` / PLACE_WU (the shared scale).
- `engine/structures/interiors.js:112` `exitStructureInterior` — calls `doorThresholdCells`, writes the
  doorstep via `applyDeltas({op:'pos'})`. The write path is correct; only the CELL it's handed is wrong.
- `public/map/worldSpace.js` — `regionCellToWu`, `placeUnitToWu`, `nodeToWu`, PLACE_WU (the frame algebra).
- Precedent to MIRROR: `engine/structures/settlementFootprint.js` (`syntheticPlanForBuilding`) — DEC-1
  already moved a rendering truth (footprint sizes) into the engine and had the renderer consume it. Same
  move, one level up (whole-settlement layout, not per-building size).
- `docs/MAP_REAL.md` + memory `project_map_real_arc` — the falsifier discipline this joins.

## The shape of the fix
1. **REPRODUCE FIRST** as U632 (failing on HEAD): boot Bryn quickstart, `go outside`, assert the landing
   region cell projects to within one building-footprint of the DRAWN home's centre (derive the drawn
   home from the extracted layout). It MUST fail on HEAD (77 m gap), pass after. A diag commit then a fix
   commit is the house pattern.
2. **Extract the P-81b layout to `engine/world/settlementLayout.js`** — a pure, deterministic function
   `settlementLayout(world, nodeId) -> { buildings: [{ structureKey|buildingName, ox, oy, plan }], road, ... }`
   using `engine/rng.js` (already what the renderer uses). **BYTE-STABILITY IS THE PRIME CONSTRAINT:** the
   emitted `ox/oy` for every building on every seed must be IDENTICAL to today, or drawn villages reshuffle.
   Preserve entry order (structs then decorative), rng draw order, rejection-sampling sequence exactly.
   Move/share the helpers it needs. This is the highest-risk step — pin it with U633: the extracted layout
   equals the pre-extraction renderer output for ≥3 seeds (snapshot the `ox/oy` set before you move code).
3. **Renderer consumes the engine layout:** `placeFromNode.js` imports `settlementLayout` and draws from it
   (delete its private copy). No village moves — U633 + the screen-truth goldens are the proof.
4. **`doorThresholdCells` consumes the true anchor:** the doorstep = the drawn building's placed position
   (its `ox/oy` → region cell via the shared frame algebra) + the entry room's outward edge, NOT the node
   centre. `structFootprintRegionCells` moves to the same true anchor (keep them siblings). U634 pins:
   the doorstep cell is adjacent to the building's DRAWN footprint, for the boot home AND a decorative-
   building exit, on ≥2 seeds.
5. **Teach the position probe the drawn-footprint cross-check:** it must now compare the doorstep against
   the DRAWN footprint (the thing that was missing), so this self-consistent-lie class can never pass green
   again. Wire it into `scripts/positionProbe.mjs` (or wherever `npm run playtest:position` points).
6. **RIDER — the `go out` one-liner (U635):** in `inferInteriorAction` (`engine/playloop.js`, the
   INSIDE-branch exit regex ~L5070 and/or the plain-exit OUTSIDE regex ~L5040), a bare `go out` / `get out`
   with no trailing clause must classify `kind:'exit'`, not fall to the atmosphere bank. TIGHTLY scoped —
   do not broaden so far that a compound "head out … who's there?" loses its presence answer (U235 guards
   that; keep it green). `playloop.js` is a HOT FILE: minimal diff, one regex touch, nothing else in it.
   If this proves entangled, SPLIT it to its own commit and flag it — don't let it bloat the geometry fix.

## Determinism / worldHash
The doorstep cell is `party[0].pos` — already IN the hash. Changing the landing changes the hash of any
POST-EGRESS world (a behavior change), but replay stays deterministic (same seed → same new landing →
same hash), which is what U19/21/22/27/30 assert. **Boot hash is unaffected** (boot has no egress). If any
ANCHOR test pins a specific post-egress hash value (grep for pinned hashes, e.g. U454-family), re-pin it
with a one-line note. NO WORLD_VERSION bump (no state SHAPE change — the layout is derived, not stored;
the pos field already exists). Run the full determinism family and state so explicitly in your report.

## Done-when
- U632 red-on-HEAD → green (the 77 m teleport is gone; the body lands at its own drawn door).
- U633 byte-stability (≥3 seeds, drawn `ox/oy` unchanged) + screen-truth goldens unmoved.
- U634 doorstep-adjacent-to-drawn-footprint (boot home + a decorative exit, ≥2 seeds).
- U635 `go out` classifies as exit; U235 (compound presence) still green.
- `npm run check` GREEN in your worktree (convergence 135/135, suite 0-fail, position probe with the
  NEW cross-check, screen truth 7/7). `playtest:quick` clean.

## Boundaries
- **Own:** `engine/world/settlementLayout.js` (new), `engine/map/spatial/tacticalPos.js`, `public/map/placeFromNode.js`,
  the position-probe script, `engine/playloop.js` (the ONE `inferInteriorAction` regex only), your 4 tests.
- **Do NOT touch:** version files (package.json / public/v1.js — Basecamp bumps), `engine/state.js`,
  `engine/effectsCore.js`, `engine/structures/interiors.js` (the write path is correct — only feed it the
  right cell; touch only if a signature genuinely must change, and flag it loudly if so),
  `public/map/continuousMap.js` / `render3d.js` / `figures3d.js` (the b125–b130 map-view lane — settled).
- `rng.js` is the only randomness; mutations via `applyDeltas`; LLM never throws; invariants always throw.
- Make ALL judgment calls yourself; reversible option + flag if truly blocked. Commit locally, atomic by
  path (never `git add -A` with unrelated dirt): `diag(...)` then `fix(map): MAP-EGRESS-1 — ...` then the
  `go out` commit. Report: SHAs, files, the byte-stability evidence (seeds + before/after ox/oy proof),
  tests with counts, the hash-stability statement, and a plain-English paragraph for Tim.
