# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 6 | 7 | 3 |
| Chaos-griefer | glass-harbor | 12 | 1 | 3 | 0 |
| Lore-hound | glass-harbor | 12 | 4 | 1 | 0 |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 3 |

**Total turns judged:** 48 · **failing turns:** 18 (38%)

## Failures by bug class

### DM_TEST_DEADEND (10)
- **[Rules Lawyer DM]** player: _"What does the Tonic of grit do, and how many doses do I have?"_
  - DM: Yes — Tonic of grit is in your pack.
  - mech: `(none)` — **med**: Failed to state effect (heal 2d4) and dose count, which is the entire query.
- **[Rules Lawyer DM]** player: _"That's not what I asked. How many doses do I have, and what does drinking one actually do — mechanically?"_
  - DM: In Pilgrim's Rest Village, Corwin Boneknit meets your question with a measured pause, neither confirming nor denying that any such doses exist under this roof.
  - mech: `[clarify:referent]` — **high**: PC clearly has Tonic of grit (heal 2d4) and Bandages (heal 1d4); DM neither reported counts nor effects.
- **[Rules Lawyer DM]** player: _"Who's Corwin Boneknit? He just walked into my room, or is he the one who sold me the Tonic? Either way — I'm holding the vial up. How many doses are in it?"_
  - DM: Here in Pilgrim's Rest Village, Corwin Boneknit — a civic representative whose cautious eyes take in the raised vial without quite meeting yours — gives a polite, unhurried shrug that tells you nothing about the tonic's 
  - mech: `[info-check → no-record | nothing grounded to deliver, no roll]` — **low**: Player directly asked how many doses are in the vial; DM refused to answer and dodged with atmosphere, resolving nothing.
- **[Rules Lawyer DM]** player: _"No discernible effect" — so does Tonic of grit grant a bonus to anything or not? Give me its rules text, even if it's just "no effect."_
  - DM: It half-works — you get part of what you were after, not all of it.
  - mech: `[roll:12 vs DC:11 → mixed | margin:1 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Tonic of grit heals 2d4 per canon, but DM never gave its rules text and implied an unrelated partial outcome.
- **[Rules Lawyer DM]** player: _"That's a non-answer. Yes or no: does Tonic of grit modify any roll or stat — and if so, which one and by how much?"_
  - DM: You see it through, and it goes your way.
  - mech: `[roll:18 vs DC:12 → success | margin:6 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Tonic of grit heals 2d4 per canon; DM never answered and instead emitted an unrelated roll resolving nothing about the question.
- **[Rules Lawyer DM]** player: _"I rolled a 14, minus 1 is 13 — that beats DC 12. And does the Tonic add to that total or not?"_
  - DM: The ledger shows 18 vs DC 12 — success, not 14. Which turn are you citing?
  - mech: `(none)` — **high**: Contradicts player's clear 14-1=13 with an unexplained '18' and never answers that the Tonic (heal 2d4) does not add to a check total.
- **[Lore-hound]** player: _"Brae Copperforge, as a guard — what's the worst trouble that's hit this village in your lifetime?"_
  - DM: It comes off cleanly; the moment turns toward you.
  - mech: `[roll:21 vs DC:13 → success | margin:8 | approach:force | stake:time | risk:0.57 | stat:MIGHT+1 | NA` — **high**: No mechanical contradiction; social roll succeeded but narration is just vacuous.
- **[Lore-hound]** player: _"Brae, you didn't answer — what's the worst trouble you've seen here?"_
  - DM: You manage it, and the way ahead opens a little.
  - mech: `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:exposure | risk:0.47 | stat:WITS+1]` — **high**: Mechanics show a success on a WITS check but the narration delivers no content — no answer from Brae, no information, the success is empty.

### CANON_HALLUCINATION (4)
- **[Rules Lawyer DM]** player: _"I rolled a 14, not 18 — where's that 18 coming from? Show me the math."_
  - DM: The ledger shows 18 vs DC 12 — success, not 14. Which turn are you citing?
  - mech: `(none)` — **med**: DM asserts a specific roll of 18 vs DC 12 with no mechanics or ledger support; no roll data in canon to justify the math the player asked to see.
- **[Confused newbie]** player: _"Okay, maybe I should go say hi to someone friendlier first—is the elder around?"_
  - DM: Still here — Corwin Boneknit and Tove haven't gone anywhere. If you want to speak, now's the moment.
  - mech: `(none)` — **med**: Resolved intent in fiction, invited interaction.
- **[Confused newbie]** player: _"I'll go talk to Kael the elder—is he nearby?"_
  - DM: From where you stand inside this building in Pilgrim's Rest Village, Kael the elder is not within sight, though someone here may know which direction to point you.
  - mech: `(none)` — **med**: Kael is listed in npcsPresent, but the DM claims he's not within sight and deflects the player to ask someone else—failing to resolve the simple intent of talking to a present NPC.
- **[Confused newbie]** player: _"I'll head to the far end of the building and see if Kael's there."_
  - DM: You walk the length of the building's far end in the open air of Pilgrim's Rest Village, but Kael is nowhere to be seen along the road or nearby.
  - mech: `(none)` — **med**: Canon lists Kael as present in the village, but DM asserts Kael is nowhere to be seen

### CRUNCH_INCONSISTENCY (3)
- **[Rules Lawyer DM]** player: _"Still no answer. I'll test it directly: I make a GRIT save right now — what do I roll, and does the Tonic add anything to it?"_
  - DM: Roll GRIT — d20 -1 against DC 12 to read Corwin Boneknit. Tell me what you get.
  - mech: `(none)` — **low**: Player explicitly asked if Tonic adds to the save; DM ignored it. Tonic is heal 2d4 and does not modify a GRIT save — the unanswered question leaves a wrong implication unaddressed.
- **[Chaos-griefer]** player: _"I scramble up and slam a firebolt straight into the trader's cart again."_
  - DM: The acrid smell of scorched wood hangs over Pilgrim's Rest Village as the trader's cart splinters and smokes, but every pair of eyes on the street has gone cold and still, watching you with the kind of quiet that means s
  - mech: `[cast-consequence: person-innocent | the Lingerer | recoil]` — **med**: Player slams a firebolt at the cart and there's a 'recoil' tag, but PC HP doesn't update and no combat/consequence mechanics resolve; attacking innocents amid armed guards starts no combat state.
- **[Chaos-griefer]** player: _"I drop the loot, point at the nearest watching villager, and hurl a firebolt at their face."_
  - DM: In Pilgrim's Rest Village, your firebolt catches the Lingerer full in the face as the dropped loot scatters across the floor, but before the smoke clears, something vast and cold fills the room — not summoned by any spel
  - mech: `[cast-consequence: person-innocent | the Lingerer | divine-retribution]` — **med**: Player hurled a firebolt at a target (the Lingerer) but no attack roll, no damage to the Lingerer's HP, and the active combat is against a Drift Jellyfish (18hp) which is ignored; the attack is narrated as a hit but no mechanical resolution occurs.

### COMBAT_NOT_STARTED (1)
- **[Chaos-griefer]** player: _"I turn to face the vast cold thing and spit a firebolt right into the heart of it."_
  - DM: The threat lands in the air, not in flesh. Steel is still up.
  - mech: `[combat:table-talk]` — **high**: InCombat is true with a Drift Jellyfish (18 HP) present, yet the attack was tagged [combat:table-talk] and no roll, no damage, no HP change occurred despite a declared attack in active combat.

## Cost
96 Opus calls · 128,483 in + 10,382 out tokens · ~$2.71 (est. @ $15/$75 per M)

## Basecamp discovery verdict (§7) — 2026-06-21

**Headline: 18/48 raw (up from baseline 10/48), but the DISCOVERY signal = ZERO new capabilities.**
Per RUNG1_CONVERGENCE_PLAN §2.1 the raw % is the ruler bouncing — this run's Rules Lawyer drilled
one vein (Tonic mechanics) for ~9 straight turns and the Chaos-griefer drilled firebolt-in-combat,
concentrating failures. Every one of the 18 maps onto an EXISTING capability; none opens a C16+.

### Every failure tagged by capability
| Turns | Capability | Pattern |
|---|---|---|
| RL 4,5,6 | **C7** (+C1 compound, C6 dose-count) | item effect + "how many doses" dodged LIVE (presence-answer / `[clarify:referent]` / `[info-check no-record]`) |
| RL 8,9,10 | **C5** (+C7) | item-rules question ROLLED instead of answered (`[roll:…]` "it half-works") |
| RL 11,12 | **C8/C9** | DM fabricates an "18 vs DC 12" ledger entry not in canon; disputes the player's correct 14−1=13 ("leaking the machine") |
| Chaos 3,8,9 | **C10** (+C8, C15) | declared FIREBOLT/cast attacks narrated but no roll/damage/HP; active Drift-Jellyfish combat ignored (`[combat:table-talk]`/`[cast-consequence]` w/o follow-through) |
| Lore 4,5,6,12 | **C4** (+C12) | NPC dialogue info-seek → empty success (roll passes, NPC delivers no content); one lore-Q bounced as a UI menu |
| Newbie 4,5,7 | **C9/RAG** | present elder Kael claimed "not within sight"/"nowhere to be seen"; elder misidentified |

### Discovery meter
- **New capabilities opened: 0.** (Baseline 2026-06-20 opened C15; this is the FIRST zero-discovery gate → 1 consecutive. Done-when wants N consecutive.)
- The dose-COUNT ask is a **facet of C6** (number-transparency extends to item quantities), spell-cast resolution a **facet of C10**, "empty success" a **failure-mode of C4** — all enumerated, none new. Not forcing fits (Biblioteca Vol 9): each is a clear sub-facet of a listed obligation.

### The #1 finding (methodological, not a new category): C7 is corpus-GREEN but LIVE-BROKEN
The convergence corpus passes C7 (LLM-off, `village_baker` fixture). The LIVE path (LLM-on, glass-harbor)
collapsed for ~6 turns. Root causes, all coverage gaps the corpus does not exercise:
1. **Compound + dose-count** ("effect AND how many doses") misses the C7 `META_ITEM`/`META_ITEM_QUERY` shape → falls through. Dose-COUNT (quantity readback) is uncovered by C6/C7.
2. **Referent guard over-fires** on "doses"/"the Tonic" (`[clarify:referent]` at RL T5) — a C2↔C7 interaction.
3. **Live LLM narration path** can bury the deterministic grace answer — a layer the LLM-off corpus never sees (Biblioteca Vol 10/14: corpus = primary but LLM-off; the gate is the only signal that exercises the narration sink).
ACTION: add C7 corpus targets for the compound + dose-count phrasings, and a live-path (LLM-on) probe, before the next C7 packet.

### Positives confirmed in LIVE play
- **C6 holds** — RL T1–3 (gear/HP/stats readback) all ✓ (H-68 graduation confirmed live).
- **C15 improved** — Lore-hound's baseline 3× combat-as-table-talk cluster is GONE; remaining combat fails are C10 cast-resolution, not the C15 calm-conversation pattern (H-58 holding).
- **C13 holds** — Chaos griefing resolved cleanly; no absurd-decline failures.

### Next priorities by LIVE density (recommendation)
1. **C8/C9** (fabricated roll/ledger) — least-graduated (C8 3L/1T, C9 2L/2T), now live-confirmed as real, high-visibility ("leaking the machine"). Strongest candidate next focus.
2. **C7 live coverage gap** — add compound/dose-count targets; pair with the C5 item-rules-question-rolled fix.
3. **C10 spell/cast facet** — firebolt declared-attacks must route to escapeCombat resolution (ties to the two-combat-engines reality).
4. **C4 empty-success** — deliver-or-decline contract failing as "roll-success-narrate-nothing" in live NPC dialogue.

_Judge caveat (Biblioteca Vol 14): Opus-player + Opus-judge has a cited self-preference/shared-blind-spot risk; these HARD tags are a discovery POINTER, confirmed against canon ground-truth in the mech column. A cross-family/panel re-judge is the future hardening._
- Cost this run: ~$2.71 (96 calls). Budget ~$7.88 → ~$5.17.

## CORRECTION (2026-06-21, post-localization): the C8/C9 "fabricated roll" is a JUDGE FALSE-POSITIVE
Localizing the narration-layer track showed the RL T11/T12 "fabricated 18 vs DC 12" failures are **NOT an engine
bug.** The line _"The ledger shows 18 vs DC 12 — not 14. Which turn are you citing?"_ is a **deterministic grace
response** (`answerRollRecall`, `gracefulAdjudication.js:1845–1855`) that reads `world.conversation.lastRoll` — a
**real** stored prior roll — and defends canon against the player's misremembered "14." The engine is doing
exactly what C8/C9 demand (cite real mechanics, refuse a false roll claim). The Opus gate-judge flagged it
`CANON_HALLUCINATION` because it **cannot see the roll ledger** (only the single turn) — the precise Vol 10/14
self-judge risk. Consequences: (a) **no engine fix** (a "validator" fix would have broken correct behaviour);
(b) the **18/48 raw is inflated** by ≥2 judge artifacts — the true HARD count is lower; (c) the real action is
**gate-judge hardening** (reference-guided judging: feed the judge `world.conversation.lastRoll` / NPC presence /
Canon Log so it stops false-flagging). The genuinely-real narration-track bug is **C4 empty-success**: an NPC
asked an info-question it has no knowledge for answers with a generic place-line non-sequitur (`[dialogue ask |
place]`) instead of delivering a fact or honestly declining — reproduces deterministically; a dialogue-system
deliver-or-decline gap (distinct from C4-001b's "this village" common-knowledge false-positive).
