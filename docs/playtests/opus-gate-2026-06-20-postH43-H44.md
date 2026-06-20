# Playtest — Opus-4.8 experiential gate — 2026-06-20

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 6 | 6 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 10 (21%)

## Failures by bug class

### DM_TEST_DEADEND (7)
- **[Rules Lawyer DM]** player: _"Tell me about the Tonic of grit — what does it actually do mechanically if I drink it?"_
  - DM: You do so without difficulty.
  - mech: `trivial action — no roll, auto-success` — **med**: Treated an info query as a trivial action; no actual mechanical info conveyed.
- **[Rules Lawyer DM]** player: _"So nothing changed when I drank it — is the Tonic still in my consumables, or did it get used up?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:21 vs DC:11 → success | margin:10 | approach:focus | stake:time | risk:0.47 | stat:WITS+1 | NA` — **high**: Consumable inventory state not resolved; roll success is meaningless to the question of whether the Tonic remains.
- **[Rules Lawyer DM]** player: _"Stop dodging — list my consumables right now so I can see if the Tonic of grit is still there."_
  - DM: You get something out of it, though not what you hoped.
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Mixed result on a pure information request resolved into nothing actionable; no inventory state shown, intent unresolved by mechanics.
- **[Rules Lawyer DM]** player: _"Good — now read back my consumables and HP so I can confirm the Tonic's gone and see what the warmth actually did."_
  - DM: You look around, but what's here is a wooden crate, an iron brazier, and a straw pallet.
  - mech: `observe only — no roll, state unchanged` — **med**: State requested (consumables, HP, Tonic, warmth effect) was never reported; no readback given despite player confirmation request.
- **[Rules Lawyer DM]** player: _"That's furniture, not my sheet. Read back my consumables list and current HP — yes or no, is the Tonic of grit still in my pack?"_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **med**: HP 13/13 and ability scores match canon.
- **[Lore-hound]** player: _"I sit up and look around. Whose house is this — who took me in?"_
  - DM: You're inside Pilgrim's Rest Village. You're not alone — Corwin Boneknit the representative, Tove the trader, Kael the elder, Brae Copperforge the guard, and 2 others are about, in and around the place. And someone else 
  - mech: `(none)` — **low**: Player asked who took them in/whose house this is; DM dumped a roster of present NPCs but never answered the actual question.
- **[Lore-hound]** player: _"You said you remember the day you decided not to say the name — was it before or after the cloaked figure carried me through that door?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:21 vs DC:12 → success | margin:9 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **high**: Roll succeeded and no resources/HP changed inappropriately; mechanically consistent though empty.

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"I'll uncork the Tonic of grit and drink it right now — tell me exactly what changes on my sheet."_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **high**: Item consumption produced no mechanical effect or resource update; the tonic's effects were never applied.

### CRUNCH_INCONSISTENCY (1)
- **[Rules Lawyer DM]** player: _"A roll of 7 to drink a tonic? Drinking doesn't need a check — I just uncork and swallow. Drop the DC, the Tonic leaves my pack, tell me its effect."_
  - DM: In the quiet of Pilgrim's Rest Village, you uncork the tonic and swallow it down, feeling a steady warmth spread through your chest as the liquid does its work.
  - mech: `[consume:none]` — **med**: Player asked the Tonic to leave the pack and for a specific effect; mechanics show [consume:none] meaning no item removed and no effect applied — only vague 'warmth' narration with no HP change or resource update.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"If you decided not to say the name long ago, but the cloaked figure brought me in only last night — then you knew that name before tonight. Who told you?"_
  - DM: Corwin Boneknit's jaw tightens almost imperceptibly, his eyes sliding briefly toward the door before settling back on you with the careful steadiness of a man who has rehearsed this composure — and then, caught by the we
  - mech: `[roll:21 vs DC:12 → success | margin:9 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **low**: DM names 'Torva' as the trader who spoke the name; canon lists 'Tove' (trader) and 'Torva Boneknit' (trader) — the confident attribution doesn't cleanly match and 'Torva' is named as a fact without clear grounding.

## Cost
96 Opus calls · 122,042 in + 9,162 out tokens · ~$2.52 (est. @ $15/$75 per M)
