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
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
