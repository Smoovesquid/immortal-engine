# API Activation Victory Gates

These gates must pass before enabling an external LLM API key.

**Non-negotiable invariant:** the engine remains the sole authority over canonical state, and **worldHash** is the canonical verification.

---

## Status Snapshot (Repo-Locked)

**Closed (PASS, test-backed):**
- Gate A — **PASS** (U37)
- Gate B — **PASS** (U40)
- Gate C — **PASS** (U35) + redaction hardening (U38)
- Gate D — **PASS** (U36)
- Gate E — **PASS** (U34)

**Open (BLOCKER):**
- (none)

**Evidence (merged commits):**
- Gate C trace capture: commit `ab8f9b4` (adds `server/aiTrace.js`, trace append in `server/ai.js`, test `tests/victory/U35.aiTrace.capture.test.js`)
- Gate D authority lock scan: commit `185ac25` (test `tests/victory/U36.engineAuthorityLock.scan.test.js`)
- Gate A prose boundary integrity: commit `de14eaf` (test `tests/victory/U37.llmBoundaryIntegrity.proseNoMutation.test.js`)
- Trace redaction (no API key leakage): commit `02ca837` (test `tests/victory/U38.aiTrace.redaction.test.js`)
- Gate E allowlist freeze test: `tests/victory/U34.canonicalEventAllowlist.freeze.test.js` (present in repo)

---

## Gate A — LLM Boundary Integrity (PASS)

**Objective**
Ensure the model cannot directly mutate canonical state.

**Acceptance Criteria**
- LLM output cannot directly invoke engine state mutation.
- LLM output must pass schema validation before interpretation.
- Event types must be validated against canonical allowlist.
- Engine decides final canonical events.
- Rejected proposals produce no state mutation.

**Test Conditions**
Cases to simulate:
1. Valid structured proposal → canonical event emitted.
2. Unknown event type → rejected.
3. Malformed JSON → rejected.
4. Prose-only response → ignored.

**Invariant**
Rejected proposals must not change worldHash.

**Evidence**
- `tests/victory/U37.llmBoundaryIntegrity.proseNoMutation.test.js`

---

## Gate B — Deterministic Replay With API Enabled (PASS)

**Objective**
Verify that determinism survives LLM integration.

**Given identical**
- seed
- transcript
- engine version

**Running the engine N times must produce**
- identical worldHash
- identical canonical event log

**Test Protocol**
- N = 10 runs
- temperature = 0
- seed fixed

**Invariant**
Narration may vary, but canonical state and worldHash must remain identical.

**Evidence**
- `tests/victory/U40.gateB.apiEnabledReplayDeterminism.stubbed.test.js`

---

## Gate C — Full Model Trace Capture (PASS)

**Objective**
Ensure every model interaction is auditable.

**Each model call must produce exactly one trace record containing**
- requestHash (payload without API key)
- model name
- seed
- system_fingerprint (when provided)
- raw response text
- parsed structured proposal
- validation result (accept/reject)
- rejection reason (if rejected)

**Invariant**
Every model call must generate exactly one trace entry.

**Evidence**
- `server/aiTrace.js`
- `tests/victory/U35.aiTrace.capture.test.js`
- `tests/victory/U38.aiTrace.redaction.test.js`

---

## Gate D — Engine Authority Lock (PASS)

**Objective**
Prevent accidental AI mutation of canonical state.

**Acceptance Criteria**
AI modules must not directly call state mutation functions.

**Verification scans must return zero matches for**
- world state mutation
- applyEvent calls
- direct canonical log writes

**Invariant**
All canonical state changes originate only inside engine modules.

**Evidence**
- `tests/victory/U36.engineAuthorityLock.scan.test.js`

---

## Gate E — Canonical Event Allowlist Freeze (PASS)

**Objective**
Prevent silent expansion of canonical event surface area.

**Acceptance Criteria**
Canonical event types are defined in a single allowlist source.
A freeze test asserts no new event types appear without intentional update.

**Invariant**
Event allowlist must remain identical between engine runs unless explicitly updated.

**Evidence**
- `tests/victory/U34.canonicalEventAllowlist.freeze.test.js`

---

## API Key Activation Rule

The API key may only be enabled once **all gates pass**.

At that point:
- LLM output remains advisory only.
- Engine remains deterministic authority.
- worldHash remains the canonical verification of state.
