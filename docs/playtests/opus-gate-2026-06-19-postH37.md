# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 6 | 1 | 1 |
| Chaos-griefer | glass-harbor | 12 | 0 | 5 | 0 |
| Lore-hound | glass-harbor | 12 | 4 | 2 | 0 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 16 (33%)

## Failures by bug class

### DM_TEST_DEADEND (9)
- **[Rules Lawyer DM]** player: _"I sit up and take stock — what's my character's name, class, and what gear do I have on me?"_
  - DM: Your name is Nyx. If I've called you anything else, that was my slip — you're Nyx.
  - mech: `(none)` — **med**: Player asked for name, class, and gear; DM only gave the name and ignored class and inventory entirely.
- **[Rules Lawyer DM]** player: _"You ducked my question — what's my class, and what gear is on me right now? Give me the sheet."_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **med**: Stats and HP match canon (13/13).
- **[Rules Lawyer DM]** player: _"You skipped class and gear again. What class am I, and list every item I'm carrying."_
  - DM: You're Nyx, a sellsword — and by the count, you're level 1. You’ve been paid to win and paid to lose. You hold to duty, for all that you're too curious. The fine print — your scores and your kit — is yours to read on you
  - mech: `(none)` — **med**: Level 1 matches canon; no mechanics changes needed.
- **[Rules Lawyer DM]** player: _"Stop deflecting — read me the kit line by line. What weapons, armor, and gear are on my sheet right now?"_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **med**: HP 13/13 and scores reported are internally consistent with canon.
- **[Rules Lawyer DM]** player: _"The sheet has no equipment section at all, does it? Just tell me straight: am I carrying any weapon or armor, yes or no?"_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **med**: Player asked a direct yes/no about equipment; DM dumped stats and never answered the question.
- **[Rules Lawyer DM]** player: _"Fine, the sheet's blank on gear. I check my own belt and body — what do my hands actually find when I pat myself down?"_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **high**: Player's intent to check for gear was never resolved; DM answered a question that wasn't asked and ignored the actual request.
- **[Lore-hound]** player: _"Torva — daughter-in-law, you said. So who was her husband, Corwin's son, and is he still around?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Roll succeeded but the fiction delivers no information and doesn't address the intent; outcome is incoherent with the success.
- **[Lore-hound]** player: _"Corwin, then — you've stopped counting your years, but Kael says you're the oldest in Pilgrim's Rest. So when were you born, and where, if not here?"_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:11 vs DC:12 → mixed | margin:-1 | approach:focus | stake:time | risk:0.47 | stat:WITS+1 | adv:` — **med**: Mixed result on margin -1 is consistent with a partial outcome.

### CRUNCH_INCONSISTENCY (6)
- **[Chaos-griefer]** player: _"I yank out whatever I find and hold it up, then crack his head into the dirt for good measure."_
  - DM: In the dust of Pilgrim's Rest Village, Corwin Boneknit's fist catches you across the jaw even as you drive his skull into the dirt, leaving him dazed and bloodied at your feet.
  - mech: `[combat:r4] [enemy:Corwin Boneknit | atk:14 vs AC:11 → hit | 2 dmg | hp:13->11]` — **med**: Mechanics show enemy Corwin hp:13->11, but canon says Corwin has hp:4/maxHp:8; the PC hp is 11/13, so the mechanics applied the player's HP values to the enemy and tracked the wrong entity's damage.
- **[Chaos-griefer]** player: _"I stand up and spit on him, then turn to the crowd and yell that they're next."_
  - DM: Your blade cuts wide through the dusty air of Pilgrim's Rest Village as Corwin Boneknit twists free of your grasp, blood from his wounds spattering the road while your shouted threat draws uneasy stares from the villager
  - mech: `[strike:Worn Blade | atk:8 vs AC:10 → miss]` — **med**: Player declared spitting and shouting, not an attack, yet mechanics rolled a Worn Blade strike (atk:8 vs AC:10 miss); action mismatch and unprompted attack roll.
- **[Chaos-griefer]** player: _"I grab a torch from the wall and toss it onto the nearest thatched roof."_
  - DM: In the smoky chaos of Pilgrim's Rest Village, your thrown torch sputters harmlessly past the thatched eave as Corwin Boneknit drives an elbow into your ribs, drawing a grunt of pain from you.
  - mech: `[strike:Improvised Flame | atk:6 vs AC:10 → miss] [enemy:Corwin Boneknit | atk:17 vs AC:11 → hit | 1` — **med**: PC HP in canon is 10 (the live value); mechanics shows hp:11->10 implying it was 11 before, contradicting canon's current 10, and enemy Corwin's hp tracking (canon hp:4) is not reflected in the player's own torch toss against him.
- **[Chaos-griefer]** player: _"I grab the torch off the ground and shove the flame straight into Corwin's face."_
  - DM: The torch gutters wildly as your lunge misses Corwin's face by a hand's breadth, and in the same breath he drives an elbow hard into your ribs, leaving you winded on the dusty road of Pilgrim's Rest Village with the flam
  - mech: `[strike:Improvised Flame | atk:2 vs AC:10 → miss] [enemy:Corwin Boneknit | atk:17 vs AC:11 → hit | 2` — **med**: Mechanics show Corwin hp:10->8 but canon enemy hp is 4/8; also the enemy 'damage' to player isn't reflected and PC hp already 8 — Corwin's HP tracking contradicts canon.
- **[Chaos-griefer]** player: _"I turn the torch on the Lingerer and ram the fire into its grinning face."_
  - DM: The streets of Pilgrim's Rest Village ring with the crack of your torch searing across the Lingerer's grinning face, but even as it recoils with a hiss, its clawing hand finds your ribs and drives the breath from you.
  - mech: `[strike:Worn Blade | atk:21 vs AC:10 → hit | 2 dmg] [enemy:Lingerer | atk:15 vs AC:11 → hit | 2 dmg ` — **med**: Canon shows Lingerer at hp:6, but mechanics report hp:7->5; also the player's intent was a torch attack yet the strike is labeled 'Worn Blade'.
- **[Lore-hound]** player: _"Then give me one name, Corwin — your son's, Torva's dead or living husband. You were born here, you know the village's whole memory; surely you remember your own child."_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:reputation | risk:0.48 | stat:WITS+1` — **med**: Roll was a success (15 vs DC 12, margin 3) but the narration delivers no actual outcome — no name, no information, contradicting the success result.

### DM_ARTIFACT_LEAK (1)
- **[Lore-hound]** player: _"Corwin, you dodged it — give me a place. What village or town were you born in, even just the name?"_
  - DM: location:Pilgrim's Rest Village
  - mech: `[roll:20 vs DC:12 → success | margin:8 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **high**: DM dumped a raw key-value artifact 'location:Pilgrim's Rest Village' instead of resolving the intent in fiction with Corwin naming his birthplace.

## Cost
96 Opus calls · 110,673 in + 9,824 out tokens · ~$2.40 (est. @ $15/$75 per M)
