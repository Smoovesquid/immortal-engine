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

**Make Every Turn Honest** — ✅ **ALL LANDED (2026-06-24; Tim: "just do the codex lane yourself" → Homebase took the lane in-house, built directly on `v2-polish`, no worker dispatch).**
- **W2·1 — Correctness floor: COMBAT (P-86).** ✅ LANDED (`6b5f6b5`, Codex branch merged + renumbered).
  Three attack-resolves-not-fizzles seams (grapple throw-foe-vs-object, `isFoeEnvironmentAttack` routing,
  GOAL_PREVAIL). `U273`/`U274`.
- **W2·2 — Correctness floor: DIALOGUE (P-86).** ✅ LANDED (`755e2fe`). Harness-probed the conversation
  slice; the info-ask layer is already robust (locked corpus C4/C9 encodes deliberate answer/deflect/
  withhold) — the one real gap was the `place` regex missing third-person "lives here", so "who else lives
  here?" deflected. One-char fix routes it through the existing answer; locked cases intact. `U275` (4/4).
  *(A broader "residents" branch was tried and reverted — it fought C4-017 / C9-003. The slice is deliberate.)*
- **W2·3 — Morality M2 / reputation-travels.** ✅ LANDED (`98da11f`). New `engine/npc/reputation.js`
  (`notorietyReaching`) consumes `rumorsReaching` for the player's atrocities reaching a node; the dialogue
  greeting turns wary + knowing, garbled to the travel tier. DISCOVERED, never a meter. **Derived from the
  deeds ledger → NO new state, NO `WORLD_VERSION` bump** (the anticipated bump didn't materialise); clean
  players byte-identical. `U276` (5/5). *Done-when met:* a tracked atrocity changes a stranger's reception.
- **Deferred (noted, not hacked):** "towns withholding from the notorious" (an effective-trust penalty in
  `askNpc`) — riskier (threads trust through the gating points, could fight locked cases like W2·2 did);
  worth a careful follow-on packet. The greeting-reception change already meets the M2 done-when.

> The `honest-turn/p86-combat` worker branch is now **defunct** (its W2·1 is merged; W2·2/W2·3 built on
> `v2-polish`). Safe to delete.

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

---

## Ready-to-dispatch — Codex lane, next (W2·1 LANDED `6b5f6b5`; tests renumbered U273/U274)

**FIRST, rebase the lane.** `honest-turn/p86-combat` still points at the pre-merge `e61de58`. Its W2·1 is
already in `v2-polish`, so **reset/rebase the branch onto current `v2-polish` HEAD** before either packet
(you get W1's rumor producer + the figures + the goal-law for free). New tests start at **U275** (U265–U274
are taken). Verify each with `npm run check`. **Do NOT bump `WORLD_VERSION` yourself** — propose new fields
to Homebase (the serialized seam).

### W2·2 — Dialogue correctness floor
- **Fence:** `engine/npc/dialogue.js`, `engine/grace/*`, `engine/resolve.js` (logic), the dialogue threads
  in `playloop.js`/`composer.js`, `engine/harness/*`; its tests. (Stay off W1's `npc/npcVoiceResolve.js`,
  `world/*Query.js`, `rumor/*`.)
- **Charge:** harness the conversation slice under the oracles; close agency / trust / info-ask seams. Mine
  Biblioteca **Vol 7** (interpret-richly-commit-narrowly), **Vol 15** (GM proposes / system commits), **Vol 17**
  (DM narration craft — hide-the-math, never-narrate-the-player).
- **Done-when:** clean multi-turn dialogue runs (no state-desync, no agency-violation) + U-tests; `npm run check` green.

### W2·3 — Morality M2 / reputation-travels  *(consumes W1·3 — now LANDED)*
- **Fence:** the morality threads in `worldTick.js` + the deeds ledger + dialogue **reception** (greeting/
  trust in `dialogue.js`); its tests.
- **Charge:** witnessed deed → trust shift (built) **+ reputation that TRAVELS** + towns withholding from the
  notorious. A tracked atrocity in town A measurably changes a stranger's reception in town B.
- **Contract:** `import { rumorsReaching } from '../rumor/rumorsReaching.js'` — shape frozen by `U266`.
  Gossip threshold is **`severity ≥ 25`** (0..100); align notoriety to it.
- **DESIGN LAW:** the reception change is **DISCOVERED**, never announced — no "reputation −3" popup, no
  meter. Obscure + player-held (`memory/project_obscure_goals_no_quest_log.md`); a stranger simply receives
  you differently and you infer why.
- **Done-when:** the elsewhere-reception shift lands as a surprise; tests; determinism intact. If it needs
  persistent state → **propose fields to Homebase** for the single `WORLD_VERSION` bump.
