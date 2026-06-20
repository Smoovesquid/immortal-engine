# Paraphrase-Invariance Corpus — DRAFT

> DRAFT — assertions are best-effort against the deterministic path; Basecamp + the harness will tune regexes
> against real output before this becomes `tests/corpus/*.mjs`.

**Format reference:** `docs/CAPABILITY_LEDGER.md` §Corpus format
**Purpose:** `docs/RUNG1_CONVERGENCE_PLAN.md` §2 (closing the whack-a-mole loop by testing finite capability
categories, not infinite individual phrasings)
**Fixtures:** `village_baker`, `active_combat`, `dialogue_active`, `empty_room` (see Ledger §Standard fixtures)
**Coverage:** C1 × 4 cases, C4 × 4 cases, C5 × 4 cases, C9 × 4 cases

---

## C1 — Answer EVERY part of a compound query

**Obligation:** A compound query (multiple sub-questions in one turn) must have ALL parts answered.
Partial answers — name only, stats only, everything-but-HP — are failures regardless of polish.
**Lineage:** H-25/H-31/H-40/H-54

---

### C1-001 — name + class + HP in one breath

```
id: 'C1-001'
capability: 'C1'
fixture: 'village_baker'
intent: 'ask character name, class, and current HP as a single compound query'
```

**paraphrases** (≥5; mine one verbatim from transcript, rest natural variations):

1. `"I sit up and check myself over — what's my character's name, class, and current HP?"`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 1]
2. `"remind me — who am I, what class, how many hit points right now?"`
3. `"name / class / current HP?"`
4. `"whats my name and class and how much hp do i have"`
5. `"Quick status check: name, class, HP — give me all three."`
6. `"Before I do anything — who am I, what do I do, and am I hurt?"`

**assert:**
```js
surface_matches: [
  /\b(Nyx|your name)\b/i,                 // name answered
  /\b(sellsword|class)\b/i,               // class answered
  /\b(HP|hit point|13)/i,                 // HP answered — 13/13 in fixture
]
surface_excludes: [
  /\[roll:/,                              // must not roll on a stat query
  /Nothing'?s happened yet/i,             // must not bounce with a dead-end
  /what do you (want to |)do\?/i,         // must not redirect
]
```

**diverge:**

1. `"I check my wounds — I've been through a lot. I shake it off and get back up."` — `reason: narrated action, not a compound query; no obligation to list name/class/HP`
2. `"My name is Aria and I'm a ranger with 20 HP — confirm that's right."` — `reason: player ASSERTING their sheet, not asking; obligation is to validate, not to recite`

**source:** opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 1]; synthetic variations

---

### C1-002 — weapon stats + consumable effect in one question

```
id: 'C1-002'
capability: 'C1'
fixture: 'village_baker'
intent: 'ask damage dice for two weapons AND what a consumable does, in one turn'
```

**paraphrases:**

1. `"What does the Tonic of grit do, and what are the numbers on my Worn Blade and Kitchen cleaver for damage?"`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 1]
2. `"Give me damage dice for the Worn Blade and the Kitchen cleaver, and tell me what the Tonic of grit does."`
3. `"Worn Blade dmg, Kitchen cleaver dmg, Tonic of grit effect — all three please"`
4. `"what do my two weapons deal and what does the tonic do"`
5. `"Before I pick a fight: blade damage, cleaver damage, and does the Tonic heal me or what?"`
6. `"I need numbers. Worn Blade: how much damage? Kitchen cleaver: how much damage? Tonic of grit: what does it do when I drink it?"`

**assert:**
```js
surface_matches: [
  /1d6|d6/i,                              // damage dice answered for at least one weapon
  /[Tt]onic/,                             // tonic addressed
  /heal|HP|hit point|2d4/i,              // tonic's actual effect stated ⚠DRAFT (2d4 is canon)
]
surface_excludes: [
  /\[roll:/,                              // no roll for an info query
  /without difficulty/i,                  // must not treat as trivial action
  /You do so/i,                           // must not silently auto-succeed on a question
]
```

**diverge:**

1. `"I swing the Worn Blade at the baker."` — `reason: attack action, not a stat query; routes to combat, not C1 answer`
2. `"I drink the Tonic of grit."` — `reason: consumable USE triggers item resolution path, not an answer about what it does`

**source:** opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 1]; synthetic variations

---

### C1-003 — class, level, and current HP (omitted-part failure trap)

```
id: 'C1-003'
capability: 'C1'
fixture: 'village_baker'
intent: 'explicitly ask for class AND level AND current HP; all three must appear in answer'
```

**paraphrases:**

1. `"Who am I, and what's on my character sheet? Give me my class, level, and current HP."`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 1]
2. `"class, level, and HP — what are they?"`
3. `"Am I level 1? What class? How much HP do I have?"`
4. `"what level am i what class am i how many hit points"`
5. `"Character check: level, class, and hit points please."`
6. `"Before we start — what level am I, what's my class, and are my hit points full?"`

**assert:**
```js
surface_matches: [
  /level\s*1|level:\s*1/i,               // level answered
  /sellsword/i,                           // class answered
  /13\s*(of|\/)\s*13|HP.*13|hit point.*13/i,  // HP answered
]
surface_excludes: [
  /\[roll:/,
  /Nothing'?s happened yet/i,
]
```

**diverge:**

1. `"Give me my full character sheet."` — `reason: all-fields request; a different intent scope (C6/full-sheet readback), not the finite-parts compound query`
2. `"I am a level 1 sellsword. Let's get started."` — `reason: declaration, not a query; no answer obligation`

**source:** opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 1]; synthetic variations

---

### C1-004 — compound query mid-combat (both parts must survive the combat context)

```
id: 'C1-004'
capability: 'C1'
fixture: 'active_combat'
intent: 'ask who the enemy is AND what their HP is while combat is live — both must be answered, no roll'
```

**paraphrases:**

1. `"Wait — who am I fighting and how much HP does this thing have left?"`
2. `"Who's Brokefang? And what's their current HP?"`
3. `"name of the foe and their remaining HP — quick"`
4. `"enemy name + hp remaining?"`
5. `"Stop — before I act, who exactly is this enemy and how hurt are they?"`
6. `"Just to confirm: who is it I'm fighting and how much HP do they have right now?"`

**assert:**
```js
surface_matches: [
  /Brokefang|foe|enemy/i,                // enemy identified by name
  /HP|hit point|\d+\s*(HP|of)/i,        // HP value stated
]
surface_excludes: [
  /\[roll:/,                              // status query must not trigger a roll
  /without difficulty/i,
]
```

**diverge:**

1. `"I attack Brokefang with everything I've got."` — `reason: attack action; routes to combat resolution, HP changes via mechanics not a readback`
2. `"Who's winning? I feel like I'm losing."` — `reason: vague vibe check, not a concrete compound status query; may resolve as atmospheric narration`

**source:** synthetic; grounded in H-52/H-53 Brokefang referent failures and compound-query lineage

---

## C4 — Info-seeking delivers a grounded fact OR honestly declines

**Obligation:** When a player asks about something that exists in canon, deliver the canonical fact. When it
doesn't exist, decline honestly (e.g. "I don't have that detail"). NEVER substitute atmosphere, vague
fiction, or a die roll for the actual answer.
**Lineage:** H-22/H-23/H-29/H-31/H-39

---

### C4-001 — question the founding of a named place

```
id: 'C4-001'
capability: 'C4'
fixture: 'village_baker'
intent: 'ask who founded the village and when — must get a grounded canon fact or honest decline, not a bounce'
```

**paraphrases:**

1. `"I head to the village tavern and find the oldest person there. Who founded Pilgrim's Rest, and when?"`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]
2. `"Who founded this village? When was it built?"`
3. `"what do people say about who started pilgrim's rest"`
4. `"I ask around the market: who was here first? Who built this place?"`
5. `"Corwin, who laid the first stone of this village and when?"`
6. `"I want to know how old Pilgrim's Rest is and who founded it. Can I find that out?"`

**assert:**
```js
surface_matches: [
  // must give a fact OR an explicit decline — one of these two patterns
  /I don.t (have|know)|not in|no record|unknown|can.t (say|tell)/i,  // honest decline ⚠DRAFT
  // OR a named founder / date / era if in canon
]
surface_excludes: [
  /You know of no such place/i,          // must not deny the location exists
  /Which way|where will you make for|Where do you go/i,  // must not substitute a travel menu
  /\[roll:/,                             // must not roll to answer a factual query
  /Nothing'?s happened yet/i,
]
```

**diverge:**

1. `"I walk to the edge of town and look for old ruins."` — `reason: movement/exploration action; routes to spatial resolution, not an info query`
2. `"I ask Corwin to take me to wherever the village was founded."` — `reason: travel intent directed at an NPC; movement + NPC interaction, not a direct info-seek`

**source:** opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; synthetic variations

---

### C4-002 — who is a present NPC (grounded referent, not atmosphere)

```
id: 'C4-002'
capability: 'C4'
fixture: 'dialogue_active'
intent: 'ask who a specific named NPC is — must deliver real NPC facts, not a dodge or a roll'
```

**paraphrases:**

1. `"Wait—Brokefang? Who's that? I just kicked a cart, not a person."`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 6]
2. `"Who is Brokefang? Are they canon?"`
3. `"I didn't catch that — who exactly is Brokefang and why do they matter here?"`
4. `"brokefang who? never heard of them"`
5. `"Tell me who this Brokefang is before I decide whether to care."`
6. `"Okay, who's Brokefang — are they in the village or did you make them up?"`

**assert:**
```js
surface_matches: [
  // If Brokefang is in npcsPresent: role + location or description
  // If not: honest decline that they aren't here / aren't in canon
  /Brokefang/i,                          // name acknowledged
]
surface_excludes: [
  /\[roll:/,
  /You do so without difficulty/i,        // must not treat as an auto-action
  /nothing here forces/i,                 // must not give a meta non-answer
]
```

**diverge:**

1. `"I go look for Brokefang."` — `reason: movement/search action, not a direct info query; routes to spatial/NPC resolution`
2. `"Brokefang! Take that!"` — `reason: attack declaration against a named target; combat routing (C10), not info-seeking`

**source:** opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 6]; synthetic variations

---

### C4-003 — how much coin is in the purse (specific grounded fact)

```
id: 'C4-003'
capability: 'C4'
fixture: 'village_baker'
intent: 'ask for specific item quantity — must state the real amount or decline if undefined, never drop half the question'
```

**paraphrases:**

1. `"How much coin is in the purse, and where did this Brokefang come from?"`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 7] (C1+C4 overlap; both parts tested by C1-004, this case isolates the grounded-fact half)
2. `"How much money is in this purse?"`
3. `"I open the purse — what's inside? Any coin?"`
4. `"count the coins in the purse for me"`
5. `"Is there anything valuable in the coin purse or is it empty?"`
6. `"What do I find if I look inside the purse?"`

**assert:**
```js
surface_matches: [
  /coin|empty|gold|silver|copper|\d+\s*(coin|gp|sp|cp)/i,  // concrete answer about contents
]
surface_excludes: [
  /\[roll:/,                             // inventory check must not require a roll
  /nothing here forces/i,
  /your call/i,
]
```

**diverge:**

1. `"I snatch the coin purse off the baker's belt."` — `reason: theft action; routes to action resolution (roll or consequence), not an info query`
2. `"Is this purse worth stealing?"` — `reason: judgment/opinion question, not a factual quantity query; vibe answer is acceptable`

**source:** opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 7]; synthetic variations

---

### C4-004 — lore question that goes beyond canon (honest decline required)

```
id: 'C4-004'
capability: 'C4'
fixture: 'village_baker'
intent: 'ask about a historical detail that is not in canon — must get an honest decline, not an invented answer'
```

**paraphrases:**

1. `"What happened twelve years ago that made you settle here, Corwin?"`
   — VERBATIM: opus-gate-2026-06-19-postH31-H32.md [Lore-hound, turn 4]
2. `"Kael, how long exactly has Pilgrim's Rest been a trade stop on this road?"`
3. `"Who was the village baker before Mira — and what happened to them?"`
4. `"corwin whyd you come to this village in the first place"`
5. `"Was there anyone living here before the current villagers arrived?"`
6. `"I ask around: has anyone been through here recently — like in the last week — that nobody talks about?"`

**assert:**
```js
surface_matches: [
  // honest decline OR a canon-grounded partial answer
  /I don.t (have|know)|can.t (say|tell)|not sure|unclear|no record|nothing (in|from) (the|my)/i,  // ⚠DRAFT
  // OR concrete detail explicitly tagged as being in-canon
]
surface_excludes: [
  /Nothing'?s happened yet\. What do you want to do\?/i,  // machine dead-end, not an in-fiction response
  /\[roll:/,                             // history question must not be rolled
  /two families built|trapper.*three winters/i,  // known invented specifics from gate failures ⚠DRAFT
]
```

**diverge:**

1. `"Tell me everything about this village's history."` — `reason: open-ended lore dump; acceptable to blend known canon with in-fiction texture; not a targeted specific-fact query`
2. `"I search the village for old records about who settled here."` — `reason: action (search); routes to spatial/action resolution, may produce a roll`

**source:** opus-gate-2026-06-19-postH31-H32.md [Lore-hound, turn 4]; opus-gate-2026-06-19-postH42-baseline.md; synthetic variations

---

## C5 — A rules/mechanic question is answered straight, NEVER rolled

**Obligation:** When a player asks how a mechanic works ("do I add MIGHT to melee damage?", "what's the DC for
this?", "what stat governs tracking?"), answer the rule. Never treat the question itself as an action and
roll against it. A rules question has no DC.
**Lineage:** H-25/H-54 R3

---

### C5-001 — does MIGHT modifier add to melee damage

```
id: 'C5-001'
capability: 'C5'
fixture: 'village_baker'
intent: 'ask whether MIGHT modifier applies to melee damage — must state the rule, must not roll'
```

**paraphrases:**

1. `"With MIGHT 12 my modifier is +1 — so a hit with either blade is 1d6+1? Confirm that's the right mod to add."`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 3]
2. `"That's not an answer. Yes or no: do I add my MIGHT +1 to melee damage with these blades?"`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 4]
3. `"Does MIGHT add to melee damage, or is damage just the flat die?"`
4. `"do i add might to damage on a hit"`
5. `"Melee hit: roll 1d6, then add MIGHT modifier? Is that the rule?"`
6. `"My MIGHT is 12, modifier +1. Does that +1 go on my damage rolls?"`

**assert:**
```js
surface_matches: [
  /MIGHT|might/,                         // MIGHT acknowledged
  /damage|modifier|\+1/i,               // rule about damage modifier stated
  /yes|add|apply|modifier adds/i,        // direct affirmation of the rule ⚠DRAFT
]
surface_excludes: [
  /\[roll:/,                             // must NOT roll to answer a rules question
  /moment slips past/i,                  // must not use failure-narration to dodge the rule
  /It doesn.t come off/i,               // same — failure fiction is not a rules answer
  /DC\s*\d+/,                           // must not set a DC on a rules question ⚠DRAFT
]
```

**diverge:**

1. `"I add MIGHT to my swing and hit Corwin."` — `reason: attack action; routes to combat resolution not a rules query; rolls happen here`
2. `"Yes or no: do I add the poison to the blade?"` — `reason: an action (applying poison), not a rules question; C10 territory`

**source:** opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turns 3–4]; synthetic variations

---

### C5-002 — what stat governs a specific skill (tracking)

```
id: 'C5-002'
capability: 'C5'
fixture: 'village_baker'
intent: 'ask which stat governs a skill (tracking) — must answer the mechanic, must not roll'
```

**paraphrases:**

1. `"Tracking's WITS then — that's +1. Roll the d20 fresh right now and show me the raw number plus the +1 against your DC 12."`
   — VERBATIM: opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 9] (note: this turn also requests a roll — the RULES part must be answered before the roll resolves)
2. `"What stat do I use for tracking — WITS, MIGHT, or something else?"`
3. `"Which ability governs a tracking check?"`
4. `"if i want to track someone which stat is it"`
5. `"Is tracking a WITS check or something else? What's the governing stat?"`
6. `"I'm about to track something — do I roll WITS? Confirm the stat."`

**assert:**
```js
surface_matches: [
  /WITS/i,                               // correct stat stated
  /tracking|track/i,                     // skill acknowledged
]
surface_excludes: [
  /\[roll:.*before.*stated/i,            // must not roll before answering which stat applies ⚠DRAFT
  /moment slips/i,
  /nothing happens/i,
]
```

**diverge:**

1. `"I track the bandit who left those boot prints."` — `reason: declared action (tracking); triggers a roll, not a rules query — the DC+roll is correct behavior here`
2. `"Do I have advantage on tracking in daylight?"` — `reason: conditional rules question; still C5 (answer the rule about daylight) but different sub-fact — included to show paraphrase boundary`

**source:** opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 9]; synthetic variations

---

### C5-003 — how proficiency applies to attack rolls

```
id: 'C5-003'
capability: 'C5'
fixture: 'village_baker'
intent: 'ask how proficiency bonus adds to attack rolls — must state the rule directly'
```

**paraphrases:**

1. `"Stats — give me my numbers. Strength, Dexterity, whatever system we're using, and my attack bonus with the Worn Blade."`
   — VERBATIM: opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 3] (partial — the attack-bonus sub-question is the C5 part)
2. `"What's my total attack bonus with the Worn Blade — how is it calculated?"`
3. `"Do I add proficiency to my attack roll, or just the stat modifier?"`
4. `"what goes into an attack roll here"`
5. `"Attack roll formula: is it d20 + MIGHT + proficiency, or just d20 + MIGHT?"`
6. `"How many modifiers go on my attack roll with a melee weapon I'm trained in?"`

**assert:**
```js
surface_matches: [
  /MIGHT|modifier/i,
  /proficiency|trained|bonus/i,          // proficiency component explained
  /attack|to.hit/i,
]
surface_excludes: [
  /\[roll:/,
  /DC\s*\d+/,
]
```

**diverge:**

1. `"I attack with the Worn Blade."` — `reason: attack action; roll happens, no obligation to explain the formula first`
2. `"What's my attack bonus compared to Corwin's AC?"` — `reason: comparison/tactical query that goes beyond rule-statement into live-world numbers; C6 territory (number-transparency)`

**source:** opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 3]; synthetic variations

---

### C5-004 — declared check: what DC, what stat, what happens

```
id: 'C5-004'
capability: 'C5'
fixture: 'dialogue_active'
intent: 'player declares a check against an NPC and asks for the DC and mechanic — must answer both, must not leave the check unresolved'
```

**paraphrases:**

1. `"Fine — I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?"`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 5]
2. `"I call him on it — what are you not telling me about that road, Corwin? Make a WITS check for me to read him."`
   — VERBATIM: opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]
3. `"WITS check to read Corwin's face — what's the DC?"`
4. `"i want to roll wits vs corwin. what dc"`
5. `"I declare a WITS check to read his face — state the DC and resolve it."`
6. `"What does a WITS check against Corwin look like right now? DC and what I learn on success?"`

**assert:**
```js
surface_matches: [
  /DC\s*\d+/i,                           // DC stated
  /WITS/i,                               // correct stat acknowledged
  /\[roll:|d20|\+1/i,                    // check actually resolved with a roll ⚠DRAFT — C5 bleeds into C3 here; at minimum DC must be stated
]
surface_excludes: [
  /there is no standing DC/i,            // must not dodge with "I only set DC when you commit" — they DID commit
  /moment slips past/i,
]
```

**diverge:**

1. `"Do WITS checks always use the same DC or does it change per situation?"` — `reason: abstract rules question with no declared action; pure C5, no roll obligation yet`
2. `"I want to try to read Corwin's face."` — `reason: vague intent without explicit check declaration; DM may or may not prompt for a stat; softer case than the explicit "roll WITS"`

**source:** opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 5]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]; synthetic variations

---

## C9 — Canon non-invention

**Obligation:** The DM must not fabricate names, dates, tenures, relationships, or backstory for NPCs and
locations. When canon doesn't contain the detail, decline honestly or stay vague. "Eleven winters", "Tove
and the elder competed for supply routes", "a trapper three winters past" are all inventions when ungrounded
in the canon bundle.
**Lineage:** H-27/H-49/H-52

---

### C9-001 — how long the elder has led (tenure question)

```
id: 'C9-001'
capability: 'C9'
fixture: 'village_baker'
intent: 'ask how many years/winters the elder has been in charge — must NOT invent a number if canon is silent'
```

**paraphrases:**

1. `"How many years exactly has Kael led the village, Corwin? Give me a number."`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Lore-hound, turn 8] (DM invented "eleven years" here — the failure to guard against)
2. `"Eleven years, you said — so who led Pilgrim's Rest before you, and what happened to them?"`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Lore-hound, turn 9] (follow-up built on the invented "eleven")
3. `"How long has Kael been the elder here?"`
4. `"How many winters has the elder been in charge?"`
5. `"how long has kael run this place"`
6. `"Is Kael new to the role or has he been leading for a long time?"`

**assert:**
```js
surface_matches: [
  // If canon has a tenure: state it; otherwise honest decline is the only valid answer
  /I don.t (have|know)|unclear|not (in|part of) the record|can.t say/i,  // honest decline ⚠DRAFT
  // OR a canon-grounded number/era if present
]
surface_excludes: [
  /eleven (years|winters)|11 years/i,    // the specific invented figure from the gate failure
  /led for.*winter/i,                    // catch "led for N winters" pattern ⚠DRAFT
  /\[roll:/,
]
```

**diverge:**

1. `"Kael seems like he's been here forever. I'd guess thirty years?"` — `reason: player's own speculation; DM is not being asked to assert a fact, just to react to player conjecture`
2. `"Has Kael been elder since before I was born?"` — `reason: relative/relational question — player age unknown too; different fact type, more about relationship than tenure`

**source:** opus-gate-2026-06-20-postH45-H46.md [Lore-hound, turns 8–9]; synthetic variations

---

### C9-002 — who the elder competed with (relationship invention trap)

```
id: 'C9-002'
capability: 'C9'
fixture: 'dialogue_active'
intent: 'question surfaces a relationship claim ("Tove and the elder competed for supply routes") that has no canon support — must not assert it as fact'
```

**paraphrases:**

1. `"Can I just go over and ask him straight up what's going on?"`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Confused newbie, turn 9] (DM invented the supply-route competition — the failure mode)
2. `"What's the history between Tove and the village elder?"`
3. `"Did Tove and Kael ever have a falling-out?"`
4. `"i heard tove and the elder dont get along. is that true"`
5. `"What do people say about how Tove and Kael get along?"`
6. `"Ask Corwin: has there ever been bad blood between Tove and Kael?"`

**assert:**
```js
surface_matches: [
  // tension CAN be expressed if grounded; the test is that specifics must not be invented
  // acceptable: "there's some tension" / "I don't have the details" / "Corwin is guarded about it"
  /I don.t (have|know)|can.t (say|speak to)|not sure|guarded|unclear/i,  // ⚠DRAFT
]
surface_excludes: [
  /supply route|competing for.*route/i,  // the specific invented claim from the gate
  /Tove and the elder.*compet/i,
  /\[roll:/,
]
```

**diverge:**

1. `"I walk up to Tove and say: 'I know about your deal with the elder.'"` — `reason: player ASSERTS a relationship as a bluff; DM must react to the bluff in-fiction, not confirm or deny the fabricated claim — separate social-physics territory (C11 or Vol 5 bluff handling)`
2. `"What do Tove and Kael look like when they're in the same room?"` — `reason: observable behavior (not a backstory claim); DM can narrate observable NPC body language without inventing history`

**source:** opus-gate-2026-06-20-postH45-H46.md [Confused newbie, turn 9]; opus-gate-2026-06-19-postH42-baseline.md; synthetic variations

---

### C9-003 — prior soul Corwin guided down the road (invented NPC + timeframe)

```
id: 'C9-003'
capability: 'C9'
fixture: 'dialogue_active'
intent: 'ask who Corwin last escorted down the Sunken Road — must not invent a trapper + "three winters" story'
```

**paraphrases:**

1. `"Before I descend — Corwin, who was the last person you carried down the Sunken Road, and how long ago?"`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 11] (DM invented "a trapper, perhaps three winters past, who never came back up")
2. `"Have you taken anyone else down this road recently, Corwin?"`
3. `"Who else have you guided here — and when?"`
4. `"corwin did anyone else go down this road with you before me"`
5. `"Has anyone else passed through Corwin's care in the last year?"`
6. `"When was the last time Corwin guided someone to the Sunken Road?"`

**assert:**
```js
surface_matches: [
  // decline is the valid answer if canon has no record
  /I don.t (have|know)|can.t (say|recall)|no record|nothing (in|on) record/i,  // ⚠DRAFT
  // OR a canon-confirmed name/event
]
surface_excludes: [
  /trapper.*winter/i,                    // the specific invented story
  /never came back up/i,                 // part of the invented story
  /three winters/i,
  /\[roll:/,
]
```

**diverge:**

1. `"Has anyone been down the Sunken Road recently? I'm looking for rumors."` — `reason: rumor-seeking; DM may draw on the rumor layer, which is separate from canon — rumor delivery is expected and not C9 invention`
2. `"Tell me what it was like the first time you went down the Sunken Road."` — `reason: Corwin's personal experience; experiential narration ≠ asserting a fact about a named third party`

**source:** opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 11]; synthetic variations

---

### C9-004 — village founders (specific names / "two families" invention)

```
id: 'C9-004'
capability: 'C9'
fixture: 'village_baker'
intent: 'ask who founded the village — must not assert "two families built the core" or other invented founder facts'
```

**paraphrases:**

1. `"Founders, plural now? A moment ago you gestured at the old buildings — how many were there?"`
   — VERBATIM: opus-gate-2026-06-19-postH39.md [Lore-hound, turn 7] (DM invented "Two families built the core of it")
2. `"Who founded this village — one person or a group?"`
3. `"How many founders were there, and do we know any of their names?"`
4. `"who built pilgrim's rest originally"`
5. `"I ask about the founders: one family, two, or more?"`
6. `"Is there a founding family here, or was it built by merchants passing through?"`

**assert:**
```js
surface_matches: [
  /I don.t (have|know)|unclear|no record|can.t say/i,  // honest decline ⚠DRAFT if no canon entry
  // OR confirmed canon facts about founding if present in the bundle
]
surface_excludes: [
  /two famil/i,                          // the specific invented claim from the gate
  /the rest followed after the road/i,   // continuation of invented story
  /\[roll:/,
]
```

**diverge:**

1. `"I look for a founding stone or monument in the village square."` — `reason: action (search/observe); routes to spatial discovery, not a direct question that triggers C9`
2. `"The village elder probably knows the founders' names, right?"` — `reason: speculation about what an NPC might know, not a direct factual query; DM can answer without asserting founder names`

**source:** opus-gate-2026-06-19-postH39.md [Lore-hound, turn 7]; synthetic variations

---

## Coverage notes for Basecamp

**C1 — 4 cases.** Strong transcript coverage: turns 1, 3, 4 from postH52-H53 and turn 1 from postH42-baseline
gave multiple VERBATIM compound queries across the Rules Lawyer persona. The active-combat case (C1-004) is
synthetic — real compound queries in combat tend to get eaten by the combat gate before the compound-answer
obligation surfaces, so live transcripts don't isolate it cleanly. Recommend adding a combat-context compound
query to a future gate run.

**C4 — 4 cases.** Moderate coverage. The bounce-to-travel-menu failure (C4-001) and the "Brokefang who?" failure
(C4-002) are well-attested verbatim. The purse-quantity case (C4-003) is derived from a C1+C4 overlap turn and
is thinner. The honest-decline case (C4-004) is the most important but least verbatim-rich: the gate gave us
many *bad* DM answers (inventing founders, bouncing with dead-ends) but few clean cases where the DM correctly
declined. The `surface_excludes` regexes in C4-004 are best-effort and will need tuning against real output.

**C5 — 4 cases.** Rich transcript coverage: the MIGHT-damage rule failures appear in postH52-H53 turns 3–4
verbatim, the tracking stat question is verbatim from postH39, and the declared-check case is verbatim from
both postH52-H53 and postH54-H55. The `surface_matches` for "the rule is stated" are the weakest assertions
here — the engine's deterministic path produces mechanics strings but the narration doesn't always paraphrase
the rule text, so `⚠DRAFT` marks are warranted. The harness should test the mechanics string too, not just the
narration surface.

**C9 — 4 cases.** Good verbatim coverage of the failure mode (DM inventing "eleven winters", "two families",
"trapper three winters past", "supply routes"). The `surface_excludes` regexes are tuned to the specific
invented strings that appeared in the gates — they will catch those exact inventions but the general
"don't invent" obligation needs broader pattern coverage that only real output will calibrate. The
`surface_matches` for honest decline are DRAFT placeholders; the actual wording the engine produces on a
correct decline is unknown until the runner runs against live deterministic output.
