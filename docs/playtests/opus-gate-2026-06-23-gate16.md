# Playtest — Opus-4.8 experiential gate — 2026-06-23

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 1 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 5 (10%)

## Failures by bug class

### DM_TEST_DEADEND (2)
- **[Lore-hound]** player: _"Fine — then name one person in Pilgrim's Rest old enough to remember the Boneknits before you, Corwin."_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:21 vs DC:12 → success | margin:9 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Roll 21 vs DC 12 success is consistent; no resources changed.
- **[Confused newbie]** player: _"You're definitely hiding something. What happened in the old days?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: Player asked an NPC about past events; DM bounced with a meta non-answer ('Nothing's happened yet. What do you want to do?') instead of resolving in fiction.

### COMBAT_NOT_STARTED (1)
- **[Rules Lawyer DM]** player: _"I close the distance and level the Worn Blade at the figure—roll my attack. What do I need to hit, and what did I roll?"_
  - DM: The ledger shows 18 vs DC 11 — success. That's your last roll.
  - mech: `(none)` — **high**: Declared attack on a present figure but no combat started: inCombat false, no enemy entity/HP, and the 'success' was just quoting a prior roll, not resolving this attack.

### CRUNCH_INCONSISTENCY (1)
- **[Chaos-griefer]** player: _"I grab Brokefang by the collar and throw him head-first through the same broken window."_
  - DM: With the sting of Brokefang's blow still fresh across your side, you seize his collar with both hands and drive him skull-first through the shattered window frame, sending him crashing into the cold Pilgrim's Rest Villag
  - mech: `[combat:egress] [enemy:Brokefang | atk:22 vs AC:11 → hit | 3 dmg | pcHp:10->7]` — **high**: Mechanics show Brokefang's atk:22 hitting the PC for 3 dmg (pcHp 10->7), but the player's action was the PC throwing Brokefang — the damage is attributed backwards and Brokefang takes no damage despite being driven through a window.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"Corwin just told me you keep a ledger, Kael. Now you say it's all memory. So recite it — how many nights, and who vouched for me?"_
  - DM: Kael meets your eyes steadily in the open air of Pilgrim's Rest Village and says, "Three nights logged in my head, and Corwin Boneknit put his name behind yours — that's what I carry, no ink needed."
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: DM asserts specific facts (three nights, Corwin vouched) but ledgerFacts/recentCanon contain no such record; these numbers are fabricated.

## Cost
96 Opus calls · 141,565 in + 8,914 out tokens · ~$2.79 (est. @ $15/$75 per M)
