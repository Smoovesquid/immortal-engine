# IOM-P2 (Sonnet lane) — room-state façade + the DM prompt learns the room's real objects & occupants

**Model:** Claude Sonnet (narration/facts lane). **Runs in parallel with the Codex lane (P4+P5 = `playloop.js`).**
You are **file-disjoint** from Codex — you do NOT touch `engine/playloop.js`.

## Context
The Interior Object Model track. P1 (landed, commit `4400956`) made furniture room-scoped in the *engine*:
`objectsHere(world)` in `engine/structures/roomObjects.js` returns only THIS room's pieces. But the DM
narration prompt still receives **zero object facts**, so the DM invents furniture the room doesn't have
(and can't reliably act on what IS there). P2 feeds the room's real facts into the DM prompt.
Full diagnosis + spec: `docs/briefs/INTERIOR_OBJECT_MODEL.md` — §2 (the façade) and §P2 (lines 234–249).

## Read first
- `docs/briefs/INTERIOR_OBJECT_MODEL.md` §2 + §P2.
- `engine/structures/roomObjects.js` (P1 — `objectsHere`, `furnitureRoomAssignments`).
- `engine/structures/interiors.js` (`describeInteriorLayout` — the WB-F5 precedent for how layout facts
  already reach the prompt), `roomOccupancy.js` (`occupantsOfRoom`, and the outdoor-occupants helper),
  `roomDetail.js`.
- `engine/ai/narratorContext.js` (`buildScene` ~387–391; `buildNPCsPresent` ~437–449).
- `engine/llmAdapter.js` (`interiorLayoutFact` ~52–63; `buildDMSystemPrompt` ~1299; `buildSystemPrompt` ~89).

## Fix shape (facts only — do NOT touch voice/style lines)
1. **New `engine/structures/roomState.js`** — a thin, pure, DERIVED façade `getRoomState(world[, nodeId])`
   over the existing P1 derivers + topology/occupancy. Returns
   `{ buildingType, roomCount, singleStorey, roomName, doorways, objects:[{name,state}]≤6, occupants:[...] }`.
   Nothing stored — same purity contract as `roomObjects.js` (no WORLD_VERSION bump, worldHash untouched).
   This is the shared façade P3/P4 will also consume, so keep it self-contained.
2. `buildScene` (`narratorContext.js`): `interior` gains `objects` (name+state, cap ~6) from `getRoomState`.
3. `buildNPCsPresent`: add a per-NPC `inRoomWithPlayer` boolean (`occupantsOfRoom` inside / outdoor-occupants
   outside). **ADD the flag — do NOT filter the roster** (downstream dialogue continuity reads the full list).
4. `interiorLayoutFact` (`llmAdapter.js`): one added fact line naming the room's real objects, e.g.
   *"In this room: a straw pallet, an iron-bound chest (open). These are the room's furnishings — do not invent
   others you expect the player to act on."* The NPCs-present block marks who is actually in the room.

**HARD guardrail (taste lane):** FACTS ONLY. Do not change any voice/tone/style line in the DM prompt. You add
fact lines + a no-invention constraint; you do not rewrite how the DM speaks. (Biblioteca V17 hide-the-math:
the added facts are context for the DM, never player-facing stat dumps.)

## Invariants — by reference (the docs win; do not weaken)
Determinism: `engine/rng.js` is the sole randomness; `worldHash` stays stable; U19/21/22/27/30 green —
`getRoomState` MUST be pure/derived, nothing stored. Mutations only via `effectsCore.applyDeltas`.
`invariants.js` throws. `docs/THE_DM_TEST.md` + `docs/THE_TABLE_TEST.md` govern. §0 cosmology never surfaced.
CLAUDE.md purity rules.

## Test plan
Add **`tests/N10.*.test.js`** (pre-assigned; next free N). Assert: the built DM prompt contains the room's
real object names; an out-of-room NPC is marked NOT in the room; existing **N7** (interior-layout gate) stays green.

## Done-when
`N10` green · `N7` green · `node --test` fully green · `npm run convergence` 100% locked · determinism green.

## Out of scope
Do NOT touch `engine/playloop.js` (Codex owns it this round), the dialogue/npc-voice path (that's P3, next),
resolution, or P6 model-convergence. No voice rewrite. **Do NOT bump the version** — Basecamp bumps once at
integration (avoids a `package.json`/`v1.js` collision with the Codex lane).

## Commit protocol
Stage ONLY your files by explicit path (`roomState.js`, `narratorContext.js`, `llmAdapter.js`, `tests/N10.*`) —
the shared tree will show the Codex lane's dirty `playloop.js`; **never `git add -A`**. Commit locally
(`feat(interiors): IOM-P2 — DM prompt learns the room's real objects & occupants`). **Report the commit hash.**
You may push your own, but for this parallel round prefer: **do not push — report the hash and Basecamp
integrates both lanes** (verifies, bumps the version, pushes).
