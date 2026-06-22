# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 3 | 2 | 0 |
| Chaos-griefer | glass-harbor | 12 | 0 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 10 (21%)

## Failures by bug class

### DM_TEST_DEADEND (7)
- **[Rules Lawyer DM]** player: _"What are my actual stats — Strength, Dexterity, all of them — and my armor class?"_
  - DM: Your Armor is 11 — that's the number an attack has to beat to land on you.
  - mech: `(none)` — **med**: AC 11 stated, no contradiction with canon; no mechanics needed.
- **[Rules Lawyer DM]** player: _"Wait — earlier you said my Armor is 11, but AGILITY 9 is a -1 modifier. Does my armor class already account for that -1, or should it be 10?"_
  - DM: There's no armor — you're armed with Kitchen cleaver and Worn Blade. You're wearing Padded coat.
  - mech: `(none)` — **med**: DM contradicts itself — claims 'no armor' yet says PC wears a Padded coat, and fails to clarify the AC/modifier math the player explicitly queried.
- **[Rules Lawyer DM]** player: _"You dodged my question. The Padded coat — what armor value does it give, and does my AGILITY -1 already factor into that 11?"_
  - DM: Your Armor is 11 — that's the number an attack has to beat to land on you.
  - mech: `(none)` — **med**: Armor 11 is consistent with no contradicting data; no mechanical error, though incomplete.
- **[Lore-hound]** player: _"Then tell me who founded Pilgrim's Rest, and what year that was."_
  - DM: I haven't introduced anyone named Then, and there's no one by that name here. Corwin Boneknit, Tove, Kael, Brae Copperforge are here — who do you actually mean?
  - mech: `[clarify:referent]` — **high**: DM parsed 'Then' as a name and bounced the question back as a clarify prompt instead of answering who founded the village
- **[Lore-hound]** player: _"Brae, you flinched just now — not at the question, at the words "first stone." Who laid it? Say the name."_
  - DM: Corwin Boneknit is done talking about it — the subject is closed.
  - mech: `[info-check → no-record | nothing grounded to deliver, no roll]` — **low**: Player addressed Brae; DM answered as Corwin Boneknit, ignoring/misattributing the addressed NPC.
- **[Confused newbie]** player: _"Okay, um, can I get a better look at them without being too obvious?"_
  - DM: Inside the building in Pilgrim's Rest Village, you let your gaze drift casually across the room, taking quiet stock of the wooden crate, the iron brazier casting a low warmth, and the straw pallet tucked against the wall
  - mech: `observe only — no roll, state unchanged` — **med**: Observe-only with no roll and no state change is fine.
- **[Confused newbie]** player: _"Okay, well, maybe I'll just go talk to the elder guy anyway."_
  - DM: The roads of Pilgrim's Rest Village wind between the buildings, and while the elder is somewhere out there among them, the way from where you stand inside leads you nowhere closer just yet.
  - mech: `(none)` — **med**: Player wanted to go talk to the elder (Kael, who is present); DM stalled with a vague non-answer instead of resolving the simple intent to approach/talk.

### CRUNCH_INCONSISTENCY (2)
- **[Rules Lawyer DM]** player: _"I roll a d20 — that's a 15, plus 1 WITS is 16. Beats DC 12. What do I read off him?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit carries himself with the careful stillness of a man who chooses his words before he speaks them — shoulders slightly drawn in, eyes that meet yours a beat too late, and hands th
  - mech: `observe only — no roll, state unchanged` — **med**: Player declared a roll resolving DC 12; mechanics say 'no roll' and lastRoll was a failure (4 vs 12), yet DM narrates a clean successful read — dice/fiction contradiction.
- **[Chaos-griefer]** player: _"I jump down and shove Tove flat on her back."_
  - DM: The scuffle inside Pilgrim's Rest Village ends abruptly as Tove scrambles backward and bolts behind a market stall, leaving you standing over the spot where she fell, blade still warm, the room suddenly very quiet.
  - mech: `[combat:fled]` — **med**: Player declared a shove/grapple on Tove (an enemy at 2 HP, in combat per timeline combat-begin t:3); the DM instead had her flee with no roll resolving the player's action against her — the shove intent was not adjudicated, she just bolted.

### CANON_HALLUCINATION (1)
- **[Lore-hound]** player: _"Torva Boneknit — Corwin, is Torva kin to you, or did you take a dead trader's name for your own?"_
  - DM: Standing in the warmth of Pilgrim's Rest Village, Corwin Boneknit meets your eyes steadily and says that Torva is his sister, born of the same mother, and that the name belongs to their family — not borrowed, not taken, 
  - mech: `[roll:16 vs DC:12 → success | margin:4 | approach:focus | stake:resource | risk:0.47 | stat:WITS+1 |` — **low**: DM asserts Corwin and Torva are siblings born of the same mother; canon only confirms both share surname Boneknit and are present, no kinship detail is grounded.

## Cost
96 Opus calls · 139,587 in + 9,407 out tokens · ~$2.80 (est. @ $15/$75 per M)
