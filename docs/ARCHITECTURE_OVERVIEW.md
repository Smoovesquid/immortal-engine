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

---

## 7) Walls and Invariants

**WITNESS-OBJECT / GOD-FRAME WALL:** Witness-objects (things with true edges) predate and underlie the gods' frame of reference — the gods are themselves downstream of the catastrophe that produced such objects. Therefore no god-relationship mechanic (divine patrons M7, manifest signs M8, dedication rites M10, the friend/thrall keystone M11) may read, categorize, respond to, or interpret a witness-object as a religious artifact, patron-signal, sign-trigger, or relic. The gods cannot recognize the orb as sacred because the orb is upstream of the gods. The gods are map; witness-objects are territory; the map may never reach down and claim the territory. Things and morality share an epistemological tier (canon-truth vs. NPC-claim) but must never share a code wire that lets the god-frame categorize a thing.

---

## 8) Parked / Deferred

**Remnant economy.** Common, depleted magic-remnants (NOT the witness-orb) may later be tradable goods used to learn or power spells. Their meaning is NPC interpretation — distorted claims that propagate and fracture, never confirmed by the engine. The common trade in cheap remnants camouflages the singular, awake, incomprehensible witness-objects: the market noise is the cover. Deferred until after the First Aperture slice is played and validated.
