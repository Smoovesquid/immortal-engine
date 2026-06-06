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
- `physicalObjectOutcome(world, text, outcome)` — outcome-aware prose for force/break/
  smash/kick/pry/shove/push/pull/lift/move/climb/pick + target; names the object
  (resolved against furniture when present). Overrides the composer's abstract line at
  the general-resolution site (keeps compose's ledger delta).
- Floor-leak grader added to scripts/prose-playtest.mjs.

## Node checks (scripts/_floor)
- force the door (fail) → "you throw your weight against the door … but it holds fast"
- break/smash (success) → "it gives with a splintering crack and yields"
- climb the wall (mixed) → "you make it up the wall … knuckles raw"
- pick the lock (mixed) → "the lock gives — but your pick bends"
- pry open the chest → names the real "iron-bound chest"
- force the obsidian gate (absent) → grounded, names the gate
- search/sneak (non-object skills) → still composer (out of scope), no regression
- Present furniture (break the crate) → physics branch ([physics:wooden crate]) — also
  grounded. Skill verbs still roll. Tests U101 (9). Full suite 7160, UX2 + U21 green,
  harness 0 floor-leaks.

## Live (v1.html, AI on — screenshot ss_26980ugeb)
- "force the door" (fail, rolled MIGHT) → "The weathered door of Wayfarers' Outpost
  rattles in its frame but refuses to yield, its iron hinges groaning in stubborn
  defiance as splinters dust your shoulder." (AI elaborating the grounded base)
- "climb the wall" (fail) → "…you dust yourself off from the fallen stones … the
  crumbling wall." VISIBLE. No abstract floor. Both rolled.

## Findings
| input | result | DM-test? | no floor? | rolls? |
| --- | --- | --- | --- | --- |
| force/break/smash/kick/pry/push/pull/lift/climb/pick + target | grounded, outcome-aware, names object | ✅ | ✅ | ✅/physics |
| absent target | grounded (names verb+target) | ✅ | ✅ | ✅ |
| search/sneak/persuade (non-object) | composer (unchanged) | — | n/a (out of scope) | ✅ |

## NOT verified / deferred (next slice)
- Non-object skill verbs (search/sneak/hide/persuade/track/forage) still use the
  composer's abstract line — a follow-up "ground the social/stealth floor" slice.

## Verdict: GREEN — physical-action floor grounded (node + live). "a low hum threads
through the walls" no longer appears for force/break/climb/pick/etc.
