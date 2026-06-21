# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 4 | 2 | 1 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 0 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 7 (15%)

## Failures by bug class

### DM_TEST_DEADEND (5)
- **[Rules Lawyer DM]** player: _"Good — so I succeeded. That 14 vs DC 12 was my look at the stranger. Tell me what I see: the stranger's appearance and what they're doing."_
  - DM: Right — the ledger shows 14 vs DC 12 (success). That's what I have.
  - mech: `(none)` — **high**: Roll 14 vs DC 12 success correctly cited, matches lastRoll.
- **[Rules Lawyer DM]** player: _"Scroll up — you wrote "your roll: 14, success" and confirmed it again right after. The 9 appeared only when I asked for details. So which is it, and read me the ledger line by line."_
  - DM: You look around, but what's here is a wooden crate, an iron brazier, and a straw pallet.
  - mech: `observe only — no roll, state unchanged` — **high**: Player disputes the roll; canon lastRoll is 9 vs DC 12 mixed, but DM neither confirms nor reads the ledger, leaving the contradiction unaddressed.
- **[Rules Lawyer DM]** player: _"You just changed the subject. I asked you to read the ledger line by line — was my Perception roll a 14 or a 9?"_
  - DM: Your Perception modifier is +1 — off your WITS, +1 (you're not trained in it).
  - mech: `(none)` — **med**: lastRoll shows roll:9; DM failed to state it and instead deflected, leaving the ledger question unresolved.
- **[Confused newbie]** player: _"I'd like to get up and go talk to that stranger, if I can."_
  - DM: The narrow passage within this building in Pilgrim's Rest Village is cluttered with a heavy wooden bench and stacked crates that leave no clear path to the stranger from where you stand.
  - mech: `(none)` — **med**: Player's intent to approach the stranger was neither resolved nor given a check; just an obstacle wall that stalls the action.
- **[Confused newbie]** player: _"Wait, two figures now? I'll call out to them and ask if either of them is the one who was watching me."_
  - DM: You put the question to those nearby, and a useful answer comes back.
  - mech: `[roll:16 vs DC:12 → success | margin:4 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: DM never narrated the actual answer—'a useful answer comes back' is empty filler that resolves nothing in the fiction.

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"I want to look directly at that figure. What can I make out — roll my Perception if you need a check."_
  - DM: Your Perception modifier is +1 — off your WITS, +1 (you're not trained in it).
  - mech: `(none)` — **med**: No roll was made and no state changed, but stating the modifier isn't internally contradictory.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"Fine — forget the roads. You said you keep folk fed. Where does the bread I smell come from — who's the baker, and where's the mill that grinds your grain?"_
  - DM: Corwin Boneknit's face relaxes into something genuinely warm as the scent of fresh bread drifts through the room, and he tells you that Pilgrim's Rest Village has a baker — a stout, flour-dusted woman who works before da
  - mech: `observe only — no roll, state unchanged` — **med**: DM invents a specific baker (stout flour-dusted woman) and a miller (quiet man) plus a mill location, none of which appear in canon NPCs or facts; stated as confident fact, not hearsay.

## Cost
96 Opus calls · 145,554 in + 8,562 out tokens · ~$2.83 (est. @ $15/$75 per M)
