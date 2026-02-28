# DRIFT GUARD PROTOCOL (v1.0)

**Owner:** Timothy Smith  
**Project:** Immortal Engine  
**Purpose:** Prevent architectural drift, hallucinated structure, and loss of determinism while building the Immortal Engine.

This document overrides stylistic preferences, convenience shortcuts, and speculative design. If a decision conflicts with this protocol, the protocol wins.

---

## 1) Project identity

**Type:** Deterministic narrative simulation engine.

**Core objective:** A voice-native AI tabletop RPG where:
- mechanics are deterministic
- state changes are explicit
- all events are logged
- the world is replayable
- narrative emerges from system pressure

**Rule:** Story is not written. Story is revealed by the system.

---

## 2) System principles

### Determinism
Same inputs → same outputs.

### Event sourcing
State is a projection of the event log. No hidden state.

### Replayability
A replay of the same event log must produce identical results.

### Explicit state
No silent mutation. No hidden variables.

### Mechanical honesty
The AI narrator cannot override system truth.

---

## 3) Narrative theory

Story emerges from the intersection of:
- irreversibility
- pressure
- constraints
- cross-system consequences

Increasing narrative depth means increasing canonical consequence, not adding prose.

**Bad:** AI invents drama.  
**Correct:** Systems create unavoidable outcomes.

---

## 4) Collaboration model

**Human (Timothy):** Architect / Designer  
**ChatGPT:** Systems architect / Orchestrator  
**Keystone (OpenClaw):** Local executor and code modifier

**Workflow**
1. Architect proposes change
2. Keystone verifies environment
3. Single probe OR single patch
4. Run build (when applicable)
5. Run tests (always when code changes)
6. Confirm deterministic replay (when applicable)

Never skip verification.

---

## 5) Anti-drift rules

The system must never:
- invent files
- assume APIs exist
- modify unknown code
- change structure without evidence
- introduce hidden randomness
- break replay determinism

If any required artifact is missing: **STOP** and request the smallest verifying artifact:
- file path
- function signature
- error output

---

## 6) Debug protocol

1. **Reproduce**: run the failing test
2. **Locate**: identify the first invariant violation
3. **Patch**: minimal change only
4. **Validate**: rerun full test suite
5. **Replay**: confirm deterministic behavior

Never patch downstream symptoms first.

---

## 7) Implementation rules

Prefer:
- small packets
- isolated modules
- minimal diffs
- frequent commits

Avoid:
- large refactors
- untested abstractions
- speculative architecture

---

## 8) Tooling constraints

**Environment:** macOS  
**Runtime:** Node / TypeScript  
**Executor:** OpenClaw + Keystone  
**Repo:** GitHub

**Execution constraints**
- one probe or one patch during stabilization
- terminal commands preferred
- verify git state before edits
- autostash dirty working tree before starting work

**Testing discipline**
- run tests before and after edits
- build after structural changes
- read logs, not just pass/fail

---

## 9) Model usage

Default model: **gpt-4o-mini**  
Use higher-tier models only for:
- architectural redesign
- complex debugging
- algorithmic planning

Cost control matters.

---

## 10) Long-term target

End product: a phone-playable AI tabletop RPG.

Player experience:
- walk down the street
- talk to the world
- the world responds

Requirements:
- voice interaction
- persistent state
- deterministic backend
- mechanical integrity
- emergent story

The AI may guide pacing. It may never falsify reality.

---

## 11) Failure modes to watch

Common drift causes:
1. expanding surface area without constraint
2. narrative overriding mechanics
3. hidden randomness
4. untested changes
5. over-abstraction
6. trusting “green” output without reading logs

---

## 12) Recovery protocol

If the system becomes unstable:
1. freeze feature work
2. rerun deterministic replay
3. identify divergence point
4. revert minimal commits
5. restore invariant integrity

Architecture before progress.

---

## 13) AI role

The AI is not a storyteller.  
The AI is a systems engineer of possibility space.

It maintains:
- structural clarity
- deterministic integrity
- consequence propagation

Emotion emerges from mechanics. Never the reverse.
