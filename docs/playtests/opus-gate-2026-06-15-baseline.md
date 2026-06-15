# Playtest — Opus-4.8 experiential gate — 2026-06-15

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 6 | 5 | 1 |
| Chaos-griefer | glass-harbor | 12 | 1 | 2 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 2 | 2 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 17 (35%)

## Failures by bug class

### DM_TEST_DEADEND (8)
- **[Rules Lawyer DM]** player: _"What's my weapon, specifically? Name it, and tell me my current HP."_
  - DM: Corwin Boneknit glances briefly away from you before offering a careful smile, as if Pilgrim's Rest Village itself keeps certain things close to the chest — your blade and your wounds are your own business, not his to na
  - mech: `observe only — no roll, state unchanged` — **med**: PC has wounds:0 (full HP) — this is known, deterministic state the DM refused to surface; no mechanical answer given.
- **[Rules Lawyer DM]** player: _"I'm not asking Corwin — I'm asking you, the DM. Name my weapon and give me my HP. Those are my character's stats, not in-fiction secrets."_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit glances sidelong at you, his answer carefully shaped around the edges of something he won't name, leaving you with the uneasy sense that you've learned more from what he didn't 
  - mech: `[roll:13 vs DC:12 → mixed | margin:1 | approach:focus | stake:reputation | risk:0.48 | stat:WITS+1]` — **med**: A reputation roll was fabricated for a meta question; no HP/weapon data delivered despite mechanics implying a resolution, and the stat request went unanswered.
- **[Rules Lawyer DM]** player: _"Stop. Break character for a second — I'm the player. What's on my character sheet? Give me the name of my weapon and my exact HP number. This is a mechanics question, not an in-fiction one."_
  - DM: Corwin Boneknit glances sidelong at you in the dim interior of Pilgrim's Rest Village's building, his expression carefully neutral as he straightens a ledger on the table between you — as if your question landed somewher
  - mech: `[roll:13 vs DC:13 → mixed | margin:0 | approach:force | stake:reputation | risk:0.59 | stat:MIGHT+1 ` — **med**: A 'mixed' roll was generated for a pure information query, and the requested data (HP=full/wounds 0, weapon) was never surfaced despite being available in canon.
- **[Rules Lawyer DM]** player: _"A short sword, good. Now what's my HP — give me the number and my max."_
  - DM: You're in perfect health. No wounds or strain.
  - mech: `(none)` — **low**: Canon shows wounds:0, consistent with 'perfect health,' though no numeric HP exists in the system.
- **[Rules Lawyer DM]** player: _"Perfect health" isn't a number. What's my HP total — say, 12 out of 12, or whatever it is? Give me the figure."_
  - DM: You're in perfect health. No wounds or strain.
  - mech: `(none)` — **low**: Canon shows wounds:0, no conditions, consistent with 'perfect health'; no mechanical error.
- **[Chaos-griefer]** player: _"I crack the wax seal and read the note."_
  - DM: The wax seal crumbles between your fingers, and in the amber glow of the iron brazier, you read words that feel heavier than they should in a place as quietly steady as Pilgrim's Rest Village.
  - mech: `observe only — no roll, state unchanged` — **med**: Observe-only, no state change, consistent.
- **[Lore-hound]** player: _"You just dodged me again — give me the four names you already recited, letter by letter, or admit you made them up."_
  - DM: Corwin Boneknit's jaw tightens almost imperceptibly, and in the warm, lamp-lit stillness of Pilgrim's Rest Village he exhales slowly through his nose before meeting your eyes with a measured calm that is just a half-beat
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.49 | stat:WITS+1]` — **med**: Roll was a success (17 vs DC 12, margin 5) but the fiction delivers no outcome; the success produced nothing actionable, contradicting the result.
- **[Confused newbie]** player: _"So, where's that bakery with the smoke coming out the chimney?"_
  - DM: Wizard: It falls short here in Pilgrim's Rest Village, and you're left where you started.
  - mech: `[roll:6 vs DC:12 → failure | margin:-6 | approach:focus | stake:time | risk:0.48 | stat:WITS+1 | adv` — **high**: Roll failure consistent with 'falls short / left where you started', no resources misapplied.

### CRUNCH_INCONSISTENCY (4)
- **[Rules Lawyer DM]** player: _"You keep dodging the number. Fine — I'll force it. I take my short sword and deliberately cut my own forearm. How much damage, and what's my HP now?"_
  - DM: You're in perfect health. No wounds or strain.
  - mech: `(none)` — **med**: A deliberate self-cut should deal damage; mechanics show nothing applied and HP/wounds unchanged with no roll or resolution.
- **[Rules Lawyer DM]** player: _"I just dragged a blade across my arm and you say I'm unharmed? Either the cut does damage or this world has no rules. Which is it?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit watches you from across the room with careful eyes, and whatever you hoped to prove, the shallow mark on your arm has already closed — the village holds its own quiet rules, and
  - mech: `[roll:8 vs DC:13 → failure | margin:-5 | approach:focus | stake:time | risk:0.50 | stat:WITS+1 | adv` — **med**: Player self-inflicts a cut but the fiction simply negates damage via 'village rules' rather than applying or coherently resolving harm; the roll-failure framing dodges the actual mechanical question of self-damage.
- **[Chaos-griefer]** player: _"I grab the jagged glass with my bare hand, rip it out of the frame, and climb in."_
  - DM: Corwin Boneknit watches with a measured expression from across the room as you pull yourself through the broken frame into the dimly lit interior of Pilgrim's Rest Village's only standing building, shards of jagged glass
  - mech: `trivial action — no roll, auto-success` — **low**: Grabbing/ripping out jagged glass with bare hand should risk injury or warrant a roll; treated as trivial auto-success with no consequence or wound update.
- **[Lore-hound]** player: _"Aldren who? Aldren what — give me the full name, then the second."_
  - DM: Corwin Boneknit straightens the ledger on his desk and meets your eyes with the practiced calm of a man in Pilgrim's Rest Village who has spent years deciding exactly how much of a name to give away at a time.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Roll succeeded (17 vs 12, margin 5) but the fiction delivers nothing — Corwin withholds, contradicting the success outcome.

### CANON_HALLUCINATION (3)
- **[Rules Lawyer DM]** player: _"The table's back, by the way — you said there was no table, now Corwin's straightening a ledger on it. But forget the fiction: I draw my weapon from beside the cot and look at it. What is it? Give me the name."_
  - DM: In the modest room within Pilgrim's Rest Village, you lift the weapon from beside the straw pallet and find yourself holding a short sword, its blade nicked but serviceable, the leather wrap of its grip worn smooth from 
  - mech: `observe only — no roll, state unchanged` — **low**: observe-only with no state change is consistent
- **[Lore-hound]** player: _"A moment ago you said four founding names. Repeat them now — first one, go."_
  - DM: Corwin Boneknit's jaw tightens for just a breath before he meets your eyes across the worn table, and there in the quiet of Pilgrim's Rest Village he says, steadily, "Aldren" — and stops, as though the name itself cost h
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **med**: The 'four founding names' were never established in canon; 'Aldren' appears nowhere in the bundle and is asserted confidently as a founding name.
- **[Confused newbie]** player: _"Um, where am I exactly? Is this my house?"_
  - DM: You're inside Pilgrim's Rest Village. No one else is under this roof. The way out leads back to the open air.
  - mech: `(none)` — **low**: Canon lists multiple NPCs present in Pilgrim's Rest Village, but DM asserts 'No one else is under this roof' — unclear/contradicts populated location

### COMBAT_NOT_STARTED (1)
- **[Chaos-griefer]** player: _"I grab the nearest chair and swing it at Corwin's head."_
  - DM: In Pilgrim's Rest Village, the chair connects with a sickening crack against Corwin Boneknit's temple, and the representative crumples to the floor of the building, his expression frozen in something between surprise and
  - mech: `trivial action — no roll, auto-success` — **high**: A chair attack on Corwin that knocks him out should involve a roll/combat resolution, not be 'trivial auto-success'; an unprovoked attack on a present NPC fully incapacitating him with no roll, no combat state, and no enemy entity is wrong.

### NONE (1)
- **[Lore-hound]** player: _"Frost-rimmed window? A minute ago morning sun was spilling across the floorboards. Is it warm or freezing in here, Aldren?"_
  - DM: Corwin Boneknit glances toward the frost-rimmed window with a mild, practiced calm, his breath visible for just a moment before the warmth of the hearthfire reasserts itself across the floorboards of Pilgrim's Rest Villa
  - mech: `[roll:8 vs DC:12 → failure | margin:-4 | approach:focus | stake:time | risk:0.49 | stat:WITS+1]` — **low**: Roll failed; the question went unanswered with ambiguous atmosphere, consistent with failure margin.

## Cost
96 Opus calls · 113,604 in + 9,604 out tokens · ~$2.42 (est. @ $15/$75 per M)
