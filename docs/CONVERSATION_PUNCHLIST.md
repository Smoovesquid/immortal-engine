# The Conversational Engine — Pipeline Map & Punchlist

**Date:** 2026-06-10 · **Build:** v2-polish (post-crunch, WORLD_VERSION 24)
**Method:** adversarial probe through the exact UI path (`isMetaQuestion` gate →
`playerMove`), 37 realistic utterances across out-of-combat and in-combat
contexts. Probe script preserved in this doc's appendix; findings reproduce
deterministically on seed `probe`/`probe2`.

THE DM TEST is the bar: *resolve intent in the fiction, never bounce a
mechanical artifact back at the player.* Every entry below is a place we
currently fail that bar.

---

## 1. Pipeline map — where an utterance can land

Order of gates (UI → `playerMoveCore`):

| # | Gate | File | Notes |
|---|---|---|---|
| 0 | Meta-question answerer | `v1.js:472` → `gracefulAdjudication` | **Only when `!combat.active`** |
| 1 | Ending locked | playloop | read-only epilogue |
| 2 | Road-encounter pending | playloop | pay/talk/slip/fight parser |
| 3 | Long rest | playloop | `isLongRestIntent` |
| 4 | Guard (canon validation) | guard.js | blocked-text path |
| 5 | Companion dismiss verb | playloop | |
| 6 | Dialogue mode | playloop | when `scene.dialogue` |
| 7 | Interior enter/exit/move | playloop | |
| 8 | Examine intent | playloop | observe-only |
| 9 | Explore intent | playloop | observe-only |
| 10 | Free movement / named travel | playloop | C.2 stages |
| 11 | talk-to-NPC ref | playloop | dialogue entry |
| 12 | Spell casting (sandbox mode) | castSpell | non-escape only |
| 13 | **Combat branch** | `resolveEscapeCombatTurn` | escape mode: RAW TEXT → verb regex, **default verb = strike** |
| 14 | Attack-NPC intent | playloop | combat entry |
| 15 | Physics verbs | llmPhysics | |
| 16 | Trivial intent | playloop | auto-success |
| 17 | Argued social (Stage B) | playloop | |
| 18 | **General adjudication** | resolve.js | d20 vs DC — **the fall-through for everything unrecognized** |

Two structural sins follow from this shape:

- **S1 — In combat, everything is an attack.** Gate 0 is disabled in combat and
  gate 13 consumes all input with `strike` as the default verb. Questions,
  confusion, table-talk — all become sword swings that spend the round.
- **S2 — Out of combat, everything unrecognized is a d20 roll.** Gate 18
  adjudicates whatever fell through, including non-actions ("hmm", "never
  mind"), with real consequences (time, env residue, failure narration).

---

## 2. Punchlist (probe results)

Severity: ☠ = DM TEST violation with mechanical damage · ✗ = wrong but
survivable · ~ = cosmetic/edge.

### In combat

| # | Utterance | What happened | What a DM does | Sev |
|---|---|---|---|---|
| C1 | "wait, what are my options?" | **strike** — swung the longsword | Answer: options, kit verbs, no turn cost | ☠ |
| C2 | "how many of them are there?" | **strike** | "Two — a bandit and a wolf." Free. | ☠ |
| C3 | "how hurt am I?" | **strike** | "You're at 12 of 13." Free. | ☠ |
| C4 | "what is a sacred flame again?" | parsed `firebolt` → resolved as weapon hit | Explain the cantrip. Free. | ☠ |
| C5 | "can I run away?" | **strike** (a QUESTION about fleeing!) | "You can — they may get a parting blow. Do you?" | ☠ |
| C6 | "help" | **strike** | Options summary | ☠ |
| C7 | "kill the wolf first, not the bandit" | struck the **bandit** — resolver always targets first living enemy; named targeting ignored | Attack the wolf | ☠ |
| C8 | "I throw my mace at the wolf" | strike vs bandit (wrong target; throw ignored) | Improvised throw at the wolf | ✗ |
| C9 | "I call down holy fire on the bandit" | `firebolt` → plain weapon hit, **no smite** (paladin) | Divine smite | ✗ |
| C10 | "use my strongest attack" | plain strike | Pick the best available: smite/surge/rage | ✗ |
| C11 | "I dive behind the table and fire at the big one" | cover only — **the attack half vanished** | Cover, then the shot | ✗ |
| C12 | "back off and let me heal myself" | cure → redirect table-talk (paladin) ✓-ish | Acceptable; multi-intent (ward+heal) lost | ~ |
| C13 | "don't attack — try to talk them down" | parley ✓ (lucky parse order, not negation handling) | Works today; fragile | ~ |

### Out of combat

| # | Utterance | What happened | What a DM does | Sev |
|---|---|---|---|---|
| O1 | "actually, never mind" | **d20 focus roll** (a NAT20, even) | "Alright. Take your time." No roll. | ☠ |
| O2 | "hmm" | **d20 focus roll** | Silence or a nudge. No roll. | ☠ |
| O3 | "what do I have in my pack?" | location survey (wrong answer) | Read the inventory | ✗ |
| O4 | "how hurt am I?" | location survey — `META_HEALTH` regex missed the phrasing | HP readout | ✗ |
| O5 | "what time is it?" | location survey | Time of day | ✗ |
| O6 | "whats my quest agian" (typo) | **adjudicated d20 roll** | Recap the objective | ✗ |
| O7 | "I think we should rest up before going anywhere" | adjudicated roll → **failure** | Offer/perform a rest ("rest up" missing from rest intent) | ✗ |
| O8 | "let's get moving — head toward the forest" | adjudicated focus roll failure | Travel toward the forest | ✗ |
| O9 | "talk to someone" | charm roll failure | "Who? Theron's by the well…" (clarify) | ✗ |
| O10 | "go to the tavern and ask about rumors" | "That way is blocked" — move failed, ask dropped | Walk there, then the rumor scene | ✗ |
| O11 | "I look around for anything useful and then head north" | META survey; **"head north" dropped** | Survey, then travel | ✗ |
| O12 | "pick up a rock and put it in my pocket" | works, but narration echoes "**my** pocket" verbatim | "your pocket" — pronoun mirroring | ~ |
| O13 | "what can I do here?" | generic observe survey | Options-shaped answer is fine; could name verbs | ~ |
| O14 | "can I see the mountains from here?" | WITS check, mixed | Correct! A real perception ruling | ✓ |
| O15 | "I do NOT want to fight anyone, I just want to leave town quietly" | stepped outside | Acceptable | ✓ |
| O16 | "sleep" | long rest ✓ | Correct | ✓ |

---

## 3. Fix plan — three tiers

### Tier A — deterministic hardening (no LLM, no API; fixes C1–C7, O1–O9)

1. **Combat question gate** (kills C1–C6): before the verb parser, a
   question-shape detector (interrogative openers, trailing `?`, "help",
   "wait") routes to a free, in-fiction status answer built from real state:
   enemies + their visible condition, your HP, your kit verbs. Zero turn cost.
   This is `isMetaQuestion` extended INTO combat with combat-aware answers.
2. **Named targeting** (C7, C8): parse enemy names/nicknames from the input
   ("the wolf", "the big one" → biggest maxHp); resolver attacks the named
   target instead of always `enemies[0]`.
3. **"Strongest attack" intent** (C9, C10): map holy/strongest/everything
   phrases to the best available feature deterministically (smite if slots,
   else surge, else rage, else strike).
4. **Null-action detection** (O1, O2): bare acknowledgments, aborts, and
   filler ("never mind", "hmm", "ok", "wait") get a DM beat with NO roll and
   NO state change.
5. **Meta coverage** (O3–O6): inventory/health/time/objective phrasings +
   light fuzz (typo tolerance via loose word-stem matching) added to the
   meta-question gate, in and out of combat.
6. **Rest synonyms** (O7): "rest up", "take a breather" → offer the rest that
   fits (short vs long by location), or perform it.
7. **Movement phrasing** (O8): "head toward/let's get moving toward X" added
   to travel intent.
8. **Clarify-don't-roll for underspecified social** (O9): "talk to someone"
   with multiple NPCs present → the DM asks who, naming them. (Grace-layer
   pattern, deterministic.)

### Tier B — LLM intent arbiter (NEEDS THE API KEY in dev)

For what regex genuinely can't do (C11, O10, O11 multi-action; true negation;
paraphrase long-tail): inputs that survive Tier A unrecognized get ONE
structured-intent extraction call (action list + targets + free-text remainder),
silent-fallback to today's behavior on any error, per the llmPhysics pattern.
Multi-action returns an ordered plan the engine executes sequentially.

### Tier C — clarifying questions

When Tier B confidence is low or the plan is ambiguous mid-combat, the DM asks
one pointed question instead of guessing. Bounded: never more than one
clarification per input.

### Regression suite

`tests/UX2.conversationRouting.test.js` — this punchlist's utterances (and
descendants) as a table: input × context → expected route class. Grows with
every future misroute found; never shrinks.

---

## Appendix — probe script

Preserved at `scripts/probes/adversarial-conversation.mjs` (run with
`node scripts/probes/adversarial-conversation.mjs`).
