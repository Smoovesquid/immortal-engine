# VICTORY GATE v1
Immortal Engine — Deterministic Voice DM

This document defines the machine-checkable acceptance criteria required
before declaring the engine “v1 Shippable.”

This is a freeze contract for the canonical narrative spine.

---

## I. Canonical Surface Freeze

Allowed canonical timeline event kinds:

- begin
- scene
- travel
- blocked
- resolution (existing resolution surface)
- threadShift
- scarFormed
- endingTriggered

Rules:

1. No new canonical event kinds may be added without:
   - Failing deterministic test
   - Explicit acceptance criteria
2. All canonical events must:
   - Emit at most once per logical transition
   - Survive export/import roundtrip
   - Be replay-stable

---

## II. Deterministic Replay Gate

For N seeds (>= 50):

1. Simulate >= 300 turns.
2. Export world.
3. Replay from seed + timeline.
4. Hash world state.
5. Hash must match original.

Failure = block release.

---

## III. Ending Integrity Gate

1. endingTriggered emits exactly once.
2. After ending:
   - No additional state mutation allowed
   - Or only epilogue-safe non-mutating output permitted.
3. Ending survives export/import.
4. Ending type and epilogueLine are stable.

---

## IV. No Hidden Mutation Rule

All meaningful state changes must occur via:

- worldTick
- resolution
- conductor (bounded)
- canonical irreversible threshold

Direct mutation outside reducer paths = failure.

---

## V. Voice Contract Gate

Given same seed + same input transcript:

1. Deterministic move resolution.
2. Same canonical events.
3. Same world hash.
4. Narration may vary stylistically only if it does not mutate canon.

---

## VI. Long-Run Stability Gate

1. 100 seeds.
2. 500-turn simulation.
3. Zero invariant violations.
4. No runaway memory growth.
5. No unbounded axis growth beyond defined caps.

---

## VII. Release Condition

Engine may be declared v1 when:

- All gates pass.
- DPoS clean.
- No open invariant violations.
- Canonical surface unchanged for >= 1 stability cycle.

