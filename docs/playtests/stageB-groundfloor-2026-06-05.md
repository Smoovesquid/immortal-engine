# Playtest — Stage B: ground the abstract floor — 2026-06-05

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST

Charter: a resolved PHYSICAL action against an object — "force the door", "break the
crate", "climb the wall", "pick the lock", "push the table" — must read as what a DM
would say: name the thing, and describe the concrete outcome (success / mixed /
failure). Never the target-blind literary filler ("a low hum threads through the
walls — it fails and you pay"). Social/stealth verbs (persuade/sneak) are out of scope
for this slice.

## Approach
After resolveMove (which rolls and gives success/mixed/failure), if the input is a
physical verb (force/break/smash/kick/pry/push/pull/lift/move/climb/pick…) + a target,
override the composer's abstract narration with grounded, outcome-aware prose that
names the object (resolved against furniture when present). Keep compose() for its
ledger delta. Additive + low-risk; everything else still uses the composer.

## Pre-registered attack list (committed BEFORE the build)
- [ ] `force the door` → success/mixed/failure prose names the door + a concrete result
- [ ] `break the crate` / `smash the barrel` → grounded, outcome-aware
- [ ] `climb the wall` → climb-flavored outcome (haul up / scraped / grip fails)
- [ ] `pick the lock` → lock-flavored outcome (tumblers give / pick bends / won't budge)
- [ ] `push the table` / `pull the lever` / `lift the crate` → move-an-object outcome
- [ ] forced verb on a PRESENT furniture name → uses the real name ("wooden crate")
- [ ] forced verb on an ABSENT target → still grounded (no abstract floor), names the verb/target
- [ ] NONE of these produce "a low hum threads through the walls" / "you stare and the meaning slips"
- [ ] skill checks STILL roll (force/climb/pick remain d20 — UX2 contract intact)
- [ ] social/stealth (persuade/sneak/hide) unchanged (still composer) — out of scope, no regression
- [ ] deterministic: same seed + input → same prose
- [ ] full suite green; prose harness abstract-floor-leakage assertion added & passing

## Grading
DM-test (names object + concrete outcome)? · reflects success/mixed/fail? · no abstract floor? · still rolls? · deterministic? · visible?

---
## Built this pass
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
