# The Two-Lane Plan — parallel wiring sprint (charter)

*Started 2026-06-24 off `v2-polish` HEAD `b84c7d1`. Homebase conducts; two worker lanes run hot in
isolated worktrees. This is the durable version of the three dispatch prompts. Re-derive state from git
before trusting any line here — workers advance the tree.*

## The split

| Lane | Charge | Worker | Worktree branch |
|---|---|---|---|
| **Light Up the World** | coverage / query / voice — make built-but-dark depth REACH the player | Sonnet | `living-world/voices` |
| **Make Every Turn Honest** | correctness floor + consequence — the turn loop, combat, dialogue, morality | Codex | `honest-turn/p86-combat` |
| **Homebase** (this window) | plan the split, own the merge into `v2-polish`, own the serialized seams, never delegate global invariants | — | `v2-polish` |

## What landed first (the reconciliation — why W1·1 is smaller than it looks)
As of `b84c7d1` the NPC **voice pipe is wired end to end** (D-C1/D-C2a): `npcVoiceResolve.js`
(`voiceCorpusId` → archetype allowlist), `dialogue.js` surfaces it, `server.js /api/npc-voice` →
`retrieveChunks` → `buildNpcVoicePrompt` → `callNpcVoice` (Opus 4.8), and `demoFigures.js` places the
steward-king (Aurelius voice) at the tallow seat. **So W1·1 is a COVERAGE packet (broaden the
allowlist), not a wiring one.** Named-figure placement is the `demoFigures` overlay's job, not random
genesis assignment.

## The fence (disjoint file-sets — neither lane crosses)
- **Light Up the World OWNS:** `engine/npc/npcGenesis.js`, `engine/npc/npcVoiceResolve.js`,
  `engine/world/placeQuery.js`, `engine/world/personQuery.js`, `engine/world/demoFigures.js`,
  `server/rag/*`, `server/npcVoicePrompt.js`, `server.js` (the `/api/npc-voice` route only),
  `engine/claims.js` (READ), `engine/rumor/*`, `engine/world/substrate*`, DEMO_REGION data, its tests.
- **Make Every Turn Honest OWNS:** `engine/playloop.js`, `engine/grace/*`,
  `engine/combat/escapeCombat.js`, `engine/npc/dialogue.js`, `engine/resolve.js`, `engine/effectsCore.js`
  (logic), the morality threads in those + `worldTick.js`/`composer.js`, `engine/harness/*`, its tests.
- **Homebase OWNS (serialized — never parallel):** `engine/state.js` / `WORLD_VERSION` / migrations /
  `worldHash` / Canon Log / `engine/rng.js` / `engine/effectsCore.js` (the mutation API itself);
  the narration layer (`engine/llmAdapter.js` `buildSystemPrompt` + `validateNarrationCandidate`,
  `engine/ai/narratorContext.js`); and the cross-lane **rumor read-API contract**.

## Packets + done-when

**Light Up the World** — ✅ **ALL LANDED `6dc951a` (2026-06-24, clean FF, +37 tests green)**
- **W1·1 — Populate every voice (finish Decision #1).** ✅ LANDED `1efbd40`. Broaden `npcVoiceResolve`'s
  allowlist from 25 to the full set of minted roles that have a corpus file. *Done-when:* a broad sweep of
  tallow NPCs resolves to a grounded Opus voice; unmapped roles fall back cleanly; `worldHash`
  replay-stable; a coverage U-test (U270, 7/7). *(voiceCorpusId is a soft field → no WORLD_VERSION bump.)*
- **W1·2 — The world answers (P-85).** ✅ LANDED `4a69465`. Deepen `placeQuery`/`personQuery` so pointed
  substrate questions resolve from buried history (no routing change). *Done-when:* a battery returns
  grounded answers or an honest in-fiction decline (never a roll/fabrication); resolver U-tests (U271, 17/17).
- **W1·3 — Rumor surface (P-83).** ✅ LANDED `6dc951a`. Filled `engine/rumor/rumorsReaching.js` (the
  contract below): reads `world.rumors` (carried, pre-garbled) + synthesizes player-deed rumors from
  `world.deeds` (severity ≥ 25, `garbleRumor` by proximity tier). Pure/deterministic, copies-before-sort.
  *Done-when:* the read-API returns fidelity-tiered rumors deterministically; U-tests (U272, 13/13; my
  contract guard U266 still green). **→ W2·3 is now UNBLOCKED.**

**Make Every Turn Honest**
- **W2·1 — Correctness floor: COMBAT (P-86).** Harness the combat slice; close the RESIDUAL reconciliation
  seams (minus the H-92 / `d2600e4` ones already fixed). *Done-when:* residual seams fixed + test-locked,
  no state-desync on combat runs, suite + determinism green.
- **W2·2 — Correctness floor: DIALOGUE (P-86).** Harness the conversation slice; close agency/trust/
  info-ask seams (mine Biblioteca Vol 7/15/17). *Done-when:* clean dialogue runs + tests.
- **W2·3 — Morality M2.** Witnessed deed shifts trust (built) + reputation that TRAVELS (consumes W1·3's
  `rumorsReaching`) + towns withholding from the notorious. **Gated on W1·3 + new state fields → both via
  Homebase.** *Done-when:* a tracked atrocity in one town measurably changes a stranger's reception in the
  next; tests; determinism intact.

## The one dependency — ✅ CLEARED
`W2·3 (reputation-travels) → consumes → W1·3 (rumorsReaching)`. **W1·3 landed first (`6dc951a`), as
intended — the producer is real before the consumer builds.** Coordination notes for W2·3:
- **Rebase `honest-turn/p86-combat` onto `6dc951a` before building W2·3** (it carries the filled impl, not
  the stub). The first two W2 packets (combat/dialogue) don't need it and can stay on their current base.
- **Threshold alignment:** deed→rumor gossip fires at **`severity ≥ 25`** (0..100 scale). W2·3's notoriety
  logic should key off the same cut so "what travels" matches "what shifts a stranger's reception."
- The read shape W2·3 consumes is frozen by **U266** (`{subject, body, tier 0..4, distortion [0,1],
  provenance[], eventRef, deedRef}`).

## The cross-lane contract (Homebase-owned, committed up front)
`engine/rumor/rumorsReaching.js` — `rumorsReaching(world, nodeId, opts?) → Rumor[]`, where
`Rumor = { subject, body, tier(0..4), distortion[0,1], provenance[], eventRef|null, deedRef|null }`.
READ-ONLY, pure, deterministic. **W1·3 fills the body; W2·3 imports it.** Shape pinned by `tests/U266`.

## Integration loop (per branch handed up)
`git fetch` the branch → review the diff → `scripts/lane-check.sh` + `npm run check` → confirm outgoing
is ONLY that lane's commits (catch foreign edits) → merge to `v2-polish` → re-run `npm run check` →
push. Keep `v2-polish` always-green. **Collision policy (LANE_MAP §7):** if both lanes need one hot
file, STOP — name the owner, the other waits/docs, merge owner, rebase other, re-check. Long-game fix =
EXTRACTION (carve a handler out of `playloop.js` into its own ownable module).

## WORLD_VERSION sequencing
Collect field proposals; sequence **ONE** bump. Expected sources: **W2** (morality/reputation state — a
real bump). **W1** brings none (`voiceCorpusId` already flows). Add safe defaults in `ensureWorld`, add
invariants, fix version-embedded test strings, run the full suite + `playtest:quick`.

## After each integration
Plain-language state report to Tim (what's now real for a player, what's still dark, what was
compressed). Pace spend: `node --test` is the free loop; the `--real-dm` harness + any Opus gate cost the
`.env` key — run deliberately, by Tim's explicit OK for paid gates.
