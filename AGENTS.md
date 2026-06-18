# Immortal Engine — Agent Guide

## Read first (durable docs)
- **`docs/WHAT_THIS_IS.md` — plain-English audit of every system with status tags (🟢 live / 🟡 built-but-dark / 🔴 partial) + moat notes. The map of what exists; read to orient fast.**
- **`docs/IDEA_GARDEN.md` — parked ideas (capture without committing). Each has `echoes:` triggers — when Tim says something that rhymes with one, resurface it. Gists are in MEMORY.md so associations fire without opening the file.**
- **`docs/PATH_TO_SELLABLE.md` — the plan to make this sellable (surface the depth → make it correct → build the soul). The three open decisions live here. Carrying packets: `docs/PACKETS.md` → "Sellable / Surface-the-Depth track" (P-82–P-88).**
- **`docs/THE_DM_TEST.md` — THE governing principle. For any player input, do what a real DM would do; resolve intent in the fiction. Never bounce intent back as a game-mechanical prompt ("travel one tile at a time, which way?") or a system artifact. The DM is the interface; mechanics serve the fiction. This is the answer, as always — apply it before shipping any response.**
- **`docs/PLAYTEST_PROTOCOL.md` — BEFORE handing Tim anything to playtest, I MUST play every new feature myself through the live `v1.html` browser surface and confirm it VISIBLY works (screenshot, not DOM dump). Default failure mode: handing over a broken game and debugging live. Don't.**
- **`docs/PROSE_MECHANIC_PLAN.md` — active roadmap to perfect the prose mechanic (Stages C→A→B→F→D→E) + the per-stage Severe Playtest discipline. Each stage closes only with a committed live playtest report in `docs/playtests/`.**
- `docs/ROADMAP.md` — the goal + the critical path (R0–R7) to voice-first, DM-adjudicated tabletop. The anchor against drift.
- `docs/REPO_MAP.md` — module map + the "two play surfaces" gotcha (v1 = trunk, `__preview/` = sandbox). Read before exploring.
- `docs/IMMORTAL_INVARIANTS.md` — non-negotiables (determinism, narration≠canon, one walkable scale, open-ended, etc.).
- `docs/PACKETS.md` — active queue + done-when. Spec a packet before editing; small bounded diffs.
- `docs/LIVING_WORLD_MERGE.md` — region/ecology/discovery/will merge (P1–P6 done).

## Build budget (Pro plan — fire every session; full protocol in `docs/BUILD_BUDGET.md`)
Tim is on Pro and hits the 5-hour cap fast. Govern spend:
- **Default to Sonnet** for mechanical work (reads, edits, greps, running tests, routine wiring). Escalate to **Opus** only for hard reasoning (architecture, design, gnarly debugging), then drop back. Opus burns ≈5× faster.
- **Model-fit check — do this at the START of each new request.** Classify the task. If it's mechanical and the active model is **Opus**, open with ONE line: *"This is routine — `/model sonnet` will save your window; I'll proceed either way."* If it's deep reasoning and the active model is **Sonnet**, suggest `/model opus`. Suggest ONCE per task, then proceed regardless — never nag, and skip it for trivial/conversational turns.
- **Targeted reads only.** NEVER read whole large files — `playloop.js` (~5.7k lines), the bestiary catalogs, `server/rag/corpus/*` in bulk. Grep to locate → Read with `offset`/`limit`. Don't re-read what's in context; don't re-read to confirm an edit.
- **One packet per session**; `/clear` between unrelated tasks, `/compact` when deep. Batch independent tool calls.
- **Heavy LLM testing runs on the `.env` API key from the CLI, not interactively** (the Opus gate is the costliest thing in the repo). Use `node --test` / `playtest:quick` for the fast loop.
- Don't spawn subagents unless fan-out is truly needed (cold context = expensive).
- Opus 4.8 IS available on Pro (confirmed by Tim) — the fast cap is Opus eating the 5-hour window, so Sonnet-default is the lever, not a tier change.

## Codex / secondary-agent mode

Codex should operate as a bounded implementation agent under this guide, not as a parallel source of product direction.

- First verify files, commands, APIs, and failing tests before proposing or editing.
- Work one packet or one requested behavior at a time: one module, one test target, one small patch.
- Prefer `AGENTS.md`, `docs/IMMORTAL_INVARIANTS.md`, `docs/PACKETS.md`, and `docs/REPO_MAP.md` before broader exploration.
- Do not invent files, commands, architecture, mechanics, or behavior. If something is unverified, run one deterministic discovery command and report what exists.
- Preserve deterministic mechanics: `engine/rng.js` only for randomness, structured mutation through `engine/effectsCore.applyDeltas()`, Canon Log authority, and stable replay/worldHash expectations.
- For bugs, start from the first failing narrow test. After edits, run the narrow relevant test first, then the relevant broader validation from `package.json`.
- Avoid broad refactors, snapshot churn, weakened assertions, or unrelated cleanup unless the requested fix requires it.
- Never commit, stage, or run broad suites unless explicitly asked or the packet's workflow requires it.

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

**Silent LLM fallback.** `engine/llmAdapter.js`, `engine/llmPhysics.js`, `server/llmProvider.js` call Claude Sonnet 4.6 via Anthropic Messages API (`/v1/messages`). If the key is missing or the API errors, the game continues with base narration — never throws to caller. **The `openai` dep is NOT stale** — `server/ai.js` uses it for the victory-gates API activation path (polish/trace/replay flow), separate from the Anthropic-backed narration layer. Two clients coexist by design; don't drop the dep.

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
| UX#    | Play-experience / audit   |

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

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
