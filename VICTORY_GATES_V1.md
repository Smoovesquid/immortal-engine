# IMMORTAL ENGINE — VICTORY GATES
## UI SPINE v1.2

---

## GOVERNING PRINCIPLES

1. Determinism is absolute.
2. UI never forks engine logic.
3. Same inputs → same worldHash.
4. No hidden mutation.
5. No feature outside active gate.
6. Gate changes require version bump + ledger entry.
7. Legacy UI remains untouched until v1 parity.

---

## CORE EXPERIENCE CONTRACT

1. User invokes a world.
2. Invocation deterministically stabilizes into structure.
3. A playable world materializes immediately.
4. Moves generate narrative + mechanical consequence.
5. Pressure accumulates toward inevitability.
6. Ending is earned, not arbitrary.
7. Chronicle is exportable.
8. Seed reproduces world exactly.
9. Refresh never corrupts state.
10. Engine never contradicts canon.

---

# GATE LADDER

---

## Gate 0 — Clean Shell Isolation

**Objective**
Establish independent v1 entrypoint.

**Acceptance Criteria**
- /public/v1.html exists.
- Loads without console errors.
- No engine files modified.
- Test suite passes unchanged.

**Non-Goals**
- No invocation logic.
- No play loop.

---

## Gate 1 — Deterministic Invocation

**Objective**
World creation from explicit structured inputs.

**Acceptance Criteria**
- Inputs: seed, primary pack, optional mixer, fate.
- Begin → world materializes.
- worldHash displayed.
- Refresh restores identical worldHash.
- Save slot auto-persist works.

**Invariant**
Same inputs → identical worldHash.

**Non-Goals**
- No triad.
- No flavor authority.

---

## Gate 2 — Play Loop Integrity

**Objective**
Prove full play loop inside v1 shell.

**Acceptance Criteria**
- Submit Move mutates world deterministically.
- New Scene mutates deterministically.
- worldHash updates.
- Ending lock respected.
- No regression in U21–U27.

**Invariant**
Transcript replay reproduces identical worldHash.

---

## Gate 3 — Chronicle Durability

**Objective**
Export/import stability.

**Acceptance Criteria**
- Export JSON.
- Import JSON.
- worldHash identical.
- No canonical drift.
- Ending survives roundtrip.

---

## Gate 4 — MythSpec + Deterministic Triad

**Objective**
Introduce structured myth interpretation layer.

**Acceptance Criteria**
- MythSpec object defined.
- Same myth input → identical MythSpec.
- Exactly 3 frames produced.
- Frame selection maps to deterministic seed.
- Frame selection → identical worldHash across reload.

**Invariant**
Triad generation has zero randomness outside seed.

**Non-Goals**
- No LLM dependency.
- No semantic freeform authority.

---

## Gate 5 — Pressure Visibility

**Objective**
Surface inevitability without complexity.

**Acceptance Criteria**
- UI shows simple tension indicator.
- Indicator shifts deterministically.
- Ending never triggers without visible prior pressure rise.

---

## Gate 6 — Sequel Continuity

**Objective**
Enable chronicle-derived invocation.

**Acceptance Criteria**
- “Begin Sequel” exists.
- Chronicle seed derivation deterministic.
- Sequel worldHash reproducible.

---

## Gate 7 — UI Parity & Legacy Sunset

**Objective**
Confirm v1 fully replaces legacy onboarding.

**Acceptance Criteria**
- v1 supports:
  - Invocation
  - Play
  - Save
  - Export
  - Import
  - Ending
- No legacy feature required for core loop.
- Legacy UI moved to /public/legacy/.

---

# CONSTRAINT BLOCK

Until Gate 5 passes, the following are forbidden:

- Spells UI
- Gear UI
- Maps visualization
- Audio
- AI conductor integration
- Online AI dependency

---

# EVOLUTION LEDGER (Template)

Version:
Change:
Reason:
Impact on prior gates:

---

# EVOLUTION LEDGER (Entries)

Version: UI SPINE v1.1
Change: Closed Gate 5 with transcript-determinism freeze test (U29) enforcing same seed + same transcript => same canon + same worldHash.
Reason: Formalize Gate 5 acceptance with a machine-checkable freeze invariant.
Impact on prior gates: None (additive test only).

---

# EVOLUTION LEDGER (Entries)

Version: UI SPINE v1.2
Change: Closed Gate 6 with chronicle-derived sequel invocation determinism test (U30).
Reason: Formalize sequel continuity as a machine-checkable invariant.
Impact on prior gates: None (additive test + new module only).

