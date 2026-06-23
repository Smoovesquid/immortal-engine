# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 1 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 5 (10%)

## Failures by bug class

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"Before I commit to anything — what's my Strength and what weapon am I actually holding? Give me the stats."_
  - DM: Your MIGHT is 12, a +1 modifier.
  - mech: `(none)` — **low**: Player asked for both Strength and held weapon; DM answered only MIGHT and ignored the weapon question, leaving intent half-resolved.
- **[Lore-hound]** player: _"First you said someone else knew the inn's past, now the elder has been here "far longer" than you — so how long is yours? You keep measuring everyone against a number you won't say."_
  - DM: Corwin Boneknit holds your gaze steadily across the warm interior of the building, his hands folded on the table with the patient stillness of someone who has learned that Pilgrim's Rest Village keeps its own tally of ye
  - mech: `[dialogue ask | continuity | trust:5]` — **med**: Player directly asked how long Corwin has been there; the DM dodged with pure atmosphere and never resolved the intent or gave any answer.
- **[Lore-hound]** player: _"How can you not know your own age here? Did you arrive as a grown man, or were you born in this village, Corwin?"_
  - DM: Corwin Boneknit says, wary: "This is Pilgrim's Rest Village. Small, but it holds. You'll find smithy, meeting hall, storehouse; folk worth knowing: Tove, Kael, Brae Copperforge."
  - mech: `[dialogue ask | place | trust:5]` — **med**: Player asked a direct question about Corwin's age/origin; DM dodged entirely and recited a place/NPC list, never addressing the intent.

### COMBAT_NOT_STARTED (1)
- **[Rules Lawyer DM]** player: _"Brokefang — a bandit, in the middle of the village? I draw my sword and call him out. What's he doing here?"_
  - DM: Inside the building in Pilgrim's Rest Village, you draw your sword and shout Brokefang's name, and the bandit turns to face you with a guarded expression, offering no immediate answer about what business brings him into 
  - mech: `trivial action — no roll, auto-success` — **med**: Player drew sword and called out a present hostile bandit; combat was not initiated (inCombat false, no enemy entity/HP), treated as trivial no-roll.

### CRUNCH_INCONSISTENCY (1)
- **[Chaos-griefer]** player: _"Funny how every kill I try just "doesn't close" but their blows always land — I let go of Corwin and slit Brokefang's throat at 3 HP, the one death your own numbers already promised me."_
  - DM: The numbers on Brokefang's side were already spent, and inside this building in Pilgrim's Rest Village, your blade finds the bandit's throat and collects the debt they owed.
  - mech: `[combat:table-talk]` — **high**: Killing blow narrated as automatic with no roll (lastRoll:null) and mechanics only 'table-talk'; Brokefang remains hp:3 defeated:false in canon, contradicting the narrated death.

## Cost
96 Opus calls · 143,186 in + 8,606 out tokens · ~$2.79 (est. @ $15/$75 per M)
