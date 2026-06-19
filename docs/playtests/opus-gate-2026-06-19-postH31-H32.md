# Playtest — Opus-4.8 experiential gate — 2026-06-19

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 0 | 0 | 0 |
| Chaos-griefer | glass-harbor | 12 | 3 | 5 | 1 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 3 | 0 | 2 |

**Total turns judged:** 48 · **failing turns:** 11 (23%)

## Failures by bug class

### DM_TEST_DEADEND (5)
- **[Chaos-griefer]** player: _"I walk outside and shove the first villager I see into the mud."_
  - DM: Blades clash in the close quarters of the building in Pilgrim's Rest Village as your worn blade opens a deep gash across Corwin Boneknit's side, leaving him swaying on his feet with only a thread of life remaining — even
  - mech: `[strike:Worn Blade | atk:16 vs AC:10 → hit | 7 dmg]` — **high**: Mechanics consistent: atk 16 vs AC 10 hit, Corwin at 1 HP, PC took counter damage, combat state active.
- **[Chaos-griefer]** player: _"I raise my hand and command the entire village to bow down and worship me as their god."_
  - DM: The dark takes you, and does not give you back.
  - mech: `(none)` — **med**: PC HP is already 0; the narration implies death/darkness but no mechanics, condition update, or resolution reflects the state, and the action was not adjudicated at all.
- **[Lore-hound]** player: _"What happened twelve years ago that made you settle here, Corwin?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **med**: DM dismissed the player's in-fiction question to Corwin with a meta non-answer ('Nothing's happened yet'), refusing to engage the conversation.
- **[Confused newbie]** player: _"Um, who are all these people? Should I know them?"_
  - DM: That one's yours to call — nothing here forces your hand either way. Go with your gut.
  - mech: `(none)` — **med**: Player asked who the present NPCs are; DM dodged entirely instead of resolving the intent in-fiction, leaking a 'your call' non-answer.
- **[Confused newbie]** player: _"Can I just open the door and go after them?"_
  - DM: The wizard's voice carries a note of quiet finality as he gestures toward the far wall of the building in Pilgrim's Rest Village, making clear that whatever door or passage you have in mind simply cannot be reached from 
  - mech: `(none)` — **med**: No mechanics needed; nothing contradicted.

### CRUNCH_INCONSISTENCY (4)
- **[Chaos-griefer]** player: _"I drag his body out into the road and dump it in front of the morning crowd."_
  - DM: The people of Pilgrim's Rest Village part in murmured confusion as you stride out into the road, but the mechanics confirm there is no body in your hands — the way was already clear, and you emerge from the building into
  - mech: `[grapple:no-target] [combat:victory]` — **med**: Mechanics show [combat:victory] and canon has Corwin Boneknit defeated (hp:0), implying a body should exist; DM narrates no body, contradicting the prior combat resolution.
- **[Chaos-griefer]** player: _"I grab the nearest villager by the collar and demand to know where Corwin's body went."_
  - DM: In Pilgrim's Rest Village, your fist closes on empty air — no one is within reach to grab — but the victory is yours all the same, and you quickly search the area and pocket whatever was left behind.
  - mech: `[grapple:no-target] [combat:victory]` — **high**: [grapple:no-target] is wrong — many villagers are present; spurious [combat:victory] triggered with no combat active (inCombat=false), and a phantom search/loot resolved nothing real.
- **[Chaos-griefer]** player: _"I stand up unburned and walk out through the wall of flames untouched."_
  - DM: The flames of Pilgrim's Rest Village part around you like a curtain drawn by a steady hand, and you step through unmarked, boots finding solid ground on the other side.
  - mech: `(none)` — **med**: PC is at 0 HP yet effortlessly performs an action and walks unharmed through flames; no resolution roll or peril applied despite the player auto-declaring success against an environmental hazard.
- **[Chaos-griefer]** player: _"I grab the counter and flip it over onto her."_
  - DM: The counter in Pilgrim's Rest Village is heavy, but your grip finds purchase and you wrench it sideways, sending it crashing down toward Corwin Boneknit with a splintering thud.
  - mech: `(none)` — **med**: Player attacks Corwin Boneknit who is already defeated (hp 0) and combat ended; no roll, no resolution against an already-dead foe, and attack treated as landing on a present target who shouldn't be a viable combatant.

### CANON_HALLUCINATION (2)
- **[Confused newbie]** player: _"Okay, can I just look at the stranger watching from the edges?"_
  - DM: In the warm interior of this building in Pilgrim's Rest Village, you scan the edges of the room but find only a wooden crate, an iron brazier casting low heat, and a straw pallet — no stranger lurks here, just the quiet 
  - mech: `observe only — no roll, state unchanged` — **high**: Observe-only, no state change is mechanically fine.
- **[Confused newbie]** player: _"Wait, there's a wizard here now? Where did he come from?"_
  - DM: In Pilgrim's Rest Village, your sharp eyes trace the wizard's path back through the open doorway to the road beyond, where the dust of recent travel still hangs in the air — he came from the east, and not long ago.
  - mech: `[roll:14 vs DC:11 → success | margin:3 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: No wizard is listed among npcsPresent in canon; the DM confirms a wizard's presence and origin as fact without support.

## Cost
96 Opus calls · 108,935 in + 9,061 out tokens · ~$2.31 (est. @ $15/$75 per M)
