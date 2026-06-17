# Graceful Adjudication — Spec v1 ("Rung 1")

**Status:** 🟢 live (rule + fallback tiers); 🟡 LLM tier stubbed; 🟡 hazard seam wired, dark.
**Module:** `engine/gracefulAdjudication.js`
**Wired at:** the front of `engine/playloop.js` `playerMove()` (after the dialogue
intercept, before the interior/explore/spell/combat cascade).

## The problem

"Rung 1" is the engine understanding **what the player is trying to do** *before*
it rolls dice or narrates. Intent was classified by brittle keyword regexes
scattered through `playerMove`, failing on three seams:

1. **META questions got dice rolled at them.** "what's my AC?", "what's the DC?",
   "can I even do that?" fell through `inferMoveFromText` into `resolveMove` and
   rolled a d20 at a question.
2. **HAZARDS got narrated without damage.** Player damage only lands when
   `stakeTag==='harm'` (`engine/resolve.js`), and that tag only became `harm` on
   attack keywords in the player's *text*. A hazard living in the fiction (a fire,
   a fall, a trap) emitted no wound.
3. **MELEE got mistagged as a SPELL.** The greedy `^cast\s+(.+?)` regex caught
   "cast a glance"; the `ritual|curse|ward|summon` → `'occult'` map turned "ward
   off the goblin with my blade" into a spell.

**Doctrine** (PLAN.md line 1): *"AI can only describe what the canonical surface
says is true."* Narration already works — the surface it is handed is sometimes
false. **We fix the surface, not the narrator.**

## The decision

A single structured, **pure, deterministic, never-throwing** decision computed
once at the front of the turn:

```
AdjudicationDecision = {
  route: 'meta'|'clarify'|'dialogue'|'recruit'|'spell'|'combat'|'physics'|'travel'|'generic',
  confidence: 0..1,
  tier: 'rule'|'llm'|'fallback',
  move: { actorId, intentText, approachTag, stakeTag, targetId, toolTag } | null,
  meta: { kind:'rules'|'sheet'|'state'|'capability', answer:string } | null,
  hazardApplied: boolean,
  clarifyPrompt: string | null
}
```

`adjudicate(world, text, opts)` wraps its whole body in try/catch and abstains to
a safe `generic` decision on any internal error — it never throws to the caller
(same contract as the LLM layer).

## Three tiers

- **Tier 1 — `rule`** (deterministic regex over text + world state):
  - **META gate runs FIRST.** Capability / sheet / rules / state questions route
    to `route:'meta'` with an `answer` composed read-only from world state
    (`party[0]` level/wounds/maxWounds/stress/AC/spell slots/known spells; current
    node name + NPCs; top ledger facts). **No dice. No mutation.**
  - **SPELL gate** routes to `'spell'` only when text has a cast verb **AND** the
    named spell resolves via `lookupSpell()` **AND** (when the caster has a
    known-list) is known. Otherwise it is **not** a spell. `'occult'` approach is
    emitted **only** on the spell route.
  - Then **recruit / dialogue / combat / travel / physics** by verb, else generic.
    Combat moves are always `stakeTag:'harm'`; combat approach defaults to
    `'force'` (so "ward off … with my blade" is force, not occult).
- **Tier 2 — `llm`** (optional, injected via `opts.llmClassifier`): wrapped so it
  never throws; falls through to Tier 3 on error or malformed output. **Not called
  in v1.** TODO: cache any LLM decision in the Canon Log keyed by
  `(turn, normalized-text)` and re-read it on replay so `worldHash` stays stable —
  never call an LLM from this synchronous deterministic path.
- **Tier 3 — `fallback`** (keyword classifier): delegates approach/stake/risk
  **MATH** to `inferMoveFromText` (the single source of truth — passed in via
  `opts.inferMove`) rather than duplicating it. Returns `null`/abstains on true
  gibberish. If nothing clears the **confidence floor (0.45)**, returns
  `route:'clarify'` with a read-back prompt and **no move**.

### Gibberish heuristic (deterministic)

A token is "wordlike" if it contains a vowel and has no run of 4+ consonants.
Input is gibberish when it has ≥1 alphabetic token and **none** are wordlike →
abstain → `clarify`.

## Hazard seam

`withHazard(world, decision)`: if `world.scene.hazards` has an active
`'enter'`/`'act'` hazard, force `move.stakeTag` to the hazard's stake and set
`hazardApplied:true`. `scene.hazards` is `[]` until a later packet, so this is a
**no-op today** — the seam is wired now (called on combat/physics/generic routes)
so seam 2 closes when the field lands, with no further playloop edits.

## Playloop wiring

At the top of `playerMove` (after the dialogue intercept):

- `route:'meta'` → return `meta.answer` as narration. **No roll, no `applyDeltas`,
  no time tick, no beat, no resolution event** — `worldHash` is unchanged.
- `route:'clarify'` → return `clarifyPrompt` as narration, same no-mutation
  guarantee.
- All other routes **fall through to the existing cascade unchanged.** The
  decision additionally **gates the spell branch**: the `^cast …` parse only runs
  when `route==='spell'`, so a melee verb or "cast a glance" can never enter spell
  resolution or consume a slot.

`inferMoveFromText` / `inferCombatMoveFromText` remain the single source of truth
for approach/stake/risk math; the fallback tier delegates to them.

## Tests (`AJ` prefix)

- `tests/AJ01.metaNoRoll.test.js` — a meta question leaves `worldHash` identical
  and emits no resolution event / no time advance.
- `tests/AJ03.meleeNotSpell.test.js` — "cast a glance over the room" is not a
  spell and consumes no slot; a real known spell still routes to `spell`; "ward
  off the goblin with my blade" in combat routes to `combat` with `approachTag
  'force'`.
- `tests/AJ04.clarifyAbstains.test.js` — gibberish → `clarify`, no mutation, a
  `clarifyPrompt` present; recognizable intent does not abstain.

## Out of scope for v1 (stubbed)

- `world.scene.hazards[]` + `WORLD_VERSION` bump + invariants/`worldHash`
  projection (seam 2's data side).
- The real LLM tier + Canon Log caching of its decision.
