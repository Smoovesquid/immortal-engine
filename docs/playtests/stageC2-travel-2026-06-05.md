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
- Engine already had overworld step-travel (arrival pipeline + biome-typed
  ambush via `maybeSpawnEscapeEncounter`/`spawnTamedAmbush`), but "go to X" was
  caught by the directional free-movement branch and deflected ("which way?").
- Replay constraint (U21): the directional branch pushes one travel event PER
  cell-step, so it can't be looped for named travel. Slice-1 design = a single
  node-graph hop via `moveToNode` + arrival pipeline = ONE travel event (replay
  re-runs the named-travel call once → identical). `world.time` gained `hours` +
  `leagues` accumulators (round-trip via ensureTime → determinism holds).

## Transcript (live v1.html, AI on — screenshots ss_96282pclx, ss_4396kl0wq)
- `go outside` → exterior; `where am I?` → "…Wayfarers' Outpost… To the south lies
  Black Orchard." (exterior survey names the neighbor)
- `I head to Black Orchard` → "The road into Black Orchard brings you past
  weathered timber and the smell of woodsmoke… but his eyes are already tracking
  something… that does not belong. [ambush]" → a journey, interrupted by a
  terrain encounter (Static Leech) → combat.
- (in combat) `where am I?` / `go to …` → resolved as combat turns (you can't
  stroll off mid-fight) — correct.
- after winning, `where am I?` → "You're in Black Orchard, a settlement… To the
  north lies Wayfarers' Outpost and to the east lies Dry Creek." (ARRIVED — new
  node, new neighbors)
- `let's travel to the Obsidian Spire` (unknown) → "Hael shakes her head… no place
  called the Obsidian Spire lies within any road she knows from here." (in-fiction
  clarification naming the real roads — NOT "which way?")

## Findings
| input | result | DM-test? | grounded? | visible? | correct? | note |
| --- | --- | --- | --- | --- | --- | --- |
| I head to / go to <neighbor> | runs a journey, arrives at the place | ✅ | ✅ | ✅ | ✅ | time + distance advance |
| journey through danger | terrain-typed ambush (Static Leech) interrupts the trip | ✅ | ✅ | ✅ | ✅ | the dangerous-journey model |
| where am I? after arrival | survey shows the NEW place + its neighbors | ✅ | ✅ | ✅ | ✅ | real state change |
| travel during combat | becomes a combat action | ✅ | ✅ | ✅ | ✅ | can't leave a fight |
| travel to UNKNOWN place | NPC clarifies in fiction, names real roads | ✅ | ✅ | ✅ | ✅ | no "which way?" |
| determinism | same seed + input → identical (U21 green, U96-C) | — | — | — | ✅ | |

## Built this pass
- DM-resolved named travel (slice 1): destination resolution, node-graph journey
  with arrival pipeline, time (turns/hours) + distance (leagues) tracking,
  terrain-typed ambush possible, in-fiction clarification for unknown places.
- Tests U96 (new) + U39d updated. Full suite 7131/7131, U21 green,
  playtest:quick clean, prose harness 0/0.

## NOT verified / deferred to Stage C.2 slice 2 (honest gaps)
- **Ambush = surprise** — `beginCombat` still rolls normal initiative; the ambusher
  does NOT yet get a surprise round / first move. (Prose deliberately does not
  claim surprise.) Needs an escape-combat turn-flow change — the lead item for s2.
- **Per-leg open-country journey** — the "dangerous wood *between* A and B" as a
  distinct mid-journey encounter. Today the encounter resolves at arrival (typed to
  the destination's land), not as a separate leg. The richer multi-cell journey
  (and multi-hop routing) is s2.
- **Non-combat travel beats** (traveler/rumor/toll you can talk/pay/slip past) — s2.
- **Directional travel between settlements** ("go south" leaving a settlement) — still
  intercepted by v1.js placeWalk (Stage C.1 report's open item).

## Verdict: GREEN for slice 1 (named travel is a real DM-run journey, live-verified).
Stage C.2 remains OPEN overall — slice 2 (surprise, per-leg wood, non-combat beats,
directional inter-node travel) is the remaining work.
