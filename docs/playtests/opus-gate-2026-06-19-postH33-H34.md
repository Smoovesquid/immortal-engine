# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 4 | 3 | 1 |
| Chaos-griefer | glass-harbor | 12 | 0 | 2 | 0 |
| Lore-hound | glass-harbor | 12 | 3 | 0 | 2 |
| Confused newbie | glass-harbor | 12 | 1 | 1 | 0 |

**Total turns judged:** 48 · **failing turns:** 13 (27%)

## Failures by bug class

### DM_TEST_DEADEND (6)
- **[Rules Lawyer DM]** player: _"How much coin is in the pouch, and what's the damage die on this short blade?"_
  - DM: For damage: the Worn Blade rolls 1d6. You add your relevant ability modifier on a hit.
  - mech: `(none)` — **low**: Damage die 1d6 plus ability modifier is a reasonable, self-consistent answer for a short blade.
- **[Rules Lawyer DM]** player: _"Three copper, a cloak, and nothing else? Then where did the Worn Blade and Kitchen cleaver go — I had them a moment ago."_
  - DM: It half-works — you get part of what you were after, not all of it.
  - mech: `[roll:11 vs DC:12 → mixed | margin:-1 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Mixed roll narrated generically with no resolution of the inventory discrepancy; no item state change or accounting for the supposedly lost items.
- **[Lore-hound]** player: _"Kael, elder — you'd know. Whose roof did I sleep under last night?"_
  - DM: You take a real bed and a real night. Sleep comes slow, then all at once. You wake whole — 13/13 HP.
  - mech: `[rest:long]` — **med**: Long rest restores HP to 13/13 correctly.
- **[Lore-hound]** player: _"Whom don't you represent, Corwin? Name one person in this village who isn't on your list."_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:reputation | risk:0.47 | stat:WITS+1` — **med**: Roll 17 vs DC 12 success is consistent with a positive-but-empty outcome; no combat or resource changes needed.
- **[Lore-hound]** player: _"Hold on — I asked Brae, but you answered as Galen. Who's Galen, and where did Brae just go?"_
  - DM: You wait, watchful, and let the moment in Dry Creek run on.
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS+1 | adv:+` — **med**: No mechanical contradiction; mixed roll loosely matches a stalled outcome.
- **[Confused newbie]** player: _"Oh, do I even have any money on me? I have no idea what I'm carrying."_
  - DM: It doesn't come off the way you meant; the moment slips past you in Pilgrim's Rest Village.
  - mech: `[roll:6 vs DC:12 → failure | margin:-6 | approach:focus | stake:time | risk:0.47 | stat:WITS+1 | adv` — **med**: Rolling WITS vs DC12 to check one's own pockets is absurd, and the failure produced no coherent outcome—the moment 'slipping past' doesn't address whether money exists.

### CRUNCH_INCONSISTENCY (4)
- **[Rules Lawyer DM]** player: _"I sit up and check myself over — what's my character's name, class, and current HP?"_
  - DM: Your name is Nyx. If I've called you anything else, that was my slip — you're Nyx.
  - mech: `(none)` — **med**: Canon has HP 13/13 and level 1; DM failed to report any HP or class despite being directly asked.
- **[Rules Lawyer DM]** player: _"So I have the Worn Blade, the cloak, and three copper. Confirm the kitchen cleaver — is it on me, yes or no?"_
  - DM: There's no cloak — you're armed with Kitchen cleaver and Worn Blade. You're wearing Padded coat. And you carry Kitchen cleaver, which means something to you.
  - mech: `(none)` — **med**: Player asked yes/no on cleaver; DM gives no clear answer, contradicts itself by both listing cleaver as a weapon and as a separate carried item, and the canon inventory isn't actually provided to confirm anything.
- **[Chaos-griefer]** player: _"Who the hell is the Lingerer? I spin and slash at whoever just hit me."_
  - DM: The Lingerer — a gaunt figure who has haunted Pilgrim's Rest Village far past any welcome — ducks your spinning slash with unsettling ease and lands another sharp blow against your side before you can recover your footin
  - mech: `[strike:Worn Blade | atk:9 vs AC:10 → miss]` — **med**: Mechanics show player's strike atk:9 vs AC:10 = miss, but narration describes the player missing AND the Lingerer landing a hit on the player; no enemy attack roll or HP update shown, and the miss is misattributed in the fiction.
- **[Chaos-griefer]** player: _"I throw a handful of burning straw in his face and stab while he flinches."_
  - DM: The burning straw catches the Lingerer full in the face inside this Pilgrim's Rest Village building, your blade finding its mark for 2 damage even as his retaliating strike clips you hard, leaving you both bloodied and d
  - mech: `[strike:Improvised Burning Oil | atk:20 vs AC:10 → hit | 2 dmg]` — **med**: DM says both 'bloodied' but PC HP is 5/13 with no damage applied to PC despite narrating a retaliating strike that 'clips you hard'; enemy HP 6/8 only reflects 2 dmg but the retaliation has no mechanical effect on PC.

### CANON_HALLUCINATION (2)
- **[Lore-hound]** player: _"Brae — three days ago, a cart with a broken wheel at the east gate. You remember that? Whose cart was it?"_
  - DM: Galen's brow creases and he glances briefly toward the window before answering — he remembers the broken wheel well enough, a cart loaded with grain sacks, but the owner's name sits just out of reach on his tongue, and a
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **low**: Mixed roll appropriately yields partial recall — remembers cart details but not the name
- **[Lore-hound]** player: _"Dry Creek? A moment ago we were in Pilgrim's Rest Village — now you call this place Dry Creek. Which is it?"_
  - DM: Galen meets your puzzled look with a patient nod, his voice steady as he confirms that yes, this settlement has always been called Dry Creek, whatever name you may have heard whispered on the road before you arrived here
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: roll succeeded and narration delivered an in-fiction answer consistently

### DM_ARTIFACT_LEAK (1)
- **[Rules Lawyer DM]** player: _"Empty? You said I had a pouch of coin under my cloak two breaths ago. Which is it?"_
  - DM: There's no cloak — you're armed with Kitchen cleaver and Worn Blade. You're wearing Padded coat. And you carry Kitchen cleaver, which means something to you.
  - mech: `(none)` — **med**: No mechanics required; inventory state isn't contradicted by canon.

## Cost
96 Opus calls · 109,787 in + 9,101 out tokens · ~$2.33 (est. @ $15/$75 per M)
