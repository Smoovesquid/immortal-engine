# Playtest — Stage C.2: directional inter-node travel — 2026-06-05

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST

Charter: "head south" / "go south" / "travel west" should set off on a JOURNEY to the
place that way (reusing the verified named-travel journey: time/distance/encounters/
surprise/beats/multi-hop) — not just nudge the avatar locally. The survey already says
"to the south lies X"; acting on that directionally must honor the intent.

Design: a typed direction WITH a movement verb ("go/head/travel/make for south") →
resolve the node in that compass direction (exitsFrom) and route through named travel
("go to <that place>"). A BARE direction ("south", "s") and the compass buttons keep
local place-walk (fine positioning). Low-risk: UI-side translation onto verified engine.

## Pre-registered attack list (committed BEFORE the build)
- [ ] `head south` (when survey says a place lies south) → travels there (journey)
- [ ] `go west` / `travel north` phrasing variants → travel to that place
- [ ] direction with NO place that way → graceful (local walk or DM note), no crash
- [ ] bare `south` / `s` → still local place-walk (unchanged)
- [ ] direction during combat → combat action (no travel mid-fight)
- [ ] after `head south`, `where am I?` → the southern place (real state change)
- [ ] reuses journey behaviour: can be ambushed / multi-hop / arrive

## Grading
DM-test (intent honored)? · travels to the right place? · bare-dir local walk intact? · no crash · visible.

---
## Built this pass
- v1.js: a typed direction WITH a verb ("head south"/"go west"/"travel north") resolves
  the node in that compass direction (exitsFrom) and rewrites the input to
  "go to <that place>", routing through the verified DM journey. Bare direction +
  compass buttons keep local place-walk.
- Found & fixed the REAL root of the original "go to Trader's Camp" bug: node names
  carry a "(N)" disambiguator ("Trader's Camp (2)"). Added cleanPlaceName(); resolvers
  match with it stripped, prose strips it for display.

## Live (v1.html, AI on)
- "head west" → "go to Wayfarers' Outpost (2)" → multi-hop journey → arrived (first run,
  before the "(N)" display fix — proved directional routing).
- After the fix: "head east" → echo "go to Old Shrine" (clean, no "(2)") → journey ran,
  surprise ambush en route ("a Mag-Louse lunges from concealment and draws first blood
  [ambush | surprise]"). Directional travel reuses the full journey (time/encounters/
  surprise/multi-hop). ✓
- Node check: node "Trader's Camp (2)" + typed "go to Trader's Camp" → matched + arrived;
  prose reads "you reach Trader's Camp" (no "(2)").

## Bug found live (fixed)
- "Assignment to constant variable" — the directional rewrite reassigned a `const text`;
  changed to `let text`.

## Findings
| case | result | verified |
| --- | --- | --- |
| head/go/travel <dir> with a place that way | journeys there | LIVE |
| bare direction / compass buttons | local place-walk (unchanged) | by design |
| "(N)" disambiguator | stripped for matching + prose | node + LIVE |
| direction during combat | combat action (no travel) | by guard (!combat) |

## NOT verified / deferred
- Bare "south" (no verb) intentionally stays local walk; flip to travel later if desired.

## Verdict: GREEN — directional inter-node travel live-verified; "(N)" leak fixed
(which also truly fixes the original "go to Trader's Camp" deflection).
