# MP-2 — the escalation module: ONE tier function under every moral act

**Spec (read FIRST, it is the law):** `docs/MORAL_PHYSICS.md` §4 (the ladder) + §8 (packet row) +
§6 (seams — fair combat NEVER tags; the wild asymmetry is a feature). Sibling rulings:
`docs/REPUTATION_UNIFICATION.md` (R5), and the MP-1 landing (`fc157aed`) — follow its
named-constant style (`DEED_GOSSIP_MIN`).

**Step 0 (mandatory):** `git reset --hard origin/v2-polish` in your worktree — agent worktrees
branch from main, ~900 commits stale. Verify `git log --oneline -1` shows the v0.30.x release line
before touching anything.

## Deliverable

`engine/morality/escalation.js` — new module, the deterministic core:

- `escalationTier(deed, actor, ctx) → 0..4` exactly per §4's pseudocode: pure, seeded, replayable.
  No `Math.random`, no Date, no LLM. Inputs: `actor.corruption 0..100`, `actor.heat ≥ 0`,
  `ctx.witnessReach = |witnesses|`, `ctx.wild = bool`.
- **Named magnitude constants in THIS ONE module:** `HUNT_HEAT` (starting calibration ≈40),
  Tier-1 threshold = `DEED_SEV.HEAVY` (import/lockstep with playloop's ceiling — do not fork),
  `PACT_CORRUPTION` **read from `engine/forbiddenGates.js` thresholds — never fork that number.**
- **Routing:** the moral-fact sources — deed recording (`applyDeedCharges` path), gratuitous-magic
  charges, NPC villain arcs — compute their tier through this function and carry it on the deed/act
  record. T0–T2 must express **today's live behavior** through the ladder (T1 = the existing
  scarify/ecology consequence, T2 = the MP-1 bridge) — no observable change beyond what §4 defines.
- **Ruling-over-doc (MP-1 precedent):** §4's tier table still names `mintClaim→propagateClaims` in
  the T2 cell — that cell is SUPERSEDED by `REPUTATION_UNIFICATION.md`: `rumorsReaching` is the sole
  read-sink; deed reputation is a read-time projection; open NO parallel mintClaim-from-deeds path.
  MP-1's worker honored the ruling over the doc; do the same on any conflict and flag it in your report.
- **T3/T4 are computed and stored, NOT acted on** — the hunt (spawnEncounter) is MP-3, the pact-gift
  is MP-4. Do not wire their effects here. No DM-prompt surfacing here either (that is MP-5);
  nothing numeric may reach any player-facing string (invariant I).

## Constraints

- `playloop.js` is a competence hot file — this is a SERIAL lane; touch only what the routing needs,
  stay off `scripts/screenTruth*` (VIS-ORACLE's lane) and all other files.
- All mutations via `effectsCore.applyDeltas()`; `rng.js` is the only randomness (the tier fn itself
  should need none).
- Fair combat must never tag cruelty (§6 seam): the helpless-gate stays tight — U556 is the guard,
  keep it green.
- `worldHash` byte-identical under replay; default-seed hash unchanged unless a §4-defined behavior
  change forces a documented re-pin.

## Tests — U558–U560 (claimed in PACKETS; single continuous range)

- **U558** tier-function truth table: every boundary edge (severity just under/at HEAVY; forbidden
  always ≥1; witnessReach 0 vs 1 at tier 2; heat at/under HUNT_HEAT; corruption at/under
  PACT_CORRUPTION; wild ctx mints tier 2 never from zero witnesses). Pure-function, no world.
- **U559** routing: a recorded HEAVY witnessed deed carries tier 2 on its record; a fair-combat kill
  routes tier 0; magnitudes appear in NO player-facing string.
- **U560** determinism wall: byte-identical `worldHash` across two replays of a scripted deed run;
  T3/T4 computed-not-acted (no encounter spawned, no gift granted).

## Done-when

`node --test` full suite green · determinism green · `npm run playtest:quick` clean · live playtest
per `docs/PLAYTEST_PROTOCOL.md` · **commit in YOUR WORKTREE ONLY — do NOT commit or copy the patch
into the main checkout** (Basecamp integrates; MP-1's worker broke this and it cost a diagnosis) ·
plain-English report: what was dead, what now routes through the ladder, why it matters.
