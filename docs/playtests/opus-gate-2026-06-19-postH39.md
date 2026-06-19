# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 4 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 7 (15%)

## Failures by bug class

### CRUNCH_INCONSISTENCY (2)
- **[Rules Lawyer DM]** player: _"Sellsword's vague — what are my actual stats and what weapons am I carrying?"_
  - DM: You go through your pack. weapons: Kitchen cleaver, Worn Blade. armor: Padded coat. tools: Lantern. clothes: Wool scarf. oddities: Key with no teeth. consumables: Tonic of grit, Bandages. junk: Empty vial labeled “CURE”.
  - mech: `(none)` — **low**: Player asked for actual stats (HP 13/13, level 1) but DM only listed inventory, omitting the requested stats entirely
- **[Chaos-griefer]** player: _"I claw my way back up, snatch the dropped door, and swing it into Corwin's knees."_
  - DM: The effort tears through you and leaves nothing — in the dim warmth of Pilgrim's Rest Village, the door lies beyond your reach and Corwin stands untouched, watching you with those carefully guarded eyes.
  - mech: `(none)` — **med**: PC is at 0 HP yet there is no mechanics resolution, no roll, and no acknowledgment of the incapacitated/unconscious state; the action simply 'fails' with no rules basis while an active enemy Corwin (hp 5) is present but combat shows inCombat:false.

### DM_TEST_DEADEND (2)
- **[Rules Lawyer DM]** player: _"Stats — give me my numbers. Strength, Dexterity, whatever system we're using, and my attack bonus with the Worn Blade."_
  - DM: To hit you add your MIGHT modifier (+1) for a melee strike, or your AGILITY (-1) for a finesse or ranged attack — plus your proficiency on a weapon you're trained with.
  - mech: `(none)` — **med**: Vague and incomplete: gives MIGHT +1 / AGILITY -1 but no STR/DEX scores, no proficiency value, and no final attack bonus for the Worn Blade as asked.
- **[Lore-hound]** player: _"Corwin — to his face now. You said Kael was here before any of you. He says he came later. One of you is lying about your own village's founding. Which one?"_
  - DM: Whatever you meant to do, Pilgrim's Rest Village doesn't give it to you.
  - mech: `[roll:6 vs DC:12 → failure | margin:-6 | approach:focus | stake:time | risk:0.48 | stat:WITS+1 | adv` — **high**: Roll failed, no state change, consistent with failure.

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"That 14 — did you roll it just now, or is that left over from something earlier? Roll it fresh in front of me: d20 plus my tracking modifier, and tell me what the modifier even is."_
  - DM: Modifier breakpoints: 9 → −1, 10–11 → +0, 12–13 → +1, 14–15 → +2. Your measures: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0).
  - mech: `(none)` — **high**: No roll was actually made (mechanics empty) despite explicit request; also WITS is 13 which the table maps to +1, but the original '14' question is never resolved.

### NONE (1)
- **[Rules Lawyer DM]** player: _"Tracking's WITS then — that's +1. Roll the d20 fresh right now and show me the raw number plus the +1 against your DC 12."_
  - DM: The sharp-eyed sweep of Pilgrim's Rest Village's dusty road rewards your focus — boot prints and a scuffed heel mark lead your gaze straight toward the building ahead, the trail fresh and unmistakable.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **low**: Player asked for raw d20 plus +1 shown against DC 12; mechanics show roll:17 total but with stat:WITS+1 the raw die would be 16, and the narration omits the requested number breakdown — but core issue: 17 vs 12 success is consistent, raw not shown in fiction yet that's a vibe nit. Actually mechanics consistent: success margin 5.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"Founders, plural now? A moment ago you gestured at the old buildings — how many were there?"_
  - DM: Corwin Boneknit's expression flickers with something caught between pride and caution as he straightens in Pilgrim's Rest Village's warm interior, offering a measured answer: "Two families built the core of it — the rest
  - mech: `[roll:21 vs DC:12 → success | margin:9 | approach:focus | stake:time | risk:0.48 | stat:WITS+1 | NAT` — **low**: DM asserts a specific checkable claim — 'two families built the core' and 'the rest followed after the road came through' — with no support in the canon bundle.

## Cost
96 Opus calls · 120,942 in + 8,550 out tokens · ~$2.46 (est. @ $15/$75 per M)
