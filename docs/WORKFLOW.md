> **Status:** Partially stale. Branch naming convention (dave/tim prefixes) and review model reflect an earlier team structure. Current development uses the home-base/worker-window pattern described in `SLICE_PLAN.md`. Core principles (PR discipline, determinism checks, AI code as draft) remain valid.

# Immortal Engine — Collaboration Workflow

Version: 1.0

---

## 1) Repository Rules

- main is protected.
- No direct pushes.
- PR required.
- Tests must pass.
- At least 1 review required.

---

## 2) Branching

Branch format:
- dave/<short-description>
- tim/<short-description>

Branches should be short-lived and scoped to one gate or one acceptance criterion.

---

## 3) Pull Request Requirements

Every PR must include:

1. Target Gate
2. Acceptance Criteria being moved
3. Evidence (tests/screenshots/logs)
4. Confirmation:
   - No nondeterminism introduced
   - No unrelated refactor

---

## 4) Review Checklist

Reviewer verifies:

- Determinism rules respected
- Event ordering preserved
- No silent mutation
- Tests updated if necessary
- Scope matches PR description

If unsure, block merge and isolate.

---

## 5) AI Usage Rule

AI-generated code is draft code.

It must:
- Pass tests
- Be reviewed by a human
- Respect deterministic doctrine

AI never bypasses gate discipline.
