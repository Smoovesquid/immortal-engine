# IOM-P3 (Sonnet lane) — the dialogue voice stops inventing space (WB-Q9)

**Model:** Claude Sonnet (narration/dialogue lane). **Solo packet** — no parallel lane this round, so you own
`playloop.js`, `public/v1.js`, the npc-voice server path, and `llmAdapter.js` for this change. P4/P5 are already
committed; the dialogue assembly you edit (`playloop.js:1010`) is far from their regions (~3759 / ~6800).

## Context
Last piece of the "invents space" bug. P1 room-scoped furniture; P2 gave the **DM** prompt the room's real
objects + occupants. But the **NPC-voice/dialogue** path still gets **no world facts at all** — so an NPC in the
single-storey tallow cottage still offers "guest rooms upstairs" (WB-Q9). Its own SHARE instruction even licenses
"invent small local color." P3 feeds the real room facts into the npc-voice prompt and adds one grounding rule.
Full diagnosis + spec: `docs/briefs/INTERIOR_OBJECT_MODEL.md` §P3 (lines 251–268).

## Read first
- `docs/briefs/INTERIOR_OBJECT_MODEL.md` §P3.
- `engine/structures/roomState.js` — **P2's landed `getRoomState(world[, nodeId])`** (line 33). Returns
  `{ inside, structureId, roomId, building:{type,roomCount,singleStorey}|null, atEntry, doorways,
  objects:[{name,state,…}]≤6, occupants }`. This is your fact source — do NOT re-derive.
- `engine/playloop.js:1010` — the dialogue output object (carries `factPhrase`, `mood`, `manner`); where you
  attach `sceneFacts`.
- `public/v1.js:594` — the `fetch('/api/npc-voice', …)` client call (payload passthrough, ~594–609).
- The `/api/npc-voice` route (in `server.js`) → `server/npcVoicePrompt.js:134` **`buildNpcVoicePrompt`** (a PURE
  function — the unit-test target; render the facts block here).
- `engine/llmAdapter.js:291` `callNpcVoice` + the **withheld-mode secret-leak guard at 458–459** (`if (mode ===
  'withheld' && factPhrase) …`).

## Fix shape (facts + one rule — do NOT touch manner/voice/decision wording)
1. **Engine (`playloop.js:1010`):** attach `sceneFacts` to the dialogue output object, mapped from `getRoomState(w)`:
   `{ buildingType: building?.type, roomCount: building?.roomCount, singleStorey: building?.singleStorey,
   roomName: roomId, doorways, objects: objects.map(o=>o.name).slice(0,5) }`. Null-safe outdoors (`inside:false`).
2. **Client (`public/v1.js` ~594–609):** forward `sceneFacts` in the `/api/npc-voice` POST body.
3. **Server route (`server.js`):** pass `sceneFacts` through to `buildNpcVoicePrompt`.
4. **Prompt builder (`server/npcVoicePrompt.js:134`):** render `sceneFacts` as a **WHERE-YOU-ARE facts block**
   plus **one grounding rule** (the WB-F5 clause, adapted): *"Speak only of rooms, floors, and furnishings listed
   here. A single-storey building has no upstairs; do not invent rooms, floors, or exits that aren't listed."*
   Adds facts + a constraint; existing manner/decision wording untouched.

## Invariants — by reference (the docs win; do not weaken)
- **Secret-leak guard stays intact (Biblioteca V12–13):** `sceneFacts` are PUBLIC room context (objects, doorways)
  — prompt INPUT only. They must NOT enter the withheld-mode leak denylist (`llmAdapter.js:458–459` scans the
  voiced OUTPUT for the `factPhrase` secret). After your change, a withheld fact must STILL be unable to leak —
  prove it in the test.
- **LLM never throws (silent fallback):** `sceneFacts` is optional context; a missing/empty value must not crash
  the npc-voice path.
- **Determinism:** `getRoomState` is pure/derived (no state write, no `worldHash` change); `buildNpcVoicePrompt`
  stays a pure function. U19/21/22/27/30 green.
- Facts only — no voice rewrite (Biblioteca V17: context for the NPC, never player-facing stat dumps).
  `docs/THE_DM_TEST.md` + `docs/THE_TABLE_TEST.md`; §0 cosmology never surfaced. CLAUDE.md purity rules.

## Test plan
- **`tests/N11.*.test.js`** (pre-assigned; next free N). Drive `buildNpcVoicePrompt` (pure — no model needed):
  assert the rendered prompt contains the real layout facts (building type, room count, single-storey, doorway
  count, the real object names) AND the grounding rule text. Add a case proving a withheld `factPhrase` is still
  caught by the leak guard (the guard didn't regress).
- Regression: existing npc-voice / dialogue tests stay green (e.g. `U294` npc-voice validator).

## Done-when
`N11` green · `node --test` fully green · `npm run convergence` 100% locked · determinism green ·
**live probe (LLM on):** a small CLI script on the `.env` key drives an npc-voice turn for an NPC in the tallow
cottage and the line **no longer offers upstairs / guest rooms** (run it via the CLI, not the interactive gate —
budget-gated, a couple of calls).

## Out of scope
Do NOT touch P4/P5's resolution paths (only the dialogue-output object at ~1010). Do NOT start P6 (model
convergence / WORLD_VERSION bump). No manner/voice rewrite. Do NOT weaken the secret-leak guard.

## Commit protocol (solo packet)
Stage ONLY your files by explicit path (`playloop.js`, `public/v1.js`, `server.js`, `server/npcVoicePrompt.js`,
`llmAdapter.js` if touched, `package.json`, `public/v1.js` version line, `tests/N11.*`) — untracked briefs/docs
are in the tree, so **never `git add -A`**. **Bump the version** (solo, no collision): `package.json` →
**`0.20.3`**, and `public/v1.js` header → **`v0.20.3`** / **`build 028 · 2026-07-02 · the NPCs see the room`**.
Commit locally (`feat(interiors): IOM-P3 — the dialogue voice stops inventing space`). **Report the commit hash;
do NOT push** — Basecamp verifies (re-runs the gate, confirms the leak guard still fires, checks the live probe)
and pushes.
