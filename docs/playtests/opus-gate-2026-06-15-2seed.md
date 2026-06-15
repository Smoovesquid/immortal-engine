# Playtest — Opus-4.8 experiential gate — 2026-06-15

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 8 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie, Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: ashfen-reach, stonewatch-hollow

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | ashfen-reach | 12 | 4 | 2 | 0 |
| Chaos-griefer | ashfen-reach | 12 | 0 | 6 | 0 |
| Lore-hound | ashfen-reach | 12 | 0 | 0 | 2 |
| Confused newbie | ashfen-reach | 12 | 1 | 0 | 2 |
| Rules Lawyer DM | stonewatch-hollow | 12 | 4 | 6 | 1 |
| Chaos-griefer | stonewatch-hollow | 12 | 1 | 7 | 0 |
| Lore-hound | stonewatch-hollow | 12 | 2 | 1 | 0 |
| Confused newbie | stonewatch-hollow | 12 | 2 | 0 | 2 |

**Total turns judged:** 96 · **failing turns:** 33 (34%)

## Failures by bug class

### CRUNCH_INCONSISTENCY (13)
- **[Chaos-griefer]** player: _"I grab the lamp off the table and hurl it at the wall to set this place ablaze."_
  - DM: The lamp shatters against the wall of the building in Saltmarket Town, spilling oil and flame across the floor, and Dax Redcloak lunges forward with a wool blanket to smother the spreading fire before it can claim the ro
  - mech: `(none)` — **low**: Throwing a lit lamp to start a fire and Dax physically intervening to stop it is an opposed/contested action that should involve a roll; outcome was narrated as auto-resolved with no mechanics, no roll, no resource/condition change.
- **[Chaos-griefer]** player: _"I scoop up the spilled oil with my hands and fling it across the curtains."_
  - DM: The oil catches the curtains in Saltmarket Town's dim interior light, spreading a slick sheen across the fabric as Dax Redcloak steps back with narrowed eyes, the easy warmth of a civic representative replaced by somethi
  - mech: `(none)` — **low**: Player flung oil across curtains (a flammable hazard / aggressive act) but the response resolved nothing mechanically—no roll, no NPC reaction beyond a glance, no state change; oil spread isn't a threat without ignition, leaving intent half-resolved.
- **[Chaos-griefer]** player: _"I kick the door open and tackle whoever's standing there."_
  - DM: Dax Redcloak stumbles back against a cluttered shelf in Saltmarket Town's modest hall, scattering rolled parchments across the floor, one hand raised in startled peace, his expression caught somewhere between alarm and a
  - mech: `(none)` — **med**: Player declared a physical tackle on a present person; no attack roll, no contest, no grapple/contact resolution — outcome (he stumbles, hands raised) just narrated without mechanics.
- **[Chaos-griefer]** player: _"I press the burning parchment against the cluttered shelf full of dry scrolls."_
  - DM: The shelf catches with a hungry crackle, and as dry scrolls curl into flame in the heart of Saltmarket Town's building, Dax Redcloak steps back with wide eyes, his evasive composure finally cracked open by the rising ora
  - mech: `(none)` — **low**: Player sets a fire spreading to dry scrolls — a meaningful hazard with no roll, no fire/hazard state, no consequences tracked, and Brokefang (present enemy) ignored despite inCombat=false; intent resolved purely narratively with no mechanics.
- **[Rules Lawyer DM]** player: _"Fine, I'll figure it out in-world. I reach into my pack and pull out everything I'm carrying — what's in there?"_
  - DM: Senna watches with quiet patience as you upend your pack onto the floor of the building here at Wayfarers' Outpost, spreading its contents across the worn planks — a few days' trail rations, a coil of hempen rope, a tall
  - mech: `[roll:8 vs DC:13 → failure | margin:-5 | approach:focus | stake:time | risk:0.50 | stat:WITS-1]` — **med**: Roll was a failure (8 vs DC 13, stake:time) yet the narration delivers a full, clean inventory reveal with no cost, complication, or time loss — outcome contradicts the failed roll.
- **[Rules Lawyer DM]** player: _"Hold on — when did I agree to trade my coins for seeds? I never initiated a transaction. Reverse it: the twelve copper go back in my pouch, the seeds stay with Senna."_
  - DM: Senna catches the misunderstanding with a quick, apologetic smile and slides the twelve copper back across the counter toward your pouch, the seeds remaining firmly in her keeping as the small transaction is quietly undo
  - mech: `[roll:12 vs DC:13 → mixed | margin:-1 | approach:focus | stake:time | risk:0.50 | stat:WITS-1 | adv:` — **low**: Roll was a mixed result (12 vs DC 13, margin -1) but the narration grants a clean full reversal with no cost or complication despite the 'time' stake.
- **[Chaos-griefer]** player: _"I shove past Senna and kick over the vendor's entire stall, scattering pots into the dirt."_
  - DM: Senna steps into your path with surprising calm, her voice cutting through the clatter of scattered pots as she reminds you, firmly and without flinching, that Wayfarers' Outpost does not suffer this kind of disruption f
  - mech: `[roll:7 vs DC:13 → failure | margin:-6 | approach:force | stake:harm | risk:0.57 | stat:MIGHT-1 | wo` — **med**: Roll was a failure with stake:harm and stat:MIGHT-1/wounds, but narration shows no consequence to the PC—no harm, no wound applied in fiction, and combat:r1 is active with an enemy (Brennan the Fox) entirely absent from the narration.
- **[Chaos-griefer]** player: _"I draw my dagger and press the point against Senna's throat."_
  - DM: The people of Wayfarers' Outpost go still as stone around you, and Senna meets your eyes over the dagger's point with a calm that is somehow more frightening than fear — the kind of calm that knows every guard by name an
  - mech: `[roll:1 vs DC:13 → failure | margin:-12 | approach:focus | stake:harm | risk:0.48 | stat:WITS-1 | wo` — **med**: Player pressed a dagger to Senna's throat with stake:harm and rolled a catastrophic failure (margin -12, combat:defeat), yet the narration shows no consequence — no wound, no disarm, no guards reacting, Senna simply stands calm; outcome doesn't match the dice.

### DM_TEST_DEADEND (11)
- **[Rules Lawyer DM]** player: _"So I'm a staff-and-robe type — what's my class and level, and do I have any hit points and stats written down? Give me the numbers."_
  - DM: You and Theron the Crow clash; neither of you gives ground cleanly.
  - mech: `[roll:15 vs DC:14 → mixed | margin:1 | approach:force | stake:harm | risk:0.57 | stat:MIGHT-1 | woun` — **med**: No character sheet numbers were provided as requested; narration about clashing with Theron ignores the player's actual query.
- **[Rules Lawyer DM]** player: _"I'm lowering my staff. Before we go anywhere else — stop and give me my character sheet: class, level, HP, and ability scores. Actual numbers, now."_
  - DM: Dax Redcloak watches you lower your staff with a measured nod, the warm lamplight of Saltmarket Town's modest room casting steady shadows across his face as he folds his hands and says nothing about the numbers you seek 
  - mech: `(none)` — **med**: No mechanics invoked; nothing computed incorrectly.
- **[Rules Lawyer DM]** player: _"This is a dealbreaker — a character with no stats can't act. If you can't generate them, say so plainly instead of dodging in-character. Can you produce a character sheet, yes or no?"_
  - DM: Dax Redcloak meets your gaze steadily across the worn table, the candlelight of Saltmarket Town casting long shadows over a scatter of ledgers, and says simply, "I can point you toward what you need, but some things you'
  - mech: `(none)` — **med**: No mechanics invoked; nothing to contradict.
- **[Rules Lawyer DM]** player: _"So you can't roll dice at all — got it. Then assign me a standard array: 15, 14, 13, 12, 10, 8. I'll be a level 1 Fighter. Write down HP 12, AC 16. Confirm those numbers back to me."_
  - DM: You fall in the fight. The world tilts grey, and the dark collects what was always its due.
  - mech: `(none)` — **high**: Declares the PC falls in a fight with no combat active (inCombat:false), no roll, no HP/wound update, and no requested stats confirmed; contradicts canon state.
- **[Confused newbie]** player: _"You keep almost telling me and then not — can you just say what happened, plainly?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: No mechanics invoked; nothing to contradict.
- **[Rules Lawyer DM]** player: _"Before I get up — what's my character? Give me my name, class, level, and current HP."_
  - DM: Whatever you meant to do, Wayfarers' Outpost doesn't give it to you.
  - mech: `[roll:1 vs DC:12 → failure | margin:-11 | approach:focus | stake:reputation | risk:0.47 | stat:WITS-` — **high**: A request for character info was forced into a WITS check vs DC12 with a NAT1 failure; this is nonsensical—no roll should gate basic sheet data, and the canon shows level 1, 0 wounds which was never surfaced.
- **[Rules Lawyer DM]** player: _"That's a non-answer. I'm asking out of character: what's my character sheet? Name, class, level, max and current HP."_
  - DM: Within the walls of Wayfarers' Outpost, Senna meets your question with a patient smile, the kind that knows the difference between the world inside a story and the one asking questions from outside it.
  - mech: `[roll:10 vs DC:11 → mixed | margin:-1 | approach:focus | stake:reputation | risk:0.48 | stat:WITS-1]` — **med**: A meta query got a DC roll attached (DC:11) and 'mixed' result, but no actual stat info delivered; nonsensical mechanics for an OOC question.
- **[Rules Lawyer DM]** player: _"Senna's smile is nice, but it's not a stat block. Who's Senna, and what does my character sheet say — name, class, level, HP?"_
  - DM: Within the warm interior of this building at Wayfarers' Outpost, Senna — the outpost's civic representative, a friendly face you've encountered here — gives you a patient look, as though accustomed to travelers who arriv
  - mech: `[roll:5 vs DC:12 → failure | margin:-7 | approach:focus | stake:reputation | risk:0.49 | stat:WITS-1` — **med**: Rolling WITS DC12 against a player asking for their own character sheet is nonsensical; the failure withholds basic info the engine knows (level 1, wounds 0).

### COMBAT_NOT_STARTED (3)
- **[Chaos-griefer]** player: _"I draw my dagger and slash at Brokefang's throat."_
  - DM: Your blade cuts wide through the stale air of the room, and Brokefang grins at you across the dim interior — a cold, unhurried smile that says Saltmarket Town has seen worse than you, and so has he.
  - mech: `[roll:10 vs DC:15 → failure | margin:-5 | approach:force | stake:harm | risk:0.58 | stat:MIGHT-1 | w` — **high**: Player attacked present foe Brokefang but combat state is not active (inCombat:false); mechanics show 'combat:defeat' yet no HP/wound update reflected and roll failure left no consequence on PC despite stake:harm/wounds
- **[Chaos-griefer]** player: _"I shove Dax into the burning shelf and hold him there."_
  - DM: The people of Saltmarket Town will remember this moment — Dax Redcloak's strangled cry, the shelf collapsing in a cascade of embers and scorched parchment, and the hollow silence that follows when a community's represent
  - mech: `(none)` — **high**: Player launched a violent attack on Dax (shove into burning shelf, hold him there) and the narration depicts him burning/dying, but no combat state, no roll, no HP/wound tracking, no attack resolution occurred — mechanics empty and inCombat stays false.
- **[Chaos-griefer]** player: _"I press harder, drawing a bead of blood, and tell her to call off her guards or I'll open her throat."_
  - DM: Senna's eyes do not widen with fear — they settle into something colder and more certain, and from somewhere deeper in the building a chair scrapes stone as the guards of Wayfarers' Outpost rise without being called at a
  - mech: `(none)` — **med**: Player holds a blade to Senna's throat (lethal threat) and guards rise to respond, but no roll, no combat state, no HP/wound tracking initiated despite an active hostage/violence situation.

### CANON_HALLUCINATION (3)
- **[Lore-hound]** player: _"Wynn — you keep the town's memory. So drop the riddles: what year was it when I first walked in, and what season?"_
  - DM: Wynn the Wary sets down a worn clay cup and meets your eyes with the unhurried steadiness of someone who has kept Saltmarket Town's ledgers longer than most here have been alive, then says plainly: "It was the third year
  - mech: `[roll:19 vs DC:12 → success | margin:7 | approach:focus | stake:time | risk:0.47 | stat:WITS]` — **med**: Wynn confidently states the PC first arrived in 'the third year of the stable count' in early autumn, but canon timeline/ledger contains no such arrival date or season — fabricated specifics presented as fact.
- **[Confused newbie]** player: _"Um, where am I exactly? Can I look around the room?"_
  - DM: You're inside Saltmarket Town. No one else is under this roof, though you can hear the settlement stirring beyond the walls. The way out leads back to the open air.
  - mech: `(none)` — **med**: DM claims 'no one else is under this roof' but canon lists six NPCs present at this location including Dax, Sera, Theron, Wynn, Brokefang, and the Lingerer.
- **[Confused newbie]** player: _"Okay, I think I'll head outside and see what's out there."_
  - DM: You're inside Wayfarers' Outpost. No one else is under this roof, though you can hear the settlement stirring beyond the walls. The way out leads back to the open air.
  - mech: `(none)` — **low**: DM asserts 'No one else is under this roof' but canon lists many NPCs present at this location with no indication they're elsewhere.

### DM_ARTIFACT_LEAK (2)
- **[Lore-hound]** player: _"Read me the entry yourself, Senna—what date does the ledger say, word for word?"_
  - DM: You look for a me the entry yourself, senna—what date does the ledger say, word for word, but what's here is a straw pallet, an iron brazier, and an oil lantern.
  - mech: `observe only — no roll, state unchanged` — **high**: No roll claimed, state unchanged, consistent with observe-only.
- **[Confused newbie]** player: _"What is it you keep looking at? You can tell me, I don't mind."_
  - DM: You take stock of your surroundings. Exits: Stonebridge, Ferry Landing. Structures: building #1.
  - mech: `observe only — no roll, state unchanged` — **high**: observe-only, no state change is consistent

### NONE (1)
- **[Lore-hound]** player: _"Don't dodge me, Dax. Give me names — who sits on this council of civic representatives?"_
  - DM: Dax Redcloak straightens the ledger on the table between you, his eyes steady but his hands just a little too deliberate, and names three faces you already know from the market square of Saltmarket Town — the elder, the 
  - mech: `[roll:13 vs DC:12 → mixed | margin:1 | approach:focus | stake:time | risk:0.48 | stat:WITS | adv:+2]` — **low**: DM claims to name three council members but never actually states names; the vague 'elder, the artisans' gloss aligns with canon roles (Wynn elder, Sera/Theron artisans) but no names given as asserted

## Cost
192 Opus calls · 231,358 in + 20,575 out tokens · ~$5.01 (est. @ $15/$75 per M)
