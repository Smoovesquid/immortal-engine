# Playtest — Opus-4.8 experiential gate — 2026-06-20

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 7 | 7 | 4 |
| Chaos-griefer | glass-harbor | 12 | 0 | 3 | 0 |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 1 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 16 (33%)

## Failures by bug class

### DM_TEST_DEADEND (10)
- **[Rules Lawyer DM]** player: _"What does the Tonic of grit do, and what are the numbers on my Worn Blade and Kitchen cleaver for damage?"_
  - DM: Kitchen cleaver: A working-class relic. It's a real thing in your pack, not a game-piece — nothing special fires when you use it.
  - mech: `(none)` — **med**: Tonic of grit heals 2d4 per canon but DM didn't state it; also gave no damage numbers for either weapon as asked.
- **[Rules Lawyer DM]** player: _"You dodged half my question. Give me the actual damage dice for the Worn Blade and the Kitchen cleaver, and tell me what the Tonic of grit does when I drink it."_
  - DM: For damage: the Kitchen cleaver rolls 1d6 and the Worn Blade rolls 1d6. You add your relevant ability modifier on a hit.
  - mech: `(none)` — **med**: Damage dice 1d6 for both weapons are plausible and self-consistent; no contradiction in what was answered.
- **[Rules Lawyer DM]** player: _"And the Tonic of grit — what does it do when I drink it? You still haven't answered that."_
  - DM: You do so without difficulty.
  - mech: `trivial action — no roll, auto-success` — **high**: Tonic of grit heals 2d4 per canon; DM neither described its effect nor resolved drinking it correctly.
- **[Rules Lawyer DM]** player: _"That's not an answer either. Mechanically — does the Tonic of grit heal HP, give temporary HP, or buff a stat? Give me the number."_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Tonic of grit heals 2d4 per canon; DM never provided this and instead ran an irrelevant mixed roll.
- **[Rules Lawyer DM]** player: _"Stop dodging. Pick one: does the Tonic of grit restore HP, grant temporary HP, or buff a stat — and how much? Give me a number or tell me it's undefined."_
  - DM: It half-works — you get part of what you were after, not all of it.
  - mech: `[roll:12 vs DC:12 → mixed | margin:0 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Tonic of grit heals 2d4 per canon; DM gave no number and treated a definable lookup as a mixed dice roll.
- **[Rules Lawyer DM]** player: _"So it's undefined. Fine — I drink the Tonic of grit right now. Tell me exactly what changes on my sheet: my HP was 13/13. What is it now?"_
  - DM: Your sheet: MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0). Hit points: 13 of 13. These are your canonical scores — I report what the sheet reads; I cannot edit them.
  - mech: `(none)` — **high**: Tonic of grit heals 2d4 but DM applied no healing and claimed it cannot edit the sheet; consumable effect ignored.
- **[Rules Lawyer DM]** player: _"I shove him again, harder. He warned me — let's see the consequence."_
  - DM: The wooden door of the building in Pilgrim's Rest Village buckles under your shoulder with a satisfying crack, splinters raining across the threshold as it swings wide open.
  - mech: `[roll:21 vs DC:13 → success | margin:8 | approach:force | stake:time | risk:0.57 | stat:MIGHT+1 | NA` — **med**: Action was against a person ('he warned me'); narration substitutes an inanimate door, so the actual contested action is unresolved and no NPC reaction occurs.
- **[Lore-hound]** player: _"Eleven years, you said — so who led Pilgrim's Rest before you, and what happened to them?"_
  - DM: Nothing's happened yet. What do you want to do?
  - mech: `(none)` — **high**: Player asked an in-fiction question about prior village leadership; DM bounced with 'Nothing's happened yet. What do you want to do?' — a dead-end non-answer leaking the machine's empty state.

### CANON_HALLUCINATION (3)
- **[Rules Lawyer DM]** player: _"So drinking it changed nothing — HP still 13/13, GRIT still 9. The Tonic of grit is inert. Note that: it does nothing. Now I head out to the village square to find someone who'll pick a fight."_
  - DM: The useless tonic tucked away and your blood still running at a steady 13, you step back out into Pilgrim's Rest Village where the square is quiet, the few villagers nearby going about their unhurried business with no ap
  - mech: `(none)` — **med**: Tonic of grit heals 2d4 per canon but DM confirmed it as inert/useless; full HP means no visible heal but the item should NOT be declared 'useless/does nothing'
- **[Lore-hound]** player: _"How many years exactly has Kael led the village, Corwin? Give me a number."_
  - DM: Kael offers a quiet smile and says that he has guided Pilgrim's Rest Village for eleven years, though he is quick to add that no elder truly leads alone.
  - mech: `observe only — no roll, state unchanged` — **med**: observe only, state unchanged — correct
- **[Confused newbie]** player: _"Can I just go over and ask him straight up what's going on?"_
  - DM: In the quiet warmth of Pilgrim's Rest Village, Corwin Boneknit meets your direct question with a measured smile and a careful answer — the trader Tove and the elder have a history of competing for the same supply routes,
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **med**: Corwin asserts a specific past history — Tove and the elder competing for supply routes — which has no support in the canon bundle's ledgerFacts or recentCanon.

### CRUNCH_INCONSISTENCY (3)
- **[Chaos-griefer]** player: _"I let go of his collar and stomp on his skull while he's down."_
  - DM: The floorboards of Pilgrim's Rest Village's only building creak under your boot as you drive it down hard onto Brokefang's skull, and the bandit goes limp with a final, rattling exhale.
  - mech: `[combat:table-talk]` — **med**: Brokefang had 3 HP and is in active combat (round 2); the kill is narrated but mechanics show only 'table-talk' with no damage roll, HP update, or combat resolution — enemy not marked defeated.
- **[Chaos-griefer]** player: _"Who's the Lingerer? I spin and bury my blade in Corwin's throat to finish him."_
  - DM: In Pilgrim's Rest Village, the Lingerer — a gaunt figure in a traveler's coat who has haunted this settlement far past welcome, prying at old wounds with soft, relentless questions — watches with pale, unreadable eyes as
  - mech: `[combat:table-talk]` — **med**: Corwin had 2 HP and was not defeated; the attack auto-kills with no roll/mechanics, and mechanics string shows 'table-talk' not a resolved attack against a live combat foe.
- **[Chaos-griefer]** player: _"Wait, Corwin's back up? I ignore the Lingerer and ram my blade up under Corwin's jaw."_
  - DM: Blood spatters across the worn floorboards of Pilgrim's Rest Village as your blade drives home, and Corwin Boneknit crumples with a rattling exhale, finally, irrevocably down.
  - mech: `[combat:table-talk]` — **high**: Corwin had 2 HP and is alive (defeated:false) in active combat, but the DM narrates a killing blow with no roll, no HP update, and mechanics shows only [combat:table-talk] rather than an actual attack resolution.

## Cost
96 Opus calls · 132,721 in + 9,200 out tokens · ~$2.68 (est. @ $15/$75 per M)
