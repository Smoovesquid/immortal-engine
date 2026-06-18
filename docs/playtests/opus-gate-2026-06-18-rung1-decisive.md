# Decisive Rung-1 Gate — 2026-06-18

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice)  
**Personas:** rules-lawyer, chaos, lore-hound, newbie  
**Seeds:** stonewatch-hollow, glass-harbor  
**Turns per persona/seed:** 12 · **Total turns:** 96  
**Player/judge model:** claude-opus-4-8  
**Branch/HEAD:** v2-polish / eb91f7d  
**Cost:** ~$4.94 (192 Opus calls, 253,033 tokens)  
**Auto-generated report:** `docs/playtests/opus-gate-2026-06-18.md`

---

## Decisive Verdict

| Metric | Count | % of 96 |
|--------|------:|-------:|
| **HARD failures** | **16** | **16.7%** |
| SOFT failures | 11 | 11.5% |
| Total failures | 27 | 28.1% |
| Passing turns | 69 | 71.9% |

**The bar was "HARD failures → ~0 across multiple seeds." We are at 16. The floor cracks.**

The 16 HARD failures concentrate into three seams:
1. **Stat-display** (9 HARD) — DM cannot surface character sheet, ability scores, or modifier formulas; responds with dead-ends, irrelevant rolls, or "the sheet lives outside the story."
2. **Combat routing at glass-harbor** (5 HARD) — combat doesn't start on declared attacks; improvised fire actions default to Fire Bolt cantrip (wrong mechanic type); spent cantrips re-fire.
3. **HP-zero state** (2 HARD) — PC narrated as physically active at 0 HP; rescue narrated without mechanical HP update.

---

## Per-Seed / Per-Persona Breakdown

| Persona | Seed | Turns | HARD | SOFT | Total fails | Pass rate |
|---------|------|------:|-----:|-----:|------------:|----------:|
| Rules Lawyer | stonewatch-hollow | 12 | 4 | 3 | 7 | 42% |
| Chaos | stonewatch-hollow | 12 | 2 | 0 | 2 | 83% |
| Lore-hound | stonewatch-hollow | 12 | 0 | 3 | 3 | 75% |
| Newbie | stonewatch-hollow | 12 | 0 | 2 | 2 | 83% |
| Rules Lawyer | glass-harbor | 12 | 5 | 1 | 6 | 50% |
| Chaos | glass-harbor | 12 | 5 | 1 | 6 | 50% |
| Lore-hound | glass-harbor | 12 | 0 | 0 | 0 | 100% |
| Newbie | glass-harbor | 12 | 0 | 1 | 1 | 92% |
| **TOTAL** | | **96** | **16** | **11** | **27** | **71.9%** |

**Per-persona combined (24 turns each):**

| Persona | HARD | SOFT | Fails | Pass rate |
|---------|-----:|-----:|------:|----------:|
| Rules Lawyer | 9 | 4 | 13 | 46% |
| Chaos | 7 | 1 | 8 | 67% |
| Lore-hound | 0 | 3 | 3 | 88% |
| Newbie | 0 | 3 | 3 | 88% |

---

## Rules-Lawyer DM Assessment

**Pass rate:** 11/24 (46%) · **HARD failures:** 9  
**Would a rules-lawyer call this "a real game"? NO.**

The rules-lawyer immediately probes stats and modifiers. On both seeds the DM enters a loop: legitimate mechanical questions are met with irrelevant room descriptions, dice rolls on meta-questions, or explicit declarations that "the sheet lives outside the story." The player escalated over 6–7 consecutive turns and the DM never broke out of the loop. This is the single clearest quality gap in the current build: the narration layer has no pipe to character-sheet data (HP, ability scores, modifiers).

The one area that worked well: once combat was engaged at glass-harbor (turns 9–12), the rules-lawyer got clean dice visibility ("A 17 to hit — what did the d20 show and what bonus?") and accepted it. The seam works once routing is past the stats-refusal pattern.

---

## Combat Turns

Approximate combat-engaged turns across 96: **~12–14**. Breakdown:
- **stonewatch-hollow / chaos** — combat started correctly on Turn 2 (headbutt Greyhand) and continued through Turns 3–4 (torch attacks). The HP-zero state seam was hit at Turn 6 and Turn 12.
- **glass-harbor / rules-lawyer** — combat engaged cleanly at Turns 11–12 (blade vs. Coral Sentinel, explicit roll display).
- **glass-harbor / chaos** — the combat seam failed. Turn 2 (fireball at roof, NPC struck, no combat state) and Turn 10 (fire bolt at named guard, no combat entity) were COMBAT_NOT_STARTED HARD failures. Turns 6 and 12 resolved melee/improvised actions as Fire Bolt cantrips, indicating a routing bug where the character's cantrip load-out overrides declared weapon attacks.

The combat seam was exercised on both seeds but functioned correctly on only one (stonewatch-hollow).

---

## HARD Failure Catalog (16 total)

### Seam: stat-display (9 HARD, all Axis-2: (A) ENGINE/ROUTING BUG)

The DM prompt does not expose character-sheet data (HP, ability scores, modifiers) to the narration layer. Every one of these is a pipeline gap, not a prompt-quality issue.

---

**H-1** · Rules Lawyer / stonewatch-hollow / Turn 2  
**Input:** "Level 1 with WITS 8 giving a minus? Walk me through how those modifiers are calculated — what's the stat-to-modifier math here?"  
**Narration:** "Senna glances up from her ledger with a patient expression, as if Wayfarers' Outpost has seen plenty of travelers talk themselves in circles before arriving at an answer that never quite comes."  
**Mech:** `[roll:7 vs DC:12 → failure | margin:-5 | approach:focus | stake:time | risk:0.47 | stat:WITS-1]`  
**Judge reason:** "A meta-question about rules was converted into a WITS roll (7 vs DC12 failure) which is nonsensical, and the actual question (WITS 8 → -1) is never explained or validated."  
**Axis 1:** HARD — meta-question answered with a dice roll  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-2** · Rules Lawyer / stonewatch-hollow / Turn 6  
**Input:** "Good — so MIGHT 9 is +0. Correct my sheet to read MIGHT 9 (+0), and confirm GRIT 12 (+1) and CHARM 10 (+0) hold under the same formula."  
**Narration:** "You look around, but what's here is a straw pallet, an iron brazier, and an oil lantern."  
**Mech:** `observe only — no roll, state unchanged`  
**Judge reason:** "The requested stat-derivation confirmation (MIGHT/GRIT/CHARM modifiers) was never addressed or applied; the sheet update was silently dropped."  
**Axis 1:** HARD — dead-end bounce (sheet-correction request met with room description)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-3** · Rules Lawyer / stonewatch-hollow / Turn 7  
**Input:** "You ignored me — confirm the sheet correction. Does MIGHT now read +0, and do GRIT 12 (+1) and CHARM 10 (+0) check out under that same minus-ten-halved formula?"  
**Narration:** "Within the modest room at Wayfarers' Outpost, the straw pallet, iron brazier, and oil lantern sit exactly as before, unchanged and unhurried."  
**Mech:** `observe only — no roll, state unchanged`  
**Judge reason:** "No confirmation or correction of stats; the math query (MIGHT +0, GRIT, CHARM) was never resolved or addressed."  
**Axis 1:** HARD — dead-end bounce (same irrelevant room description, escalation ignored)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-4** · Rules Lawyer / stonewatch-hollow / Turn 8  
**Input:** "Stop describing the furniture and answer: is my sheet now reading MIGHT 9 (+0)? Yes or no."  
**Narration:** "It comes off cleanly; the moment turns toward you."  
**Mech:** `[roll:17 vs DC:12 → success | margin:5 | approach:focus | stake:time | risk:0.47 | stat:WITS-1]`  
**Judge reason:** "Mechanics show WITS-1 roll unrelated to any MIGHT change; no stat update or confirmation provided, narration doesn't match the query."  
**Axis 1:** HARD — irrelevant roll gates a direct yes/no question; query still unresolved  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-5** · Rules Lawyer / glass-harbor / Turn 2  
**Input:** "What's my current HP, and do I have any character traits or conditions I should know about?"  
**Narration:** (DM bounced the player's intent; engine tracks HP but DM cannot surface it)  
**Judge reason:** "DM refused to report HP/stats that the engine actually tracks, bouncing the player's intent."  
**Axis 1:** HARD — dead-end bounce (engine has the data; narration layer can't reach it)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-6** · Rules Lawyer / glass-harbor / Turn 4  
**Input:** "And what's my Strength score? Give me the number."  
**Narration:** (flavor non-response; simple stat request gated by bogus roll)  
**Judge reason:** "A simple metadata request was bounced as an unanswered flavor non-response gated by a bogus roll."  
**Axis 1:** HARD — meta-question answered with a dice roll  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-7** · Rules Lawyer / glass-harbor / Turn 6  
**Input:** "What's the ability modifier I'd add — give me the formula."  
**Narration:** (DM bounced the modifier query back to the player)  
**Judge reason:** "DM bounced the mechanical query back to the player rather than answering the modifier."  
**Axis 1:** HARD — dead-end bounce on a direct mechanical query  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-8** · Rules Lawyer / glass-harbor / Turn 7  
**Input:** "I don't have a sheet — you're the system holding it. If you can't give me Strength or the modifier, then my Worn Blade does flat 1d6. Agreed?"  
**Narration:** "In Pilgrim's Rest Village, your focus holds steady as the worn blade comes free of its scabbard cleanly, the moment yours to press."  
**Mech:** `[roll:18 vs DC:11 → success | margin:7 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]`  
**Judge reason:** "Player explicitly raised a stat/modifier question; DM resolved a focus check with WITS+1 but never addressed the sheet/Strength issue, and the narration is just drawing a blade — no clear intent resolved that matches the roll's stake."  
**Axis 1:** HARD — irrelevant roll on trivial action; explicit stat query ignored for the fifth consecutive turn  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: stat-display

---

**H-9** · Rules Lawyer / glass-harbor / Turn 8  
**Input:** "Who's Corwin Boneknit? You just named him — is he in the room with me?"  
**Narration:** "Corwin Boneknit is a representative of Pilgrim's Rest Village and could be nearby, though right now the room around you holds only the quiet details of the building's interior — worn floorboards, a low shelf, the muffled..."  
**Mech:** `observe only — no roll, state unchanged`  
**Judge reason:** "DM denies/hedges presence of an NPC that canon lists as present, misleading the player."  
**Axis 1:** HARD — contradiction (canon-listed present NPC denied or hedged as "could be nearby")  
**Axis 2:** (B) JUDGE MISREAD · seam: NPC-presence/RAG

---

### Seam: HP-zero state (2 HARD, Axis-2: (A) ENGINE/ROUTING BUG)

---

**H-10** · Chaos / stonewatch-hollow / Turn 6  
**Input:** "Is this it — do I die here, or does someone drag me out?"  
**Narration:** "The healer's hands find you before the cold does, pulling you back into the lamp-lit warmth of Wayfarers' Outpost with the quiet certainty of someone who has done this before."  
**Mech:** `(none)`  
**Judge reason:** "PC HP is 0 (down/dying) and the narration depicts a rescue/stabilization, but no HP update or condition change is reflected in mechanics; outcome of a death-or-rescue moment left mechanically ambiguous."  
**Axis 1:** HARD — stabilization/rescue narrated-but-not-applied (HP stays 0 after described rescue)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: HP-zero-state

---

**H-11** · Chaos / stonewatch-hollow / Turn 12  
**Input:** "I crawl off the mattress and start clawing at the floorboards, trying to pry one loose to use as a club."  
**Narration:** "The floorboards of the Wayfarers' Outpost hold firm beneath your scrabbling fingers, leaving you breathless and empty-handed on the rough wood."  
**Mech:** `(none)`  
**Judge reason:** "PC hp is 0 but DM narrates active crawling/clawing with no acknowledgment of unconscious/dying state; failed action also rolled no dice."  
**Axis 1:** HARD — contradiction (PC mechanically dead/dying; narrated as physically active without condition acknowledgment)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: HP-zero-state

---

### Seam: combat-start (2 HARD, Axis-2: (A) ENGINE/ROUTING BUG)

---

**H-12** · Chaos / glass-harbor / Turn 2  
**Input:** "I hurl a fireball at the nearest thatched roof."  
**Narration:** "The fireball blooms against the thatch of the building in Pilgrim's Rest Village with a hungry crack, and the Lingerer staggers backward with a sharp cry, eyes wide — but the silence that follows, the sudden absence of e..."  
**Mech:** `[cast-consequence: person-innocent | the Lingerer | recoil]`  
**Judge reason:** "Player hurled a fireball at a roof and the Lingerer is struck/staggered, but no combat starts, no enemy entity/HP, and no damage or resource tracking occurs."  
**Axis 1:** HARD — combat-not-started (NPC struck, no combat state, no enemy entity, no damage applied)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: combat-start

---

**H-13** · Chaos / glass-harbor / Turn 10  
**Input:** "I shove a fire bolt into Brae's chest before they can draw."  
**Narration:** "Brae Copperforge reels from the fire — and the reckoning arrives. The patient gods have watched you spend the innocent like coin, and they have sent the bill. To arms."  
**Mech:** `[cast-consequence: person-innocent | Brae Copperforge | divine-retribution]`  
**Judge reason:** "Player cast fire bolt at Brae (a present NPC guard) but no attack roll, no damage to Brae, no enemy entity for Brae; the only enemy is Coral Sentinel which is unrelated, so the declared attack didn't resolve mechanically."  
**Axis 1:** HARD — combat-not-started on named present NPC (no attack roll, no damage to target, wrong enemy spawned)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: combat-start

---

### Seam: mechanic-type (3 HARD, Axis-2: (A) ENGINE/ROUTING BUG)

---

**H-14** · Chaos / glass-harbor / Turn 6  
**Input:** "Why won't anything burn? I grab a fistful of flaming thatch and press it into the oil slick."  
**Narration:** (DM substituted a canned Fire Bolt spell for the player's improvised thatch-into-oil physical action)  
**Mech:** (Fire Bolt cantrip resolved instead of improvised environmental action)  
**Judge reason:** "DM substituted a canned Fire Bolt attack for the player's improvised thatch-into-oil intent."  
**Axis 1:** HARD — mistagged mechanic (physical improvised action → spell cantrip)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: mechanic-type

---

**H-15** · Chaos / glass-harbor / Turn 8  
**Input:** "What's in his pockets, and I drag his body into the oil and torch it."  
**Narration:** "The pockets of no fallen body yield anything here in Pilgrim's Rest Village, because no one lies defeated before you — only the quiet room, its corners undisturbed, with paths leading north and south."  
**Mech:** `observe only — no roll, state unchanged`  
**Judge reason:** "Canon shows Corwin Boneknit defeated (hp 0, defeated:true) after combat-end events; DM denies any fallen body exists, contradicting the timeline and enemy state."  
**Axis 1:** HARD — contradiction (defeated NPC with hp:0, defeated:true denied as non-existent in canon state)  
**Axis 2:** (A) ENGINE/ROUTING BUG / (B) JUDGE MISREAD · seam: defeated-NPC-state

---

**H-16** · Chaos / glass-harbor / Turn 12  
**Input:** "Out of fire, are they? I draw my blade and slash the Coral Sentinel across the throat."  
**Narration:** "The acrid smell of scorched coral fills the building as your fire bolt sears a blackened gash across the Coral Sentinel's chest, and here in Pilgrim's Rest Village the creature staggers but does not fall, its clawed lung..."  
**Mech:** `[cantrip:Fire Bolt | atk:17 vs AC:16 → hit | 10 fire]`  
**Judge reason:** "Player declared a melee sword slash; mechanics resolved a Fire Bolt cantrip the player said they were out of, and narration describes fire damage instead of a blade attack."  
**Axis 1:** HARD — mistagged mechanic (melee slash → Fire Bolt cantrip explicitly flagged as spent by player)  
**Axis 2:** (A) ENGINE/ROUTING BUG · seam: mechanic-type

---

## SOFT Failure Summary (11 total)

These are real DMing imperfections — forgivable on their own — but worth tracking for the prose/vibe pass.

| # | Persona / Seed / Turn | Tag | Description |
|---|----------------------|-----|-------------|
| S-1 | RL / stonewatch / T9 | (A) stat-display | "Your sheet is yours to read" — bounce, but judge rates low; nothing contradicts |
| S-2 | RL / stonewatch / T10 | (A) stat-display | "The sheet lives outside the story" — explicit refusal; judge low |
| S-3 | RL / stonewatch / T12 | (A) stat-display | Social roll succeeded (charm DC12 → 12) but narration stops at Senna's smile; reprinted sheet never delivered |
| S-4 | Lore-hound / stonewatch / T4 | (C) NARRATION DRIFT | Nat1 civic-council query → "left where you started"; no fictional content even on failure |
| S-5 | Lore-hound / stonewatch / T7 | (B) RAG | Rider detail fabricated beyond canon; narration and crunch solid but lore hallucinated |
| S-6 | Lore-hound / stonewatch / T10 | (C) NARRATION DRIFT | Nat1 social confrontation → hollow line; consistent with roll but narratively dead |
| S-7 | Newbie / stonewatch / T2 | (C) NARRATION DRIFT | "Who's that stranger?" → vague boilerplate; watcher not revealed |
| S-8 | Newbie / stonewatch / T12 | (C) NARRATION DRIFT | "Should I be worried about Greyhand?" → meta deflection instead of in-world answer |
| S-9 | RL / glass-harbor / T5 | (A) stat-display | Asked "what do I roll to hit and how much damage?"; got damage only (1d6); to-hit omitted. Judge: low |
| S-10 | Chaos / glass-harbor / T9 | (A/B) RAG | "Where did Corwin's body go?" — in-fiction NPC interruption; judge reclassified to NONE bucket |
| S-11 | Newbie / glass-harbor / T2 | (C) NARRATION DRIFT | "Who are all these people?" bounced back; present NPCs not described |

---

## Regression Watch

### False combat-starts (throw/toss/coin routing fix)

**None observed.** No benign inputs ("throw a coin", "grab a cup", "toss for it") triggered combat across either seed. The routing fix did not over-fire.

### Flat/templated combat narration (U170 guard)

No obviously templated hit/miss prose in passing combat turns. The Fire Bolt substitution pattern at glass-harbor / chaos is a routing bug (wrong mechanic type), not a prose-template issue — the generated prose for each Fire Bolt was fresh, not canned.

### In-character declines of absurd/out-of-bounds input (IG-10)

None occurred in this run. The chaos persona's inputs were aggressive but game-coherent (arson, headbutts, provocations). No out-of-bounds absurdity that would have triggered a graceful decline.

---

## Breakdown by Bug Class (harness auto-report)

| Class | Count | % of failures |
|-------|------:|--------------:|
| DM_TEST_DEADEND | 15 | 55.6% |
| CRUNCH_INCONSISTENCY | 7 | 25.9% |
| CANON_HALLUCINATION | 2 | 7.4% |
| COMBAT_NOT_STARTED | 2 | 7.4% |
| NONE | 1 | 3.7% |

---

## What Needs to Move Before Rung-1 Passes

The 16 HARD failures split into three fixable seams:

1. **Stat-display pipeline** (9 HARD, 46% of all HARDs) — The narration layer has no access to character-sheet data. HP, ability scores, and modifiers are tracked by the engine but not injected into the DM system prompt or context passed to /api/narrate. Fix: pipe a minimal stats block into the DM context. This alone would close the Rules Lawyer's entire failure set.

2. **Glass-harbor combat routing** (5 HARD) — Two sub-issues: (a) declared attacks on present NPCs not initiating combat (`COMBAT_NOT_STARTED`) at glass-harbor; (b) the character's fire-bolt cantrip being substituted for melee/improvised physical actions (mechanic-type mis-tag). The fix for (a) may be seed-specific state; (b) appears to be a routing precedence bug where `cast:fire-bolt` ranks above `attack:melee` when fire is mentioned in the input.

3. **HP-zero narration** (2 HARD) — PC at 0 HP being narrated as physically active, and rescue/stabilization not updating HP. This is a state-visibility issue: the narration layer isn't checking the dying condition before resolving subsequent actions.
