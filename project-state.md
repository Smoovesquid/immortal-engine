# Immortal Engine — Project State Handoff

_Snapshot: 2026-04-10, branch `feat/phase2-physics-decompression`_

---

## 1. CLAUDE.md audit

**Size:** 59 lines / ~550 words / ~750 tokens. Tight and well-structured for its scope, but **stale in several places** and **missing several concepts that matter for day-to-day work**.

**What's in it:**
- Quick Reference (test cmd, dev cmd, world version, purity rules)
- Architecture map of `engine/` core modules + top-level dirs
- 14 invariant rules with numeric bounds
- Commit protocol for bug fixes (baseline → fix → retest → commit)

**Problems:**
- **Stale `WORLD_VERSION`.** CLAUDE.md claims `WORLD_VERSION = 9`. On-disk committed value is `10`; uncommitted work in `engine/state.js` has bumped it to `11`. This field drifts every time state shape changes and should either be removed from CLAUDE.md or be pulled dynamically.
- **Architecture map is ~5 modules deep; reality is ~20 subdirs.** CLAUDE.md lists only `engine/` top-level files. Actual `engine/` has ~18 subdirectories (`npc/`, `goals/`, `map/`, `structures/`, `decompression/`, `csl/`, `chargen/`, `scene/`, `world/`, `env/`, `gear/`, `metrics/`, `ai/`, `util/`, `utils/`, `__tests__/`, …) that are never mentioned.
- **No mention of the Canon Log**, which `docs/ARCHITECTURE_OVERVIEW.md` declares is the single source of truth and "wins" over world state on divergence. That's a load-bearing concept absent from the agent guide.
- **No mention of `worldHash`**, which is the public determinism fingerprint and the thing several U## tests assert against.
- **No mention of the playtest harness** (`scripts/playtest.js`, `npm run playtest[:quick|:full]`) or `PLAYTEST.md` bug-class taxonomy — these are the project's primary bug-finding workflow and newer than CLAUDE.md.
- **No mention of the active milestone structure** in `PLAN.md` (Canonical Surface v1 + AI Narration v1, their S1–S6 and N1–N6 gates) or the test naming convention that mirrors them (`S#.*`, `N#.*`, `U##.*`, `C#.*`, `G0#.*`).
- **No mention of the LLM layer**: Claude Sonnet 4.6 via Anthropic Messages API, `engine/llmAdapter.js`, `engine/llmPhysics.js`, `server/llmProvider.js`, and the "silent fallback if key missing" contract.
- **Commit protocol** only covers bug fixes; doesn't document the feature-commit cadence visible in `git log` (`feat(phase2):`, `feat(goals):`, etc.) or the `fix(<module>): <bug class> — <what changed>` format spelled out in `PLAYTEST.md`.

**Verdict:** good bones, needs a refresh pass — at minimum fix the world version, add Canon Log / worldHash / playtest harness / LLM adapter, and expand the engine map to name the subdirectory families.

---

## 2. Architecture snapshot

**Stack:** Node.js (ESM, `"type": "module"`), Express 4, `@anthropic-ai/sdk`, `openai` SDK, `dotenv`. Vanilla HTML/CSS/JS browser UI (no framework, no build step). Tests via `node --test`. **Two LLM clients coexist by design:** narration layer (`engine/llmAdapter.js`, `engine/llmPhysics.js`, `server/llmProvider.js`) calls **Anthropic Messages API** with `claude-sonnet-4-6`; victory-gates API activation layer (`server/ai.js`, trace/replay flow) uses the OpenAI client.

**Entry points:**
- `server.js` — Express dev server on port 5179, thin wrapper over `engine/`.
- `public/v1.html` + `public/v1.js` — browser UI shell.
- `scripts/playtest.js` — headless 412-line deterministic playtest harness with bug probes.

**Engine layout (reality, not the CLAUDE.md sketch):**

```
engine/
  state.js           WORLD_VERSION, ensureWorld(), newWorld()           (383 LoC)
  playloop.js        beginAdventure/playerMove/newScene — main loop    (1,215 LoC) ← big
  effectsCore.js     applyDeltas() — sole structured mutation path      (345 LoC)
  resolve.js         d20 vs DC, deltas                                  (422 LoC)
  worldTick.js       living system: factions, threads, ecology, scars   (489 LoC)
  conductor.js       AI orchestration layer, delta proposals            (208 LoC)
  composer.js        narration assembly                                 (338 LoC)
  invariants.js      assertWorldInvariants() — runs on every ensureWorld (96 LoC)
  instrument.js      threads, motifs, inevitability meter
  guard.js           player text validation against canon
  ledger.js, ledgerUtils.js   facts/threats/questions (cap 8 each)
  llmAdapter.js      narration polish, validateNarrationCandidate, buildDMSystemPrompt
  llmPhysics.js      physics/decompression LLM calls
  save.js            export/import world
  rng.js             seeded RNG (deterministic source of truth)
  simulate.js, simulateWalk.js   headless N-turn sims
  worldHash.js / worldHash.browser.js   canonical fingerprint
  sceneDirector.js, mythSpec.js, triad.js, voice.js, ending.js, endingArchitect.js, sequel.js

  ai/        narratorContext.js, conductContract.js, polishValidation.js
  npc/       npcGenesis.js, npcDepth.js, perspectiveFilter.js, dialogue.js [UNCOMMITTED]
  map/       generateMap.js, mapState.js, mapDebugProbe.js, projection/, spatial/
  structures/ generateStructures.js, interiors.js, anchors.js, topology.js, discoveryState.js, structuresState.js, applyGeneratedStructuresForNode.js
  world/     minimalWorld.js, regions.js, resolveSurfaceContact.js, structures.js
  decompression/ decompress.js, detectEvents.js, extractPresent.js, generateFurniture.js, settlementTicker.js, texturize.js
  scene/     latentProjection.js
  goals/     goalContract.js
  chargen/   (character creation — ritual options)
  csl/       canonLog.js, schema.js, validator.js, serializer.js, grammar.js, latent.js, socketSpec.js, domains/
  env/       envCore.js (noise/heat/scent/light residue)
  gear/      gearProps.js (gear as physics input)
  metrics/   (telemetry)
  rulesets.js, util.js, util/, utils/, log.js
```

**Other dirs:**
- `server/` — `ai.js`, `aiTrace.js`, `llmProvider.js` (abstraction over Anthropic + mock).
- `public/` — `v1.html`, `v1.js`, `engine/`, `map/`, `ui/`, `legacy/`, `styles.css`.
- `packs/` — 5 genre packs (`fantasy`, `haunted`, `modern`, `space-rift`, `zombie`) + `manifest.json`.
- `canon/` — single file `query.js` (canon query system).
- `gates/` — bash scripts `A1`..`A5` for spatial/structure gates.
- `docs/` — 16 design/process docs, lighter on architecture than on philosophy (Determinism Doctrine, Drift Guard, Debug Priority Order, Victory Gates, Campaign Lifecycle Spec, etc.).
- `tests/` — **126 test files**, naming conventions: `U##` (unit/invariant), `S#` (surface gates), `N#` (narrator gates), `C#` (campfire/NPC depth), `G0#` (goals).

**Built:**
- Deterministic engine core: state, play loop, resolve, effectsCore, worldTick, ledger, invariants.
- Save/load, determinism-by-seed, world hash, canon log.
- Living system: factions, threads, scars, ecology, gossip, inevitability, instrument/motifs.
- Narrative composer + scene director + ending architect + sequel.
- Character genesis v2 (ritual options), gear as physics signals, environmental residue signals.
- Living terrain map v1 + v2 (node graph, tactical zoom).
- Conductor (constrained AI delta planner) + advisory mode.
- **Canonical Surface v1** — all 6 gates passed per `PLAN.md` (node type classification, local projection by type, honest player position, structure enter/exit, room navigation, replay-stable hash).
- **AI Narration v1** — all 6 gates passed. Anthropic Messages API, grounded prompts, pack-tone shaping, node-type violation guard, silent fallback without key.
- **Phase 2 (most recent commit):** physics + decompression depth + P3 narration polish; Goal Contract with verifiable kinds (`reach`/`obtain`/`talkTo`/`learn`/`defeat`); Campfire Engine (NPC depth, perspective filter, narrator wiring).
- Headless playtest harness with bug probes + JSON report.

**Stubbed / partial:**
- **NPC dialogue system** (see §3) — pure engine module exists uncommitted; playloop intercept wired; UI surfacing unclear.
- Voice output is a browser Speak button (narration-only); no STT.
- `public/legacy/` implies UI churn; only `v1.html`/`v1.js` are live.
- Conductor has `advisory|conductor|off` modes — conductor mode hooked in but use in practice is light.

**Missing (per `PLAN.md` parking lot + ROADMAP.md):**
- Multiplayer session sync, mobile UI, TTS with a real voice.
- Node-type → faction/ecology pressure coupling beyond what scene director reads today.

---

## 3. Active state

**Branch:** `feat/phase2-physics-decompression` (not yet merged to `main`).

**Last commits (most recent first):**
- `6939868 feat(goals): add verifiable Goal Contract — reach/obtain/talkTo/learn/defeat`
- `92a5180 feat(phase2): physics + decompression depth + P3 narration polish`
- `d50c49f fix(save): warn on old version before ensureWorld upgrade`
- `b0dfb65 fix(llmAdapter): add settlement and speaker blocks to system prompt`
- `8a00806 fix(narratorContext): add buildSpeakerContext + settlement/speaker fields`

**Uncommitted work — NPC Dialogue Mode (significant):**

Modified files (7):
```
 M engine/ai/narratorContext.js   (+81/-2)   buildDialogueTurn, sharedFacts/withheldFacts derivation
 M engine/invariants.js           (+34/0)    scene.dialogue shape + topic cap + npc-at-node check
 M engine/llmAdapter.js           (+26/0)    withheld-fact narration guard + DIALOGUE MODE prompt block
 M engine/playloop.js             (+161/-21) dialogue-mode intercept: explicit exit, breaking intent, ask
 M engine/state.js                (+38/-3)   WORLD_VERSION 10 → 11; scene.dialogue shape + ensureDialogueContext
 M public/v1.js                   (+8/0)
 M tests/U23.canonicalSurfaceFreezeAllowlist.test.js   (+3/-2)
?? engine/npc/dialogue.js         (442 LoC, new)  beginDialogue/askNpc/endDialogue/availableTopics
?? scripts/playtest.js            (412 LoC, new)  headless playtest harness
?? CLAUDE.md, PLAYTEST.md, PLAYTEST_CHECKLIST.md  (new docs, not tracked)
?? .claude/                       (local Claude settings)
```

What this amounts to: **a full NPC dialogue loop**. Enter dialogue → world tracks `scene.dialogue = { npcId, startedAt, turnsInDialogue, topicsOffered[≤20], lastAnswer }`. Each player turn is routed to `askNpc` unless the text is an explicit exit ("leave", "bye") or a "breaking" intent (move, fight, travel). NPCs track `trustLevel`, `honesty`; the `narratorContext` derives `sharedFacts` (from ledger markers `npc:{id} shared:{factId}`) and `withheldFacts` (topics offered minus shared, gated by trust thresholds 4/7 for public/secret). The LLM adapter injects a `DIALOGUE MODE` block into the DM system prompt and blocks any narration that mentions withheld factIds.

**Test status:** `node --test` → **368 pass / 1 fail / 369 total**.

The single failing test is **`U50.structures.S3.materializeOnNodeEntry`**:
```
+ 'stgen:v11:n1:0'
- 'stgen:v10:n1:0'
```
The structure-generation hash key embeds `WORLD_VERSION`. Bumping to 11 invalidated the expected string. This is a **trivial test update** (not a regression), but it should be fixed before the dialogue work lands. Grep `v10:` across tests/structures to see if anything else needs the same nudge.

**Most recent thing worked on, in order of recency:** (1) NPC dialogue mode (active, uncommitted), sitting on top of (2) Goal Contract (committed), sitting on top of (3) Phase 2 physics + decompression (committed, branch name).

---

## 4. Gaps — things CLAUDE.md should capture but doesn't

Ordered by how often they bite day-to-day work:

1. **Canon Log is authoritative.** Per `docs/ARCHITECTURE_OVERVIEW.md`: "If Canon Log and world diverge, Canon Log wins." `engine/csl/` holds the schema, validator, serializer, grammar, latent projection, socket spec, and domain modules. This is a core mental model for anyone editing state flow and it's invisible in CLAUDE.md.

2. **`worldHash` is the determinism contract.** Several tests (`U19`, `U21`, `U22`, `U27`, `U30`) assert hash equality under replay. Any change that alters world shape must be checked against hash determinism. Hash has a browser variant (`worldHash.browser.js`) — pay attention when editing.

3. **Playtest harness + bug taxonomy.** `scripts/playtest.js` + `npm run playtest[:quick|:full]` + `PLAYTEST.md`'s 10 bug classes (CRASH, INVARIANT_VIOLATION, DEATH_SPIRAL, DETERMINISM_BREAK, SAVE_CORRUPTION, ENDING_LEAK, TIMELINE_RUNAWAY, CLOCK_MONOTONIC, NPC_OVERFLOW, THREAD_STARVATION) are the primary bug-finding workflow. None of this is referenced from CLAUDE.md.

4. **LLM integration contract.**
   - Model: `claude-sonnet-4-6` via Anthropic Messages API (`/v1/messages`).
   - Key lives in server env; browser never sees it.
   - `engine/llmAdapter.js` handles narration polish + validation (`validateNarrationCandidate`, `buildDMSystemPrompt`).
   - `engine/llmPhysics.js` handles physics-detection LLM calls.
   - `server/llmProvider.js` is the abstraction layer.
   - **Silent fallback:** if key is missing or API errors, the game continues with base narration — no throws. This is a hard contract and easy to violate.
   - The `openai` dependency is **live**: `server/ai.js` uses it for the victory-gates API activation path (polish/trace/replay), separate from the Anthropic narration layer. Two clients coexist by design.

5. **Active milestone structure + test naming.** `PLAN.md` organizes work as S# (Canonical Surface) and N# (AI Narration) gates. Tests mirror this (`S1.*`, `N2N3N4N5.*`). New test files should follow the `{prefix}##.shortName.test.js` convention.

6. **File shape of `ensureWorld`.** `engine/state.js` is the canonical shape definition and `ensureWorld` runs `assertWorldInvariants` on every call. Any new subsystem must (a) add its field to `ensureWorld` with a safe default, (b) add invariants to `invariants.js`, (c) bump `WORLD_VERSION`, (d) handle the upgrade path. The NPC-dialogue diff is a textbook example.

7. **`playloop.js` is 1,215 lines.** That's the biggest engine file by 2.5x. Several commits are backfilling features into it. Consider either documenting its sections or splitting when adding the next big subsystem. The new dialogue intercept is the third major branch at the top of `playerMove`.

8. **Silent fallback vs throws.** The convention across `llmAdapter`, `llmPhysics`, and narration is "errors fall back to deterministic offline path, never throw to caller." But the invariants layer DOES throw. Understanding which layer is which is not documented.

9. **Pack system conventions.** 5 packs, shared manifest, tone words drive narrator voice. `scripts/gen-pack-content.mjs` and `scripts/patch-gear-props.mjs` suggest pack content is generated/patched, not purely hand-edited. CLAUDE.md should either describe this or point at the manifest.

10. **The `public/legacy/` split and `state.js` at the repo root** (35-byte stub file sitting beside `engine/state.js`) — both are small traps for an agent that searches by filename.

11. **`WORLD_VERSION` upgrade protocol.** When bumping the version you must: update `state.js`, ensure old saves warn (see commit `d50c49f`), update any test that embeds the version in a hash string (see U50 failure above), and re-run the full test suite. This recipe isn't written down.

12. **Test count, not just command.** CLAUDE.md says "run `node --test`" but a reviewer won't know whether 369 is the expected total or whether 1 fail is the baseline (it is, for U50, pending the dialogue landing).

---

## Suggested CLAUDE.md deltas (if you want a starting point)

- Drop the literal `WORLD_VERSION = 9` line — replace with "see `engine/state.js`".
- Add a one-paragraph **Canon Log** section citing `engine/csl/` and the "canon wins" rule.
- Add a **Playtest** section pointing at `PLAYTEST.md` + `npm run playtest[:quick|:full]` + the 10 bug classes.
- Add an **LLM** section: model, API, env var, silent-fallback contract, which files are the integration seams.
- Expand the engine map to name the subdirectory families (`npc/`, `map/`, `structures/`, `decompression/`, `csl/`, `goals/`, `chargen/`, `env/`, `gear/`).
- Add a **Test naming** bullet: `S#`, `N#`, `U##`, `C#`, `G0#` and what each prefix means.
- Add a **When bumping `WORLD_VERSION`** checklist.
- Document the dual-client reality: Anthropic (`claude-sonnet-4-6`) for narration, OpenAI for victory-gates API activation path (`server/ai.js`). Do not remove the `openai` dep.
