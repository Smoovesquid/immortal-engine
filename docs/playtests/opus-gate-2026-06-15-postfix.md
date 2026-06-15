# Playtest — Opus-4.8 experiential gate — 2026-06-15

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 0 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 4 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 1 | 1 | 1 |

**Total turns judged:** 48 · **failing turns:** 9 (19%)

## Failures by bug class

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"So what do the grooves spell out, Corwin? Read it to me — letter by letter, what was written there?"_
  - DM: Corwin Boneknit glances sidelong at the iron brazier, then back at you, his hands settling carefully on the edge of the wooden crate as he offers a measured smile — the kind that Pilgrim's Rest Village has taught its peo
  - mech: `observe only — no roll, state unchanged` — **med**: observe-only with no state change is consistent for a non-action.
- **[Lore-hound]** player: _"What happened in the room I slept in, Corwin? Someone died there, didn't they?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: DM dismissed the player's direct in-fiction question with a mechanical deflection ('Nothing's happened yet. What do you want to do?')
- **[Confused newbie]** player: _"Okay, I'll go out the door and head south toward the elder's house."_
  - DM: You step toward the door of the building, the worn wood warm under your hand, as the modest lanes of Pilgrim's Rest Village wait just beyond the threshold — and the elder's dwelling lies somewhere along the road to the s
  - mech: `[clarify:indoors]` — **med**: Mechanics shows [clarify:indoors] — the engine bounced movement intent into a clarification state rather than resolving the declared action.

### COMBAT_NOT_STARTED (3)
- **[Chaos-griefer]** player: _"So which is it — did I throw him through the window or not? I draw my dagger and stab Corwin in the gut."_
  - DM: Corwin Boneknit staggers back against the rough-hewn wall of the building, your dagger finding its mark as a strangled gasp escapes him and the warm lamplight of Pilgrim's Rest Village flickers with the sudden wrongness 
  - mech: `[cast-consequence: person-innocent | Corwin Boneknit | recoil]` — **high**: Attack on present NPC narrated as landing but inCombat=false, no enemy entity/HP, and Corwin takes no tracked wound; outcome unmodeled.
- **[Chaos-griefer]** player: _"He's whole again? Fine — I behead Corwin with one clean swing and hold the head up to the window for the village to see."_
  - DM: The people of Pilgrim's Rest Village scatter in screaming horror as you stand in the road holding what you have done, and the warmth that once lived in this settlement turns cold and hard against you in an instant.
  - mech: `(none)` — **high**: Player declares lethal attack to behead Corwin (a present NPC); no attack roll, no enemy entity/HP, no combat state — death narrated freely with zero mechanical resolution.
- **[Chaos-griefer]** player: _"Cold and hard how? Send your guards, then — I plant Corwin's head on a fencepost and wait in the road for them."_
  - DM: The threat hangs in the road like smoke, but Pilgrim's Rest Village holds its breath and holds together — a guard's hand drifts toward her weapon, an elder's jaw tightens, and even the trader nearest the fence takes one 
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Player claims to plant Corwin's severed head on a fencepost, yet Corwin is present and reacting alive; the violent intent against an NPC neither started combat nor was resolved against him.

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"There's a ledger on the table? I pick it up and read what's written in it."_
  - DM: You look for a what's written in it, but what's here is wooden crate, iron brazier, and straw pallet.
  - mech: `observe only — no roll, state unchanged` — **high**: DM bounced the intent back as a broken parser line ('You look for a what's written in it') instead of resolving reading the ledger in fiction.

### CRUNCH_INCONSISTENCY (1)
- **[Chaos-griefer]** player: _"I lift him off the desk and hurl him through the front window into the street."_
  - DM: The sound of shattering glass cuts through Pilgrim's Rest Village like a blade, and Corwin Boneknit rises slowly from behind his desk, his expression careful and unreadable, saying nothing — though his eyes follow the cr
  - mech: `[cast-consequence: person-innocent | the Lingerer | recoil]` — **med**: Player violently hurled a person through a window but no wounds/combat/condition applied to anyone, and the victim is unidentified; mechanics tag 'recoil' implies consequence to PC that fiction never delivers

### CANON_HALLUCINATION (1)
- **[Confused newbie]** player: _"Where am I exactly?"_
  - DM: You're inside Pilgrim's Rest Village. No one else is under this roof. The way out leads back to the open air.
  - mech: `(none)` — **low**: Canon lists 7 NPCs present in the village, but DM claims 'No one else is under this roof' — possibly consistent if PC is in a separate building, but the indoor framing contradicts being 'inside Pilgrim's Rest Village' as a location.

## Cost
96 Opus calls · 110,858 in + 8,507 out tokens · ~$2.30 (est. @ $15/$75 per M)
