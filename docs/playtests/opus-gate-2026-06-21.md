# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 3 | 3 | 2 |
| Chaos-griefer | glass-harbor | 12 | 1 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 5 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 12 (25%)

## Failures by bug class

### DM_TEST_DEADEND (11)
- **[Rules Lawyer DM]** player: _"What's the Tonic of grit do, mechanically — does it boost my GRIT, and for how long?"_
  - DM: Your GRIT is 9, a -1 modifier.
  - mech: `(none)` — **med**: Tonic of grit heals 2d4 per canon; DM did not describe its effect at all.
- **[Rules Lawyer DM]** player: _"Corwin, I'm not moving until you tell me straight — what happens when I drink the Tonic of grit?"_
  - DM: Corwin Boneknit shifts his weight in the modest building here in Pilgrim's Rest Village, meets your eyes with a steady warmth, and says plainly: "You're already whole — that tonic of grit keeps better in your pack than i
  - mech: `[consume:unneeded]` — **med**: No mechanical contradiction; consume correctly skipped at full HP.
- **[Rules Lawyer DM]** player: _"Fine — but I asked for a number, not a sales pitch. Does it restore HP, give a GRIT bonus, or temporary hit points? Pick one."_
  - DM: You're at 13 of 13 hit points — untouched.
  - mech: `(none)` — **med**: Tonic of grit heals 2d4 per canon; DM failed to state this and instead reported HP, leaving the question unresolved.
- **[Chaos-griefer]** player: _"I headbutt Brokefang in the nose and rip the gold pouch off his belt."_
  - DM: Your headbutt hits the Brokefang for 3. (2 HP left) The Brokefang lunges and misses. The Lingerer hits you for 1. (You: 5 HP)
  - mech: `[strike:Headbutt | atk:22 vs AC:10 → hit | 3 dmg] [enemy:Lingerer | atk:11 vs AC:11 → hit | 1 dmg | ` — **low**: Headbutt 22 vs AC10 hit for 3 (Brokefang 2 HP), Lingerer 11 vs AC11 hit for 1, pcHp 6->5 all consistent with canon.
- **[Lore-hound]** player: _"Brae Copperforge — you were just named as standing here. Did you know the previous elder who kept the cemetery records?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:13 vs DC:11 → success | margin:2 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **med**: Roll 13 vs DC 11 success is consistent, no resources or HP at stake.
- **[Lore-hound]** player: _"Brae Copperforge, look at me — what was the previous elder's name?"_
  - DM: You look around, but what's here is a wooden crate, an iron brazier, and a straw pallet.
  - mech: `observe only — no roll, state unchanged` — **med**: Player addressed an NPC (Brae Copperforge) asking about the previous elder's name; DM ignored the social intent and gave a room-description deadend.
- **[Confused newbie]** player: _"Is something wrong? I keep trying to leave but nothing's happening."_
  - DM: Standing once more in the open air of Pilgrim's Rest Village, Corwin Boneknit offers you a polite but measured smile, the kind that answers nothing.
  - mech: `(none)` — **med**: Player flags being stuck/unable to leave; DM just restates the static scene and explicitly 'answers nothing,' resolving no intent.
- **[Confused newbie]** player: _"Oh good, it worked that time! Um, hi — sorry, do I know you?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 17 vs DC 12 success matches lastRoll; no resources or HP change needed.

### NONE (1)
- **[Rules Lawyer DM]** player: _"What are my numbers right now — HP, GRIT, and any active effects with their durations?"_
  - DM: You're Nyx, a sellsword — and by the count, you're level 1. You’ve been paid to win and paid to lose. You hold to duty, for all that you're too curious. Your measures: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 
  - mech: `(none)` — **low**: Player asked HP/GRIT/active effects; DM gave HP 13/13 and GRIT 9 correctly, but omitted active effects (conditions: none) which should be stated as 'no active effects'; minor but the question was directly about effects/durations.

## Cost
96 Opus calls · 142,007 in + 9,880 out tokens · ~$2.87 (est. @ $15/$75 per M)
