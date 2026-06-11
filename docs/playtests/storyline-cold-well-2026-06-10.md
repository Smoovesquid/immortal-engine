# Playtest — Storyline proving slice: The Cold Well (2026-06-10)

**Build:** v2-polish · **Spec:** docs/STORYLINE_SPEC.md · **Arc:** content/arcs/the_cold_well.arc.js

## Verdict: the full arc pipeline works, live in the browser.

Played on the live `v1.html` surface (planted county world, seed `arc0`):

1. **The rumor is in the air at adventure start** — minted into `world.rumors`,
   carried by the cast witness (tier 2, so she'll volunteer it at neutral trust):
   *"They say the well at Crossway Village runs cold and wrong since the new
   moon — and that Yara Boneknit saw why."*
2. **"Hello Yara Boneknit"** → dialogue banner ("In conversation with Yara
   Boneknit — laborer"), zero dice.
3. **"What happened with the cold well?"** → gold-accented NPC line, visible in
   screenshot: *Yara Boneknit leans in. "Cold well truth? Aye, I'll tell you
   what I know." And they do — plainly, holding nothing back.* Mechanics:
   `[dialogue ask | shared | cold_well_truth | trust:6]`. Arc stage advances
   hear-it → see-it.
4. **Resolution** (engine-verified, G10-06): standing at the well completes the
   arc — an `aid` deed is recorded and the county talks: *"A stranger came and
   looked into the cold well at Crossway Village, and did not flinch."*
5. **Abandonment** (G10-07): ignore it 12 days and the well freezes over, the
   witness leaves, a colder rumor replaces the hook. Stories don't wait.

No quest markers, no journal chrome — the arc surfaces only as rumor, NPC
knowledge, and consequence. The word "arc" never appears player-side.

## Bug found & fixed during the live run (the playtest protocol earning its keep)

**The UI's meta-question gate was shadowing dialogue.** "What happened with the
cold well?" matched the "what happened?" recap pattern in `doSubmitMove`, so the
DM recapped the previous turn instead of letting the NPC answer — the question
never reached the engine. In dialogue mode everything you type is said to THEM
(the banner says exactly that). Fix: skip the meta gate when
`w.scene.dialogue.npcId` is set. Engine-side routing was already correct — this
was UI-only, and headless tests couldn't see it. Screenshot-or-it-didn't-happen
caught it.

Also fixed en route: `server.js` now serves `/content` (the arc data module
404'd in the browser and killed the engine module graph).

## Verification

- Suite: 7,417 pass / 0 fail (G10 ×8 new: validate, cast determinism, rumor
  carriage, fact planting, stage advance, branch deed + rumor, abandonment,
  ensureWorld/hash round-trip).
- `npm run playtest:full`: 500 runs, 0 bugs.
- Live screenshots: dialogue banner + spoken truth line (`/tmp/cold-well-victory3.png`).
- WORLD_VERSION 24 → 25 (`world.story`), invariants + worldHash cover it,
  version-pinned tests updated per checklist.
