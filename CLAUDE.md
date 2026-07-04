# Immortal Engine — Agent Guide

*Operating model: `docs/THE_PLAYBOOK.md` (how we build) + `docs/THE_BUILD_SYSTEM.md` (map of the doc apparatus). This guide is the high-signal index; detail lives in the linked docs.*

## Read first (durable docs)
- `docs/THE_DM_TEST.md` — **THE governing principle.** For any player input, do what a real DM would do; resolve intent in the fiction, never bounce it back as a mechanical prompt. Run it before shipping any response.
- `docs/THE_TABLE_TEST.md` — **governing principle for BEHAVIOR** (sibling of the DM Test): do what would happen at a real D&D table; wrong behavior has *drifted* from the table, so restore it. Texture, not the visible math.
- `docs/IMMORTAL_INVARIANTS.md` — the non-negotiables (determinism, narration≠canon, one walkable scale, open-ended).
- `docs/SOBRIETY.md` — **the guardrails against never shipping.** Read when scope is growing or a feature is "done": build-dark ≠ done · the LLM meter · prototype gravity · unfalsifiable vision → **ship ONE bounded Module.**
- `docs/WHAT_THIS_IS.md` — status-tagged audit (🟢 live / 🟡 built-but-dark / 🔴 partial) of every system. Orient here fast.
- `docs/REPO_MAP.md` — module map + the "two play surfaces" gotcha (v1 = trunk, `__preview/` = sandbox). Read before exploring.
- `docs/PRD.md` — **the victory map** (canonical, code-audited 2026-07-02): the three victories, the Armory of what's already built, the six-phase plan to V1, the Witness Test. **Check the Armory before building anything new.** Page 1 is Tim's wall poster.
- `docs/ROADMAP.md` + `docs/NORTH_STAR.md` — the goal + critical path; the anchor against drift.
- `docs/PACKETS.md` — active queue + done-when. Spec a packet before editing; small bounded diffs.
- `docs/PATH_TO_SELLABLE.md` — the sellable plan (surface depth → make correct → build soul); open decisions live here.
- `docs/IDEA_GARDEN.md` — parked ideas (capture without committing); `echoes:` triggers resurface them when Tim's words rhyme (gists in MEMORY.md).
- `docs/biblioteca/` — research library; mine the matching volume BEFORE scoping a social/dialogue/NPC/eval rule (gist in MEMORY.md).
- `docs/HARNESS_USAGE_STRATEGY.md` — how to aim the Human Playtest Harness (the deterministic desync oracle is the crown jewel).
- `docs/PLAYTEST_PROTOCOL.md` — play every new feature yourself through live `v1.html` (screenshot, not DOM dump) BEFORE handing Tim anything.
- `docs/PROSE_MECHANIC_PLAN.md` — active roadmap for the prose mechanic; each stage closes with a committed playtest report.
- `docs/LIVING_WORLD_MERGE.md` — region/ecology/discovery/will merge (P1–P6 done).

## Build budget (full protocol: `docs/BUILD_BUDGET.md`)
- **Use the right model for the task.** Hard reasoning (architecture, design, gnarly debugging) → Opus; mechanical work (reads, edits, greps, routine wiring) → Sonnet is plenty. The clearer the spec, the cheaper the model can run it. *This home base runs loose — don't over-conserve.* The Sonnet-default / 5-hr-cap discipline is for the **Pro farm/worker lanes** (see `BUILD_BUDGET.md`); suggest a model switch only when it genuinely matters, never as a per-request ritual.
- **Targeted reads only.** NEVER read whole large files — `playloop.js` (~7.4k lines), bestiary catalogs, `server/rag/corpus/*`. Grep to locate → Read a slice. Don't re-read what's in context or re-read to confirm an edit.
- **One packet per session**; `/clear` between unrelated tasks, `/compact` when deep; batch independent tool calls.
- **Heavy LLM testing runs on the `.env` API key from the CLI, not interactively** (the Opus gate is the repo's costliest thing). Use `node --test` / `playtest:quick` for the fast loop.
- Don't spawn subagents unless fan-out is truly needed (cold context = expensive).

## Reporting to Tim (ALWAYS)

Tim is not a coder. Every substantive report — from any window, worker or conductor — ends with a
plain-English paragraph: *what was broken / what changed / why it matters*, jargon translated on first
use. Never route a judgment call back to him mid-task (a question to Tim is a stalled lane — take the
reversible option and flag it in the report). When a job is done, say so and stop; no trailing "want me to…?".

## Engine-brief ritual (ALWAYS — hook-enforced)

Any request whose execution would **edit `engine/**` in the main checkout**: FIRST render the request
back to Tim as a **Form Prompt brief** (`docs/FORM_PROMPT.md`) in chat and **STOP for his explicit OK**
— before any engine edit. After his OK: `touch .claude/engine-edit-ok` (authorizes 4 h) and proceed.
A PreToolUse hook (`scripts/hooks/engine_brief_gate.sh`, wired in `.claude/settings.local.json`)
hard-blocks engine writes without a fresh marker — **never touch the marker without Tim's OK in-chat.**
Tim away → queue the brief in `docs/PACKETS.md` or dispatch it to a worker worktree (worktrees are
exempt — their approval happened at dispatch). Reads are unrestricted; this gates WRITES only.

## Cockpit — project skills & scripts

| Command | What it does |
|---|---|
| `basecamp` (skill) | Boot the conductor from verified git state; plain-English status board |
| `handoff` (skill) | Checkpoint this window → `.claude/handoff-latest.md` + next-window kickoff |
| `dispatch` (skill) | Run a brief as a background subagent in a worktree (default over hand-carrying prompts) |
| `execute` (skill) | Run a brief file end-to-end unattended; `review` mode critiques it first |
| `play` (skill) / `scripts/play.sh` | Open the game guaranteed-fresh, version-checked (Tim never playtests a stale build) |
| `adversarial` (skill) | Skeptic pass — no-reassurance analysis of a plan/claim/report |
| `scripts/next-test-number.sh <prefix> [n]` | Allocate free test numbers (prevents parallel-worker collisions) |
| `node scripts/budget.mjs` | Gate-spend ledger (`set`/`spend`) — check before any paid gate, record after |

## Quick Reference

```
npm run check                  # the one-command green (convergence + suite + determinism + git sync)
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

## Engine Map (full module map: `docs/REPO_MAP.md`)

```
engine/
  state.js            WORLD_VERSION, ensureWorld(), newWorld()
  playloop.js         beginAdventure/playerMove/newScene (~7.4k LoC — largest, hot file)
  effectsCore.js      applyDeltas() — sole mutation path
  resolve.js          d20 vs DC, delta generation
  worldTick.js        factions, threads, ecology, scars
  conductor.js        AI orchestration, delta proposals     composer.js  narration assembly
  invariants.js       assertWorldInvariants()               guard.js     player text vs canon
  ledger.js           facts/threats/questions (cap 8 each)  rng.js       seeded RNG
  llmAdapter.js       narration polish, DM system prompt     llmPhysics.js  physics-detection calls
  worldHash.js        determinism fingerprint (+ .browser)   save.js      export/import
  csl/ npc/ map/ structures/ decompression/ goals/ chargen/ scene/ ai/ env/ gear/ metrics/
```

Other dirs: `server/` (Express + LLM provider), `public/` (`v1.html`/`v1.js` are live), `packs/` (5 genre packs), `canon/` (query system), `gates/` (spatial/structure gate scripts).

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

`scripts/playtest.js` + `PLAYTEST.md`. 10 bug classes: CRASH, INVARIANT_VIOLATION, DEATH_SPIRAL, DETERMINISM_BREAK, SAVE_CORRUPTION, ENDING_LEAK, TIMELINE_RUNAWAY, CLOCK_MONOTONIC, NPC_OVERFLOW, THREAD_STARVATION. Run after any commit that touches state shape, playloop, or worldTick.

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

## Status & milestones

Current backlog + done-when: `docs/PACKETS.md`. Direction: `docs/NORTH_STAR.md` + `docs/SLICE_PLAN.md`. Shipped: Canonical Surface (S1–S6) ✅, AI Narration (N1–N6) ✅. *(The older `PLAN.md` "Phase 2" framing predates the North-Star pivot — prefer PACKETS / SLICE_PLAN.)*

## Commit Convention

```
feat(<module>): <description>
fix(<module>): <bug class> — <what changed>
```

Bug fix protocol: reproduce → baseline test → fix → retest → commit.

**Versioning (ALWAYS — Tim plays the live build and must know which one).** Every shipped change-set bumps the version, and you **state the new version number at the end of the work**. Two sources, keep them in lockstep:
- `package.json` `"version"` — semver. Minor bump for a feature/milestone (`0.3.0`→`0.4.0`), patch for a fix (`0.4.0`→`0.4.1`).
- `public/v1.js` the header `title` (`Immortal Engine — vX.Y.Z`) **and** the `sub` build line (`build NNN · YYYY-MM-DD · <short label>`) — increment the build counter, set today's date, write a 2-4 word label. This is what the player SEES on the front door, so verify it live after the bump.
No `VERSION`/`CHANGELOG` file exists; these two are the source of truth.

**Staging discipline.** Do not use `git add -A` / `git add .` when unrelated untracked or modified files are present in the tree — stage files explicitly by path so each commit's scope matches its message. Only use `-A` when the working tree is known to contain a single coherent change.

## Parallel lanes (Homebase = conductor)

Full map: **`docs/LANE_MAP.md`**. Default to the maximum *worthwhile* concurrency, **per lane-type**: parallel by default for **content / UI / docs-design**; **serial** for **competence hot files** (`playloop.js`, `dialogue.js`, `grace/`, composer, `escapeCombat.js`), **schema/`WORLD_VERSION`**, and taste-critical narration. Assume warm worker lanes may be running.

- **Homebase conducts + integrates:** plan the split, own the merge into `v2-polish`, never delegate the global-invariants lane. Worker lanes produce branches; Homebase lands them.
- **Isolate parallel lanes in their own git worktree** (`git worktree add` / Agent `isolation: "worktree"`) — branch names do NOT isolate a shared working dir. Stay off another lane's hot files; coordinate first. **Never commit edits you didn't make.**
- **Before every push/merge:** run `scripts/lane-check.sh` then `npm run check`; confirm outgoing is only this lane's. Tiny solo packets may go direct to `v2-polish`; multi-hour/parallel work uses a worktree+branch.
- Shared docs (`CAPABILITY_LEDGER.md`, `AGENT_CHANGELOG.md`, `PACKETS.md`) interleave — each lane **appends its own dated section** (append-only).

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill tool as your FIRST action. Do NOT answer directly, do NOT use other tools first. The skill has specialized workflows that produce better results than ad-hoc answers.

- Product ideas, "is this worth building", brainstorming → **office-hours**
- Bugs, errors, "why is this broken", 500 errors → **investigate**
- Ship, deploy, push, create PR → **ship**
- QA, test the site, find bugs → **qa**
- Code review, check my diff → **review**
- Update docs after shipping → **document-release**
- Weekly retro → **retro**
- Design system, brand → **design-consultation**
- Visual audit, design polish → **design-review**
- Architecture review → **plan-eng-review**
- Save progress, checkpoint, resume → **checkpoint**
- Code quality, health check → **health**
