# DTD-A (Sonnet lane) — meta/knowledge questions get ANSWERED, never rolled or bounced

**Model:** Claude Sonnet (grace lane). **Runs in parallel with the Codex lane (DTD-B = `playloop.js` movement).**
You own **`engine/grace/gracefulAdjudication.js` only** — do NOT touch `playloop.js`.

## Context
The 2026-07-02 Opus gate (`docs/playtests/opus-gate-2026-07-02.md`) — DM_TEST_DEADEND was the dominant class
(4/6). THE_DM_TEST core: resolve the player's intent in the fiction; never bounce a question back as a roll or a
UI prompt. Three grace repros (all on seed `tallow`, all reproducible LLM-OFF at the routing layer):
1. **A rules question got ROLLED.** _"Gravedigger — is that a class with abilities, or just a background? What can
   I actually do in a fight?"_ → the engine rolled a d20 (3 vs DC 13) and fogged it. It fell through the
   meta-detectors onto the resolver.
2. **An in-fiction question got a nav prompt.** _"Who lit that lantern, Elske?"_ → `buildLocationSurvey` output
   ("Ways lead off east and south. What do you do?") instead of the NPC answering (or an honest "I don't know").
3. **CANON_HALLUCINATION — character-sheet gear invented.** _"what's my name, class, HP, and gear on me?"_ → DM
   claimed Mirror shard / Wooden staff / Worn Blade / Travel helm; canon is two Holy water. The gear answer wasn't
   grounded in real inventory.

## Read first
- The gate report §DM_TEST_DEADEND + §CANON_HALLUCINATION.
- `engine/grace/gracefulAdjudication.js`: `META_CHARACTER` (:318), `META_ARMOR_VALUE` (:295), `isMetaQuestion`
  (:589), `handleMetaQuestion`, `buildLocationSurvey`, the character-sheet answer assembly (~:1904, ~:2166), the
  player-name answer (~:1609).
- `docs/THE_DM_TEST.md` (the governing principle).

## Fix shape (answer from canon — Road A; never let the LLM supply the fact/outcome)
1. **Rules/class/capability questions → a meta ANSWER, not a roll.** Extend the character-meta detection (a new
   `META_CAPABILITY`, or widen `META_CHARACTER`) to catch "is X a class / background", "what can I do in a fight",
   "what can I do / what abilities do I have". Route to `handleMetaQuestion` (answer from the ruleset/class) so it
   never reaches the d20 resolver.
2. **NPC-addressed in-fiction questions → the NPC / an honest answer, not a survey.** A "<question> , <NpcName>?"
   (or "<NpcName>, <question>") must NOT return `buildLocationSurvey`. Detect the npc-address + question and let the
   dialogue/npc path answer (or an honest "I couldn't say") — never a navigation recap.
3. **Character-sheet gear from REAL state.** The gear/inventory portion of a character-sheet answer must list the
   player's ACTUAL `world.party[].inventory` items — never leave "gear on me" for the LLM to fill. Ground it so the
   deterministic answer carries the real items.

## Invariants — by reference (do not weaken)
Road A / Biblioteca V11 — the grace layer answers from canon; never let the LLM set the fact or the number.
THE_DM_TEST + THE_TABLE_TEST. Determinism: `engine/rng.js` sole randomness; `worldHash` stable; U19/21/22/27/30
green. LLM never throws (silent fallback). **Over-match discipline (critical):** this layer is mature with a large
existing meta-question corpus — any new regex must NOT swallow real actions ("I fight the guard" is not a
meta-question) or break existing tests. Prove no regression with the full suite + convergence.

## Test plan
`tests/U310.*.test.js` (pre-assigned). LLM-OFF routing assertions on the `tallow` start: (1) the rules/capability
question routes to a meta/info ANSWER, not a roll (no `roll:` mechanics); (2) the npc-addressed question does NOT
return a `buildLocationSurvey` nav recap; (3) the character-sheet answer contains the player's real inventory
item(s), not invented gear. Existing meta-question tests stay green.

## Done-when
`U310` green · `node --test` fully green · `npm run convergence` 100% locked · determinism green.

## Out of scope
Do NOT touch `engine/playloop.js` (Codex owns it this round — the "go outside" movement fix). Not the DM_ARTIFACT_LEAK
narration case (THE_REF track). Not P6. **Do NOT bump the version** — Basecamp bumps once at integration.

## Commit protocol
Stage ONLY `engine/grace/gracefulAdjudication.js` + `tests/U310.*` by explicit path — the shared tree shows the
Codex lane's dirty `playloop.js`; **never `git add -A`**. Commit locally
(`fix(grace): DTD-A — meta/knowledge questions get answered, not rolled or bounced`). **Report the commit hash;
do NOT push** — Basecamp verifies both lanes and integrates.
