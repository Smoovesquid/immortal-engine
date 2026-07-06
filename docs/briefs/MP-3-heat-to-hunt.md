# MP-3 — heat→hunt: accumulated heat brings the hunt (Tier 3 goes live)

**Spec (read FIRST, it is the law):** `docs/MORAL_PHYSICS.md` §4 (heat paragraph + T3 row) + §8
(packet row) + §6 (seams). Predecessors LANDED — study their shape before writing anything:
MP-1 (`fc157aed`, rumorsReaching sole sink) and MP-2 (`5e7815fd`, `engine/morality/escalation.js`
— the tier function + named magnitudes; deed.tier stamped at the effectsCore recordDeed chokepoint).

**Step 0 (mandatory).** Your worktree is branched from `main`, **~900 commits STALE** behind
`v2-polish`. Before ANY work: `git fetch origin && git reset --hard origin/v2-polish`; confirm
`git log --oneline -1` shows the MP-2 integration (`5e7815fd`) or newer. Do NOT work in the main
checkout. Then follow `docs/WORKER_BRIEF.md` (Step-0 self-assemble, verification ladder, output
contract).

## Deliverable — heat becomes real, and at the threshold the hunt comes

1. **Heat accrual (the accumulator):** each cruelty/forbidden deed adds
   `heat += f(severity, witnessReach, concealment)` — per §4: WITS/deception REDUCES it; the wild
   (`ctx.wild`, no settlement witnesses) accrues slowly and mints NO claim (the honest
   "getting away with it" asymmetry — decision #7; it is a FEATURE, name it in code).
   The accrual function + its named constants live in `engine/morality/escalation.js` (MP-2's
   module — ONE home for moral magnitudes). Wire accrual at the same effectsCore recordDeed
   chokepoint MP-2 used (all emitters, uniformly; playloop stays untouched).
2. **Heat decays** with time/distance per §4 — deterministic decay in the world-tick path
   (`engine/worldTick.js`), seeded, replayable; named constants for rate.
3. **The hunt (T3 goes live):** when `actor.heat >= HUNT_HEAT` (MP-2's constant — do not fork),
   the world-tick spawns the hunt via the EXISTING `spawnEncounter` organ (virtue-gods' avengers /
   crime pressure per §4's T3 row). Deterministic-by-seed; the encounter is a real encounter
   through existing systems, no new effect code. Hide-the-math: the player sees hunters arrive,
   never a heat number (invariant I — no numeric moral value in any player-facing string).
4. **Heat is state:** if `actor.heat` isn't already persisted state, add it additively with a safe
   default in `ensureWorld` (MP-2's `deed.tier` pattern: additive + invariant + no WORLD_VERSION
   bump IF deterministically derivable/normalizable — if you conclude a bump IS required, STOP and
   flag it in your report instead; that is a separate blessed ritual).

## Constraints

- Mutations via `effectsCore.applyDeltas()` only; `engine/rng.js` the sole randomness; the LLM
  never sets or sees a number (it may receive tier/vocabulary only — and even that surfacing is
  MP-5, not yours).
- T4 stays computed-not-acted (MP-4's packet). Do not touch the pact/darkGift path.
- Fair combat never accrues heat (U556's law: helplessness is the gate).
- Serial engine lane: `effectsCore.js`, `worldTick.js`, `escalation.js` are yours;
  stay OFF `playloop.js`, `public/map/**` + `scripts/screenTruth*` + `scripts/check.mjs` +
  `package.json` (PLAN-SPLIT-1's live lane wires those), `server.js` fixtures. `worldHash`
  replay-stable; default-seed hash unchanged unless a §4-defined behavior change forces a
  documented re-pin (heat on a no-deed default run should be zero → hash likely unchanged; prove it).
- The six screen goldens are law — your changes must not drift them.
- **Live-playtest server: use a NON-default port** (`PORT=5183 npm run dev` or similar) — 5179 is
  the shared live-verify port; another lane's playtest server may hold it; never fight for or kill it.
  *(Standing rule as of b103 — a worker's playtest server on 5179 masked a release verify.)*

## Tests — U563–U565 (your assigned numbers; use ONLY these — ignore the allocator script, it
re-offers unmerged claims)

- **U563** heat algebra: accrual rises with severity+witnesses, falls with concealment/WITS; wild
  accrues slower AND mints no claim; decay over ticks; all pure-function boundary edges.
- **U564** the hunt fires: scripted deed run crosses HUNT_HEAT → world-tick spawns the hunt
  encounter deterministically (same seed = same tick, same encounter); below threshold = no hunt;
  fair-combat-only run accrues ZERO heat.
- **U565** determinism wall: byte-identical `worldHash` across two replays of the scripted hunt
  run; no numeric heat/corruption value in any player-facing string; old-save normalize green.

## Done-when

Full `node --test` green · determinism green · `npm run playtest:quick` clean · live playtest per
`docs/PLAYTEST_PROTOCOL.md` (drive a real over-threshold run in the browser and watch the hunt
arrive; screenshot receipt) · commit in YOUR WORKTREE ONLY (atomic by path; do NOT push; do NOT
touch the main checkout; do NOT bump version files — Basecamp owns the release bump) ·
plain-English report for Tim: commit SHA, files, test counts, what the hunt looks like in play.

## Standing conduct

Make ALL judgment calls yourself; never wait on Tim; take the reversible option + flag it.
