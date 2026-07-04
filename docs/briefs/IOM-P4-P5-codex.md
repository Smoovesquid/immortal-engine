# IOM-P4 + P5 (Codex lane) — failure narration grounds in the room + compound "move-then-act" routing

**Model:** Codex 5.5 (deep-engine, `playloop.js` hot file). **Serial: do P4, then P5** (both edit `playloop.js`).
**Runs in parallel with the Sonnet lane (P2 = `llmAdapter`/`narratorContext`/`roomState`).** You are file-disjoint
from Sonnet — you do NOT touch `engine/llmAdapter.js`, `narratorContext.js`, or the narration prompts.

## Context
Interior Object Model track. P1 (landed, commit `4400956`) made furniture room-scoped:
`objectsHere(w)` in `engine/structures/roomObjects.js`. Two `playloop.js` residuals remain:
- **P4** — failure narration is place-generic and has a literal **"reach for the it"** article bug; it should
  name the acted-on object, and when that object is in a SIBLING room, say so concretely.
- **P5 (WB-Q3)** — a compound "move then act" sentence ("I head back to my room and open that iron-bound chest")
  falls off every regex gate onto a raw d20 instead of moving + then acting.
Full diagnosis + spec: `docs/briefs/INTERIOR_OBJECT_MODEL.md` — §P4 (270–282) + §P5 (284–296).

## Read first
- `docs/briefs/INTERIOR_OBJECT_MODEL.md` §P4, §P5.
- `engine/structures/roomObjects.js` (`objectsHere`, `furnitureRoomAssignments` — for sibling-room detection).
- `engine/playloop.js`: the generic failure floor / `genericActionObject` (~6793–6803), `takeTargetOf`, and the
  "the it" fallback (~6839–6845, the `take:f:${what}` bank); `inferInteriorAction` (~3759), the interior-move
  machinery (`resolveInteriorRoomHint` ~7243), and the action-dispatch chain.
- `tests/U258*.test.js` (the whole-building movement family — fixture pattern + over-match guards; the WB-F4
  "press through the crowd" precedent).

## P4 fix shape (`playloop.js` only)
- **Article-safe fallback:** `takeTargetOf(t) || 'it'` must never render "the it". With no named object, emit
  "You reach for it," (no article) — fix the `take:f` bank (~6845) and any sibling bank with the same
  `the ${what}` shape when `what === 'it'`.
- Extend `genericActionObject` (~6793–6803) to scan **clause-by-clause** (split on `,` `;` ` and `) so a compound
  sentence still yields the acted-on object.
- When the named object matches `objectsHere` in a **sibling** room (present at the node but assigned elsewhere —
  use `furnitureRoomAssignments`), say so concretely: *"the iron-bound chest is back in the bedchamber — nothing
  like it here"*, instead of the place-generic line.
- Keep every line in the EXISTING banks' voice (Biblioteca V17; narrate the read, not the number; no
  machine-voice). Keep `pickVariant(..., world, key)` seeded (determinism).

## P5 fix shape (`playloop.js` only)
- In `inferInteriorAction` / the dispatch, recognize `<interior move clause> and (then )? <act clause>`
  (t19's exact shape). Execute the move via the EXISTING interior-move machinery, then **re-dispatch the
  remainder clause through the normal gate chain in the new room** — where P1 makes the chest genuinely present
  so the free container path fires (no roll).
- **MANDATORY over-match guards** (U258 style, WB-F4 precedent): "press through the crowd", "reach for the sun",
  etc. must NOT trip the compound-move split. This is the highest regression surface in the cluster — guard hard.

## Invariants — by reference (do not weaken)
Determinism: `engine/rng.js` is the ONLY randomness; `worldHash` stable under replay; U19/21/22/27/30 green.
Resolution stays deterministic — NEVER let an LLM decide the outcome/number (Biblioteca V11; the resolver is
d20-vs-DC in `engine/resolve.js`). Mutations only via `effectsCore.applyDeltas`; `invariants.js` throws; Canon
Log authoritative; `docs/THE_DM_TEST.md` + `docs/THE_TABLE_TEST.md`; §0 never surfaced. CLAUDE.md purity rules.

## Test plan (pre-assigned — U307 is the current max)
- **P4 → `tests/U308.*.test.js`:** t11/t19-shaped inputs produce intent-naming, room-true prose; "the it" is
  gone (never "the it"); a sibling-room object gets the concrete "back in the <room>" line.
- **P5 → `tests/U309.*.test.js`:** the t19 repro ("I head back to my room and open that iron-bound chest") ends
  in a container reveal with **`no roll`** mechanics; over-match guards hold ("press through the crowd" doesn't split).
- Regression: `U258`/`U260`/`U263` stay green (export `genericGroundedOutcome` if needed for a unit test).

## Done-when
`U308` + `U309` green · `U258`/`U260`/`U263` green · `node --test` fully green · `npm run convergence` 100% locked ·
determinism green · **`npm run playtest:quick` 0 crashes / 0 bugs** (playloop touched — mandatory).

## Out of scope
Do NOT touch `engine/llmAdapter.js`, `narratorContext.js`, `roomState.js`, or the DM/dialogue prompts (Sonnet
owns those). Do NOT start P3 (dialogue) or P6 (model convergence / WORLD_VERSION bump). **Do NOT bump the
version** — Basecamp bumps once at integration.

## Commit protocol
Stage ONLY `playloop.js` + your new `U308`/`U309` tests (+ any `U258`-family edits) by explicit path — the shared
tree shows the Sonnet lane's dirty files; **never `git add -A`**. Commit **locally**
(`feat(interiors): IOM-P4+P5 — failure floor grounds in the room + compound move-then-act`). **Report the commit
hash(es); do NOT push** (Codex-no-push rule — Basecamp pushes from its own environment and integrates both lanes).
