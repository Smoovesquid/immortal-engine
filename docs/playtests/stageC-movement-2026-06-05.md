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
- **Root cause of "go outside" no-op:** `exitStructureInterior` cleared `scene.interior`
  but not `party[0].position.interior`. `ensureWorld` re-derives `scene.interior` FROM
  `position.interior` when scene's is absent → the next ensureWorld snapped the player
  back inside. Fix: enter sets `position.interior`, exit clears it; both wrap the result
  in `ensureWorld` so positions canonicalize (worldHash replay stability).
- **Determinism (U21):** enter/exit emitted no timeline event, so replay never reproduced
  the transition and diverged. (It "passed" before only because the snap-back bug made
  sim and replay both wrongly stay inside.) Fix: enter/exit now push a replayable
  `resolution` event carrying the input text.

## Transcript (live v1.html, AI on — screenshots ss_2376flo7h, ss_9599e6cbu)
- `where am I?` → "You're inside Wayfarers' Outpost. You see Elske the Fox, Torva the
  Crow, Lucca the innkeeper, and Greyhand the bandit here. The way out leads back to the
  open air." (interior survey)
- `go outside` → "…you step back into the open air of Wayfarers' Outpost…" (VISIBLE)
- `where am I?` → "You're in Wayfarers' Outpost, a settlement. … Nearby stand a building.
  **To the south lies Old Shrine.**" (EXTERIOR directional survey — state truly changed)
- `go inside` → "…you step inside, the familiar warmth…" ; `where am I?` → interior survey
- `go to Old Shrine` → deflected: "…has no old shrine within its bounds… choose a
  direction and walk it." (named travel does NOT move you)
- `go to the obsidian tower` → "Out here you travel a step at a time. Which way…?"
- compass **S ×6** then `where am I?` → still "Wayfarers' Outpost" (walking never leaves)

## Findings
| input | result | grounded? | visible? | correct? | note |
| --- | --- | --- | --- | --- | --- |
| go outside | exits to exterior | ✅ | ✅ | ✅ | **fixed** (was the reported bug) |
| go inside / enter | re-enters | ✅ | ✅ | ✅ | round-trip works |
| where am I? (in/out) | correct interior vs exterior survey | ✅ | ✅ | ✅ | proves real state change |
| go to <named neighbor> | deflects to "pick a direction" | ✅ | ✅ | ⚠️ | by-design (no teleport) but high-friction dead-end loop |
| cardinals (south / go south) | UI `placeWalk` = local avatar move | ✅ | ✅ | ❌ | never transitions nodes |
| walk to next settlement | impossible via prose/compass | — | — | ❌ | only the Map tab travels between nodes |

## Fixed this pass
- Interior↔exterior transitions ("go outside" / "go inside" / "enter"): grounded, visible,
  state-correct, determinism-safe. Full suite 7127/7127, U21 green, playtest:quick clean,
  prose harness 0/0.

## NOT verified / OPEN (honest gap — bigger than the reported bug)
- **Node-to-node travel via the prose interface is broken.** The engine HAS overworld
  step-travel (`playloop.js` ~563, `nodeAtCell` arrival), but `public/v1.js` intercepts all
  cardinals to `placeWalk` (local place movement that never transitions nodes), and named
  travel is deflected by design. So a player cannot walk from one settlement to another by
  typing — only via the Map tab. This is the remaining bulk of the Stage C charter
  ("go to the well", "cardinals … resolve to real location changes").
- Needs a deliberate design pass (reconcile local place-walk vs overworld node-travel;
  decide how typed cardinals/named-travel leave a settlement). Not safe to jam in next to
  the determinism-sensitive travel code without that design.

## Verdict: PARTIAL — interior transitions GREEN and shippable; node-to-node travel OPEN.
