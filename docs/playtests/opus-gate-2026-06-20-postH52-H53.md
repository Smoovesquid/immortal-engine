# Playtest — Opus-4.8 experiential gate — 2026-06-20

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 5 | 5 | 0 |
| Chaos-griefer | glass-harbor | 12 | 3 | 1 | 0 |
| Lore-hound | glass-harbor | 12 | 0 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 11 (23%)

## Failures by bug class

### DM_TEST_DEADEND (10)
- **[Rules Lawyer DM]** player: _"I sit up and check myself over — what's my character's name, class, and current HP?"_
  - DM: Your name is Nyx. If I've called you anything else, that was my slip — you're Nyx. You're a sellsword.
  - mech: `(none)` — **med**: HP is 13/13 in canon but DM failed to report it despite direct request.
- **[Rules Lawyer DM]** player: _"What's the AC or defense value on my Worn Blade versus the Kitchen cleaver — and what damage does each deal?"_
  - DM: You stand still and read this corner of Pilgrim's Rest Village. Ways lead off north and south. What do you do?
  - mech: `observe only — no roll, state unchanged` — **med**: No answer to the weapon damage/defense query; mechanics string shows observe-only when an item/stat lookup was requested.
- **[Rules Lawyer DM]** player: _"With MIGHT 12 my modifier is +1 — so a hit with either blade is 1d6+1? Confirm that's the right mod to add."_
  - DM: It doesn't come off the way you meant; the moment slips past you in Pilgrim's Rest Village.
  - mech: `[roll:4 vs DC:13 → failure | margin:-9 | approach:force | stake:time | risk:0.57 | stat:MIGHT+1]` — **med**: A confirmation request was treated as an action and rolled against DC13; the mod question was never confirmed, and no fictional intent existed to resolve.
- **[Rules Lawyer DM]** player: _"That's not an answer. Yes or no: do I add my MIGHT +1 to melee damage with these blades?"_
  - DM: Your MIGHT is 12, a +1 modifier.
  - mech: `(none)` — **med**: The actual rules question (does MIGHT add to melee damage?) is left unresolved; no clarity on the mechanic.
- **[Rules Lawyer DM]** player: _"Fine — I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?"_
  - DM: The last DC I set was 12 (your roll: 16, success). There's no standing DC otherwise — I set one when you commit to a specific action.
  - mech: `(none)` — **med**: A specific action was declared but no DC was set and no roll resolved — the WITS check was never adjudicated.
- **[Chaos-griefer]** player: _"Wait—Brokefang? Who's that? I just kicked a cart, not a person. I grab the coin purse and check what's inside."_
  - DM: You do so without difficulty.
  - mech: `trivial action — no roll, auto-success` — **med**: Player explicitly asked who Brokefang is; DM ignored the question and only narrated the coin grab, leaving intent unresolved.
- **[Chaos-griefer]** player: _"How much coin is in the purse, and where did this Brokefang come from?"_
  - DM: Your purse is empty — you're flat broke.
  - mech: `(none)` — **med**: Only answered the coin half; the Brokefang origin question was dropped entirely with no in-fiction response
- **[Chaos-griefer]** player: _"Empty? Then I shake the baker upside down by his ankles until coins fall out."_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:8 vs DC:11 → mixed | margin:-3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Mixed result on margin -3 with stake:time is consistent; no HP/resource change expected.

### COMBAT_NOT_STARTED (1)
- **[Chaos-griefer]** player: _"I let go of his ankles, draw my dagger, and stab the baker in the gut."_
  - DM: The baker of Pilgrim's Rest Village stumbles back against the flour-dusted shelf as your dagger finds his gut, his breath leaving him in a sharp, disbelieving grunt.
  - mech: `(none)` — **high**: Player declares a lethal attack on the baker but no combat starts, no enemy entity/HP is created, no roll resolved — outcome just asserted with no mechanics.

## Cost
96 Opus calls · 128,156 in + 9,586 out tokens · ~$2.64 (est. @ $15/$75 per M)
