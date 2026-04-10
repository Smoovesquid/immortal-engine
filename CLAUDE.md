# Immortal Engine — Agent Guide

## Quick Reference

```
node --test                    # full suite (S/N/U/C/G/D prefixes)
npm run dev                    # Express on :5179
npm run playtest:quick         # headless playtest, fast probes
npm run playtest:full          # headless playtest, all bug classes
WORLD_VERSION                  # see engine/state.js (source of truth)
```

## Core Contracts

**Determinism.** The engine is deterministic-by-seed. `engine/rng.js` is the sole source of randomness. Any change that alters world shape must preserve hash equality under replay. Tests `U19`, `U21`, `U22`, `U27`, `U30` assert this via `worldHash`.

**Canon Log wins.** `engine/csl/` (schema, validator, serializer, grammar, latent, domains). If Canon Log and world state diverge, Canon Log is authoritative. See `docs/ARCHITECTURE_OVERVIEW.md`.

**Silent LLM fallback.** `engine/llmAdapter.js`, `engine/llmPhysics.js`, `server/llmProvider.js` call Claude Sonnet 4.6 via Anthropic Messages API (`/v1/messages`). If the key is missing or the API errors, the game continues with base narration — never throws to caller. The `openai` dep in `package.json` is stale/unused.

**Invariants throw.** `engine/invariants.js` runs `assertWorldInvariants()` on every `ensureWorld()` call. Invariant violations are hard failures. This is the opposite of the LLM layer — know which layer you're in.

**Mutation path.** All structured world mutations go through `engine/effectsCore.js` → `applyDeltas()`. No direct state writes.

## Engine Map

```
engine/
  state.js            WORLD_VERSION, ensureWorld(), newWorld()
  playloop.js         beginAdventure/playerMove/newScene (1,215 LoC — largest file)
  effectsCore.js      applyDeltas() — sole mutation path
  resolve.js          d20 vs DC, delta generation
  worldTick.js        factions, threads, ecology, scars
  conductor.js        AI orchestration, delta proposals
  composer.js         narration assembly
  invariants.js       assertWorldInvariants()
  instrument.js       threads, motifs, inevitability meter
  guard.js            player text validation against canon
  ledger.js           facts/threats/questions (cap 8 each)
  llmAdapter.js       narration polish, DM system prompt, validation
  llmPhysics.js       physics-detection LLM calls
  rng.js              seeded RNG
  worldHash.js        determinism fingerprint (+ worldHash.browser.js)
  save.js             export/import

  csl/                Canon Log: schema, validator, serializer, grammar, latent, domains
  npc/                npcGenesis, npcDepth, perspectiveFilter, dialogue
  map/                generateMap, mapState, projection/, spatial/
  structures/         generation, interiors, anchors, topology, discovery
  decompression/      decompress, detectEvents, furniture, settlement, texturize
  goals/              goalContract (reach/obtain/talkTo/learn/defeat)
  chargen/            character creation (ritual options)
  scene/              latentProjection
  ai/                 narratorContext, conductContract, polishValidation
  env/                envCore (noise/heat/scent/light residue)
  gear/               gearProps (gear as physics input)
  metrics/            telemetry
```

Other dirs: `server/` (Express + LLM provider), `public/` (vanilla HTML/CSS/JS UI, `v1.html`/`v1.js` are live), `packs/` (5 genre packs + manifest), `canon/` (query system), `gates/` (spatial/structure gate scripts), `docs/` (16 design docs).

**Trap:** `state.js` exists at repo root (35-byte stub) AND at `engine/state.js`. The engine one is real. `public/legacy/` is dead code.

## Purity Rules

1. `rng.js` is the only randomness source — no `Math.random()`.
2. All state mutations through `effectsCore.applyDeltas()`.
3. Canon Log is authoritative over world state on divergence.
4. LLM layer never throws — silent fallback to deterministic path.
5. Invariants layer always throws on violation.
6. `worldHash` must be stable under replay after any state shape change.
7. Ledger caps: 8 facts, 8 threats, 8 questions.
8. NPC dialogue: topic cap ≤20, NPC must be at player's node.
9. Browser never sees the API key — server-only.

## When Bumping WORLD_VERSION

1. Update `engine/state.js` (the number and the `ensureWorld` shape).
2. Add safe defaults for new fields in `ensureWorld()`.
3. Add invariants for new fields in `invariants.js`.
4. Old saves must warn before upgrade (see commit `d50c49f`).
5. Grep tests for version-embedded strings (e.g., `v10:` → `v11:`). Fix them.
6. Run full test suite. Run `npm run playtest:quick`.

## Playtest Harness

`scripts/playtest.js` + `PLAYTEST.md`. 10 bug classes: CRASH, INVARIANT_VIOLATION, DEATH_SPIRAL, DETERMINISM_BREAK, SAVE_CORRUPTION, ENDING_LEAK, TIMELINE_RUNAWAY, CLOCK_MONOTONIC, NPC_OVERFLOW, THREAD_STARVATION.

Run after any commit that touches state shape, playloop, or worldTick.

## Test Naming

| Prefix | Domain                    |
|--------|---------------------------|
| S#     | Canonical Surface gates   |
| N#     | AI Narration gates        |
| U##    | Unit / invariant          |
| C#     | Campfire / NPC depth      |
| G0#    | Goals                     |

File convention: `{prefix}##.shortName.test.js`

## Milestones

See `PLAN.md` for active gates. Canonical Surface v1 (S1–S6): ✅ complete. AI Narration v1 (N1–N6): ✅ complete. Phase 2 (physics/decompression/goals/campfire): in progress.

## Commit Convention

```
feat(<module>): <description>
fix(<module>): <bug class> — <what changed>
```

Bug fix protocol: reproduce → baseline test → fix → retest → commit.

**Staging discipline.** Do not use `git add -A` / `git add .` when unrelated untracked or modified files are present in the tree — stage files explicitly by path so each commit's scope matches its message. Only use `-A` when the working tree is known to contain a single coherent change.
