# API Activation Victory Gates

These gates must pass before enabling an external LLM API key.

The engine must remain the sole authority over canonical state.

---

# Gate A — LLM Boundary Integrity

Objective:
Ensure the model cannot directly mutate canonical state.

Acceptance Criteria:

• LLM output cannot directly invoke engine state mutation.
• LLM output must pass schema validation before interpretation.
• Event types must be validated against canonical allowlist.
• Engine decides final canonical events.
• Rejected proposals produce no state mutation.

Test Conditions:

Cases to simulate:

1. Valid structured proposal → canonical event emitted.
2. Unknown event type → rejected.
3. Malformed JSON → rejected.
4. Prose-only response → ignored.

Invariant:

Rejected proposals must not change worldHash.

---

# Gate B — Deterministic Replay With API Enabled

Objective:
Verify that determinism survives LLM integration.

Given identical:

• seed
• transcript
• engine version

Running the engine N times must produce:

• identical worldHash
• identical canonical event log

Test Protocol:

N = 10 runs  
temperature = 0  
seed fixed

Invariant:

Narration may vary, but canonical state and worldHash must remain identical.

---

# Gate C — Full Model Trace Capture

Objective:
Ensure every model interaction is auditable.

Each model call must produce a trace record containing:

• requestHash (payload without API key)
• model name
• seed
• system_fingerprint (when provided)
• raw response text
• parsed structured proposal
• validation result (accept/reject)
• rejection reason (if rejected)

Trace Record Example:

{
 "requestHash": "hash",
 "model": "model-name",
 "seed": 0,
 "systemFingerprint": "fingerprint",
 "responseText": "...",
 "parsedProposal": {},
 "validationResult": "accepted"
}

Invariant:

Every model call must generate exactly one trace entry.

---

# Gate D — Engine Authority Lock

Objective:
Prevent accidental AI mutation of canonical state.

Acceptance Criteria:

AI modules must not directly call state mutation functions.

Verification scans must return zero matches for:

worldState mutation
applyEvent calls
direct canonical log writes

Invariant:

All canonical state changes originate only inside engine modules.

---

# Gate E — Canonical Event Allowlist Freeze

Objective:
Prevent silent expansion of event surface area.

Acceptance Criteria:

Canonical event types are defined in a single allowlist source.

A freeze test must assert that no new event types appear without intentional update.

Invariant:

Event allowlist must remain identical between engine runs unless explicitly updated.

---

# API Key Activation Rule

The API key may only be enabled once all gates pass.

At that point:

• LLM output is advisory only.
• Engine remains deterministic authority.
• worldHash remains the canonical verification of state.
