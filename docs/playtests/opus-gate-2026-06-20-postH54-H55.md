# Playtest — Opus-4.8 experiential gate — 2026-06-20

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 2 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 5 | 2 | 0 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 10 (21%)

## Failures by bug class

### DM_TEST_DEADEND (8)
- **[Rules Lawyer DM]** player: _"I call him on it — what are you not telling me about that road, Corwin? Make a WITS check for me to read him."_
  - DM: Roll WITS — d20 +1 against DC 12 to read Corwin Boneknit. Tell me what you get.
  - mech: `(none)` — **med**: DC and modifier stated correctly, no rules violated yet.
- **[Lore-hound]** player: _"Wait — who's Brae Copperforge, and when did they walk in? I never saw anyone else in this room."_
  - DM: You bide your time, eyes moving over Pilgrim's Rest Village.
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Roll shows success but the fiction delivers nothing relevant to the player's query; outcome disconnected from the rolled success.
- **[Lore-hound]** player: _"Don't dodge me — you mentioned Brae Copperforge nodding along just now. Where is this person standing?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll/DC math is consistent (14 vs 12 success), nothing contradicts.
- **[Lore-hound]** player: _"Answer the question — Brae Copperforge, the one you said nodded a moment ago. Point to exactly where they're standing in this room."_
  - DM: You ask around, and someone gives you something real to go on.
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll succeeded (14 vs 12) but the success delivered no actual information — outcome contradicts the stated success.
- **[Lore-hound]** player: _"So Brae's a guard now — who posted them here, and what crime am I suspected of?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:19 vs DC:12 → success | margin:7 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Roll succeeded and nothing contradicts mechanics, though no info delivered.
- **[Lore-hound]** player: _"Stop dodging — answer plainly: who posted Brae as a guard here, and what am I suspected of?"_
  - DM: You're Nyx, a sellsword — and by the count, you're level 1. You’ve been paid to win and paid to lose. You hold to duty, for all that you're too curious. The fine print — your scores and your kit — is yours to read on you
  - mech: `(none)` — **med**: No mechanics invoked; nothing to contradict.
- **[Confused newbie]** player: _"Okay, um, can I go talk to that guard, Brae, about the bandit?"_
  - DM: That way is blocked from here.
  - mech: `(none)` — **high**: Player wanted to talk to Brae, who is present per canon; DM gave a movement deadend instead of resolving the social intent.
- **[Confused newbie]** player: _"Okay, I made it. Brae, can I talk to you about that bandit watching the village?"_
  - DM: It falls short here in Pilgrim's Rest Village, and you're left where you started.
  - mech: `[roll:6 vs DC:12 → failure | margin:-6 | approach:charm | stake:time | risk:0.47 | stat:WITS+1 | adv` — **med**: Roll 6 vs DC12 is a failure and the narration reflects no progress, consistent.

### CRUNCH_INCONSISTENCY (2)
- **[Rules Lawyer DM]** player: _"What weapons and gear am I carrying, and do I have any armor on?"_
  - DM: There's no armor — you're armed with Kitchen cleaver and Worn Blade. You're wearing Padded coat.
  - mech: `(none)` — **med**: Self-contradiction: claims no armor then says wearing Padded coat, which is armor.
- **[Rules Lawyer DM]** player: _"I'm citing the WITS check you just adjudicated — you said d20+1 vs DC 12, I rolled 14+1=15. Where's this 9 vs DC 10 coming from? That's a different roll entirely."_
  - DM: Roll WITS — d20 +1 against DC 12 to read Corwin Boneknit. Tell me what you get.
  - mech: `(none)` — **med**: DM never addressed or reconciled the discrepancy between the stated 9 vs DC 10 and the player's 15 vs DC 12; the resolution is internally inconsistent and unresolved.

## Cost
96 Opus calls · 131,063 in + 9,137 out tokens · ~$2.65 (est. @ $15/$75 per M)
