# Playtest — Stage C: Movement & transitions — 2026-06-05

Surface: live v1.html (browser) · AI: (record at run time) · Persona: The Skeptic

Charter: every movement phrasing either moves the player (with prose naming the
destination) or clearly explains why not — never silently no-ops, never abstract floor.

## Pre-registered attack list (committed BEFORE the fix)

Interior → exterior:
- [ ] `go outside`
- [ ] `leave the building`
- [ ] `step outside`
- [ ] `leave`
- [ ] `go out`
- [ ] `exit`

Exterior → interior (re-enter):
- [ ] `go inside`
- [ ] `enter the building`
- [ ] `go back in`

Named travel:
- [ ] `go to the well`
- [ ] `head to the gate`
- [ ] `go to the market`
- [ ] `go to the obsidian tower` (absent — must not silently no-op)

Cardinals:
- [ ] `go north`
- [ ] `n`
- [ ] `head west`
- [ ] `south`

Memory / continuity (multi-turn):
- [ ] inside → `look around` → `go outside` → `look around` (does the survey change?)
- [ ] go outside → `examine the <exterior thing>` → `go inside` → `look around` (remembers?)
- [ ] go outside → `where am I?` (survey reflects new location?)

Garbage / edge:
- [ ] `go to nowhere`
- [ ] `go` (bare)
- [ ] `go outside` ×3 rapid (idempotent / sane when already outside)

Cross-feature:
- [ ] `go outside` → `draw my sword` → `go inside`

## Grading per input
grounded? · visible on screen (screenshot)? · correct outcome (did location actually change)? · no dead-end / no abstract floor / no value leak?

---

## Investigation notes
(filled during the fix)

## Transcript (input → response, screenshot IDs)
(filled during live play)

## Findings
| input | result | grounded? | visible? | correct? | note |
| --- | --- | --- | --- | --- | --- |

## Fixed this pass

## NOT verified (honest gaps)

## Verdict: not yet
