# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 1 | 2 | 1 |
| Chaos-griefer | glass-harbor | 12 | 2 | 5 | 0 |
| Lore-hound | glass-harbor | 12 | 5 | 2 | 3 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 0 |

**Total turns judged:** 48 · **failing turns:** 20 (42%)

## Failures by bug class

### DM_TEST_DEADEND (10)
- **[Rules Lawyer DM]** player: _"What are my actual stats and current HP? You listed gear but no numbers."_
  - DM: Within the quiet building of Pilgrim's Rest Village, your character sheet and current hit points are tracked by your game system rather than the world around you — check your character sheet or ask your DM to pull up you
  - mech: `observe only — no roll, state unchanged` — **med**: Canon has concrete stats (hp 13/13, level 1) the DM should have surfaced; instead it leaked the machine boundary and provided nothing.
- **[Chaos-griefer]** player: _"I walk outside and shove the trader's cart over, spilling everything into the mud."_
  - DM: Inside the building in Pilgrim's Rest Village, your worn blade connects hard against Tove's side for 7 damage, leaving the trader barely standing at 1 HP and stumbling backward as she retaliates with a desperate swing th
  - mech: `[strike:Worn Blade | atk:16 vs AC:10 → hit | 7 dmg]` — **high**: Mechanics consistent with combat state: hit, 7 dmg, Tove at 1 HP.
- **[Chaos-griefer]** player: _"I grab a torch from the village square and hurl it onto the next building's roof."_
  - DM: In the flickering chaos inside Pilgrim's Rest Village's building, you wrench the Lingerer into a grinding clinch — no torch, no square, just your arms locked around a struggling figure who strains against your grip but c
  - mech: `[grapple:clinch | 13+1 vs 12]` — **high**: Grapple resolution 13+1 vs 12 succeeds and fiction matches the clinch outcome; combat state consistent.
- **[Lore-hound]** player: _"So you settled in 1335 — who held the deed to this inn before you, by name?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:16 vs DC:12 → success | margin:4 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Roll succeeded but the fiction delivers nothing concrete; success/outcome mismatch.
- **[Lore-hound]** player: _"That's not an answer, Corwin. Give me a name — who held this inn's deed before you in 1335?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Roll succeeded but the success has no content — the requested information was not provided, so the fiction doesn't match the mechanical success.
- **[Lore-hound]** player: _"The dice don't answer questions, Corwin. A name — who held this deed before you?"_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:11 vs DC:12 → mixed | margin:-1 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1 ` — **med**: Mixed result on margin -1 is consistent with a partial/imperfect outcome; no resources to update.
- **[Lore-hound]** player: _"Corvin Ashe — that's nearly your own name, Corwin Boneknit. Where's Ashe now, and was he any kin to you?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:reputation | risk:0.48 | stat:WITS+1` — **high**: Roll resolves as success consistently, no resource changes needed.
- **[Lore-hound]** player: _"Stop with the dice — Corwin, look me in the eye and tell me: is Corvin Ashe dead, alive, or kin to you?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:15 vs DC:12 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Roll 15 vs DC 12 success is consistent; no resources to update.

### CRUNCH_INCONSISTENCY (6)
- **[Rules Lawyer DM]** player: _"I sit up and take stock—what am I carrying, and what do my stats look like?"_
  - DM: You go through your pack. weapons: Kitchen cleaver, Worn Blade. armor: Padded coat. tools: Lantern. clothes: Wool scarf. oddities: Key with no teeth. consumables: Tonic of grit, Bandages. junk: Empty vial labeled “CURE”.
  - mech: `(none)` — **low**: Player asked for stats too; DM listed inventory but never reported HP/level/stats despite canon (hp 13/13, level 1).
- **[Chaos-griefer]** player: _"I grab the lantern off the wall and smash it against the Lingerer, setting it ablaze."_
  - DM: The lantern swings wide in the cramped building of Pilgrim's Rest Village, shattering against the wall rather than the Lingerer, who steps back with unsettling calm and watches the spilled oil burn between you.
  - mech: `[combat:table-talk]` — **med**: Canon shows inCombat=true round 4 with Lingerer at 8 HP, but mechanics reads [combat:table-talk] and the attack resolves as a miss with no roll shown or HP/combat state update during active combat.
- **[Chaos-griefer]** player: _"I kick the burning oil toward the Lingerer and bolt for the door."_
  - DM: The burning oil skids across the floor of Pilgrim's Rest Village's building in a wash of heat and light, forcing the Lingerer back a step — but the fight is far from finished, and the door is still three hard paces away.
  - mech: `[combat:table-talk]` — **med**: Player declared two actions (kick oil, bolt for door) with a present foe in active combat, but mechanics show only [combat:table-talk] — no attack roll, no damage/effect resolution, no movement resolution, Lingerer HP unchanged at 8.
- **[Chaos-griefer]** player: _"I jam my blade through the door's latch to wedge it shut and back away as the flames climb the walls."_
  - DM: The crack of steel through iron latch echoes inside the burning building in Pilgrim's Rest Village as your blade holds the door fast, but the Lingerer's answering blow clips your side and you stagger back through the smo
  - mech: `[strike:Worn Blade | atk:22 vs AC:10 → hit | 3 dmg]` — **med**: Mechanics show PC's strike hitting (atk:22 vs AC:10, 3 dmg) but narration describes the player wedging the door and taking damage from the Lingerer's counterattack — the 3 dmg should reduce enemy HP, yet PC HP is described as bleeding/staggered with no enemy HP update reflected.
- **[Chaos-griefer]** player: _"I twist its arm behind its back and hurl it face-first into the burning wall."_
  - DM: The Lingerer's face meets the scorched timber wall of Pilgrim's Rest Village with a sickening crack, buying you a desperate breath as the smoke thickens and your body screams from the seven rounds of punishment already t
  - mech: `[combat:r6]` — **med**: Mechanics shows combat round 6 but canon says round 7; the attack on the Lingerer is narrated as a hit yet no HP damage is applied (Lingerer still at 5 HP).
- **[Chaos-griefer]** player: _"I spin around and bury my blade in the Lingerer's skull as it charges through the doorway."_
  - DM: The streets of Pilgrim's Rest Village echo with a wet crack as your worn blade bites into the Lingerer's skull mid-charge, drawing blood and staggering it back through the doorway — but the thing's momentum carries one s
  - mech: `[strike:Worn Blade | atk:21 vs AC:10 → hit | 2 dmg]` — **med**: Lingerer had 3 HP; a hit dealing 2 dmg leaves it at 1 HP alive, but the narration says blade buried in skull/staggering — also the counter-swipe across PC's ribs is not reflected in any HP loss for the PC (still at 4).

### CANON_HALLUCINATION (3)
- **[Lore-hound]** player: _"I head downstairs to the common room and find the innkeeper. What's your name, and how long have you run this place?"_
  - DM: In the warm common room of Pilgrim's Rest Village's only inn, the broad-shouldered innkeeper looks up from wiping the bar and offers a straightforward smile, introducing himself as Corwin Boneknit — a name he says he's c
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **low**: Corwin Boneknit is in canon (role: representative), but the '12 years running the inn' and 'settled after roads wore him out' backstory is invented with no canon support, stated confidently.
- **[Lore-hound]** player: _"What year is it right now, by your reckoning — give me the actual number?"_
  - DM: Corwin Boneknit scratches the back of his neck and tells you that by Pilgrim's Rest Village's common reckoning, the year is 1347.
  - mech: `observe only — no roll, state unchanged` — **low**: Specific year 1347 has no support in canon bundle; asserted confidently without grounding
- **[Lore-hound]** player: _"The DM's gone vague. Corwin — say the name out loud yourself: who sold you this inn in 1335?"_
  - DM: Corwin Boneknit's jaw tightens for just a moment before the name slips out in Pilgrim's Rest Village's warm lamplight — "Corvin Ashe" — said quietly, like a coin dropped on a table he'd rather not have opened.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:reputation | risk:0.48 | stat:WITS+1` — **med**: The name 'Corvin Ashe' and the 1335 inn-sale event have no support anywhere in the canon bundle; presented as confident fact.

### NONE (1)
- **[Rules Lawyer DM]** player: _"What's your name, and why are you so interested in who ran this village before the current elders?"_
  - DM: In the warm light of Pilgrim's Rest Village, the Lingerer meets your gaze steadily and says their name plainly, then admits with a wary half-smile that they have simply stayed too long asking questions about the village'
  - mech: `[dialogue ask | self | trust:5]` — **low**: DM says NPC 'says their name plainly' but never states a name; canon only gives 'the Lingerer' as a descriptor, not an actual name — the claim of revealing a name is unsupported/empty.

## Cost
96 Opus calls · 108,214 in + 9,101 out tokens · ~$2.31 (est. @ $15/$75 per M)
