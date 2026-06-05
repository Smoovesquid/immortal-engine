# Playtest — Stage C.2: DM-resolved travel — 2026-06-05

Surface: live v1.html (browser) · AI: (record at run) · Persona: The Skeptic
Governing: `docs/THE_DM_TEST.md` · Model: PROSE_MECHANIC_PLAN Stage C.2

Charter: "I head to the Old Shrine" is resolved like a DM runs a journey — named
destination resolved, route across real terrain, time + distance pass, terrain-typed
encounter possible (road→brigands, wood→beasts), ambush gives the attacker surprise,
arrive-or-interrupted — never bounced back as "which way?".

## Pre-registered attack list (committed BEFORE the build)

Named travel — resolution & arrival:
- [ ] `go to the Old Shrine` (named adjacent place from the survey) → actually arrives
- [ ] `head to the Old Shrine` (phrasing variant) → arrives
- [ ] `travel to <multi-hop place>` → arrives (or journeys toward) across >1 leg
- [ ] `let's go to the Old Shrine` (natural phrasing) → arrives
- [ ] after arrival, `where am I?` → survey shows the NEW place (real state change)

Time & distance:
- [ ] travel advances the clock (turns/time-of-day moves) and records distance
- [ ] longer trips cost more time than short ones
- [ ] time/distance surfaced in DM-natural language, not a stat dump

Terrain-typed encounters & ambush surprise:
- [ ] a trip through dangerous terrain can produce a **fight** (terrain-appropriate foe)
- [ ] a trip through safe terrain usually arrives clean
- [ ] when a fight triggers from travel, the **attacker has surprise** (first move / init edge)
- [ ] road foes read as brigands/robbers; wood foes read as beasts/monsters
- [ ] at least one **non-combat** travel beat (traveler/rumor/toll) — talk/pay/slip past

Interrupt & resume:
- [ ] an interrupted journey leaves you *in it* (on the road / in the wood), not at dest
- [ ] after resolving the interruption, the journey can be continued

DM-Test failures to confirm are GONE:
- [ ] no "Out here you travel a step at a time. Which way?" for a named destination
- [ ] unknown place (`go to the obsidian tower`) → in-fiction clarification, NOT a UI prompt

Determinism / robustness:
- [ ] same seed + same inputs → identical journey (U21-style replay holds)
- [ ] garbage (`go to`, `go to nowhere`) handled gracefully

## Grading per input
DM-Test pass (would a DM do this)? · grounded? · visible on screen? · correct state change? · time/distance advanced? · no dead-end / no "which way?" / no value leak?

---

## Investigation notes
(filled during build)

## Transcript (input → response, screenshot IDs)
(filled during live play)

## Findings
| input | result | DM-test? | grounded? | visible? | correct? | note |
| --- | --- | --- | --- | --- | --- | --- |

## Fixed / built this pass

## NOT verified / deferred (honest gaps)

## Verdict: not yet
