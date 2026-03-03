# Immortal Engine — UI Victory Gates

Version: 1.0  
Status: Active Ladder (UI Surface)

These gates apply to the **UI/presentation layer** only.

## Scope Allowed
- `public/` (HTML/CSS/JS UI shell)
- UI rendering, layout, messaging, accessibility
- Non-canonical UI state (pure display / interaction affordances)
- UI regression tests that protect assets and behavior

## Scope Forbidden (UI Gates)
- `engine/`
- CanonLog schema / validation
- worldHash algorithm / inputs
- RNG pathways
- Event ordering or canonical mutation flows

## Global UI Invariants
- UI must not introduce nondeterminism (`Math.random`, time-based logic affecting engine calls).
- UI must not mutate canonical state outside existing engine APIs.
- Same inputs/transcript must yield identical `worldHash` before and after UI changes.
- UI changes must be provable (tests + screenshots/logs).

---

## UI Gate 1 — Visual Stability

Objective:
Make the interface readable, stable, and predictable without altering engine behavior.

Acceptance Criteria:
- Layout does not shift when status text changes.
- Map, controls, and move input are visually grouped.
- Buttons align consistently and do not jump around.
- No JavaScript errors in console during normal play.
- Same seed + same actions → same `worldHash` as prior baseline.

Invariant:
UI-only changes; engine untouched.

---

## UI Gate 2 — Status Surface Integrity

Objective:
Make engine/UI transitions visible to the player.

Acceptance Criteria:
- Persistent status line supports at least: Idle / Submitting / Creating Scene / Error.
- Submit and New Scene are disabled during in-flight actions.
- Status updates are observable on every click attempt (even on rejection).
- No double-submit possible.

Invariant:
No timing hacks (no setTimeout that gates engine calls).

---

## UI Gate 3 — Input Authority & Guardrails

Objective:
Make input behavior deterministic, predictable, and user-proof.

Acceptance Criteria:
- Empty move submission is blocked with a clear message.
- Enter key submits move (when allowed).
- Move input auto-focuses after resolution (or on error, as defined).
- Clear feedback when move is rejected or invalid.
- No duplicate submissions under rapid keypress/click.

Invariant:
Validation must occur before calling engine; no engine mutation added.

---

## UI Gate 4 — Canonical Readability

Objective:
Expose canonical state clearly without mutating it.

Acceptance Criteria:
- `worldHash` is prominent and easy to copy.
- Seed / pack / fate are visible (where present in UI).
- Location node + exits are readable and not truncated.
- Discovered count is labeled and understandable.
- Formatting does not alter canonical values.

Invariant:
UI displays canonical state; does not transform it in ways that could be mistaken for canon.

---

## UI Gate 5 — Accessibility & Clarity

Objective:
Make UI usable for more people with minimal complexity.

Acceptance Criteria:
- Visible focus outlines for keyboard navigation.
- Buttons and inputs have clear hover/active states.
- Text contrast supports legibility.
- Tap targets / clickable areas are reasonable.
- No reliance on color alone to convey meaning.

Invariant:
Style changes only; preserve functional semantics.

---

## UI Gate 6 — UI Determinism Audit

Objective:
Prove UI layer does not introduce nondeterminism or drift.

Acceptance Criteria:
- No `Math.random()` usage in UI code.
- No `Date.now()` / time-based branching that affects engine calls.
- No async delays that reorder engine interactions.
- Determinism test evidence: same transcript → same `worldHash` before/after UI changes.

Invariant:
UI remains a pure presentation layer with deterministic interaction ordering.

