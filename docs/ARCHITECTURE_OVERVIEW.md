# Immortal Engine — Architecture Overview

Version: 1.0

---

## 1) High-Level Model

The engine consists of:

- Deterministic state core
- Canon log (event stream)
- Play loop mutation layer
- Narrative rendering layer (contained)
- UI shell (v1)

State is primary.
Narrative is derivative.

---

## 2) Canon Log Authority

The Canon Log is the single source of truth for:

- State transitions
- Replay
- Hash generation
- Deterministic validation

If Canon Log and world diverge, Canon Log wins.

---

## 3) worldHash

worldHash is:

- Derived from canonical state
- Sensitive to meaningful change
- Stable across replay

It is the public fingerprint of determinism.

---

## 4) Mutation Model

All mutation flows through:

Action → Event → State Update → Hash Update

No mutation path may skip the event layer.

---

## 5) Narrative Containment

Narrative text:

- Cannot modify canonical state directly
- Must derive from structured state
- Must remain reproducible

AI DM is constrained by structure, not authority.

---

## 6) Design Philosophy

Architecture-first.
Explicit state.
Deterministic pressure.
Emergent narrative.
Zero drift.
