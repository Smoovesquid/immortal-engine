> **Status:** Partially superseded — Gates 1-3 (deterministic invocation, play loop, chronicle) remain valid. Gate 4 (MythSpec/Triad) references concepts that have been absorbed into the current pack system. See `NORTH_STAR.md` and `SLICE_PLAN.md` for current development model.

# Immortal Engine — Victory Gates

Version: 1.0  
Status: Active Ladder

---

## Gate 1 — Deterministic Invocation

Objective:
World creation from explicit structured inputs.

Acceptance Criteria:
- Inputs: seed, pack, optional mixer, fate.
- Begin → world materializes.
- worldHash displayed.
- Refresh restores identical worldHash.
- Save slot auto-persist works.

Invariant:
Same inputs → identical worldHash.

---

## Gate 2 — Play Loop Integrity

Objective:
Full play loop inside v1 shell.

Acceptance Criteria:
- Submit Move mutates world deterministically.
- New Scene mutates deterministically.
- worldHash updates.
- Ending lock respected.
- No regression in U21–U27.
- Transcript replay reproduces identical worldHash.

Invariant:
Replay stability.

---

## Gate 3 — Chronicle Durability

Objective:
Export/import stability.

Acceptance Criteria:
- Export JSON.
- Import JSON.
- worldHash identical after roundtrip.
- Ending survives roundtrip.

Invariant:
No canonical drift across serialization.

---

## Gate 4 — MythSpec + Deterministic Triad

Objective:
Introduce structured myth interpretation layer.

Acceptance Criteria:
- MythSpec object defined.
- Same myth input → identical interpretation.
- No nondeterministic narrative injection.

Invariant:
Narrative layer cannot mutate canon silently.

---

## Gate 5+ — (Future)

All future gates must define:
- Objective
- Acceptance Criteria
- Invariants
- Non-goals
