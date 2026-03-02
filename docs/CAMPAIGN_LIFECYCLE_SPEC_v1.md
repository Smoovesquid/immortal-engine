# CAMPAIGN LIFECYCLE SPEC v1.0

## Objective

Define the finite campaign arc required for MVP commercialization.

Campaigns are open-ended in architecture but must resolve into
finite arcs for market viability.

---

## 1. Campaign Definition

A Campaign is:

- A deterministic world instance created from:
  - seed
  - pack
  - invocation
- Persisted under a campaignId
- Converging toward an Ending Trigger

---

## 2. Campaign Arc Length

Target:

- 60–90 minutes median playtime
- 20–40 meaningful turns
- Inevitable convergence toward resolution

---

## 3. Convergence Model

Campaigns must terminate via one of:

- Tragic convergence (inevitability overflow)
- Transformational convergence (thread resolution cluster)
- Catastrophic collapse (scar threshold breach)
- Mythic closure (motif completion)

Ending must be:

- Deterministic given seed + transcript
- Canonically logged
- Locked against further mutation

---

## 4. Ending Trigger Rules

EndingTriggered occurs when one of:

- Dread >= threshold
- Active threats >= 3 with high inevitability
- Scar accumulation >= threshold
- Pack-specific convergence condition

Post-ending:

- World state locked
- No further mutation
- Chronicle export allowed
- Sequel derivation permitted

---

## 5. Sequel Continuation Contract

Sequel invocation must:

- Derive deterministically from exported chronicle
- Preserve motif pressure
- Preserve scar memory
- Maintain campaign lineage via campaignId

---

## 6. Replay Guarantee

Invariant:

Same seed + same transcript =>

- Same canonical log
- Same endingType
- Same worldHash

---

## 7. MVP Scope Constraint

For MVP:

- Exactly one official pack
- No pack mixing
- No sandbox endless mode
- Campaign defined as finite arc
- Sequel as new arc continuation

---

## Acceptance Criteria for Gate 1

Gate 1 passes when:

- Campaign lifecycle spec committed
- Ending trigger thresholds explicitly documented
- Replay ending determinism verified by test
- No undefined termination state exists

