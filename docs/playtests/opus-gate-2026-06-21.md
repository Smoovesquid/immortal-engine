# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 3 | 0 | 0 |
| Chaos-griefer | glass-harbor | 12 | 1 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 4 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 10 (21%)

## Failures by bug class

### DM_TEST_DEADEND (7)
- **[Rules Lawyer DM]** player: _"What's the pay for running off this bandit, and where exactly at the village edge is he lurking?"_
  - DM: You take stock of your surroundings. Exits: The Sunken Road, Dry Creek, Hollow Chapel. Structures: building #1.
  - mech: `observe only — no roll, state unchanged` — **high**: Player asked about bounty pay and the bandit's location; DM ignored both and dumped a generic exits/structures list as the answer.
- **[Rules Lawyer DM]** player: _"That's not an answer, Corwin. How much coin for the job, and which of those — Sunken Road, Dry Creek, or Hollow Chapel — is the bandit lurking near?"_
  - DM: Your purse is empty — you're flat broke.
  - mech: `(none)` — **med**: Player asked Corwin two direct questions (coin amount and which location the bandit lurks near); DM dodged both with an unrelated 'your purse is empty' instead of resolving the NPC interaction in fiction.
- **[Lore-hound]** player: _"Why won't you tell me who came before you, Kael? What happened to them?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: Player directly addressed Kael with an in-fiction question; DM deflected with a meta 'Nothing's happened yet. What do you want to do?' instead of resolving intent in the fiction.
- **[Lore-hound]** player: _"Corwin — Kael's eyes flicked, not yours. Why are you answering for where HE looked?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 15 vs DC 12 success matches the narrated minor progress; no resources to update.
- **[Confused newbie]** player: _"Wait, what am I even carrying? I didn't know I had anything."_
  - DM: You're Nyx, a sellsword — and by the count, you're level 1. You’ve been paid to win and paid to lose. You hold to duty, for all that you're too curious. The fine print — your scores and your kit — is yours to read on you
  - mech: `(none)` — **med**: Player asked what they carry; DM punted to 'read it on your sheet' instead of telling them they have a Tonic of grit and Bandages.
- **[Confused newbie]** player: _"A book, huh? Can I open it and see what's inside?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **med**: roll 18 vs DC 12 success is consistent with a positive outcome
- **[Confused newbie]** player: _"Oh interesting, so Tove the trader owes someone? Maybe I should go ask her about this."_
  - DM: That way is blocked from here.
  - mech: `(none)` — **high**: Player wanted to go talk to Tove (who is present in the village); DM bounced with a navigation/UI deadend 'that way is blocked' instead of resolving intent in fiction.

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"I roll out of the blanket and check what I've got on me — what's in my pack and what am I wearing?"_
  - DM: You go through your pack. weapons: Kitchen cleaver, Worn Blade. armor: Padded coat. tools: Lantern. clothes: Wool scarf. oddities: Key with no teeth. junk: Empty vial labeled “CURE”. consumables: Tonic of grit, Bandages.
  - mech: `(none)` — **med**: DM dumped raw inventory categories as a flat list rather than describing the gear in fiction; reads like a UI/stat dump.

### COMBAT_NOT_STARTED (1)
- **[Chaos-griefer]** player: _"I shake the purse open, count the coins aloud, then backhand the villager for being light."_
  - DM: Your purse is empty — you're flat broke.
  - mech: `(none)` — **med**: A declared physical attack on a present NPC triggered no resolution, no combat, no roll.

### CANON_HALLUCINATION (1)
- **[Confused newbie]** player: _"Okay, maybe I'll just go say hi to that elder guy, Kael."_
  - DM: From somewhere deeper in the building, the elder's calm voice carries through Pilgrim's Rest Village's sturdy walls, but the way to him is blocked from where you stand, and you'll need to find another path.
  - mech: `(none)` — **med**: Kael is present per canon; DM blocks a simple greeting with an invented obstacle instead of resolving the trivial intent to talk to him.

## Cost
96 Opus calls · 141,174 in + 8,115 out tokens · ~$2.73 (est. @ $15/$75 per M)
