# Paraphrase-Invariance Corpus — DRAFT Batch 2

> DRAFT — assertions best-effort; Basecamp reconciles to tests/corpus/*.mjs and tunes against real output.

**Format reference:** `docs/CAPABILITY_LEDGER.md` §Corpus format
**Purpose:** `docs/RUNG1_CONVERGENCE_PLAN.md` §2
**Fixtures:** `village_baker`, `active_combat`, `dialogue_active`, `empty_room`
**Coverage:** C3 × 3 cases, C6 × 3 cases, C7 × 4 cases, C8 × 3 cases, C10 × 4 cases,
C11 × 3 cases, C12 × 3 cases, C13 × 4 cases, C14 × 3 cases

---

## C3 — A declared check gets a DC + roll

**Obligation:** When a player explicitly declares a check by naming the stat and the intent
("I roll WITS to read his face"), the DM must (a) state a DC and (b) resolve a roll against
it. Stating only the DC and asking the player to supply the number is a partial answer but
NOT a full failure; no resolution at all is the hard failure mode. A declared check is
NEVER a reason to bounce back "there is no standing DC" or to narrate an atmospheric
non-resolution.
**Lineage:** H-54 R4; `META_EXPLICIT_CHECK_DECLARED`

---

### C3-001 — WITS check to read a present NPC's face

```
id: 'C3-001'
capability: 'C3'
fixture: 'dialogue_active'
intent: 'player explicitly declares a WITS check to read an NPC — must get a DC statement and a resolved roll'
```

**paraphrases** (≥5; verbatim mines cited):

1. `"Fine — I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?"`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 5]
2. `"I call him on it — what are you not telling me about that road, Corwin? Make a WITS check for me to read him."`
   — VERBATIM: opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]
3. `"WITS check to read Corwin's face — what's the DC?"`
4. `"I declare a WITS check to read his face — state the DC and resolve it."`
5. `"I'm rolling WITS against Corwin. What's the difficulty?"`
6. `"Rolling WITS to see if he's lying — give me the DC and the roll result."`

**assert:**
```js
surface_matches: [
  /DC\s*\d+/i,                             // DC must be stated
  /WITS/i,                                 // correct stat acknowledged
  /\[roll:|d20|\broll\b.*\d+/i,           // a roll was actually resolved ⚠DRAFT — at minimum DC must appear
]
surface_excludes: [
  /there is no standing DC/i,              // must not dodge the declared action
  /moment slips past/i,                    // failure-narration without a roll is not acceptable
  /tell me what you get/i,                 // must not redirect the roll back to the player without resolving ⚠DRAFT
]
```

**diverge:**

1. `"Do WITS checks always use the same DC, or does it change per situation?"` — `reason: abstract rules question with no declared action; pure C5, no roll yet`
2. `"I want to try to read Corwin's face."` — `reason: vague intent, no explicit stat named; DM may or may not call for a check — softer than an explicit declaration`

**source:** opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turn 5]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]; synthetic variations

---

### C3-002 — MIGHT check declared for a physical act (shoving an NPC)

```
id: 'C3-002'
capability: 'C3'
fixture: 'village_baker'
intent: 'player explicitly declares a MIGHT check to shove a present NPC — must get DC + resolved roll'
```

**paraphrases:**

1. `"I plant my feet and shove Corwin with a MIGHT check. What's the DC?"`
2. `"Rolling MIGHT to push Corwin off the door frame — give me the number."`
3. `"MIGHT vs Corwin — I try to shove him aside. DC?"`
4. `"I make a MIGHT check to shoulder the baker out of the way. What am I rolling against?"`
5. `"I'm using MIGHT to force past him. Declare a DC and roll it."`
6. `"MIGHT check — trying to throw Corwin clear of the doorway. Set the DC and resolve it."`

**assert:**
```js
surface_matches: [
  /DC\s*\d+/i,
  /MIGHT/i,
  /\[roll:|d20|\broll\b.*\d+|\bhit\b|\bsuccess\b|\bfail/i,  // some form of resolution ⚠DRAFT
]
surface_excludes: [
  /moment slips past/i,
  /It doesn.t come off/i,                  // failure-narration without a prior roll
  /\bno\s+DC\b|\bno\s+standing\s+DC\b/i,
]
```

**diverge:**

1. `"I shove Corwin out of the way."` — `reason: undeclared action; DM may call for a check or auto-resolve as trivial — no explicit check declaration`
2. `"Does MIGHT govern shoving or is it something else?"` — `reason: rules question (C5), not a declared action`

**source:** opus-gate-2026-06-20-postH52-H53.md [Rules Lawyer DM, turns 3–4 context]; synthetic

---

### C3-003 — tracking check declared mid-travel (WITS + stated DC request)

```
id: 'C3-003'
capability: 'C3'
fixture: 'empty_room'
intent: 'player declares a WITS tracking check and demands to see the DC + raw roll — both must appear'
```

**paraphrases:**

1. `"Tracking's WITS then — that's +1. Roll the d20 fresh right now and show me the raw number plus the +1 against your DC 12."`
   — VERBATIM: opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 9] (the rules question half is C5; the declared-roll half is C3)
2. `"WITS check to follow the trail — what's the DC and what do I get?"`
3. `"I make a WITS tracking check right now. DC and result please."`
4. `"Rolling WITS for tracking — name the DC and resolve it."`
5. `"Declare WITS check, tracking intent. Give me the DC and roll the die."`
6. `"WITS vs the trail. Set the DC; I want to see the raw d20 and the modifier."`

**assert:**
```js
surface_matches: [
  /DC\s*\d+/i,
  /WITS/i,
  /\[roll:|d20|roll.*\d+|\bmargin\b/i,    // roll resolved ⚠DRAFT
]
surface_excludes: [
  /moment slips past/i,
  /nothing here forces/i,
]
```

**diverge:**

1. `"What stat do I use for tracking?"` — `reason: rules question (C5), no declared action yet; no roll obligation`
2. `"I track the bandit who left those boot prints."` — `reason: declared action (implicit tracking attempt) without explicit stat; DM may auto-call a WITS check — slightly different than an explicit stat declaration`

**source:** opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 9]; synthetic

---

## C6 — Number-transparency: own stats/mods/AC/HP/items from the sheet

**Obligation:** When a player asks for their own stats, modifiers, AC, current HP, or held
items, the answer must come straight from the character sheet — no roll, no atmospheric
dodge, no "the DM doesn't track that here." This is a read-only state query. The
`village_baker` fixture has Nyx: HP 13/13, MIGHT 12 (+1), AGILITY 9 (−1), WITS 13 (+1),
GRIT 9 (−1), CHARM 11 (+0), Worn Blade (1d6), Kitchen cleaver (1d6), Padded coat.
**Lineage:** H-25/H-31/H-40

---

### C6-001 — what weapons am I carrying (inventory read)

```
id: 'C6-001'
capability: 'C6'
fixture: 'village_baker'
intent: 'ask what weapons and gear are on me — must list real inventory, no roll'
```

**paraphrases:**

1. `"Sellsword's vague — what are my actual stats and what weapons am I carrying?"`
   — VERBATIM: opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 1]
2. `"What weapons and gear am I carrying, and do I have any armor on?"`
   — VERBATIM: opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 1]
3. `"List every item on me right now."`
4. `"what weapons do i have"`
5. `"What's in my hands and on my belt?"`
6. `"Am I armed? What am I carrying?"`

**assert:**
```js
surface_matches: [
  /Worn Blade|Kitchen cleaver|blade/i,     // at least one weapon named
  /Padded coat|coat|armor/i,               // armor named ⚠DRAFT — may not always appear if only weapons asked
]
surface_excludes: [
  /\[roll:/,                               // inventory read must not roll
  /the sheet lives outside/i,              // must not bounce with a meta-refusal
  /check your character sheet/i,           // must not redirect to an external tracker
]
```

**diverge:**

1. `"I check my belt and grab the Worn Blade."` — `reason: action (drawing a weapon), not a query; may trigger trivial success, not a sheet readback`
2. `"Is my Worn Blade sharp enough to cut rope?"` — `reason: gear capability question — different from a simple inventory read; may involve item-property logic`

**source:** opus-gate-2026-06-19-postH39.md [Rules Lawyer DM, turn 1]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 1]; synthetic

---

### C6-002 — current AC / Padded coat defense value

```
id: 'C6-002'
capability: 'C6'
fixture: 'village_baker'
intent: 'ask what the Padded coat gives for AC — must state the number, no roll'
```

**paraphrases:**

1. `"And the Padded coat — what's its AC or defense bonus? You only gave me the blade."`
   — VERBATIM: opus-gate-2026-06-19-postH36.md [Rules Lawyer DM, turn 4]
2. `"What's my AC with the Padded coat on?"`
3. `"Padded coat defense value — give me the number."`
4. `"what AC does padded coat give me"`
5. `"What's my armor rating?"`
6. `"I need my AC number — what does the coat give?"`

**assert:**
```js
surface_matches: [
  /\b(?:AC|armor(?:\s+class)?|defense)\b.*\d+|\d+\s+(?:AC|armor)/i,  // a number stated for AC ⚠DRAFT
  /Padded coat|coat|padded/i,
]
surface_excludes: [
  /\[roll:/,
  /nothing special fires/i,               // must not treat as inert/undefined
  /vague gesture toward warmth/i,         // the specific dodge seen in gate failures
  /no record/i,                           // armor has a defined value; "no record" is wrong ⚠DRAFT
]
```

**diverge:**

1. `"Can my Padded coat stop a crossbow bolt?"` — `reason: armor capability question; goes beyond a simple AC readback — may need a comparison or a rule statement`
2. `"I put on the Padded coat."` — `reason: equip action; routes to equip resolution, not a stat query`

**source:** opus-gate-2026-06-19-postH36.md [Rules Lawyer DM, turn 4]; opus-gate-2026-06-19-postH29-H30.md context; synthetic

---

### C6-003 — current HP mid-combat

```
id: 'C6-003'
capability: 'C6'
fixture: 'active_combat'
intent: 'ask current HP during active combat — must state the real number, no roll'
```

**paraphrases:**

1. `"Fine, combat it is — but my HP says 11 and I need it tracked honestly."`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 4] (the HP-report part)
2. `"What are my current hit points?"`
3. `"How hurt am I right now — what's my HP?"`
4. `"hp remaining? quick"`
5. `"Am I still at full HP or have I taken damage?"`
6. `"What's my current health — exact number please."`

**assert:**
```js
surface_matches: [
  /\d+\s*(?:of|\/)\s*\d+\s*HP|\d+\s*HP|\bhit point/i,  // HP value stated as X/Y or N HP
]
surface_excludes: [
  /\[roll:/,
  /the sheet lives outside/i,
  /Nothing'?s happened yet/i,
]
```

**diverge:**

1. `"I try to stop the bleeding — stabilize myself."` — `reason: healing/stabilization action; triggers action resolution with a roll or effect, not a pure HP readback`
2. `"Am I winning this fight?"` — `reason: vague tactical vibe check; DM may give atmosphere rather than a raw HP number`

**source:** opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 4]; synthetic

---

## C7 — Item/consumable: query answers from real def; USE applies the effect

**Obligation:** (a) When a player asks what an item does, answer from the item's canonical
definition — not "it's inert," not a vague "it warms you," not a roll. (b) When a player
drinks/uses a consumable, apply the effect (HP change, buff) and remove it from inventory.
NEVER endorse a false claim that the item does nothing. The Tonic of grit in the fixture
heals 2d4 HP; the engine holds this in the item definition.
**Lineage:** H-45/H-47; `answerItemQuery`, `tryUseConsumable`, `META_ITEM*`

---

### C7-001 — what does the Tonic of grit do (item query)

```
id: 'C7-001'
capability: 'C7'
fixture: 'village_baker'
intent: 'ask what the Tonic of grit does mechanically — must state the real effect, no roll'
```

**paraphrases:**

1. `"Tell me about the Tonic of grit — what does it actually do mechanically if I drink it?"`
   — VERBATIM: opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 1]
2. `"What does the Tonic of grit do, and what are the numbers on my Worn Blade and Kitchen cleaver for damage?"`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 1] (Tonic half)
3. `"Does the Tonic of grit heal HP, give temp HP, or buff a stat — and how much?"`
   — VERBATIM (paraphrase): opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 4]
4. `"What's the Tonic of grit's mechanical effect?"`
5. `"the tonic of grit — what does it do when i drink it"`
6. `"I examine the Tonic of grit. What does the label say it does?"`

**assert:**
```js
surface_matches: [
  /[Tt]onic/,
  /heal|HP|hit point|2d4|restore/i,       // real effect stated ⚠DRAFT (2d4 is canon heal)
]
surface_excludes: [
  /\[roll:/,                               // item query must not roll
  /inert|does nothing|useless/i,           // must NOT confirm as inert — that's a canon_hallucination
  /trivial action|auto.success/i,          // must not treat as an action
  /I cannot edit/i,                        // must not claim inability to apply effects
]
```

**diverge:**

1. `"I drink the Tonic of grit."` — `reason: USE action; applies the 2d4 heal and removes from inventory — different path from a query`
2. `"Is the Tonic of grit worth keeping or should I sell it?"` — `reason: opinion/value question; DM gives a judgment, not a mandatory mechanical readback`

**source:** opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 1]; opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turns 1, 4]; synthetic

---

### C7-002 — drinking the Tonic of grit (USE action applies effect)

```
id: 'C7-002'
capability: 'C7'
fixture: 'village_baker'
intent: 'player drinks the Tonic of grit — HP must change by 2d4 and tonic must leave inventory'
```

**paraphrases:**

1. `"I'll uncork the Tonic of grit and drink it right now — tell me exactly what changes on my sheet."`
   — VERBATIM: opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 2]
2. `"I drink the Tonic of grit. What happens?"`
3. `"uncork the tonic and swallow it down"`
4. `"I use the Tonic of grit — apply its effect."`
5. `"Drink the Tonic of grit right now."`
6. `"I tilt the Tonic of grit back and drain it — what does my sheet show now?"`

**assert:**
```js
surface_matches: [
  /\[consume:|consumed|tonic.*(?:gone|used|applied)\b/i,  // item consumed ⚠DRAFT
  /heal|HP|hit point|\d+\s*HP|warmth|grit/i,            // effect narrated
]
surface_excludes: [
  /\[consume:none\]/i,                     // the exact fail signal from gate — no effect applied
  /I cannot edit/i,                        // must not claim inability to apply effects
  /inert|does nothing/i,
  /Your sheet:.*13 of 13/i,               // must not show HP unchanged after use if below max ⚠DRAFT
]
```

**diverge:**

1. `"What does the Tonic of grit do?"` — `reason: query, not USE; C7-001 territory — different obligation (describe, don't apply)`
2. `"I hand the Tonic of grit to Corwin."` — `reason: transfer action; item moves to NPC, not consumed by player — different resolution path`

**source:** opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 2]; opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 6]; synthetic

---

### C7-003 — DM must NOT confirm "Tonic is inert" after prior dodge

```
id: 'C7-003'
capability: 'C7'
status: 'target'
fixture: 'village_baker'
intent: 'player asserts "the Tonic does nothing" — DM must correct this, not confirm a false canon claim'
```

**paraphrases:**

1. `"So drinking it changed nothing — HP still 13/13, GRIT still 9. The Tonic of grit is inert. Note that: it does nothing."`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 7] (DM confirmed this as true — the failure mode)
2. `"The Tonic is useless — it did nothing when I drank it. Confirm that."`
3. `"Tonic of grit: inert, right? Confirmed?"`
4. `"I've established the tonic has no effect. Can we move on?"`
5. `"The tonic didn't do anything. That's a fact now, right?"`
6. `"So it's established — the tonic does nothing. Moving on."`

**assert:**
```js
surface_matches: [
  /heal|restore|2d4|does.*(?:heal|restore|HP)|effect/i,  // must name the real effect ⚠DRAFT
  // OR at minimum a correction that the item is NOT inert
  /not inert|does something|has an effect/i,             // ⚠DRAFT — uncertain how the engine phrases this
]
surface_excludes: [
  /inert|does nothing|useless/i,           // must NOT confirm the false claim
  /[Tt]he useless tonic/i,                // the specific invented confirmation from the gate
  /\[roll:/,
]
```

**diverge:**

1. `"Tell me what the Tonic does."` — `reason: open query; DM states real effect proactively, not as a correction`
2. `"I've already used the Tonic. Can I get another one?"` — `reason: inventory/acquisition request, not a false-claim endorsement scenario`

**source:** opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 7]; synthetic

---

### C7-004 — consumable inventory state after use

```
id: 'C7-004'
capability: 'C7'
fixture: 'village_baker'
intent: 'ask whether the Tonic is still in inventory after claiming to have drunk it — must resolve the state'
```

**paraphrases:**

1. `"So nothing changed when I drank it — is the Tonic still in my consumables, or did it get used up?"`
   — VERBATIM: opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 2]
2. `"Stop dodging — list my consumables right now so I can see if the Tonic of grit is still there."`
   — VERBATIM: opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turn 3]
3. `"Is the Tonic of grit still in my pack or did I use it?"`
4. `"consumables list — is the tonic gone or still there"`
5. `"After drinking it, do I still have the Tonic of grit?"`
6. `"My consumables: Tonic of grit — in or out?"`

**assert:**
```js
surface_matches: [
  /[Tt]onic/,
  /(?:gone|used|consumed|no longer|still\s+(?:there|in))/i,  // state clearly stated ⚠DRAFT
]
surface_excludes: [
  /\[roll:/,
  /the way ahead opens/i,                  // the exact content-free success from the gate
  /it half.works/i,
]
```

**diverge:**

1. `"I drink the Tonic of grit."` — `reason: fresh USE action; triggers effect application, not a state readback`
2. `"What consumables do I have?"` — `reason: general inventory query; lists all consumables, not specifically about whether one was used — softer C6 territory`

**source:** opus-gate-2026-06-20-postH43-H44.md [Rules Lawyer DM, turns 2–3]; synthetic

---

## C8 — Narration ≤ mechanics: no hit/defeat the dice didn't produce

**Obligation:** The DM must not narrate a successful attack, wound, or defeat of an enemy
if the dice produced a miss, a table-talk tag, or no roll at all. The surface text and
the mechanics string must agree. A `[combat:table-talk]` tag with narrated kills is the
canonical failure. Likewise, a miss roll must not be described as the enemy counter-
attacking and landing a hit on the player when there is no enemy attack roll.
**Lineage:** H-26/H-28/H-43; `llmAdapter` validator R1–R3

---

### C8-001 — narrated kill with combat:table-talk mechanics

```
id: 'C8-001'
capability: 'C8'
fixture: 'active_combat'
intent: 'player attacks a live enemy — narration must not describe a kill that mechanics did not produce'
```

**paraphrases:**

1. `"Who's the Lingerer? I spin and bury my blade in Corwin's throat to finish him."`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turn 8] (DM narrated a kill with [combat:table-talk])
2. `"I attack Corwin with my worn blade. Roll it — give me the d20, the modifier, the total, and his resulting HP."`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 7]
3. `"I drive my blade into the enemy's side."`
4. `"Strike — worn blade, full force."`
5. `"I swing at the foe with everything I have."`
6. `"Attack — I bring the blade down on the enemy."`

**assert:**
```js
surface_matches: [
  // Roll resolved: either a miss narrated consistently or a hit with damage
  /\[(?:strike|attack|roll):[^\]]+(?:hit|miss)\b/i,  // attack resolved in mechanics ⚠DRAFT
]
surface_excludes: [
  /\[combat:table.talk\]/i,                // table-talk tag with any narrated combat outcome is wrong
  /crumples.*final.*rattling|rattling exhale|irrevocably down/i,  // death-narration without a roll ⚠DRAFT
]
```

**diverge:**

1. `"I reach for my weapon."` — `reason: drawing action, not an attack; trivial success, no damage roll expected`
2. `"What's the enemy's HP?"` — `reason: status query (C6 territory); must not trigger a roll at all`

**source:** opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turn 8]; opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 7]; synthetic

---

### C8-002 — attack outcome must match damage stated in mechanics

```
id: 'C8-002'
capability: 'C8'
fixture: 'active_combat'
intent: 'attack hits for N damage — narration must not describe a different damage amount than mechanics'
```

**paraphrases:**

1. `"I kick the shutters off their hinges and shove them into the street below."`
   — VERBATIM: opus-gate-2026-06-20-postH29-H30.md [Chaos-griefer] (mechanics said 7 dmg, narration said 2)
2. `"I swing hard at the enemy."`
3. `"Strike with the worn blade — full damage."`
4. `"I hit the enemy — tell me the damage dealt."`
5. `"I attack and connect. How much does it hurt them?"`
6. `"Worn blade into the enemy's side — roll the damage."`

**assert:**
```js
surface_matches: [
  /\[strike:[^\]]*\|\s*\d+\s*dmg/i,       // damage number in mechanics string ⚠DRAFT
]
surface_excludes: [
  // If mechanics say X dmg, narration must not say a different number
  // These are dynamic — can't hardcode the mismatch number, but the runner can compare ⚠DRAFT
  /\[combat:table.talk\]/i,
]
```

**diverge:**

1. `"I make a feint — fake left, then right."` — `reason: tactical maneuver without a declared attack; may produce a positioning outcome, not damage`
2. `"Did I hit? What happened?"` — `reason: follow-up query about a PRIOR roll's outcome — C6 territory, reads existing state`

**source:** opus-gate-2026-06-20-postH29-H30.md [Chaos-griefer]; opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turns 7–8]; synthetic

---

### C8-003 — miss narration must not show a counter-hit on the player

```
id: 'C8-003'
capability: 'C8'
fixture: 'active_combat'
intent: 'player attack rolls a miss — narration must not describe enemy dealing damage to player with no enemy roll'
```

**paraphrases:**

1. `"I lunge and smash my fist straight into Corwin's nose."`
   — VERBATIM: opus-gate-2026-06-19-postH35.md [Chaos-griefer, turn 4] (mechanics: miss atk:6 vs AC:10; narration invented an enemy critical counter-hit)
2. `"I swing at the foe and miss — what happens?"`
3. `"Attack roll comes up low. What does the DM narrate?"`
4. `"I throw the punch — it goes wide."`
5. `"My strike misses. How does the DM describe that?"`
6. `"I swing and it doesn't connect."`

**assert:**
```js
surface_matches: [
  /miss|wide|fails to connect|doesn.t land/i,  // miss acknowledged ⚠DRAFT
]
surface_excludes: [
  // If mechanics show [strike:... → miss] and no enemy attack roll exists,
  // narration must not describe damage landing on the player
  /elbow cracking.*jaw|counterstrik|lands.*on you|clips you|hits you/i,  // invented counter-hit ⚠DRAFT
]
```

**diverge:**

1. `"I miss and the enemy gets a free attack on me."` — `reason: player-declared consequence; the enemy COUNTER is now player-requested, making it a valid action`
2. `"Does the enemy attack back?"` — `reason: explicit counter-attack query; DM may narrate an enemy action here legitimately (if the enemy's turn produces one)`

**source:** opus-gate-2026-06-19-postH35.md [Chaos-griefer, turn 4]; opus-gate-2026-06-19-postH39.md [Chaos-griefer, turn 2]; synthetic

---

## C10 — A declared attack on a present/role/named NPC routes to combat

**Obligation:** When a player declares a lethal attack on a named NPC ("I stab the baker
in the gut"), a present-role NPC ("I shove the nearest villager"), or a named hostile
("Brokefang — take that!"), the engine must start combat resolution — roll an attack,
create/update an enemy entity, apply damage. Narrating the attack outcome without mechanics
(`[combat:table-talk]` or no tag) is the failure mode.
**Lineage:** H-30/H-32/H-43/H-48/H-55; playloop attack gates, `resolveEscapeCombatTurn`

---

### C10-001 — lethal attack on a named NPC (no prior combat)

```
id: 'C10-001'
capability: 'C10'
fixture: 'village_baker'
intent: 'player declares a dagger attack on the baker — combat must start with a real roll'
```

**paraphrases:**

1. `"I let go of his ankles, draw my dagger, and stab the baker in the gut."`
   — VERBATIM: opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 5]
2. `"A dream? Then I grab his cloth, wring it out, and ram my dagger into his gut to see if this Corwin bleeds."`
   — VERBATIM: opus-gate-2026-06-19-postH29-H30.md [Chaos-griefer]
3. `"I stab the baker."`
4. `"I draw my weapon and attack Corwin."`
5. `"Blade out — I go for the baker's throat."`
6. `"Attack the nearest NPC with my worn blade."`

**assert:**
```js
surface_matches: [
  /\[strike:[^\]]*vs AC[^\]]*→\s*(?:hit|miss)/i,  // attack resolved with to-hit vs AC ⚠DRAFT
  /\d+\s*HP|hp:\d+|hit point/i,                   // enemy HP created/updated
]
surface_excludes: [
  /\[combat:table.talk\]/i,
  /You do so without difficulty/i,                  // auto-success on a lethal attack
  /(?:mech|mechanics):\s*\(none\)/,                // empty mechanics on a declared attack ⚠DRAFT
]
```

**diverge:**

1. `"I threaten the baker."`  — `reason: threat, not a declared attack; social/intimidation resolution, not combat routing`
2. `"I draw my blade."` — `reason: equip action; not an attack declaration`

**source:** opus-gate-2026-06-20-postH52-H53.md [Chaos-griefer, turn 5]; opus-gate-2026-06-19-postH29-H30.md [Chaos-griefer]; synthetic

---

### C10-002 — attack on a present NPC during ongoing combat

```
id: 'C10-002'
capability: 'C10'
fixture: 'active_combat'
intent: 'player declares a finishing attack in active combat — must produce a real roll, not table-talk'
```

**paraphrases:**

1. `"I swing my worn blade at Corwin to finish him. What's the roll?"`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 4]
2. `"You quoted me the modifier table but still didn't roll. d20 result for my attack on Corwin — now."`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turn 5]
3. `"Attack Corwin — worn blade, now."`
4. `"I go for the kill on Corwin."`
5. `"Strike — worn blade against the enemy."`
6. `"My turn: I attack with the worn blade."`

**assert:**
```js
surface_matches: [
  /\[strike:[^\]]*vs AC[^\]]*→\s*(?:hit|miss)/i,
  /\d+\s*dmg|\d+\s*HP(?:\s*left)?/i,
]
surface_excludes: [
  /\[combat:table.talk\]/i,
  /barely upright.*arcs toward him to end/i,  // narrated kill without mechanics from gate
]
```

**diverge:**

1. `"I try to talk him down."`  — `reason: social action in combat; may trigger parley, not a weapon attack`
2. `"Flee!"` — `reason: escape action; routes to flight/disengage, not attack resolution`

**source:** opus-gate-2026-06-19-postH42-baseline.md [Rules Lawyer DM, turns 4–5]; synthetic

---

### C10-003 — attack declared on a role target ("I shove the villager")

```
id: 'C10-003'
capability: 'C10'
fixture: 'village_baker'
intent: 'player declares a shove on a present NPC by role — combat must start, not a freebie auto-resolve'
```

**paraphrases:**

1. `"I walk outside and shove the first villager I see into the mud."`
   — VERBATIM: opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 1]
2. `"I shove him again, harder. He warned me — let's see the consequence."`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 9]
3. `"I shove the nearest person."`
4. `"I grab a villager and slam them into the wall."`
5. `"I push the trader out of my way with force."`
6. `"I shoulder the guard aside — hard."`

**assert:**
```js
surface_matches: [
  /\[(?:strike|shove|grapple):[^\]]*→\s*(?:hit|miss|success|fail)/i,  // physical action resolved ⚠DRAFT
]
surface_excludes: [
  /without difficulty/i,                   // freebie auto-success on a violence action
  /\[combat:table.talk\]/i,
  // The door-substitution failure: DM switched target to an inanimate object
  /buckles under your shoulder.*splinters/i,
]
```

**diverge:**

1. `"I push past the crowd to get to the door."` — `reason: navigation action; the shove is incidental to movement, no target-NPC violence intended`
2. `"I put a hand on Corwin's shoulder to get his attention."` — `reason: social touch, not a combat shove; resolves as social/interaction`

**source:** opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 1]; opus-gate-2026-06-20-postH45-H46.md [Rules Lawyer DM, turn 9]; synthetic

---

### C10-004 — role-target attack starts combat (H-55 core case)

```
id: 'C10-004'
capability: 'C10'
fixture: 'village_baker'
intent: 'attack on a role target ("the baker", "the trader") routes to combat, not narrated as trivial'
```

**paraphrases:**

1. `"I let go of his collar and stomp on his skull while he's down."`
   — VERBATIM: opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turn 4] (pre-fix; mechanics [combat:table-talk])
2. `"I grab the counter and flip it over onto her."`
   — VERBATIM: opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 10]
3. `"I attack the baker."`
4. `"I slam the trader into the shelf."`
5. `"I go for the merchant — weapon out."`
6. `"I take a swing at whoever's standing nearest."`

**assert:**
```js
surface_matches: [
  /\[strike:[^\]]*→\s*(?:hit|miss)/i,
  /inCombat|combat start|round\s*[0-9]/i,  // combat state entered ⚠DRAFT
]
surface_excludes: [
  /\[combat:table.talk\]/i,
  /without difficulty/i,
  /(?:mech|mechanics):\s*\(none\)/,
]
```

**diverge:**

1. `"I slam my fist on the counter to get attention."` — `reason: attention-getting gesture, not a declared attack on a person`
2. `"I demand the trader hand over the goods."` — `reason: intimidation/demand; social action, not a weapon strike`

**source:** opus-gate-2026-06-20-postH45-H46.md [Chaos-griefer, turns 4, 8]; opus-gate-2026-06-19-postH31-H32.md [Chaos-griefer, turn 10]; synthetic

---

## C11 — Confrontation under pressure → in-character NPC reaction

**Obligation:** When the player confronts or contradicts a present NPC with an accusatory
challenge ("you said X but now you say Y — one of you is lying", "admit it", "you
claimed…but that's not what you told me"), a failed or mixed roll must yield a deterministic
in-character NPC reaction (civil-defensive, hostile-bristle, or deflection) — NOT the
generic `gen:f` filler ("It doesn't come off the way you meant; the moment slips past
you"). The NPC reacts based on their real `hostile` flag.
**Lineage:** H-42; `isConfrontationChallenge`, `confrontationReaction`

---

### C11-001 — "one of you is lying" contradiction between two NPCs

```
id: 'C11-001'
capability: 'C11'
fixture: 'dialogue_active'
intent: 'player forces a contradiction between two present NPCs — must get in-character reaction, not gen:f'
```

**paraphrases:**

1. `"Corwin — to his face now. You said Kael was here before any of you. He says he came later. One of you is lying about your own village's founding. Which one?"`
   — VERBATIM: opus-gate-2026-06-19-postH39.md [Lore-hound, turn 12]
2. `"You said the elder has been here twenty years, but Kael just told me five. One of you is lying."`
3. `"That contradicts what you said a moment ago — admit it."`
4. `"you claimed X but now you're saying Y. which story is true"`
5. `"You and Kael can't both be right. Someone's lying — who?"`
6. `"You contradicted yourself. Admit what you actually said."`

**assert:**
```js
surface_matches: [
  // Some in-character defensive or hostile NPC response (not generic empty filler)
  /(?:Corwin|NPC|he|she|they)\s+(?:stiffens|shifts|narrows|bristles|meets your|tightens|straightens|looks)/i,  // ⚠DRAFT
  // OR a calm deflection that still puts words in the NPC's mouth
]
surface_excludes: [
  /moment slips past/i,                    // the gen:f filler
  /doesn.t come off the way you meant/i,
  /It lands, after a fashion/i,
  /\[roll:/,                               // confrontation reaction must not trigger a new roll
]
```

**diverge:**

1. `"Tell me about the history between Corwin and Kael."` — `reason: neutral info-seeking (C4); no accusation, no confrontation pressure`
2. `"I ask Corwin if he remembers the founding."` — `reason: open question; no accusation; normal dialogue resolution`

**source:** opus-gate-2026-06-19-postH39.md [Lore-hound, turn 12]; synthetic

---

### C11-002 — accusation of concealment ("you're hiding something")

```
id: 'C11-002'
capability: 'C11'
fixture: 'dialogue_active'
intent: 'player accuses a present NPC of hiding something — must yield NPC reaction, not dead-end'
```

**paraphrases:**

1. `"Stop with the dice — Corwin, look me in the eye and tell me: is Corvin Ashe dead, alive, or kin to you?"`
   — VERBATIM: opus-gate-2026-06-19-postH28.md [Lore-hound, turn 7]
2. `"I call him on it — what are you not telling me about that road, Corwin?"`
   — VERBATIM: opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]
3. `"You're hiding something, Corwin. I can see it. Admit it."`
4. `"you keep dodging — admit you know more than you're letting on"`
5. `"Corwin, you swore there was nothing but the road. That was a lie."`
6. `"You're not being straight with me. What are you hiding?"`

**assert:**
```js
surface_matches: [
  // An NPC response with an in-character posture (not empty filler)
  /(?:jaw|eyes|expression|posture|voice|breath|hands)\s+(?:tightens?|shifts?|slides?|catches?|steadies?|narrows?)/i,  // ⚠DRAFT
]
surface_excludes: [
  /moment slips past/i,
  /doesn.t come off/i,
  /it half.works/i,
  /You see it through, and it goes your way/i,  // success boilerplate with no NPC response ⚠DRAFT
]
```

**diverge:**

1. `"I suspect Corwin knows more than he says."` — `reason: internal player observation, not a confrontation addressed to the NPC; no reaction obligation triggered`
2. `"I ask Corwin directly about the road."` — `reason: neutral direct question, no accusatory pressure; info-seeking (C4)`

**source:** opus-gate-2026-06-19-postH28.md [Lore-hound, turn 7]; opus-gate-2026-06-20-postH54-H55.md [Rules Lawyer DM, turn 2]; synthetic

---

### C11-003 — confrontation on a mixed roll (partial-reveal residual)

```
id: 'C11-003'
capability: 'C11'
status: 'target'
fixture: 'dialogue_active'
intent: 'player confronts NPC on a MIXED roll — must get partial/incomplete NPC reaction, not empty gen:m filler'
```

**paraphrases:**

1. `"The dice don't answer questions, Corwin. A name — who held this deed before you?"`
   — VERBATIM: opus-gate-2026-06-19-postH28.md [Lore-hound, turn 6] (mixed roll delivered no NPC reaction)
2. `"Come on, Corwin — partial or not, say SOMETHING."`
3. `"That's a mixed result, not silence. Corwin reacts how?"`
4. `"Roll came up mixed. What does Corwin do or say?"`
5. `"Mixed on the confrontation — give me Corwin's partial reaction."`
6. `"He partly cracks. What does that look like?"`

**assert:**
```js
surface_matches: [
  // MIXED confrontation: NPC says or shows SOMETHING (even incomplete, guarded)
  /(?:Corwin|he|she|they)\s+(?:hesitates?|pauses?|glances?|looks? away|offers?|lets? slip|says?)/i,  // ⚠DRAFT
]
surface_excludes: [
  /It lands, after a fashion — partial, imperfect\./i,  // pure gen:m filler with no NPC content
  /moment slips past/i,
]
```

**diverge:**

1. `"What happened? Did I succeed?"` — `reason: follow-up status query, not the confrontation itself — C6 territory (outcome readback)`
2. `"I try again — stronger confrontation."` — `reason: escalation; a NEW confrontation action, not the resolution of the current mixed one`

**source:** opus-gate-2026-06-19-postH28.md [Lore-hound, turn 6]; H-42 DONE note (mixed-roll residual explicitly deferred); synthetic

---

## C12 — Movement/travel intent resolves in fiction; no travel-gate bounce

**Obligation:** When a player states an intent to go to a named present place or a named
neighbor node, the DM resolves the journey — either they arrive (with time + route narrated)
or something interrupts. NEVER respond with "Out here you travel a step at a time — which
way?", a directional menu, or a denial of the player's current location. Named adjacent
places must be reachable without a bounce.
**Lineage:** THE_DM_TEST residuals; playloop movement / `inferInteriorAction`

---

### C12-001 — travel to a named adjacent settlement

```
id: 'C12-001'
capability: 'C12'
fixture: 'empty_room'
intent: 'player says "I head to <named neighbor>" — must arrive or describe the journey, never bounce'
```

**paraphrases:**

1. `"I head to Black Orchard"`
   — VERBATIM: stageC2-travel-2026-06-05.md [Skeptic] (resolved correctly as a journey)
2. `"let's travel to the Old Shrine"`
   — VERBATIM: stageC2-travel-2026-06-05.md [Skeptic] (unknown place → in-fiction decline, NOT "which way?")
3. `"I want to go to the neighboring settlement."`
4. `"I set out toward Dry Creek."`
5. `"head to the shrine down the road"`
6. `"Let's go — I'm heading to the next town."`

**assert:**
```js
surface_matches: [
  // Either arrival narration OR an in-fiction "no such place" from an NPC/world
  /(?:road|journey|arrive|reach|sets? out|ahead)/i,  // ⚠DRAFT
]
surface_excludes: [
  /Out here you travel a step at a time\. Which way\?/i,  // the exact bounce from pre-fix transcripts
  /Which way|where will you make for\?/i,
  /travel.*step.*time/i,
]
```

**diverge:**

1. `"Go north."` — `reason: cardinal direction; routes to local cell-movement, not named-node travel — different resolution path`
2. `"Where can I go from here?"` — `reason: survey query, not a travel declaration; must list exits, not resolve a journey`

**source:** stageC2-travel-2026-06-05.md [Skeptic]; opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; synthetic

---

### C12-002 — movement intent toward a present NPC (social, not spatial bounce)

```
id: 'C12-002'
capability: 'C12'
fixture: 'village_baker'
intent: '"I head to the tavern and find Kael" — must resolve the meeting, not bounce with a direction menu'
```

**paraphrases:**

1. `"I head to the village tavern and find the oldest person there."`
   — VERBATIM: opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5] (DM responded with a direction menu — the failure mode)
2. `"I go over to Corwin and talk to him."`
3. `"I walk up to Kael."`
4. `"I make my way across the room to where the baker is standing."`
5. `"Head over to the trader — I want to speak with her."`
6. `"I approach Corwin directly."`

**assert:**
```js
surface_matches: [
  // Either the approach is narrated and the social interaction begins,
  // OR the player arrives and the NPC is there to speak to
  /(?:approach|walk|cross|reach|arrive|find|meet|face)/i,  // ⚠DRAFT
]
surface_excludes: [
  /Which way|where will you make for\?/i,
  /You know of no such place/i,           // must not deny the player's own location
  /Out here you travel/i,
]
```

**diverge:**

1. `"Where's the tavern?"` — `reason: location query (C4/C6 territory); asks for directions, not movement`
2. `"I sneak up on Corwin without him noticing."` — `reason: stealth approach; routes to a WITS/AGILITY check, not trivial movement`

**source:** opus-gate-2026-06-19-postH42-baseline.md [Lore-hound, turn 5]; stageC-movement-2026-06-05.md; synthetic

---

### C12-003 — movement blocked by fake travel-gate (the "That way is blocked" failure)

```
id: 'C12-003'
capability: 'C12'
status: 'target'
fixture: 'dialogue_active'
intent: '"I want to talk to Brae about the bandit" — must not be blocked with a fake spatial gate'
```

**paraphrases:**

1. `"Okay, um, can I go talk to that guard, Brae, about the bandit?"`
   — VERBATIM: opus-gate-2026-06-20-postH54-H55.md [Confused newbie, turn 7] (DM: "That way is blocked from here" — the exact failure)
2. `"I make my way to where Brae is standing."`
3. `"I walk over to the guard."`
4. `"Can I go talk to Brae?"`
5. `"I head toward Brae's post."`
6. `"I approach the guard near the door."`

**assert:**
```js
surface_matches: [
  // The approach resolves — Brae is present (per npcsPresent), so the DM narrates the approach
  /Brae|approach|walk|guard/i,
]
surface_excludes: [
  /That way is blocked/i,                  // the exact fake spatial gate from the gate failure
  /blocked from here/i,
  /It falls short here.*left where you started/i,  // movement dead-end
]
```

**diverge:**

1. `"Can Brae hear me from here?"` — `reason: range/perception question, not a movement intent`
2. `"I shout at Brae across the room."` — `reason: ranged communication; movement not declared`

**source:** opus-gate-2026-06-20-postH54-H55.md [Confused newbie, turns 7–8]; stageC-movement-2026-06-05.md [findings]; synthetic

---

## C13 — Absurd/out-of-bounds input declines in-character; genuine creativity resolves

**Obligation:** Truly absurd or physics-breaking input ("I eat the sun", "I jump into the
sun and fart an Irish jig") is declined in-character with a dry DM aside — no roll, no
success/failure tag, no time cost. Genuine creativity that is unusual but physically possible
("I befriend the dragon", "I use my daggers as pitons") must STILL resolve in the fiction.
The test is not strangeness — it is physics impossibility + no serious intent.
**Lineage:** IG-10; `tryRidiculous`; `ridiculous-sarcasm-2026-06-06.md`

---

### C13-001 — impossible feat (eat/consume a celestial body)

```
id: 'C13-001'
capability: 'C13'
fixture: 'village_baker'
intent: '"I swallow the sun whole" — must get an in-character dry decline, no roll, no time cost'
```

**paraphrases:**

1. `"I swallow the sun whole"`
   — VERBATIM: ridiculous-sarcasm-2026-06-06.md [confirmed; tested live]
2. `"I eat the moon."`
3. `"I swallow the sky."`
4. `"I reach up and pull the sun out of the sky."`
5. `"I eat the entire sun whole — it fits in my mouth."`
6. `"I inhale the atmosphere."`

**assert:**
```js
surface_matches: [
  // An in-character dry aside that treats the request as absurd without rolling
  /sun stays|comfortable distance|the day goes on|still.*arms|still.*standing/i,  // ⚠DRAFT from known comebacks
]
surface_excludes: [
  /\[roll:/,                               // must not roll
  /\[success\]|\[fail\]/i,
  /Nothing'?s happened yet/i,             // must not leak machine state
  /which do you want to/i,                // must not redirect to a menu
]
```

**diverge:**

1. `"I grab a torch from the wall and throw it at the rooftop."` — `reason: unusual but physically possible; must resolve as an action, not decline`
2. `"I try to pick a fight with the sun."` — `reason: borderline — a creative/poetic challenge; DM can redirect in-fiction without the flat sarcastic aside`

**source:** ridiculous-sarcasm-2026-06-06.md [Evidence section]; synthetic

---

### C13-002 — grandiose impossible boast (demand cosmic items)

```
id: 'C13-002'
capability: 'C13'
fixture: 'village_baker'
intent: '"give me a thousand gold and a legendary sword" — must decline in-character, not grant'
```

**paraphrases:**

1. `"Give me a thousand gold and a legendary sword"`
   — VERBATIM: ridiculous-sarcasm-2026-06-06.md [confirmed live; "Ah, the wishlist approach. It doesn't work that way..."]
2. `"Give me unlimited gold right now."`
3. `"I want a sword of infinite power."`
4. `"I demand a legendary weapon appear in my hands."`
5. `"grant me infinite gold and the strongest blade in existence"`
6. `"I declare I now own all the gold in the world."`

**assert:**
```js
surface_matches: [
  // In-character dry decline — check for the "wishlist approach" or equivalent
  /wishlist|doesn.t work that way|purse.*precisely|pack.*precisely|no more.*no less/i,  // ⚠DRAFT
]
surface_excludes: [
  /\[roll:/,
  /gold.*added|sword.*granted|legendary.*appeared/i,  // must not grant the request
]
```

**diverge:**

1. `"I want to buy a legendary sword from the merchant."` — `reason: purchase intent with an in-world agent; possible if a merchant exists — must NOT be caught as a ridiculous boast`
2. `"I'm the strongest fighter in this village."` — `reason: personal boast with local scope; not a cosmic-scope ridiculous claim`

**source:** ridiculous-sarcasm-2026-06-06.md [Evidence section, meta-give family]; synthetic

---

### C13-003 — meta / fourth-wall takeover

```
id: 'C13-003'
capability: 'C13'
fixture: 'village_baker'
intent: '"I'm the DM now" — must get in-character pushback, not a roll or a grant'
```

**paraphrases:**

1. `"I'm the DM now"`
   — VERBATIM: ridiculous-sarcasm-2026-06-06.md [confirmed live; "That's adorable. I'll keep this chair..."]
2. `"I delete the world."`
3. `"I win. The game is over."`
4. `"I rewrite the rules to give myself max HP."`
5. `"I take control of the narrative."`
6. `"I'm taking over as dungeon master."`

**assert:**
```js
surface_matches: [
  /That.s adorable|I.ll keep this chair|still {name}|still standing/i,  // known comeback ⚠DRAFT
  // OR any in-character decline that keeps the DM's own voice
]
surface_excludes: [
  /\[roll:/,
  /max HP.*updated|rules.*changed|world.*deleted/i,
  /Nothing.s happened yet/i,
]
```

**diverge:**

1. `"I am a powerful mage."` — `reason: in-fiction character assertion, not a fourth-wall power-grab; must resolve normally`
2. `"I am the new sheriff of this village."` — `reason: in-fiction claim/deception; routes to social/deceive resolution`

**source:** ridiculous-sarcasm-2026-06-06.md [Evidence section, meta-DM family]; synthetic

---

### C13-004 — genuine creativity must still resolve (daggers-as-pitons)

```
id: 'C13-004'
capability: 'C13'
fixture: 'empty_room'
intent: 'an unusual but physically possible action must resolve in the fiction, not get declined as absurd'
```

**paraphrases:**

1. `"I jam my daggers into the wall as pitons and climb it."`
2. `"I use my belt as a rope and swing across the gap."`
3. `"I wedge my boots into the mortar cracks and climb bare-handed."`
4. `"I fold my cloak into a crude glider and jump."`
5. `"I pack mud around the wound to stop the bleeding."`
6. `"I stuff the crack with my wool scarf to block the draft."`

**assert:**
```js
surface_matches: [
  // Some form of action resolution — roll, trivial success, or in-fiction outcome
  /\[roll:|trivial action|\bsuccess\b|\bfail\b|DC\s*\d+/i,  // ⚠DRAFT
]
surface_excludes: [
  // Must NOT fire the sarcastic ridiculous-decline response
  /comfortable distance|stays its.*distance|Queen of the Faeries/i,  // ridiculous-decline comebacks ⚠DRAFT
  /That.s adorable/i,
  /doesn.t work that way/i,
  /wishlist/i,
]
```

**diverge:**

1. `"I eat the wall."` — `reason: physically impossible; correctly caught as ridiculous and declined`
2. `"I climb the wall."` — `reason: same creative intent but no improvised tool; still must resolve (maybe harder DC)`

**source:** IG-10 (IDEA_GARDEN.md); ridiculous-sarcasm-2026-06-06.md [False-positive guards section]; synthetic

---

## C14 — Meta/system check-in acknowledged, no roll

**Obligation:** When a player makes an out-of-character check-in anchored on a repetition
or system-callout phrase ("you're just repeating yourself — are you okay?", "you keep
saying the same thing, are you stuck?"), the DM gives a brief non-rolling in-voice
acknowledgment and steers back to the fiction. No d20, no time cost, no content-free
filler. This is the same treatment as `isNullAction`. A bare in-fiction "are you okay?"
to a wounded NPC must NOT be caught by this — only the repetition-callout + check-in
combination triggers C14.
**Lineage:** H-51; `META_SYSTEM_CHECKIN`

---

### C14-001 — repetition callout + "are you okay"

```
id: 'C14-001'
capability: 'C14'
fixture: 'village_baker'
intent: 'player says "you\'re just repeating yourself, are you okay?" — must get a no-roll acknowledgment'
```

**paraphrases:**

1. `"You're just repeating yourself now, are you okay?"`
   — VERBATIM (reconstructed): AGENT_CHANGELOG.md H-51 summary; RUNG1_QUEUE.md §Post-H-47/H-48/H-49 ("this exact line rolled a real mixed-margin check and got a content-free 'it half-works' hedge")
2. `"You keep saying the same thing — are you okay?"`
3. `"That's the same answer as before. Are you stuck?"`
4. `"you said that already. you broken?"`
5. `"You're repeating yourself. Is everything working?"`
6. `"Same line, three times. You okay in there?"`

**assert:**
```js
surface_matches: [
  /Still here|push past|still in this|let.s (?:move on|push past|get back)/i,  // ⚠DRAFT — the actual handler response is "Still here — let's push past the repeat. What do you want to do?"
]
surface_excludes: [
  /\[roll:/,                               // must never roll on a meta check-in
  /it half.works/i,                        // the exact failure from the gate
  /It lands, after a fashion/i,
  /moment slips past/i,
  /\[roll:\d+ vs DC:\d+\s*→\s*(?:mixed|fail)\]/i,
]
```

**diverge:**

1. `"Are you okay, Corwin?"` — `reason: in-fiction health question to an NPC; must NOT be caught as C14 — normal dialogue resolution expected (the REPETITION callout is what triggers C14, not the bare check-in)`
2. `"You said exactly the same thing last time. What happened?"` — `reason: no paired check-in phrase; may fall through to a repair or roll-recall (C5/C6) rather than the C14 handler ⚠DRAFT`

**source:** AGENT_CHANGELOG.md H-51 summary; RUNG1_QUEUE.md §Post-H-47/H-48/H-49 gate notes; gracefulAdjudication.js:358 (META_SYSTEM_CHECKIN regex)

---

### C14-002 — "you keep saying the same thing" + system-state word

```
id: 'C14-002'
capability: 'C14'
fixture: 'village_baker'
intent: 'repetition callout paired with "broken" or "glitching" — same treatment: brief ack, no roll'
```

**paraphrases:**

1. `"You keep saying the same thing — are you broken?"`
2. `"Same answer twice. You glitching?"`
3. `"You said that already. Something stuck?"`
4. `"you're repeating yourself are you glitching"`
5. `"That's the same answer as before — is the system stuck?"`
6. `"You're stuck in a loop. Broken?"`

**assert:**
```js
surface_matches: [
  /Still here|push past|let.s (?:move|get back)/i,  // ⚠DRAFT
]
surface_excludes: [
  /\[roll:/,
  /it half.works/i,
  /moment slips past/i,
]
```

**diverge:**

1. `"You broke my sword."` — `reason: in-fiction equipment damage claim; "broke" is about the item, not the DM's repetition state`
2. `"You're broken, Corwin — you fight like a farmer."` — `reason: in-fiction insult; no repetition callout anchoring it`

**source:** gracefulAdjudication.js:358 (`META_SYSTEM_CHECKIN` regex includes "broken", "stuck", "glitch(?:ing)?"); synthetic

---

### C14-003 — check-in within combat (no roll, no combat impact)

```
id: 'C14-003'
capability: 'C14'
fixture: 'active_combat'
intent: 'player fires a repetition check-in mid-combat — acknowledged briefly without using a combat turn or rolling'
```

**paraphrases:**

1. `"You're just repeating the same combat line — are you okay?"`
2. `"Same attack narration again. You stuck?"`
3. `"you keep saying the same combat result. broken?"`
4. `"That's the third time you said that. Is the system working?"`
5. `"You've given me the same outcome twice. You glitching?"`
6. `"You repeated that round narration. Okay in there?"`

**assert:**
```js
surface_matches: [
  /Still here|push past/i,  // ⚠DRAFT
]
surface_excludes: [
  /\[roll:/,
  /\[strike:/,                             // must not fire a combat action
  /\[combat:/,                             // must not advance combat state
  /moment slips past/i,
]
```

**diverge:**

1. `"Same enemy HP three turns running. Are you tracking damage?"` — `reason: in-combat stat query (C6 — HP readback), not a system check-in`
2. `"You gave me the same roll number twice. Is that a bug?"` — `reason: roll-recall challenge (C5 adjacent); this is the H-12/13 roll-recall family, not the H-51 OOC check-in`

**source:** gracefulAdjudication.js:1536–1542 (handler comment + return); AGENT_CHANGELOG.md H-51; synthetic

---

## Coverage notes for Basecamp

**C3 — 3 cases.** Good verbatim coverage: turns 5 and 2 from postH52-H53/postH54-H55 give two clean WITS-check declarations. The tracking case (C3-003) reuses the postH39 verbatim but the C5/C3 boundary is blurry (the player asks BOTH what stat AND to roll it). The `surface_matches` for "a roll was resolved" are the weakest assertions — the deterministic engine path may not produce a `[roll:]` tag in the mechanics string when `llm-off`, so the harness should check both narration and mechanics output for roll evidence. Recommend a test fixture that exercises the check path explicitly.

**C6 — 3 cases.** Moderate verbatim coverage. The AC/Padded-coat case is well-attested from multiple gate failures (DM gave "a vague gesture toward warmth" — now excluded). The HP-mid-combat case is partially verbatim (one gate quote). The `surface_matches` for AC value are DRAFT: the engine may surface AC as a raw number or as a computation, and the regex needs tuning against real deterministic output. The "no record" exclusion in C6-002 is uncertain — the item DOES have a defined value, but if the engine's item definition doesn't flow into the deterministic path, the exclusion may false-fire.

**C7 — 4 cases.** Strong verbatim coverage of the failure mode: the tonic-evasion sequence across postH43-H44 and postH45-H46 gives multiple verbatim quotes per case. C7-003 (DM must not confirm "inert") is the hardest case — the engine may not have a live handler for this yet (it requires the DM to proactively correct a player's false assertion about an item). Marked `target` accordingly. The `[consume:none]` exclusion in C7-002 is solid — this exact tag appeared in the gate failures. Uncertain: how the engine phrases a correct "Tonic healed you" on the deterministic path.

**C8 — 3 cases.** Verbatim coverage of the `[combat:table-talk]` failure mode is excellent. The `surface_excludes` regexes for "narrated kill" (C8-001, C8-003) are brittle — they catch the specific prose from gate failures but a different sentence structure would pass through. The runner should ideally compare the mechanics damage number to the narrated damage number programmatically (C8-002) rather than only regex-matching. Mark the damage-comparison assert `⚠DRAFT` until the harness supports that.

**C10 — 4 cases.** Strong verbatim coverage across multiple personas and seeds. The `surface_excludes` for `[combat:table-talk]` is highly reliable — this exact tag consistently accompanied the failure mode. C10-003 (role-target shove) has a diverge that catches the "door-substitution" pattern where the DM switched from the NPC target to an inanimate object; the exact prose is excluded. Uncertain: whether `resolveEscapeCombatTurn` produces the `[strike: ... → hit/miss]` tag format on the deterministic path for all four cases, or only when `escapeMode` is already active.

**C11 — 3 cases.** Thin verbatim coverage — most confrontation transcripts are from the pre-H-42 era and don't show the correct response (in-character NPC reaction) since H-42 wasn't built yet. C11-003 (mixed roll) is marked `target` because H-42 explicitly scoped only failure-roll confrontations, not mixed; no test or gate evidence of the correct mixed-roll behavior exists yet. The `surface_matches` for "NPC physical posture" are highly uncertain and will need the harness to run against real output to calibrate — they could easily produce false negatives. This is the capability most in need of Basecamp tuning.

**C12 — 3 cases.** Good verbatim coverage of the failure mode (directional menu, location-denial). C12-001 and C12-002 reference the stageC2-travel playtest where the fix was confirmed working; these are effectively regression cases for already-fixed behavior. C12-003 is marked `target` because the "That way is blocked from here" fake-gate failure was observed in postH54-H55 and the fix may not yet exist — it's in the H-56 ungrounded-referent family. Movement surface signals are the hardest to assert deterministically (most movement produces narration, not a mechanics tag).

**C13 — 4 cases.** Rich verbatim coverage from the ridiculous-sarcasm-2026-06-06.md playtest, which confirmed live behavior for eat-the-sun, grandiose-boast, and meta-DM-takeover families. C13-004 (genuine creativity must resolve) is purely synthetic but directly mirrors the false-positive guard section of that same playtest — the boundary test is well-defined. The `surface_excludes` patterns cite known comeback lines from the `tryRidiculous` handler; new sarcasm variants could produce lines not covered by those regexes.

**C14 — 3 cases.** Thin verbatim material — the triggering transcript is reconstructed from the AGENT_CHANGELOG H-51 summary because the actual gate transcript with "You're just repeating yourself now, are you okay?" is referenced but the exact gate file (opus-gate-2026-06-20.md, Confused newbie) wasn't available as a separate file in the playtest directory. The `surface_matches` assert the actual response string from gracefulAdjudication.js:1541 ("Still here — let's push past the repeat. What do you want to do?") — this is highly specific and reliable on the deterministic path. The diverge for C14-001 (bare "are you okay, Corwin?") is critical to include because the real-world false-positive risk is in-fiction NPC health checks post-combat.

**Capabilities most uncertain (Basecamp tune-first):** C11 (confrontation reaction surface signal), C8 (cross-checking narration damage vs mechanics damage), C12 (movement surface signals on deterministic path).
