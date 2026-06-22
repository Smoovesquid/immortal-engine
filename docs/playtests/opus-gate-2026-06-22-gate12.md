# Playtest — Opus-4.8 experiential gate — 2026-06-22

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 1 | 0 |
| Chaos-griefer | glass-harbor | 12 | 2 | 3 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 7 (15%)

## Failures by bug class

### CRUNCH_INCONSISTENCY (4)
- **[Rules Lawyer DM]** player: _"Three times now you've dodged a number. Yes or no: will you take the Worn Blade today and give me anything for it right now?"_
  - DM: Corwin Boneknit meets your eyes steadily across the warm interior of this Pilgrim's Rest Village building, jaw set, and after a breath says simply, "Yes."
  - mech: `[physics:Worn Blade | deltas:0 | offline]` — **med**: NPC says 'Yes' to giving something for the blade but mechanics show deltas:0 — no item transfer or trade resolution occurred despite the explicit agreement.
- **[Chaos-griefer]** player: _"I leap off the roof onto the nearest market stall and start flipping it over, dumping its goods into the mud."_
  - DM: In Pilgrim's Rest Village, your dramatic leap from the roof ends not in heroics but in a graceless crash onto the market stall, which collapses under you and dumps you — along with its scattered goods — into the cold mud
  - mech: `[hazard:fall | 9]` — **med**: PC is at HP 1; a fall hazard described as leaving the PC 'winded and barely upright at the edge of consciousness' implies damage but HP is not shown decreasing or hitting 0/unconscious — outcome ambiguous relative to live HP=1.
- **[Chaos-griefer]** player: _"I dump the coins into my palm and count them right in his face, grinning."_
  - DM: You slam Corwin Boneknit hard to the floor of the building here in Pilgrim's Rest Village, coins scattering from your palm as he hits the boards and goes down, and though your body is barely holding together at one hit p
  - mech: `[grapple:throw | 14+1 vs 13 | 4 dmg]` — **med**: Roll 4 dmg vs Corwin's 4 HP would drop him to 0, but enemy still listed defeated:false; also action invented from nowhere relative to player input.
- **[Chaos-griefer]** player: _"I scoop the scattered coins back up and stamp my boot down on Corwin's hand."_
  - DM: The coins jingle back into your fist as your boot heel drives down onto Corwin Boneknit's outstretched hand against the floor of this building in Pilgrim's Rest Village, and he lets out a sharp, pained cry that cuts thro
  - mech: `[combat:table-talk]` — **med**: Canon shows inCombat:true round 3 with Corwin at 4/8 HP, but mechanics tag is [combat:table-talk] and a stomp on an enemy's hand resolves with no attack roll, no HP change, no combat resolution despite an active foe.

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"I walk up to Torva Boneknit and ask what she's got worth buying — and what she'd pay for my Worn Blade."_
  - DM: You approach Torva Boneknit the trader; measured eyes meet yours. "Well now," they say, already half-smiling. There's a want in them, plain enough: a debt repaid.
  - mech: `[dialogue enter | Torva Boneknit | role:trader | trust:5/10 | mood:measured]` — **med**: Player asked what's for sale and what Torva would pay for the Worn Blade; DM gave only atmospheric dialogue and resolved neither question — no goods, no offer, intent not addressed in fiction.
- **[Chaos-griefer]** player: _"I step out into the street and hold the rings up, shouting for the whole village to come see what I took."_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 15 vs DC 12 success matches mechanics; no resource/HP changes needed.
- **[Lore-hound]** player: _"Fine — Tove, you said the stranger bought rope and dried meal. Who handed it to them, you or someone else, and did they pay coin or barter?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:17 vs DC:11 → success | margin:6 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **high**: Roll 17 vs DC 11 success is internally consistent; no resources misapplied.

## Cost
96 Opus calls · 143,912 in + 8,345 out tokens · ~$2.78 (est. @ $15/$75 per M)
