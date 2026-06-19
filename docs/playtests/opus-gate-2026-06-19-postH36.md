# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 3 | 0 |
| Chaos-griefer | glass-harbor | 12 | 1 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 2 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 9 (19%)

## Failures by bug class

### DM_TEST_DEADEND (5)
- **[Rules Lawyer DM]** player: _"What gear and weapons am I carrying, and do I have any coin?"_
  - DM: Your purse is empty — you're flat broke.
  - mech: `(none)` — **low**: Incomplete resolution of the inventory query; no gear/weapon info provided.
- **[Rules Lawyer DM]** player: _"What's the damage on the Worn Blade, and what does my Padded coat give me for defense?"_
  - DM: For damage: the Worn Blade rolls 1d6. You add your relevant ability modifier on a hit.
  - mech: `(none)` — **low**: 1d6 + ability mod on hit is a reasonable, consistent rule statement.
- **[Chaos-griefer]** player: _"I drag his body into the village square and prop it up against the well for everyone to see."_
  - DM: Corwin Boneknit is already down. There is no living foe there to fight.
  - mech: `[combat:no-live-target]` — **med**: Corwin is correctly defeated (hp 0); no combat should start—mechanically consistent.
- **[Lore-hound]** player: _"Corwin Boneknit — that's an odd surname. Who in his family was the first "Boneknit," and how'd they earn it?"_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:13 vs DC:12 → mixed | margin:1 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: DM gave no actual answer to the question about the Boneknit name origin; just a vague 'partial, imperfect' meta-comment with no fiction content.
- **[Confused newbie]** player: _"Hold their ground against what? Is there some kind of trouble here?"_
  - DM: Corwin Boneknit offers you a measured smile, his eyes briefly scanning the room before settling back on you with practiced calm, as though Pilgrim's Rest Village has always been the sort of place where a man chooses his 
  - mech: `[dialogue ask | deflected | trust:5]` — **med**: Mechanics show a dialogue ask deflected, consistent with no combat and the evasive response.

### CRUNCH_INCONSISTENCY (2)
- **[Rules Lawyer DM]** player: _"And the Padded coat — what's its AC or defense bonus? You only gave me the blade."_
  - DM: Here in Pilgrim's Rest Village, Corwin Boneknit meets your question about the padded coat's protection with a slow blink and a shrug, offering nothing more solid than a merchant's vague gesture toward warmth over armor.
  - mech: `[info-check → no-record | nothing grounded to deliver, no roll]` — **low**: Padded armor has a defined AC (11+Dex in 5e); DM gave no stat and treated it as if no record exists, leaving the player's item undefined.
- **[Rules Lawyer DM]** player: _"Hold on — you said Corwin pays ME twenty silver. He just pocketed it from me? Reverse that, I'm the one getting paid."_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit's hand pauses halfway to his belt pouch, his expression caught between evasion and resignation, and he counts out twenty silver coins into your open palm with the careful delibe
  - mech: `[roll:13 vs DC:12 → mixed | margin:1 | approach:focus | stake:time | risk:0.47 | stat:WITS+1 | adv:+` — **low**: Roll was 'mixed' (margin 1) yet the fiction delivers a clean, full reversal with all twenty silver paid — a mixed result should carry a cost/complication, not full success.

### CANON_HALLUCINATION (2)
- **[Lore-hound]** player: _"What exact questions do Brokefang's people always ask — name one that I supposedly asked Corwin."_
  - DM: In the smoke-thick air of Pilgrim's Rest Village, Brokefang snarls that your people asked Corwin where the civic stores are kept at night — a question no honest traveler needs answered.
  - mech: `[combat:table-talk]` — **med**: The DM confidently invents a specific accusation (asking Corwin where civic stores are kept at night) with no support anywhere in the canon bundle; presented as fact, not hearsay.
- **[Lore-hound]** player: _"Hold on — Brokefang's here now, snarling at me? A second ago you said Brokefang's people, through Kael's mouth. Is Brokefang in this room, yes or no?"_
  - DM: In Pilgrim's Rest Village, the elder Kael stands bloodied before you inside this building — Brokefang is not in this room, but Kael's cracked lips have been speaking that name like a warning or a summons.
  - mech: `[combat:table-talk]` — **med**: Canon lists Brokefang in npcsPresent, but DM flatly says Brokefang is not in the room; this contradicts the ground-truth presence list.

## Cost
96 Opus calls · 106,667 in + 8,417 out tokens · ~$2.23 (est. @ $15/$75 per M)
