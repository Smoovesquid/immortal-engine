# Playtest — Conversational Tier A: Deterministic Hardening (2026-06-10)

**Build:** v2-polish · **Spec:** docs/CONVERSATION_PUNCHLIST.md
**Persona:** crusty DM. "If a player asks a question and you make their character swing a sword, you are not a DM. You are a trap."
**Surface:** adversarial probe re-run (same 37 utterances) + UX2 routing regression suite + live `v1.html` mid-combat question.

## Verdict: GREEN — every ☠ from the punchlist is dead, no API key needed

## What changed (all deterministic)

| Punchlist | Fix |
|---|---|
| C1–C6 ☠ (questions mid-combat = attack) | **Table-talk gate** in the escape combat branch: null actions and question-shaped input get answered for FREE — the round holds. `combatStatusAnswer()` reads real state: foes + visible condition ("bloodied a little", "held rigid"), your HP (+ice), every verb in your kit, available cover, parley/flee. Parley-as-question ("can we talk about this?") and explicit action words ("uh… strike I guess?") pass through to the resolver. |
| C7 ☠ (targeting ignored) | **Named targeting** with negation scrubbing: "kill the wolf, not the bandit" hits the WOLF. "The big one" reads size; "the wounded one" reads HP. Applies to strikes, cantrips, and single-target spells. |
| C9/C10 ("holy fire", "strongest attack") | **Strongest-verb resolution**: the DM picks your best available move — fireball > smite > surge > scorching ray > magic missile > reckless > strike, gated on what you actually have. |
| O1/O2 ☠ ("hmm", "never mind" rolled dice) | **Null-action gate** with leading-filler tolerance ("actually, never mind"): "Take your time. The world holds." No roll, no timeline event, no env residue (asserted in UX2-06). Skipped in dialogue, where a bare "yes" is an answer. |
| O3–O6 (wrong answers to questions) | **Meta coverage**: inventory (question-anchored so "put it in my pocket" stays an action), time of day from travel hours, quest/objective recap (typo-tolerant), health phrasings — and health now reads REAL escape HP, not the legacy wounds estimate. All work in combat too. |
| O7 (rest up → failed roll) | **Rest synonyms** + the wilderness **breather**: no bed in the wild, but you get a short rest instead of a flat refusal — a DM gives you something for stopping. |
| O8 (travel phrasing from indoors) | "head toward/make for/get moving/set out" recognized; voiced indoors → **clarify**: "the road starts at the door." |
| O9 ("talk to someone" → failed roll) | **Clarify-don't-roll**: names who's actually present — "A few folk are about — Theron, Rook, Asha. Who do you want to talk to?" |

## Probe deltas (before → after)

- 11 of 13 in-combat findings fixed; the 2 remaining (multi-action "dive and
  fire", improvised throw mechanics) are Tier B by design.
- 7 of 9 ☠/✗ out-of-combat findings fixed; the 2 remaining are multi-action
  sentences (Tier B).
- Zero regressions: legitimate actions still roll ("can I see the mountains?"
  is still a WITS check; "pick up a rock" is still an action; "strike I
  guess?" still strikes; parley still parleys).

## Verification

- **UX2 routing regression suite** (6 tests over 31 tabled utterances ×
  expected route class) — the punchlist in permanent test form. Grows with
  every future misroute; never shrinks.
- Full suite 7,400 green (one deliberate contract change: U115-07 wild rest
  now expects the breather); playtest:full 500 runs, no bugs.
- Live: planted an active fight via the production save path, typed
  "wait — what are my options here?" — the DM answered with foes, HP, the
  full verb list, cover, and "Asking costs you nothing — the round waits."
  `[combat:table-talk]`, no console errors (/tmp/tabletalk.png).

## What remains (Tier B — NEEDS THE DEV API KEY)

- Multi-action sentences: "I dive behind the bar and fire at the big one",
  "go to the tavern and ask about rumors" — ordered plans need the intent
  arbiter.
- Paraphrase long-tail and true negation beyond the deterministic scrub.
- Tier C clarifying questions for low-confidence extractions.
