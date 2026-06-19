# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 5 | 6 | 3 |
| Chaos-griefer | glass-harbor | 12 | 0 | 3 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 3 | 1 |
| Confused newbie | glass-harbor | 12 | 0 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 14 (29%)

## Failures by bug class

### DM_TEST_DEADEND (6)
- **[Rules Lawyer DM]** player: _"Hold on — you just listed a Kitchen cleaver and a Worn Blade, but a moment ago I had a staff and a robe. Which is it? What's actually in my hands right now?"_
  - DM: In the warm light of Pilgrim's Rest Village, you search your memory for certainty about what you're carrying, but the details slip and blur, leaving you holding only doubt.
  - mech: `[roll:4 vs DC:12 → failure | margin:-8 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Turned a meta inventory question into a WITS check and used the failure to refuse answering what's in hand; inventory contradiction left unresolved.
- **[Rules Lawyer DM]** player: _"What's the damage die on this staff, and what's my Armor value in this robe? You never answered."_
  - DM: Your weapons roll for damage as follows — the Kitchen cleaver rolls 1d6 and the Worn Blade rolls 1d6, plus your ability modifier on a hit.
  - mech: `(none)` — **med**: DM lists weapons that don't match the player's referenced staff/robe and gives no Armor value, contradicting the asked-about items.
- **[Rules Lawyer DM]** player: _"Stop. You said the staff. Give me the STAFF's damage die and my Armor value — not the cleaver, not the blade. Numbers, now."_
  - DM: For damage: the Kitchen cleaver rolls 1d6 and the Worn Blade rolls 1d6. You add your relevant ability modifier on a hit.
  - mech: `(none)` — **med**: Failed to provide requested staff stat or Armor value; answered a different question entirely, and no staff appears in inventory canon.
- **[Rules Lawyer DM]** player: _"You're stuck in a loop, and you still haven't given me an Armor value. Let me test it the hard way — Corwin swings his healer's satchel at my head. What do I roll to defend, and what's my Armor?"_
  - DM: You're armed with Kitchen cleaver and Worn Blade. You're wearing Padded coat. And you carry Kitchen cleaver, which means something to you.
  - mech: `(none)` — **high**: A declared attack by present NPC Corwin started no combat, no defense roll, no Armor value given, no HP interaction.
- **[Lore-hound]** player: _"Fine — Kael, then tell me one name from those old years you DO remember. Anyone at all."_
  - DM: You get something out of it, though not what you hoped.
  - mech: `[roll:13 vs DC:12 → mixed | margin:1 | approach:focus | stake:reputation | risk:0.49 | stat:WITS+1]` — **med**: Roll 13 vs DC 12 is a success/mixed but no name was actually delivered in the fiction, contradicting the positive margin.
- **[Lore-hound]** player: _"Then you tell me, Corwin — why send me to a man who knows nothing? Who DID found Pilgrim's Rest?"_
  - DM: It doesn't come off the way you meant; the moment slips past you in Pilgrim's Rest Village.
  - mech: `[roll:4 vs DC:13 → failure | margin:-9 | approach:focus | stake:time | risk:0.50 | stat:WITS+1 | adv` — **med**: NAT1 failure consistent with no progress on the question

### CRUNCH_INCONSISTENCY (5)
- **[Rules Lawyer DM]** player: _"A padded coat now? Fine — give me its Armor value as a number, and tell me the defense roll I make against Corwin's swing."_
  - DM: Your padded coat — worth 2 points of armor here in Pilgrim's Rest Village — held firm as Corwin's wounded lunge came in short, your defense roll of 14 beating his swing while your worn blade's earlier strike left him ble
  - mech: `[strike:Worn Blade | atk:11 vs AC:10 → hit | 3 dmg]` — **med**: Mechanics show only the player's Worn Blade strike (atk 11 vs AC 10, 3 dmg); the narrated defense roll of 14 against Corwin's swing has no supporting mechanics and contradicts the single-action mechanics string.
- **[Chaos-griefer]** player: _"I kick the shutters off their hinges and shove them into the street below."_
  - DM: The shutters of Pilgrim's Rest Village splinter outward under your boot and clatter onto the road below as Corwin Boneknit, barely standing with blood soaking through his shirt, rakes a desperate hand across your ribs fo
  - mech: `[strike:Kick | atk:16 vs AC:10 → hit | 7 dmg]` — **high**: Mechanics say 7 damage but narration says 2; also Corwin has 1 HP and a hit for 7 should defeat him, yet he counterattacks unharmed.
- **[Chaos-griefer]** player: _"Where did this Corwin come from? Whatever — I grab him by the throat and slam his head into the windowsill."_
  - DM: In Pilgrim's Rest Village, you seize Corwin Boneknit by the throat and drive his skull hard into the windowsill, his body going limp as his last breath rattles out and he crumples to the floor.
  - mech: `[combat:table-talk]` — **high**: Corwin is a live enemy (hp:1, defeated:false, inCombat round 2) but the narration instantly kills him with no attack roll and no HP/defeated update; mechanics tag 'table-talk' doesn't resolve combat.
- **[Lore-hound]** player: _"Corwin's not from the old years, Kael — he's standing right here, alive. Give me a name of someone who's DEAD."_
  - DM: Kael sighs. "I told you — I don't know. Won't change by asking twice."
  - mech: `[roll:18 vs DC:13 → success | margin:5 | approach:focus | stake:reputation | risk:0.50 | stat:WITS+1` — **med**: Roll succeeded (18 vs DC 13, margin 5) but Kael refuses to provide info — success yields nothing, contradicting the mechanics.
- **[Lore-hound]** player: _"Corwin, you said it yourself — Kael knows the old years best. So who taught YOU that name you won't say?"_
  - DM: Kael sighs. "I told you — I don't know. Won't change by asking twice."
  - mech: `[roll:18 vs DC:13 → success | margin:5 | approach:focus | stake:reputation | risk:0.50 | stat:WITS+1` — **med**: Roll was a success (18 vs DC13, margin 5) but the fiction delivered a flat refusal/stonewall, contradicting the successful outcome.

### CANON_HALLUCINATION (2)
- **[Rules Lawyer DM]** player: _"A staff and a robe? You called me a sellsword with MIGHT 12 — what's the damage die on this staff, and what's my Armor value in the robe?"_
  - DM: Your weapons roll for damage as follows — the Kitchen cleaver rolls 1d6 and the Worn Blade rolls 1d6, plus your ability modifier on a hit.
  - mech: `(none)` — **high**: Failed to provide staff damage die or robe Armor value; described different weapons not referenced by player.
- **[Lore-hound]** player: _"Where do I find Kael, and how old is he supposed to be that he "knows the old years best"?"_
  - DM: Kael, the elder of Pilgrim's Rest Village, sits not far from where you stand — a grey-haired man whose lined face and slow, deliberate speech mark him as a man well past seventy, old enough that the village's earliest da
  - mech: `observe only — no roll, state unchanged` — **low**: Canon confirms Kael is the elder at this location, but the specific age claim ('well past seventy') is invented detail not in the bundle, asserted as fact.

### COMBAT_NOT_STARTED (1)
- **[Chaos-griefer]** player: _"A dream? Then I grab his cloth, wring it out, and ram my dagger into his gut to see if this Corwin bleeds."_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit lets out a sharp, winded gasp as your dagger finds his gut, and the bloom of red spreading across his tunic answers your question plainly — he bleeds.
  - mech: `(none)` — **high**: Player declared a dagger attack on Corwin but no combat started (inCombat false, no roll, no HP applied) despite narrating a wound; mechanics string empty

## Cost
96 Opus calls · 108,302 in + 9,139 out tokens · ~$2.31 (est. @ $15/$75 per M)
