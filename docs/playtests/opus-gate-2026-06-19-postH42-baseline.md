# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 6 | 5 | 1 |
| Chaos-griefer | glass-harbor | 12 | 0 | 4 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 2 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 16 (33%)

## Failures by bug class

### CRUNCH_INCONSISTENCY (7)
- **[Rules Lawyer DM]** player: _"Who am I, and what's on my character sheet? Give me my class, level, and current HP."_
  - DM: You're armed with Kitchen cleaver and Worn Blade. You're wearing Padded coat. Your measures: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13.
  - mech: `(none)` — **low**: Player asked for class and level explicitly; DM gave stats/HP but omitted both class and level (canon level=1).
- **[Rules Lawyer DM]** player: _"Fine, combat it is — but my HP says 11 and I need it tracked honestly. I swing my worn blade at Corwin to finish him. What's the roll?"_
  - DM: Blood already streaking his tunic from the first round's wound, Corwin Boneknit staggers against the wall of the building in Pilgrim's Rest Village, barely upright at 1 hit point as your worn blade arcs toward him to end
  - mech: `[combat:table-talk]` — **med**: Combat is active (round 2, Corwin at 1 HP) but the declared finishing attack produces no roll, no damage, no resolution — mechanics tag is only 'table-talk'.
- **[Rules Lawyer DM]** player: _"You quoted me the modifier table but still didn't roll. d20 result for my attack on Corwin — now. What's the number?"_
  - DM: The clash inside Pilgrim's Rest Village continues as your blade finds Corwin Boneknit — already barely standing at a single hit point — and the strike lands hard enough to end the fight.
  - mech: `[combat:table-talk]` — **high**: No roll resolved (combat:table-talk), yet narration claims the strike lands and ends the fight; enemy still shows hp:1 defeated:false — outcome asserted without mechanics.
- **[Chaos-griefer]** player: _"I scoop up the blade and hurl it after him, aiming for his back."_
  - DM: The thrown blade tumbles end over end across the room of Pilgrim's Rest Village's lone building and bites into the retreating figure's back with a solid thunk, buying you the moment you needed to press forward.
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll succeeded and blade hit, but enemy Lingerer HP (1) was not reduced/tracked; a solid hit on a 1-HP foe should defeat or update it.
- **[Chaos-griefer]** player: _"I twist his arm behind his back and slam his face into the wall over and over."_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit wrenches his arm free before your grip fully locks, turning the wall-slam into a glancing blow that costs you the initiative and leaves you both breathing hard, the fight still 
  - mech: `[combat:table-talk]` — **med**: In-combat attack on Corwin (round 3, enemy HP 8) resolved as table-talk with no HP change or roll despite established combat state; mechanics tag contradicts canon inCombat:true.
- **[Chaos-griefer]** player: _"I grab his ankle and yank hard to drag him down with me."_
  - DM: The cold floor of Pilgrim's Rest Village's only building holds you fast as your grip slips from his ankle, and the darkness pulls you down alone.
  - mech: `(none)` — **med**: Player grappling action resolved as a failure with no roll/mechanics shown; PC HP is 0 and there's an undefeated enemy (Corwin, 8hp) yet inCombat=false, leaving an action outcome that contradicts the live combat state.
- **[Chaos-griefer]** player: _"I drag myself back up and grab the dropped blade off the floor."_
  - DM: The cold floor of Pilgrim's Rest Village presses against your cheek for only a moment before your fingers close around the dropped blade and you haul yourself upright, breath ragged but resolve intact.
  - mech: `(none)` — **med**: PC is at HP 0 yet narration shows them hauling upright with no death save, stabilization, or HP change reflected

### CANON_HALLUCINATION (3)
- **[Rules Lawyer DM]** player: _"That's not what I asked. I asked Brae the guard who the stranger lurking at the edges is — not about Corwin. Does Brae have an answer?"_
  - DM: Corwin Boneknit, a representative — one of the folk here, watching from nearby.
  - mech: `(none)` — **high**: DM ignored the player's explicit correction and re-served Corwin instead of answering who the lurking stranger is.
- **[Lore-hound]** player: _"I head to the village tavern and find the oldest person there. Who founded Pilgrim's Rest, and when?"_
  - DM: You step out into the open air. You know of no such place hereabouts. From here the roads lead to The Sunken Road to the south and Dry Creek to the west. Where will you make for?
  - mech: `(none)` — **high**: DM denied the player's location/intent and bounced back a directional menu instead of resolving the tavern visit
- **[Lore-hound]** player: _"Before I descend — Corwin, who was the last person you carried down the Sunken Road, and how long ago?"_
  - DM: Corwin — the figure beside you at the threshold of The Sunken Road — thinks a moment, then says that the last soul he guided down these steps was a trapper, perhaps three winters past, who never came back up.
  - mech: `[descend]` — **med**: Corwin is not in npcsPresent and the trapper-three-winters-ago story has no support in canon; presented as confident fact.

### DM_TEST_DEADEND (3)
- **[Rules Lawyer DM]** player: _"Brae, ignore Corwin. Point at the stranger on the edge of the village and tell me their name."_
  - DM: Your worn blade hits the Corwin Boneknit for 7. (1 HP left) (A market stall here offers cover — type "take cover" for +2 AC.) The Corwin Boneknit hits you for 2. (You: 11 HP)
  - mech: `[strike:Worn Blade | atk:16 vs AC:10 → hit | 7 dmg] [enemy:Corwin Boneknit | atk:21 vs AC:11 → hit |` — **high**: Mechanics consistent: 7 dmg to Corwin (1 HP left), 2 dmg to PC (13->11).
- **[Rules Lawyer DM]** player: _"Lands how? Give me the d20, my +1 MIGHT, the total versus his AC, and confirm Corwin drops to 0."_
  - DM: Facing you: the Corwin Boneknit (nearly done). You're at 11 of 13 HP. You can "strike", "strike", "fire bolt", "ward", "take cover" behind the market stall, or talk ("parley"). No running from this one — they're already 
  - mech: `[combat:table-talk]` — **high**: No d20 rolled, no total vs AC, no HP update; Corwin is at 1 HP and the demanded resolution was never executed.
- **[Confused newbie]** player: _"That sideways glance — is something going on you're not telling me?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:19 vs DC:12 → success | margin:7 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **med**: roll 19 vs DC 12 is a success and narration is positive-toned, consistent

### DM_ARTIFACT_LEAK (2)
- **[Rules Lawyer DM]** player: _"I attack Corwin with my worn blade. Roll it — give me the d20, the modifier, the total, and his resulting HP."_
  - DM: Modifier breakpoints: 9 → −1, 10–11 → +0, 12–13 → +1, 14–15 → +2. Your measures: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0).
  - mech: `[combat:table-talk]` — **high**: Already inCombat round 2 with Corwin at 1 HP; no d20 rolled, no HP update, attack unresolved.
- **[Confused newbie]** player: _"Why am I here, though? I don't really remember how I got here."_
  - DM: Your aim: Your life is your own. See where the road leads..
  - mech: `(none)` — **med**: No mechanics needed; nothing contradicted.

### NONE (1)
- **[Confused newbie]** player: _"A falling-out about what? Who were these people?"_
  - DM: In the quiet of Pilgrim's Rest Village, Corwin Boneknit's jaw tightens almost imperceptibly before he answers, his words coming out carefully measured — two traders, one road, and a debt that was never repaid, settled lo
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.48 | stat:WITS+1]` — **low**: DM gives vague 'two traders' backstory but names no one; canon has traders Tove and Torva Boneknit, yet the falling-out event has no support in ledgerFacts/recentCanon

## Cost
96 Opus calls · 119,826 in + 9,640 out tokens · ~$2.52 (est. @ $15/$75 per M)
