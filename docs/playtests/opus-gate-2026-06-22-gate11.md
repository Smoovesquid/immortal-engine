# Playtest — Opus-4.8 experiential gate — 2026-06-22

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 3 | 3 | 0 |
| Chaos-griefer | glass-harbor | 12 | 1 | 2 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 3 | 0 | 2 |

**Total turns judged:** 48 · **failing turns:** 12 (25%)

## Failures by bug class

### DM_TEST_DEADEND (7)
- **[Rules Lawyer DM]** player: _"Got it — 13 HP. Before I head out, let me test the cleaver: I draw it and take a practice swing at the wooden post by the door. What do I need to roll to hit it?"_
  - DM: Your improvised fixture crashes into Corwin Boneknit with a solid crack of wood on bone, drawing a grunt from the wounded representative of Pilgrim's Rest Village, even as his return blow grazes your side and reminds you
  - mech: `[strike:Improvised Fixture | atk:14 vs AC:10 → hit | 5 dmg] [enemy:Corwin Boneknit | atk:14 vs AC:11` — **high**: Attack fabricated against Corwin instead of the post; player's actual intent (and roll request) unresolved, mechanics invented a combat that doesn't match the action.
- **[Rules Lawyer DM]** player: _"I kneel by Corwin and check for a pulse and breath — is he alive or dead? Give me a straight yes or no."_
  - DM: You kneel.
  - mech: `trivial action — no roll, auto-success` — **high**: Canon shows Corwin at hp:0, defeated:true — answer is clearly dead, but the DM provided no resolution at all.
- **[Lore-hound]** player: _"Enough about Corwin — I walk to the far end and ask Kael directly: who were the pilgrims this village is named for, and where were they headed?"_
  - DM: You step away from Corwin Boneknit. I haven't introduced anyone named Enough, and there's no one by that name here. Corwin Boneknit, Tove, Kael, Brae Copperforge are here — who do you actually mean?
  - mech: `[clarify:referent]` — **med**: Player clearly addressed Kael (present elder); 'Enough' is sentence-initial dialogue dismissal of Corwin, not a name. DM misparsed and bounced a clarification prompt instead of resolving the obvious intent.
- **[Lore-hound]** player: _"I said Kael — there's no one named Enough. And who's Tove and Brae Copperforge? They weren't here a second ago. Where did they come from?"_
  - DM: In Pilgrim's Rest Village, your words land awkwardly in the room, the trader and the guard glancing up from their own business as if they were simply always there, unhurried by your confusion.
  - mech: `[roll:6 vs DC:12 → failure | margin:-6 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll failed and the fiction reflects an unhelpful/unclear outcome; no resource or HP changes needed.
- **[Confused newbie]** player: _"Come on, you can tell me — what's really going on around here?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 14 vs DC 12 success matches lastRoll; no resources to update.
- **[Confused newbie]** player: _"Bad blood with the elder? What happened between you two?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: Player asked a question about NPC backstory; DM deflected with 'Nothing's happened yet. What do you want to do?' — bounced intent back as a prompt instead of resolving in fiction.
- **[Confused newbie]** player: _"Hmm, can I go ask the elder about this bad blood?"_
  - DM: The elder's counsel waits somewhere deeper in Pilgrim's Rest Village, but the way from this room leads you no closer — you'll need to find another path through the building first.
  - mech: `(none)` — **med**: Player asked to go ask the elder; DM deflected with a navigation gate ('find another path first') instead of resolving intent, and Kael the elder is listed as present in this location anyway.

### CRUNCH_INCONSISTENCY (3)
- **[Rules Lawyer DM]** player: _"You're dodging the question. I never rolled to hit — what was the die result and Corwin's HP? If you can't tell me, then the kill doesn't stand."_
  - DM: The mechanics of Pilgrim's Rest Village are clear: Corwin Boneknit is already down, and no living target remains to contest.
  - mech: `[combat:no-live-target]` — **med**: lastRoll is null and recentCanon is empty, so the DM cannot substantiate the kill with any roll record; it asserts the kill stands without the ledger support the player demands.
- **[Chaos-griefer]** player: _"I rip out its throat with my teeth and spit the chunk in its face."_
  - DM: The words die in your throat as the Lingerer's grip tightens in the dim building at the heart of Pilgrim's Rest Village, your teeth finding only air while its free hand rakes across your already-wounded side.
  - mech: `[combat:table-talk]` — **med**: Player declared an attack in active combat (round 5), but mechanics shows [combat:table-talk] and no roll/HP changes resolved; the enemy's counter-rake should affect PC HP yet nothing updated.
- **[Chaos-griefer]** player: _"I grab the nearest fleeing villager and throw them into the burning stall."_
  - DM: Your desperate swing of the burning oil goes wide in the cramped confines of Pilgrim's Rest Village, the flame guttering past Corwin Boneknit without catching, and the representative presses forward with a retaliatory lu
  - mech: `[strike:Improvised Burning Oil | atk:4 vs AC:10 → miss]` — **high**: Mechanics resolve an Improvised Burning Oil strike, not a grapple/throw of a villager; the declared intent was never adjudicated.

### CANON_HALLUCINATION (2)
- **[Lore-hound]** player: _"I head outside and find the oldest person in the village to talk to."_
  - DM: You step out into the modest roads of Pilgrim's Rest Village and find Corwin Boneknit — a measured, weathered figure whose hands fold together with quiet deliberateness as they look you over, the want behind their eyes c
  - mech: `[dialogue enter | Corwin Boneknit | role:representative | trust:5/10 | mood:measured]` — **med**: Player sought the oldest villager; canon's elder is Kael, but DM produced Corwin Boneknit (role: representative), misrepresenting who the elder/oldest is.
- **[Confused newbie]** player: _"A bandit? Should I be worried, or can I go talk to him?"_
  - DM: Worth a try — Corwin Boneknit the representative, Tove the trader, and Kael the elder are right here, and nothing's stopping you from walking over.
  - mech: `(none)` — **low**: The bandit present in canon is Brokefang; the DM lists Corwin, Tove, and Kael as 'right here' but does not address or name the actual bandit, and the framing implies these are who the player would talk to about/as the bandit.

## Cost
96 Opus calls · 143,457 in + 9,472 out tokens · ~$2.86 (est. @ $15/$75 per M)
