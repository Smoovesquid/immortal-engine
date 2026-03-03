# Immortal Engine — Deterministic Doctrine

Version: 1.0  
Status: Binding

---

## 0) Prime Directive

The Immortal Engine is deterministic by construction.

Same inputs → identical outputs.  
Same transcript → identical worldHash.  
All meaningful state transitions must be explicit and observable.

Determinism outranks convenience. Stability outranks speed.

---

## 1) Core Invariants

These must never be violated:

- No hidden state mutation.
- All meaningful transitions are evented or logged.
- Replay from canonical log reproduces identical state.
- Event order is stable and intentional.
- Canon integrity is preserved.

If a change risks one of these, stop and isolate it.

---

## 2) Prohibited Sources of Nondeterminism

The following are banned unless routed through deterministic wrappers:

- `Math.random()` outside seeded systems
- Date/time as gameplay input
- Environment-dependent branching
- Locale-based formatting in logic
- Unstable iteration (object keys, Sets, Maps without defined ordering)
- Implicit JSON key ordering assumptions

---

## 3) State Discipline

All state transitions must:

1. Be intentional.
2. Be observable.
3. Be reproducible.
4. Affect worldHash in a controlled way.

No “silent writes.”

---

## 4) Replay Authority

Replay is the final judge.

If replay does not produce identical worldHash:
- The change is incorrect.
- The bug is structural.
- Fix determinism before adding features.

---

## 5) Refactor Rule

No refactor without failing signal.

Permitted refactor triggers:
- Failing test
- Proven instability
- Explicit architectural milestone

Prohibited:
- Cosmetic refactors during gate progression
- Structural rearrangements without invariant proof

---

## 6) Gate-Oriented Development

All work must move a declared Victory Gate acceptance criterion.

If a change does not move a gate forward, it does not merge.
