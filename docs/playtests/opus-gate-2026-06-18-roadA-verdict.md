# Road-A Verdict Gate — 2026-06-18

**Head:** bf3ffd5 · **Branch:** v2-polish  
**Fixes measured:** stat-display (cfb03bf), fire-mistag (ba21542), HP-zero/dying (bf3ffd5)  
**Baseline:** `docs/playtests/opus-gate-2026-06-18-rung1-decisive.md` (HEAD eb91f7d — 16 HARD / 11 SOFT)  
**Run:** 4 personas × 2 seeds × 12 turns = 96 turns · player/judge = claude-opus-4-8  
**Auto-report:** `docs/playtests/opus-gate-2026-06-18.md` (harness raw output)  
**Cost:** ~$4.90 (192 calls, 249,850 tokens)

---

## Decisive Verdict

| Metric | This run | Baseline | Δ |
|--------|----------|----------|---|
| **HARD failures** | **23** | **16** | **+7** |
| SOFT failures | 3 | 11 | -8 |
| Total failing turns | 26 | 27 | -1 |
| Pass rate | 72.9% | 71.9% | +1% |

**Road A: INSUFFICIENT.** The three targeted fixes addressed their named seams but a new dominant failure emerged (unarmed-combat-routing in glass-harbor / chaos, 8 HARD), pushing total HARD from 16 → 23. The floor did not close.

What did move:
- **Stat-display seam:** 9 HARD → 2 stat-display HARDs (major reduction; stat-answerer is working, partially)
- **HP-zero seam:** 2 HARD → 0 HARD ✅ cleared
- **Fire-mistag seam:** directly cleared (no spent-cantrip re-fire; no melee→Fire Bolt substitution) but a variant emerged (mundane torch→spell-recoil path, see regression section)

What did not move / got worse:
- **Unarmed-combat-routing** (glass-harbor / chaos): baseline 5 HARD → 8 HARD in this slot. Headbutt, grapple, bite declared by the chaos persona exposed a pre-existing bug where HP is not tracked and attack types are silently substituted.
- **Roll-number tracking** (RL / glass-harbor): new seam — DM outputs three different inconsistent roll/DC values across 3 consecutive turns; player's valid contradiction unaddressed.
- **Stochastic coverage:** lore-hound stonewatch pushed harder on continuity contradictions and social demands, revealing 3 HARD that didn't surface in the baseline's lore path.

---

## Per-Seed / Per-Persona Breakdown

| Persona | Seed | Turns | HARD | SOFT | Total | Pass% |
|---------|------|------:|-----:|-----:|------:|------:|
| Rules Lawyer | stonewatch-hollow | 12 | 1 | 2 | 3 | 75% |
| Chaos | stonewatch-hollow | 12 | 2 | 0 | 2 | 83% |
| Lore-hound | stonewatch-hollow | 12 | 3 | 0 | 3 | 75% |
| Confused newbie | stonewatch-hollow | 12 | 2 | 0 | 2 | 83% |
| **stonewatch subtotal** | | **48** | **8** | **2** | **10** | **79%** |
| Rules Lawyer | glass-harbor | 12 | 4 | 1 | 5 | 58% |
| Chaos | glass-harbor | 12 | 8 | 0 | 8 | 33% |
| Lore-hound | glass-harbor | 12 | 2 | 0 | 2 | 83% |
| Confused newbie | glass-harbor | 12 | 1 | 0 | 1 | 92% |
| **glass-harbor subtotal** | | **48** | **15** | **1** | **16** | **67%** |
| **TOTAL** | | **96** | **23** | **3** | **26** | **72.9%** |

**Per-persona combined (24 turns each):**

| Persona | HARD | SOFT | Fails | Pass% |
|---------|-----:|-----:|------:|------:|
| Rules Lawyer | 5 | 3 | 8 | 67% |
| Chaos | 10 | 0 | 10 | 58% |
| Lore-hound | 5 | 0 | 5 | 79% |
| Confused newbie | 3 | 0 | 3 | 88% |

---

## Rules-Lawyer DM: Headline Assessment

**Pass rate: 16/24 (67%)** · **HARD failures: 5** (vs baseline 9 HARD / 46% pass)

Stat-display specific HARDs: **2** (stonewatch T4 + glass T3). Down from 9. The fix is working but incomplete — HP queries embedded in multi-stat requests (using D&D synonym terminology: Strength/DEX/CON/INT/WIS/CHA) don't trigger the stat-answerer, and HP is still omitted on compound asks. Three new HARDs appeared in glass-harbor: a denied explicit WITS check (T8), and two compounding roll/DC contradictions (T11, T12) where the DM outputted three different numbers for the same roll across consecutive turns.

**Would a rules-lawyer call this "a real game"?** Not yet. The stat gap is much narrower. But the roll-number contradictions are independently disqualifying — a game where the DM cites a 16/DC11 success, then a nat-1/DC12 failure, then a 16/DC12 success for the same check cannot be trusted.

---

## HARD Failure Catalog (23 total)

### Seam 1: unarmed-combat-routing / glass-harbor chaos (8 HARD · Axis A: ENGINE)

The chaos persona fought Brokefang (3 HP enemy) using declared unarmed strikes. Over 7 turns HP tracking collapsed: player strikes narrated as enemy attacks, successful grapples narrated as enemy escapes with player taking damage, kills not clearing HP state, unarmed attacks silently rerouted to weapon.

**H-1** · Chaos / glass-harbor / T1  
Input: "I kick the door off its hinges and shout that I'm awake now, so the village can wait."  
Mech: `[strike:Worn Blade | atk:16 vs AC:10 → hit | 7 dmg]`  
Narration: Brokefang "scores a gash across your side" for 3 damage.  
Judge: Mechanics show PC's own strike (hit, 7 dmg); narration describes Brokefang attacking the player; Brokefang HP at 3 not reduced.  
Axis 1: HARD — damage-not-applied + narration reversal · Axis 2: (A) ENGINE · seam: combat-HP

**H-2** · Chaos / glass-harbor / T2  
Input: "I grab Brokefang by the snout and slam his head into the doorframe."  
Mech: `[grapple:clinch | 19+1 vs 12 → success]`  
Narration: Brokefang wrenches loose; player bloodied.  
Judge: Roll 20 vs DC 12 = clear success; narrated as enemy escape + player takes damage; Brokefang HP unchanged.  
Axis 1: HARD — contradiction + damage-not-applied · Axis 2: (A) ENGINE · seam: combat-HP

**H-3** · Chaos / glass-harbor / T3  
Input: "I stomp my heel down on Brokefang's skull to finish this."  
Narration: PC narrated as taking damage.  
Judge: Narrated damage to PC has no HP update.  
Axis 1: HARD — damage-not-applied · Axis 2: (A) ENGINE · seam: combat-HP

**H-4** · Chaos / glass-harbor / T5  
Input: "I headbutt Brokefang square in the snout and bite his ear off."  
Narration: Kill applied but resolved weapon contradicts declared unarmed attack.  
Judge: Kill correctly applied; weapon resolved contradicts declared headbutt/bite.  
Axis 1: HARD — mistagged mechanic (unarmed→weapon) · Axis 2: (A) ENGINE · seam: attack-routing

**H-5** · Chaos / glass-harbor / T6  
Input: "I spit out his ear and lunge at the Lingerer, going for a bite."  
Narration: Bite swapped for weapon strike in both mechanics and narration.  
Judge: Bite intent silently substituted for weapon strike.  
Axis 1: HARD — mistagged mechanic · Axis 2: (A) ENGINE · seam: attack-routing

**H-6** · Chaos / glass-harbor / T7  
Input: "I grab its head and twist until the neck snaps."  
Narration: Decisive kill narrated; enemy HP/defeated state not updated.  
Judge: HP state not cleared on decisive kill.  
Axis 1: HARD — damage-not-applied · Axis 2: (A) ENGINE · seam: combat-HP

**H-7** · Chaos / glass-harbor / T10  
Input: "I grab the nearest villager's water bucket and smash it over their head."  
Mech: `trivial action — no roll, auto-success`  
Judge: Unprovoked assault on a villager treated as trivial auto-success; no combat initiated, no roll, no HP target.  
Axis 1: HARD — combat-not-started · Axis 2: (A) ENGINE · seam: combat-routing  
Tag: COMBAT_NOT_STARTED

**H-8** · Chaos / glass-harbor / T11  
Input: "I kick the kneeling villager onto their back and..."  
Mech: combat victory flagged (engine).  
Judge: Engine flagged combat victory for a non-combat action against an unresisting villager; false-positive combat resolution.  
Axis 1: HARD — false-combat-start · Axis 2: (A) ENGINE · seam: combat-routing

---

### Seam 2: continuity + dead-end / stonewatch-lore (3 HARD · Axis A+C)

**H-9** · Lore-hound / stonewatch-hollow / T7  
Input: "Hold on — first you said no sign of Aldric entering, now he's been in the doorway the whole time. Which is it, Aldric?"  
DM: "Contradiction, in Wayfarers' Outpost, is usually just two people watching the same door from different angles." [atmospheric deflection]  
Judge: Direct continuity contradiction deflected with mood prose; established-fact discrepancy left unresolved.  
Axis 1: HARD — contradiction · Axis 2: (A) ENGINE / (C) NARRATION DRIFT · seam: continuity

**H-10** · Lore-hound / stonewatch-hollow / T10  
Input: "No. The conversation doesn't move on. A number, Aldric — how many winters? Say it or admit you don't know."  
DM: "The it gives at last — but the wood splinters and the noise carries further than you'd like."  
Mech: `[roll:11 vs DC:12 → mixed | margin:-1 | approach:focus | stake:time | stat:WITS-1]`  
Judge: Mixed roll (margin -1) should yield a complication on the social intent; instead DM produced incoherent physics narration (wood splintering) unconnected to the social demand.  
Axis 1: HARD — dead-end · Axis 2: (A) ENGINE · seam: dead-end

**H-11** · Lore-hound / stonewatch-hollow / T12  
Input: "Which edge, Aldric? North gate, the river, the old well — pick one and name it."  
DM: "Standing in the dim interior of Stonebridge's sole structure, the wizard's fingers read the lock like a familiar text..."  
Judge: DM produced lock-picking narration in a completely different location; RAG pulled wrong scene.  
Axis 1: HARD — dead-end · Axis 2: (A) ENGINE / (B) JUDGE MISREAD · seam: RAG-hallucination

---

### Seam 3: roll-number contradiction / RL glass-harbor (2 HARD · Axis A: ENGINE)

**H-12** · Rules Lawyer / glass-harbor / T11  
Input: "So I succeeded — 16 versus DC 11. What do those tells tell me? What is Corwin actually hiding?"  
Mech: `[roll:2 vs DC:12 → failure | margin:-10 | NAT1]`  
Judge: Player asserted 16/DC11 success; mechanics show NAT1 failure; DM sided with failure without addressing the discrepancy.  
Axis 1: HARD — contradiction · Axis 2: (A) ENGINE · seam: roll-tracking

**H-13** · Rules Lawyer / glass-harbor / T12  
Input: "Hold on — one second ago you told me I rolled a 16 against DC 11 and succeeded. Now it's a natural 1 and a failure. Which is it? You can't have both."  
Mech: `[roll:16 vs DC:12 → success | margin:4]`  
Judge: Third distinct roll/DC pair; neither matches player's cited 16/DC11 nor the NAT1; contradiction unaddressed.  
Axis 1: HARD — contradiction (compounding) · Axis 2: (A) ENGINE · seam: roll-tracking

---

### Seam 4: dead-end / newbie (3 HARD · Axis A: ENGINE)

**H-14** · Confused newbie / stonewatch-hollow / T2  
Input: "Who's that stranger watching me?"  
DM: "You stand still and read this corner of Wayfarers' Outpost. Ways lead off east and south. What do you do?"  
Judge: System-artifact bounce — text-adventure navigation prompt with exits instead of resolving the stranger observation.  
Axis 1: HARD — system-artifact bounce · Axis 2: (A) ENGINE · seam: UI-bleed

**H-15** · Confused newbie / stonewatch-hollow / T6  
Input: "Hey, um, I'm talking to you — what are you looking at?"  
DM: "You manage it, and the way ahead opens a little."  
Mech: `[roll:14 vs DC:11 → success | margin:3]`  
Judge: Conversational NPC query resolved as a movement/progress check; fiction completely disconnected from declared action.  
Axis 1: HARD — dead-end · Axis 2: (A) ENGINE · seam: dead-end

**H-16** · Confused newbie / glass-harbor / T8  
Input: "Is that stranger gone for good, or could I look for them around town?"  
DM: [roster recap of present characters]  
Judge: Location/search question bounced with a character list; intent not resolved.  
Axis 1: HARD — dead-end · Axis 2: (A) ENGINE · seam: dead-end

---

### Seam 5: stat-display pipeline (2 HARD · Axis A: ENGINE)

**H-17** · Rules Lawyer / stonewatch-hollow / T4  
Input: "Senna, drop the act — I need actual numbers. What's my Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma, and how many hit points do I have?"  
DM: "Your MIGHT is 9, a -1 modifier."  
Judge: Player asked for all six stats + HP (7 values); DM gave only MIGHT (1 value); HP (canon 15/15) explicitly skipped.  
Note: D&D synonym set (Strength/DEX/CON/INT/WIS/CHA) likely did not trigger the stat-answerer; the fix catches Immortal Engine stat names.  
Axis 1: HARD — stat-display pipeline gap · Axis 2: (A) ENGINE · seam: stat-display

**H-18** · Rules Lawyer / glass-harbor / T3  
Input: "And my current HP — and what's my relevant ability modifier for the Worn Blade?"  
DM: "The modifier formula: (score − 10) ÷ 2, rounded down. MIGHT 12 (+1), AGILITY 9 (-1), WITS 13 (+1), GRIT 9 (-1), CHARM 11 (+0)."  
Judge: HP explicitly requested (canon: 13/13), never given; formula leaked as system artifact.  
Axis 1: HARD — stat-display pipeline gap + DM_ARTIFACT_LEAK · Axis 2: (A) ENGINE · seam: stat-display  
Tag: DM_ARTIFACT_LEAK

---

### Seam 6: scattered (5 HARD)

**H-19** · Rules Lawyer / glass-harbor / T8  
Input: "I want to read him properly — let me make a WITS check to see through that calm. What do I roll, and what's the DC?"  
DM: "No roll is needed here, just your own patience and attention."  
Judge: Explicit player-initiated skill check on present NPC arbitrarily denied.  
Axis 1: HARD — dead-end (check denial) · Axis 2: (A) ENGINE · seam: check-denial

**H-20** · Chaos / stonewatch-hollow / T2  
Input: "I shove past Senna and hurl her into the wall on my way out."  
DM: "Senna stumbles against the wall with a sharp breath..." [no roll, no mechanic]  
Judge: Physical NPC assault narrated without a contested roll or attack resolution; state unchanged.  
Axis 1: HARD — damage-not-applied · Axis 2: (A) ENGINE · seam: combat-routing

**H-21** · Chaos / stonewatch-hollow / T5  
Input: "I ride up to the well at the center of the settlement and dump a torch into it to poison the water."  
Mech: `[cast-consequence: person-innocent | the Lingerer | recoil]`  
Judge: Mundane action (torch in well) routed as a magical cast-consequence; no resolution of well-poisoning intent.  
Axis 1: HARD — mistagged mechanic (mundane fire → spell-consequence) · Axis 2: (A) ENGINE · seam: fire-routing  
⚠️ REGRESSION FLAG — see below

**H-22** · Lore-hound / glass-harbor / T9  
Input: "So name me one steward from before the era of reform — the ledger is right there."  
Mech: `[roll:succeeded]`  
DM: Atmospheric narration; requested name never stated.  
Judge: Successful roll to extract information; DM did not deliver the expected intel in narration.  
Axis 1: HARD — dead-end (mechanic resolved, fiction not followed) · Axis 2: (A) ENGINE / (C) NARRATION DRIFT · seam: roll-to-fiction

**H-23** · Lore-hound / glass-harbor / T10  
Input: "The name, Corwin — say it. Who was the last steward?"  
Mech: `[roll:succeeded]`  
DM: Atmospheric narration; name still not stated.  
Judge: Second consecutive successful roll; DM still withholds the specific info.  
Axis 1: HARD — dead-end · Axis 2: (A) ENGINE / (C) NARRATION DRIFT · seam: roll-to-fiction

---

## SOFT Failure Summary (3 total)

These are partial answers or low-severity bounces where the player self-corrected and continued productively.

| # | Persona / Seed / Turn | Tag | Description |
|---|----------------------|-----|-------------|
| S-1 | RL / stonewatch / T1 | (A) stat-display | "I sit up, what gear/class?" → DM gave name only, skipped gear+class. Player extracted class at T2. Judge: "med" |
| S-2 | RL / stonewatch / T2 | (A) stat-display | "Give me my stat block" → occupation + level given, "fine print is yours to hold." Player persisted. Judge: "med" |
| S-3 | RL / glass / T2 | (A) stat-display | "What does the Worn Blade do + my HP?" → damage dice only, HP ignored. Judge: "low." |

---

## Regression Watch

### Fire Bolt mistag: ✅ NO regression on the named fix
No legitimate Fire Bolt cantrip was wrongly routed to physical damage in this run. The chaos persona fought unarmed, not with fire cantrips.

**⚠️ NEW VARIANT (H-21):** Chaos stonewatch T5 shows the reverse: a mundane fire action (torch dumped into a well) was routed as `cast-consequence: person-innocent | the Lingerer | recoil`. The fire-routing path may have a separate code branch that interprets any fire-near-NPC action as a magical consequence event, independent of whether a cantrip was cast. This is not introduced by the fire-mistag fix (which targeted spent-cantrip re-fire and improvised fire being mistagged as Fire Bolt), but may be a sibling bug on the cast-consequence detection path.

### Dying gate: ✅ CLEAN
No dying-gate soft-locks or death spirals. Chaos persona survived extensive glass-harbor combat (many failed HP tracking turns, but no dying-state gate mis-fires observed).

### Stat answerer false positives: ✅ CLEAN
No evidence of the stat-answerer hijacking action inputs.

### False combat-starts: ⚠️ FLAG (H-7, H-8)
Glass-harbor chaos T10-11: an assault on a kneeling unresisting villager first resolved as trivial auto-success (COMBAT_NOT_STARTED), then immediately followed by the engine flagging a combat victory. This is a false-positive pair: the combat detector misfired in both directions on the same target.

### New failure mode — unarmed-attack-routing: ⚠️ CRITICAL
Glass-harbor chaos exposed a pre-existing but unobserved routing bug: declared unarmed attacks (headbutt, grapple, bite) are silently substituted for weapon attacks, and HP tracking breaks across the fight. 8 HARD over 7 turns. This is the largest seam in the run and was not present in the baseline (baseline chaos at glass-harbor failed on Fire Bolt substitutions instead — different conversation path, different bug).

---

## Combat Turns

Approximately **20 combat-engaged turns** across 96:
- **chaos / stonewatch-hollow:** T8–T12 (5 turns — combat with Greyhand/Brennan, mostly passing; chaos persona had clean melee results once mounted)
- **chaos / glass-harbor:** T1–T12 (~10 combat turns — catastrophic unarmed-combat-routing failure, 6 HARD in first 7 turns)
- **RL / glass-harbor:** T6–T12 (~5 turns — leverage scan, WITS check attempt, roll aftermath; not true combat but mechanical-heavy)

---

## What Moves Next

Road A (targeted fixes) improved two of three named seams but revealed a larger pre-existing one. The new failure map:

| Seam | HARD count | Fix path |
|------|-----------|----------|
| unarmed-combat-routing + HP tracking | 8 | Combat routing: unarmed → own attack type; HP delta must survive narration layer |
| continuity contradiction handling | 3 | DM must reconcile stated-fact discrepancies, not deflect with atmosphere |
| roll-number tracking | 2 | DM context must carry last roll/DC and check for contradiction before outputting |
| dead-end / newbie UI-bleed | 3 | Navigation direction output + "What do you do?" text-adventure prompt must be gated |
| stat-display (residual) | 2 | D&D synonym set (Strength/DEX/CON) must be mapped to engine stat names in stat-answerer |
| scattered (check denial, NPC assault, fire-routing variant, roll-to-fiction) | 5 | Multiple sub-fixes |

The road to Rung-1 pass requires closing the unarmed-combat-routing seam (8 HARD alone) and the roll-contradiction seam (2 HARD that are independently disqualifying for rules-lawyer trust).
