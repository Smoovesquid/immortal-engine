# Playtest — Stage C.2: non-combat travel beats — 2026-06-05

Surface: live v1.html (browser) · Persona: The Skeptic · Governing: THE_DM_TEST

Charter: a journey isn't just fight-or-nothing. On a clear trip (no ambush) there's
sometimes a non-combat, terrain-typed BEAT — a trader's cart, fresh tracks, a watcher
at the treeline — that colors the journey without presuming the player's choices.
(Interactive beats you pay/talk/slip past = a later slice; this slice is observational.)

## Pre-registered attack list (committed BEFORE the build)
- [ ] travel several clean trips → some show a non-combat beat, some are plain quiet
- [ ] beats are terrain-typed (forest beat reads woodsy; plains/road reads road-ish; etc.)
- [ ] a beat NEVER starts combat and NEVER blocks arrival (you still reach the place)
- [ ] beats don't presume player choices (no "you pay the toll" — observational only)
- [ ] ambush trips still work (fight) and clean+beat trips still arrive
- [ ] deterministic: same seed + trip → same beat (or same none)
- [ ] no value leak / no "[object Object]" / reads as DM prose
- [ ] node sweep: across many trips, a healthy mix of fight / beat / quiet

## Grading
DM-test (would a DM say this on the road)? · terrain-appropriate? · arrives anyway? · no presumed choices? · deterministic? · visible?

---
## Built this pass
- `travelBeat(seed, destNode, timeline)` — per-biome observational beat tables
  (forest/plains/marsh/mountains/coastal/desert/arctic/wilderness), ~40% of clear
  journeys, deterministic, narration-only. Wired into the clean-arrival path with a
  `[travel | journey-arrive | beat]` tag.

## Node sweep (60 trips): ~23 fight / ~13 beat / ~24 quiet — healthy mix. Samples:
- "…along a salt-bitten shore. Gulls wheel and scream over something dead on the tideline."
- "…where cold peaks bite the sky. A cairn marks the way, one stone added by every traveler."
- "…under a wide, windswept sky. You share the road a while with a lone traveler…"

## Live (v1.html, AI on — screenshots ss_66581t1j7; also ss_9834wftst from slice 2)
- Beat: `[travel | journey-arrive | beat]` — "You arrive at Roadside as the cold
  bites through your cloak… across the frozen road…" (arctic beat woven in). VISIBLE. ✓
- Bonus: caught BOTH slice-2a surprise branches live — `[ambush | surprise]`
  (WITS-6 char, "breathless and shaken") and `[ambush | spotted]` (WITS-7 char,
  "finds you already turned to face it, staff in hand"). ✓
- Clean trips render arrival + biome flavor; deterministic.

## Findings
| case | result | DM-test? | visible? | note |
| --- | --- | --- | --- | --- |
| clear journey beat | terrain-typed, arrives, no combat, no presumed choice | ✅ | ✅ | live + sweep + U98 |
| mix over many trips | fight / beat / quiet all occur | ✅ | — | sweep |
| determinism | same seed/trip → same beat | — | — | U98-B |

## BUG found by the Skeptic (logged, not in this slice)
- **Survey advertises unreachable places.** Survey showed "to the south lies
  Trader's Camp (2)"; `go to Trader's Camp` did NOT travel — it deflected
  ("…lies that way, two stretches down… safe travels"). The "(2)" = a NON-adjacent
  node; `resolveNamedNeighbor` only handles direct neighbors, so the survey promises
  a destination travel can't deliver — a DM-Test violation. Fix belongs to **multi-hop
  routing** (deferred C.2 item): either route multi-hop, or only advertise direct
  neighbors in the survey.

## NOT in this slice / deferred
- Interactive beats (a toll you pay, brigands you talk/slip past) — needs a pending-
  choice state machine. The next clear follow-up.
- Multi-hop named travel (the Trader's Camp bug above).
- Per-leg "dangerous wood *between*" as a distinct mid-journey interrupt.
- Directional inter-node travel ("go south" leaving a settlement; v1.js placeWalk).

## Verdict: GREEN — non-combat travel beats live-verified; journey now reads as
fight / beat / quiet. (Skeptic surfaced the survey-vs-reach multi-hop bug to fix next.)
