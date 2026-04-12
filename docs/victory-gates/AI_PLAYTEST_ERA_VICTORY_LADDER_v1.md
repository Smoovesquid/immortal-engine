> **Status:** Partially superseded. Gate A1 (narrative weave) and A2 (structure layer) are implemented. Gate A3 (spatial illusion UI) is partially covered by the map panels. Gates A4-A5 (AI action proposals, autonomous playtester) remain aspirational. The playtest harness (`scripts/playtest.js`) covers some of A5's goals through headless simulation. See `NORTH_STAR.md` for current vision.

# AI Playtest Era — Victory Ladder v1

This ladder extends the existing Victory Gates spine with an AI-first playtest era.
It must preserve the core invariants:
- AI can change narration, never canon.
- Canon only changes via explicit canonical events (e.g., CANON_CREATE).
- Replay determinism remains transcript-keyed.

---

## Gate A1 — Narrative Weave Contract

**Objective**  
AI turns engine state into vivid prose **without mutating canon**.

**Acceptance Criteria (machine-checkable)**
- With AI ON, `worldHash` after a move equals `worldHash` with AI OFF for the same transcript.
- AI output contains no forbidden tokens (existing polish validation rules apply).
- AI output is pure narration (no hidden mechanics fields added).

**Invariant**
- AI can change text, never state.

---

## Gate A2 — Structure Layer

**Objective**  
Add deterministic “structures within a node” (houses, shrines, docks, etc.) without rooms/geometry.

**Acceptance Criteria**
- Each map node deterministically yields `structures[]` (`id`, `name`, `tags`).
- Each structure deterministically yields `surfaces[]` (latent by default).
- Same `(seed, nodeId)` → same structures/surfaces.
- Interacting canonizes surfaces using existing `CANON_CREATE` event path.
- `worldHash` changes only when canonical events occur.

**Invariant**
- Structure generation is a pure function of seed + location identity.

---

## Gate A3 — Spatial Illusion UI

**Objective**  
Visualize “what’s real” at 10k/5k/local views without introducing true geometry.

**Acceptance Criteria**
- Region/world maps unchanged (graph view still canonical).
- Local map can show structure markers derived from deterministic ids (no time/random).
- No UI-only state changes affect engine call ordering (no async reorder).

**Invariant**
- UI remains projection-only.

---

## Gate A4 — AI Action Proposals (Constrained)

**Objective**  
AI proposes candidate actions from current state while engine remains authority.

**Acceptance Criteria**
- AI returns a bounded list (e.g., 3–5) of action strings.
- Actions are validated by deterministic rules (no direct world mutation).
- Running chosen action through playloop yields deterministic results.

**Invariant**
- AI suggests, engine decides.

---

## Gate A5 — Autonomous Deterministic Playtester

**Objective**  
Run large batches of AI-assisted play while proving replay determinism.

**Acceptance Criteria**
- Test harness runs N simulations (e.g., N=200) with AI enabled in advisory mode.
- For each run: transcript replay reproduces identical `worldHash`.
- Trace capture redacts secrets (extend existing trace redaction tests if needed).

**Invariant**
- Transcript is the replay key. AI must not introduce nondeterministic branching.
