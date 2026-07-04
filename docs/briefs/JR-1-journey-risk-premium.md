# JR-1 — journey = fast travel with a risk premium (elevated chance + surprised opening)

**Model:** Opus (engine serial lane — playloop journey path + worldTick encounter seam + a minimal
surprise hook in escapeCombat; this worker owns ALL hot files, nothing else engine is running).
**Your tests: U420–U423** (U418–U419 belong to an in-flight renderer worker — do not use them).
**Spec of record:** PACKETS §JR-1 + `docs/POSITION_AS_CANON.md` §3 (THE MOVEMENT LAW — read the
journey paragraph verbatim; it is Tim's design, not a suggestion).

## Tim's parameter (2026-07-04, verbatim intent)

"If you say, I wanna go to Greenwood, which is a different node, then the DM can move you there, but
you're probably gonna get surprised by bandits or something like that — you're gonna increase the
chance that you're gonna run into a negative consequence and be surprised by it, because you're
essentially fast traveling."

## The mechanics (design the minimal v1, then build)

1. **The premium:** a journey turn (the explicit node-travel verb — post NODE-DESYNC-1 it is the ONLY
   node mover) rolls the encounter/consequence table at an ELEVATED rate versus what walking the same
   ground turn-by-turn would accumulate. Deterministic: seeded via `rng.js` from (worldSeed, journey
   context) — replay-stable, worldHash-safe.
2. **The surprise:** when a journey-triggered encounter opens combat, it opens ON THE ENEMY'S TERMS —
   a "surprised" opening in `escapeCombat` (minimal v1 shape: the enemy acts first / the player's
   first-turn options or footing are visibly worse; design the smallest honest version, document it).
   A walked-into encounter does NOT carry the surprise flag.
3. **The asymmetry is the point (test it):** the same route walked manually (local moves, many turns)
   accrues NO premium and no surprise flag. Slowness buys vigilance.
4. **Interruption:** an interrupted journey drops the traveler en route (node edge in the interim —
   region cells arrive with later TAC packets); the narration says where honestly.

## THE LAW of narration (house rule, absolute)

**Narrate the read, never the number.** The player hears "the road feels watched" / "you made good
time, and someone noticed" — NEVER "+30% encounter chance" or any mechanic surfaced. The mech line
(instrument trace) may carry the numbers; prose may not.

## Boundaries

- Serial-lane hot files allowed: `engine/playloop.js` (journey handler only), `engine/worldTick.js`
  (encounter seam), `engine/escapeCombat.js` (the surprise hook — remember `ensureCombat` STRIPS
  non-whitelisted enemy/combat fields in `state.js`: if you add a combat-state field, add it to the
  whitelist and test that it survives).
- NO `WORLD_VERSION` bump if avoidable; if a persisted field is truly required, STOP and flag instead
  (a transient combat-scoped field should suffice for v1).
- Determinism (U19/21/22/27/30 replay green); `rng.js` only; convergence 100% (relock deliberately +
  document if a locked row asserts old journey behavior); LLM-off repro/tests FIRST.

## Tests (U420–U423)

- **U420:** the premium — journeying rolls the elevated table; walking the same legs does not
  (assert the rate asymmetry deterministically across seeds, not statistically).
- **U421:** the surprise — a journey-triggered combat opens with the surprised condition and the
  enemy's first action; a walked-into combat does not.
- **U422:** interruption — an interrupted journey commits an honest en-route position + narration
  names it; no silent completion.
- **U423:** narration hygiene — journey prose contains no numbers/mechanics tokens (grep-class
  assertion over the journey narration bank), while the mech line carries the trace.

## Done-when

All four green LLM-off; `npm run check` GREEN; `playtest:quick` clean; one local commit (no push);
changelog + PACKETS row in the same commit. Patch version bump package.json only (front door line is
integration's).

## Rollback

Revert the commit (journeys return to premium-free).

## Report (plain English for Tim)

What this is (fast travel now costs what it should: ask the DM to take you to the Greenwood and you'll
get there, but the road you didn't watch is likelier to bite, and when it bites it bites FIRST;
walking stays slow and safe-ish because you're paying attention), why it matters (it's your rule —
convenience buys risk, vigilance buys safety — and it makes the world's distances mean something).
