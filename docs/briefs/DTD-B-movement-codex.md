# DTD-B (Codex lane) — "can I go outside and look around?" leaves the room, not a survey

**Model:** Codex 5.5 (deep-engine, `playloop.js`). **Runs in parallel with the Sonnet lane (DTD-A = grace).**
You own **`engine/playloop.js` only** — do NOT touch `engine/grace/gracefulAdjudication.js`.

## Context
The 2026-07-02 Opus gate (`docs/playtests/opus-gate-2026-07-02.md`) — DM_TEST_DEADEND was dominant. The movement
repro (Confused-newbie, seed `tallow`): _"Huh, D... maybe I'll figure it out. **Can I go outside and look
around?**"_ → the DM re-described the interior room instead of moving outside. Root: `inferInteriorAction` doesn't
recognize the exit intent when it's wrapped as a question ("can I …?") and followed by "…and look around", so the
text falls through to a location survey. (The player had to repeat "I said I want to go outside" next turn.)

## Read first
- The gate report §DM_TEST_DEADEND (the newbie movement fail).
- `engine/playloop.js`: `inferInteriorAction` (:3794) and its exit branch (:3848 —
  `leave|exit|go outside|step outside|…|head out|back out`), the meta/survey routing (:893 — the `isMetaQuestion`
  guard that excludes `META_LOCATION`; :1162 — the `inferInteriorAction` call; :4147 — interior transitions).
- Imported grace signals `META_LOCATION` (:237 in grace) and the **`META_MOVE_TO_PLACE`** precedent (:245 —
  WB-F3, where a motion-verb + spatial-target was made to WIN over the location survey). Mirror that pattern for
  the EXIT case.

## Fix shape (`playloop.js` only)
Make `inferInteriorAction` recognize EXIT/movement intent through a question wrapper and a trailing survey clause:
- _"Can I go outside and look around?"_ → an interior **exit** (leave the building), NOT a location survey. The
  "…and look around" is a natural follow-on to arriving outside; the exit wins.
- Do the precedence entirely within `playloop` (reuse `inferInteriorAction`'s existing exit detection at :3848);
  do not add a grace regex — grace is the other lane.

## Invariants — by reference (do not weaken)
Determinism: `engine/rng.js` sole randomness; `worldHash` stable under replay; U19/21/22/27/30 green. Road A /
THE_DM_TEST + THE_TABLE_TEST. **Over-match discipline (WB-F4 precedent — critical):** bare "look around" /
"what's here?" / "check the rest" with NO exit verb must STILL survey (not leave); "press through the crowd" must
not become a move. Only genuine exit-movement wins. Guard hard.

## Test plan
`tests/U311.*.test.js` (pre-assigned). On the `tallow` interior start: (1) "Can I go outside and look around?"
resolves as an interior exit/move (not a survey); (2) plain "go outside" still leaves; (3) guard — bare "look
around" / "what's around here?" still surveys (no false exit). Existing `U258`/movement/interior tests stay green.

## Done-when
`U311` green · `U258`/`U260`/`U263` green · `node --test` fully green · `npm run convergence` 100% locked ·
determinism green · **`npm run playtest:quick` 0 crashes / 0 bugs** (playloop touched — mandatory).

## Out of scope
Do NOT touch `engine/grace/gracefulAdjudication.js` (Sonnet owns the meta-question binding this round). Not the
CANON_HALLUCINATION or DM_ARTIFACT_LEAK cases. Not P6. **Do NOT bump the version** — Basecamp bumps at integration.

## Commit protocol
Stage ONLY `engine/playloop.js` + `tests/U311.*` by explicit path — the shared tree shows the Sonnet lane's dirty
grace file; **never `git add -A`**. Commit **locally** (`fix(playloop): DTD-B — exit-movement wins over the room
survey ("can I go outside and look around")`). **Report the commit hash; do NOT push** (Codex-no-push — Basecamp
verifies both lanes and pushes).
