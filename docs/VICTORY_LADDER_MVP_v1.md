# IMMORTAL ENGINE
# MVP VICTORY LADDER v1.0

## Purpose

Define the complete gate sequence required to move from current Engine/UI Spine state to a commercially viable Minimum Viable Product (MVP).

This ladder terminates at a paid, publicly usable single-pack product with deterministic guarantees preserved.

All gates require explicit Acceptance Criteria (AC).
No gate advances without AC PASS.

---

# GATE 0 — Engine Freeze Contract

Objective: Stabilize deterministic substrate.

Acceptance Criteria:

- Canon event schema declared frozen.
- WorldHash contract declared frozen.
- Save/export format versioned.
- Deterministic replay documented.
- No hidden mutation after ending.
- All engine tests passing.
- Replay determinism verified across ≥ 50 seeded transcripts.

Failure Conditions:

- Non-deterministic worldHash drift.
- Canon mutation without event log.
- Ending mutation after lock.

---

# GATE 1 — Campaign Definition Lock

Objective: Define marketable campaign loop.

Acceptance Criteria:

- Campaign arc length target defined (60–90 minutes).
- Convergence threshold mechanics tuned.
- Ending trigger conditions documented.
- Sequel continuation contract defined.
- Same seed + same transcript → same endingType.

Deliverable:

Campaign Lifecycle Spec committed to repo.

---

# GATE 2 — LLM Containment Hardening

LLM is required but must remain subordinate to engine.

Acceptance Criteria:

- AI narration cannot mutate world outside conductor.
- CanonLog always authoritative.
- LLM failure fallback deterministic.
- Median turn latency < 2.5s.
- Cost per full campaign measured and documented.
- No prose-only hallucination influencing canon.

Failure:

- Canon drift from LLM output.
- Unbounded cost per session.
- Non-deterministic conductor application.

---

# GATE 3 — Single Pack MVP Lock

Scope containment.

Acceptance Criteria:

- Exactly one official pack.
- No pack mixing.
- MythSpec → Triad → Invocation stable.
- ≥ 10 seeded campaign variations tested.
- Replay diversity documented.

No marketplace. No creator tools.

---



---

## GATE 3.1 — Regional World Contract

Objective: Deterministic, themed regional topology with faction personality vectors.

World Generation Requirements:

- Exactly 5 regions per campaign:
  - 1 Origin (safe cluster)
  - 2 Mid-tier regions
  - 1 High-threat region
  - 1 Anomaly region
- Total nodes per world: ~20–30.
- Player always spawns in Origin region.
- Origin region baseline hostility is lowest in world.
- Region sizes are variable within bounded deterministic ranges.
- Regions generated via seed → Region Theme Vector.

Region Theme Vector must include:

- Tone bias
- Base hostility
- Base instability
- Scar density baseline
- Environmental modifier

Faction Personality Vector Contract:

- Each region has a dominant faction.
- Factions have exactly 8 personality axes:
  - Scarcity
  - Curiosity
  - Dominance
  - Mercy
  - Paranoia
  - Honor
  - Corruption
  - Isolation
- Values are bounded integers (deterministic).
- Minor NPCs inherit faction vector.
- Major NPCs may apply bounded modifier.

Containment Rule:

- LLM receives vectors.
- LLM may narrate personality.
- LLM may not mutate vectors or world state.
- All behavioral outcomes computed by engine.

Threat Model:

effectiveThreat =
  regionBaseThreat
+ distanceModifier
+ min(playerPowerInfluence, cap)

Bleed Rules:

- Low-probability anomaly pockets in low-tier regions.
- Low-probability sanctuaries in high-tier regions.
- Origin may destabilize late-campaign but never becomes high-tier.

Acceptance Criteria:

- ≥10 seeded worlds show distinct region vector patterns.
- Player never spawns outside Origin.
- Origin baseline hostility lowest across regions.
- WorldHash stable across generation.
- All regions reachable via clustered graph with weighted bridges.
- No instant-lethal states in first 3 turns.
- Personality vectors influence deterministic reaction weighting.
- No LLM-only behavioral mutation possible.


# GATE 4 — User Completion Loop

Text-first MVP: Primary interaction is typed text (input + output). Voice I/O is explicitly deferred to Post-MVP.

User must be able to:

1. Start campaign < 60 seconds.
2. Understand stakes.
3. Reach ending.
4. Export chronicle.
5. Begin sequel.

Acceptance Criteria:

- Text-first MVP: campaign is fully playable via typed text only (no mic required).
- LLM narration is visible as text output (no audio required).
- Clean onboarding.
- Visible inevitability progression.
- Chronicle export human-readable.
- Sequel boot deterministic.
- No UI dead-ends.

---

# GATE 5 — Account + Server Authority

Commercial readiness requires persistence.

Acceptance Criteria:

- Email-based account system.
- Campaign list per account.
- Auto-save per turn.
- Server authoritative world state.
- Replay verification endpoint.
- No client-side state authority.

No multiplayer.

---

# GATE 6 — Closed Beta Validation

Release to 20–30 external users.

Required Metrics:

- ≥ 50% reach an ending.
- ≥ 30% start a sequel.
- Median session length ≥ 30 minutes.
- ≥ 5 users replay with new seed.
- AI cost per campaign acceptable.
- No deterministic drift incidents.

If metrics fail → iterate prior gate.

---

# GATE 7 — Monetization Readiness

Acceptance Criteria:

- Stripe (or equivalent) integration.
- Paid tier gating active.
- Deterministic replay preserved under paid tier.
- Cost margin documented.
- Refund-safe operation.

---

# GATE 8 — Public MVP Launch

Definition of Done:

- Engine frozen.
- One polished pack.
- Deterministic replay verified.
- Chronicle export stable.
- Sequel continuation stable.
- Account system operational.
- Billing operational.
- ≥ 10 paying users.
- No unresolved deterministic defects.

MVP achieved at first sustained paying cohort.

---

# Post-MVP (Not In Scope)

- Voice mode.
- Multiplayer.
- Pack marketplace.
- Creator tools.
- Engine licensing.
- Multi-pack mixing.

Future ladders required.

---

# Stop Conditions

Development halts if:

- Determinism compromised.
- Canon integrity broken.
- Engine substrate refactored without gate reset.
- Scope exceeds single-pack constraint.

---

# Guiding Principle

The engine governs reality.
The AI narrates.
Commercial viability requires both.
