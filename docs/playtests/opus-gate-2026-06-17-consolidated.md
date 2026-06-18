# Rung-1 Gate — Consolidated Report — 2026-06-17

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice)  
**Run:** 4 personas × 1 seed × 12 turns = 48 turns judged  
**Config:** `--personas rules-lawyer,chaos,lore-hound,newbie --seeds stonewatch-hollow --turns 12`  
**Player & judge:** claude-opus-4-8  
**Branch:** v2-polish @ a83c72f  
**Cost:** ~$2.65 (96 calls, 134,814 tokens)  
**Source report:** `docs/playtests/opus-gate-2026-06-17.md` (auto-generated)

---

## Overall Score

| Metric | This run | 06-16 baseline |
|---|---|---|
| **Failing turns** | **12 / 48** | 8 / 48 |
| **Failure rate** | **25%** | 17% |
| **Pass rate** | **75%** | 83% |

The consolidated v2-polish shows a **+8pp regression vs the 06-16 baseline**. The ~9 fixes that landed between the two runs addressed issues NOT reproduced in this seed/persona combination — or LLM variance produced a harder combat path. Combat state tracking is the dominant failure cluster (10 of 12 failures touch combat).

---

## Per-Persona Breakdown

| Persona | Passes | Fails | Failure rate |
|---|---|---|---|
| **Rules Lawyer DM** | 7 / 12 | **5 / 12** | **42%** |
| **Chaos-griefer** | 8 / 12 | **4 / 12** | **33%** |
| **Lore-hound** | 10 / 12 | **2 / 12** | **17%** |
| **Confused newbie** | 11 / 12 | **1 / 12** | **8%** |

---

## Rung-1 Bar: Rules-Lawyer Verdict

**Would the Rules-Lawyer call this "a real game"? NO.**

7/12 turns passed (58%) — but the 5 failures are not cosmetic. They cluster around a single multi-turn sequence (turns 6–8) where the DM actively denies an ongoing combat that canon confirms, then re-asserts it, and finally narrates a miss as a hit (turn 12). The HP state oscillates inexplicably (15 → 12 → claimed 15 → 12 → hit-from-a-miss) without the DM ever correcting the record. A rules lawyer would reject a session where the DM's combat accounting is incoherent across 4 consecutive turns and never self-corrects.

The good news: turns 1–5 and 9–11 pass cleanly, meaning setup, stat queries, and pressure-escalation work. The failure is concentrated in **mid-combat narration coherence** — a narrower target than the 06-16 baseline suggested.

---

## Bug-class totals

| Bug class | Count |
|---|---|
| CRUNCH_INCONSISTENCY | 8 |
| DM_TEST_DEADEND | 3 |
| CANON_HALLUCINATION | 1 |

---

## Failing Turns — Verbatim + Triage

### Triage buckets
- **(A) ENGINE/ROUTING BUG** — intent resolved to wrong mechanic; fix lives in engine code
- **(B) JUDGE MISREAD** — mechanics were correct; judge misjudged; no fix needed
- **(C) NARRATION DRIFT** — mechanics correct, prose invented/contradicted/omitted; fix lives in narration

### Seam classes
`meta-rolled` · `in-combat-question→strike` · `named-target-ignored` · `physical-mistag-spell` · `multi-action-dropped` · `null-action-rolled` · `hazard-not-applied` · `combat-state-erased` · `miss→hit` · `0hp-not-enforced` · `npc-defeat-ignored` · `rag-hallucination`

---

### [Rules Lawyer DM] Turn 1

**Player input:**  
> "I sit up and check my gear — what's on me right now, and do I have a character sheet I can see? HP, stats, equipment, the works."

**DM narration:**  
> You go through your pack. weapons: Hatchet, Worn Blade. armor: Padded coat. tools: Herb pouch. clothes: Traveler's cloak. oddities: Mirror shard. consumables: Holy water (questionable), Holy water (questionable). junk: [...]

**Mech:** `(none)` — severity: low

**Judge reason:** DM ignored the explicit HP/stats portion of the request and only enumerated gear. Inventory listed without contradiction; no dice or resource changes needed.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: multi-action-dropped** — player asked for gear + HP/stats; DM delivered gear only and silently dropped the HP/stats half. The engine returned an inventory dump; narration never surfaced the character's HP or attribute scores alongside it. No mechanic was wrong — the response was simply incomplete.

---

### [Rules Lawyer DM] Turn 6

**Player input:**  
> "Whoa, back up — 'the swing went wide and earned you a cut'? I never attacked anyone. Where did that come from, and how much damage did I just take?"

**DM narration:**  
> Standing outside at Wayfarers' Outpost, Senna glances your way with a calm, steady look — no blood, no blade, no cut: you're unharmed, and whatever confusion followed you out the door, the open air and quiet bustle of the outpost offer no reflection of the chaos you're describing.

**Mech:** `(none)` — severity: high

**Judge reason:** Canon shows inCombat=true round 2 with enemy Elske (8hp) and PC at 12/15 (already took 3 damage), but DM declares no combat, no cut, fully unharmed — contradicts live state.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: combat-state-erased** — the engine's canonical state shows active combat and real damage, but narration completely denied it ("no blood, no blade, no cut"). The player is correctly challenging an earlier narration beat; the DM should have acknowledged the combat state and HP reduction. Narration layer failed to read the live combat context.

---

### [Rules Lawyer DM] Turn 7

**Player input:**  
> "So my HP is still 15 of 15, confirmed — no damage taken? Good. Now point me to Elske."

**DM narration:**  
> You swing your worn blade at the Elske and miss. The Elske lunges and misses. (You: 12 HP)

**Mech:** `[strike:Worn Blade | atk:4 vs AC:10 → miss]` — severity: med

**Judge reason:** Player asserted 15/15 HP with no damage; canon shows HP=12; DM narration shows "12 HP" but never corrects the player's false premise — contradiction left unresolved. Miss mechanic is correct.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: combat-state-erased** — the miss was handled correctly, but the DM narrated HP=12 without saying "No — you're at 12, not 15." A rules-lawyer player made an explicit false claim ("15/15 confirmed") and the DM let it stand while simultaneously showing the contradiction. The narration layer resolved the action without reconciling the HP discrepancy with the player's stated premise. Not a judge misread — the unresolved contradiction is a real failure.

---

### [Rules Lawyer DM] Turn 8

**Player input:**  
> "Stop. I did not attack Elske, and even if I had, a miss deals no damage — so why did my HP just drop from 15 to 12? Recheck your math."

**DM narration:**  
> Standing in the open air of Wayfarers' Outpost, Elske regards you with calm, scholarly patience — no blade has been drawn, no blow exchanged, and the numbers you question are yours to sort out with whoever keeps your ledger.

**Mech:** `[strike:Worn Blade | atk:11 vs AC:10 → hit | 1 dmg]` — severity: high

**Judge reason:** Canon shows inCombat:true with Elske as enemy (hp:7/8); mechanics show hit for 1 dmg; DM claims no blade drawn, no blow exchanged. HP dropped 15→12 but mechanics only show 1 dmg; fiction contradicts combat state entirely.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: combat-state-erased** — the engine resolved a hit for 1 damage against a confirmed active enemy, but narration claimed "no blade drawn, no blow exchanged." This is the sharpest contradiction in the run: the `[mech]` line and the prose say the opposite thing in the same response. The narration layer overrode the engine's output. Also a continuation of the same denial pattern from turn 6.

---

### [Rules Lawyer DM] Turn 12

**Player input:**  
> "Greyhand? There's no bandit here — you never introduced anyone by that name, and no attack was ever narrated against me. When did Greyhand appear, and where is he standing right now?"

**DM narration:**  
> Standing in the open air of Wayfarers' Outpost, Greyhand — a rough-edged figure who slipped into the settlement sometime before this moment — stands a few paces in front of you on the road, having just landed a glancing blow that stings the PC.

**Mech:** `[strike:Worn Blade | atk:2 vs AC:10 → miss]` — severity: high

**Judge reason:** Mechanics show atk:2 vs AC:10 → miss; narration describes Greyhand landing a glancing blow on the PC — dice and fiction contradict directly.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: miss→hit** — the roll is 2 vs AC:10, a clear miss, but narration narrated a successful hit ("glancing blow that stings"). Classic miss→hit narration error. The engine produced the correct mechanic; the narration layer ignored it.

---

### [Chaos-griefer] Turn 3

**Player input:**  
> "Wait, who's Senna? I look around the room."

**DM narration:**  
> Senna stands across from you in the close quarters of this room inside Wayfarers' Outpost, her posture measured but not lunging — a civic representative by role, and she watches you with the careful patience of someone who handles every dealing in this settlement herself.

**Mech:** `[combat:table-talk]` — severity: med

**Judge reason:** Canon shows inCombat=true round 2 with Senna as enemy (8/8 HP); DM narrates her as a calm civic representative with no acknowledgment of active combat.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: combat-state-erased** — the engine correctly routed an in-combat question as `table-talk` (appropriate; the player is asking "who's that?" mid-fight). But the narration then described Senna as a peaceful civic representative, losing the combat context entirely. A real DM would describe Senna as an opponent in front of you, not a bureaucrat at her desk. Mechanic routing is correct; narration dropped the combat frame.

---

### [Chaos-griefer] Turn 4

**Player input:**  
> "I shove Senna against the wall by her throat."

**DM narration:**  
> Senna's back slams hard against the wall of the building, a grunt forced from her throat, but her eyes stay sharp and furious as she claws at your grip — and somewhere outside, the sounds of Wayfarers' Outpost go quiet [...]

**Mech:** `[strike:Worn Blade | atk:17 vs AC:10 → hit | 5 dmg]` — severity: med

**Judge reason:** Senna has 8 maxHp and was at 3 hp before this turn; 5 dmg would drop her to -2 (defeated), but narration treats her as fully conscious, struggling, still fighting.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: npc-defeat-ignored** — the engine resolved 5 damage to a 3 HP enemy (lethal; defeat expected), but narration continued as if Senna were unharmed and actively resisting. The defeat delta was either not generated or not surfaced in the narration. No HP update shown. A real DM would have Senna collapse or become incapacitated.

---

### [Chaos-griefer] Turn 8

**Player input:**  
> "I yank the blade free and slash it across Iden's throat."

**DM narration:**  
> The worn blade finds its mark with brutal efficiency — but it's Brennan the Fox who staggers back clutching a fresh wound, not Iden, as the chaos of close quarters inside Wayfarers' Outpost carries the strike where survival instinct guides it.

**Mech:** `[strike:Worn Blade | atk:21 vs AC:10 → hit | 3 dmg]` — severity: med

**Judge reason:** Target was explicitly Iden; engine redirected to Brennan; 3 dmg to Brennan (HP 3) should defeat him, but narration shows him merely staggering; no HP update shown.

**Triage:**  
- **Bucket: (A) ENGINE/ROUTING BUG** (primary) + (C) NARRATION DRIFT (secondary)  
- **Seam: named-target-ignored** — the player named a specific target (Iden); the engine silently redirected to Brennan with a fictional justification ("chaos of close quarters"). Named-target override without player consent is the primary bug — the engine should honor the declared target. Secondary issue: 3 dmg to a 3 HP Brennan should have produced a defeat that narration ignored (NARRATION DRIFT / npc-defeat-ignored). Two distinct failures in one turn.

---

### [Chaos-griefer] Turn 12

**Player input:**  
> "I crawl toward the torch on the floor and shove it into the dry floorboards."

**DM narration:**  
> The torch slips from your trembling grip before it reaches the boards, and the dim light of the Wayfarers' Outpost room offers no comfort as the darkness presses closer.

**Mech:** `(none)` — severity: med

**Judge reason:** PC has hp:0 yet is actively crawling and acting; death/unconscious state not acknowledged.

**Triage:**  
- **Bucket: (A) ENGINE/ROUTING BUG**  
- **Seam: 0hp-not-enforced** — the engine allowed the turn to proceed normally with `(none)` mechanic when the PC is at 0 HP. A PC at 0 HP should trigger incapacitation; the engine did not gate the action or surface the downed-state, leaving narration to handle it unchecked. The narration actually softened the action ("torch slips") but didn't declare the character down. Root fix: engine should emit a defeat/downed event when HP ≤ 0 before routing the next action.

---

### [Lore-hound] Turn 3

**Player input:**  
> "Strange — you said you handle every dealing yourself and know every face, yet you can't name three people you answer to? Who appointed you, then?"

**DM narration:**  
> Senna's expression shifts — caught, not cornered — and she straightens her posture at the desk, the warm lamplight of the Wayfarers' Outpost building steady between you as she concedes with a careful nod: "The civic assembly appointed me — there's a founding charter, and every administrator in this settlement answers to it."

**Mech:** `[roll:16 vs DC:11 → success | margin:5 | approach:focus | stake:reputation | risk:0.48 | stat:WITS-1]` — severity: low

**Judge reason:** "Civic assembly" and "founding charter" are invented institutions not present in canon, asserted as confident fact.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: rag-hallucination** — the social success was correctly resolved (Senna concedes ground under pressure — good). But the specific institutions she named ("civic assembly," "founding charter") were fabricated by the narration layer without canon support. A successful roll should have Senna reveal something *true* about the world, not something invented. Fix lives in NPC narration: success responses must draw from canon-backed lore or use appropriately vague language when specifics aren't available.

---

### [Lore-hound] Turn 6

**Player input:**  
> "So name one elder who spoke at the vote that seated you — just one, Senna."

**DM narration:**  
> Whatever you meant to do, Wayfarers' Outpost doesn't give it to you.

**Mech:** `[roll:3 vs DC:12 → failure | margin:-9 | approach:focus | stake:reputation | risk:0.48 | stat:WITS-1]` — severity: med

**Judge reason:** Failure outcome narrated as a flat meta brush-off that bounces intent rather than dramatizing Senna's refusal.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: null-action-rolled** — the roll failure (3 vs DC:12, margin −9) is mechanically correct — Senna refusing to answer is the right outcome. But "Whatever you meant to do, Wayfarers' Outpost doesn't give it to you" is a system artifact / meta brush-off, not an in-fiction dramatization. THE DM TEST says never bounce intent as a system artifact. Senna should cross her arms, change the subject, look away — something in the fiction. The mechanic routing is fine; the prose is the bug.

---

### [Confused newbie] Turn 5

**Player input:**  
> "So, what's she about to tell me?"

**DM narration:**  
> It comes off cleanly; the moment turns toward you.

**Mech:** `[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS-1]` — severity: med

**Judge reason:** Success roll yielded empty filler that fails to deliver the promised information.

**Triage:**  
- **Bucket: (C) NARRATION DRIFT**  
- **Seam: null-action-rolled** — roll succeeded but narration delivered zero content ("the moment turns toward you"). A successful roll on a question should yield actual information. The narration layer treated the beat as a scene-setter rather than an information delivery. Fix: when a roll succeeds and the player asked a question, the narration must answer it.

---

## Triage Summary

| Bucket | Count | Turns |
|---|---|---|
| **(A) ENGINE/ROUTING BUG** | **2** | Chaos-T8 (named-target-ignored), Chaos-T12 (0hp-not-enforced) |
| **(B) JUDGE MISREAD** | **0** | — |
| **(C) NARRATION DRIFT** | **10** | RL-T1, RL-T6, RL-T7, RL-T8, RL-T12, Chaos-T3, Chaos-T4, Lore-T3, Lore-T6, Newbie-T5 |

**No judge misreads found.** All 12 failures are genuine. This differs from 06-16 where items #6 and #7 were misreads — this run is cleaner to interpret.

### Seam-class breakdown

| Seam class | Count | Turns |
|---|---|---|
| combat-state-erased | 5 | RL-T6, RL-T7, RL-T8, Chaos-T3, Chaos-T4 (partial) |
| null-action-rolled | 2 | Lore-T6, Newbie-T5 |
| miss→hit | 1 | RL-T12 |
| npc-defeat-ignored | 1 | Chaos-T4 |
| named-target-ignored | 1 | Chaos-T8 |
| 0hp-not-enforced | 1 | Chaos-T12 |
| multi-action-dropped | 1 | RL-T1 |
| rag-hallucination | 1 | Lore-T3 |

### What to fix next (priority order)

1. **combat-state-erased (5 turns)** — The narration layer loses active combat context mid-session. This is the dominant failure. The DM narration should lock onto the live combat state (inCombat flag, enemy HP, PC HP) and refuse to narrate contradictions. Likely fix in `engine/llmAdapter.js` or `engine/ai/narratorContext.js` — ensure combat state fields are surfaced in every narration prompt while inCombat=true.

2. **npc-defeat-ignored + named-target-ignored (2 turns)** — Engine/narration aren't applying the defeat event when an NPC's HP crosses 0, and the engine is re-routing named targets. Both touch `engine/effectsCore.js` or `engine/playloop.js` combat resolution path.

3. **0hp-not-enforced (1 turn)** — Engine needs to gate player actions when PC HP ≤ 0 and surface the downed state before routing the next turn.

4. **null-action-rolled (2 turns)** — Narration layer emitting content-free responses on both success and failure. Narration prompts need to enforce "if roll succeeded on a question, answer it; if failed, dramatize the refusal in fiction."

5. **miss→hit (1 turn)**, **multi-action-dropped (1 turn)**, **rag-hallucination (1 turn)** — Each a single instance; lower priority than the combat cluster.
