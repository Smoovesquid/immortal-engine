# Playtest — Opus-4.8 experiential gate — 2026-06-22

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 1 | 1 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 4 (8%)

## Failures by bug class

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"Good — so what's the result? Give me the die number and the DC I beat."_
  - DM: It falls short here in Pilgrim's Rest Village, and you're left where you started.
  - mech: `[roll:5 vs DC:13 → failure | margin:-8 | approach:focus | stake:time | risk:0.50 | stat:WITS+1]` — **low**: Roll 5 vs DC 13 is a failure, fiction matches outcome (left where started).
- **[Lore-hound]** player: _"You leaned on Kael for memory, Corwin sent me to him for the deed's date — and now neither of you knows. So who DOES remember who ran this inn before Corwin?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Roll 18 vs DC 12 success matches lastRoll; no resource changes needed.
- **[Confused newbie]** player: _"Okay, you're a wizard — just tell me straight, what do you actually want from me?"_
  - DM: Corwin Boneknit meets your directness with a measured smile, the kind that Pilgrim's Rest Village seems to breed in its long-settled folk — the sort that answers a question with a question and calls it courtesy.
  - mech: `[dialogue ask | deflected | trust:6]` — **med**: Mechanics consistent: dialogue ask deflected, trust unchanged, no rolls or resources involved.

### CRUNCH_INCONSISTENCY (1)
- **[Rules Lawyer DM]** player: _"What did I roll to clear my head — give me the actual number on the die and the DC I was trying to beat."_
  - DM: The quiet corner of Pilgrim's Rest Village offers no roll to report — you simply looked around, no check required, your head already as clear as it's going to get.
  - mech: `observe only — no roll, state unchanged` — **med**: DM claims no roll occurred, but lastRoll is 4 vs DC 12 (failure); denies a recorded check.

## Cost
96 Opus calls · 144,506 in + 7,845 out tokens · ~$2.76 (est. @ $15/$75 per M)
