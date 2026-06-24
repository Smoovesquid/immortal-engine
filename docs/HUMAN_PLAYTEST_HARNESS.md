# Human Playtest Harness — how we BUILD it

*Companion to `docs/HARNESS_USAGE_STRATEGY.md` (how we AIM it) and `docs/biblioteca/vol-16-automated-playtesting-coherence-harness.md` (the research backing). Oracle reference spec: [THE_TABLE_TEST](THE_TABLE_TEST.md) — "would this happen at a real D&D table?" This doc is the construction plan: components, file plan, reuse map, build phases, done-when.*

**Autonomy decision (Tim, 2026-06-24): FINDER now, self-fix later.** The harness *plays + detects + reports* — it never edits engine code unattended. We design its outputs (structured, seam-grouped, deterministically reproducible) so they can later *feed* a find→fix→re-run loop, but Phase 3 (self-fix) is deliberately gated until the finder's findings have earned trust.

---

## 0. Readiness — what the code already gives us (verified 2026-06-24)

The harness is **assembly, not invention** (Vol 16). Grounded against the source:

- **Turn API is clean + already driven.** `beginAdventure(world, packs)` → `playerMove(world, packs, text)` returns `{ world, output }` with `output.narration`, `output.narrationSource`, and the mechanics line. `engine/playloop.js:159,415`.
- **The crown-jewel oracle is half-built.** `engine/ref/rubric.js` exports `buildCanonGroundTruth(world)` (THE REF's canon extractor) + `JUDGE_SYSTEM`. The state-desync oracle is largely "diff the narration's claims against the delta in what this returns turn-over-turn."
- **The driver scaffold exists.** `scripts/dm-playtest.mjs` already runs a multi-turn LLM player through grace→`playerMove`→`/api/narrate`, on `DEMO_SEED` (`engine/world/demoRegion.js`), and imports the shared rubric. The harness is this script with the player re-aimed at a *goal* and the per-turn *text-judge* replaced by the *oracle bank*.
- **Tier-0 invariants exist.** `scripts/playtest.js` (CRASH / INVARIANT_VIOLATION / DETERMINISM_BREAK / SAVE_CORRUPTION / soft caps).

**The one real gap (the scale-unlock, not a blocker):** there is **no clean `legalActions(world)`**. Affordances exist only at the object/socket level (`engine/world/minimalWorld.js:54`, `engine/csl/socketSpec.js`); turn-legality is scattered across the intent classifiers (`isExploreIntent`, `classifyTrivial`, the meta handlers, the escape-combat verbs). Phase 1 sidesteps this with an LLM player; Phase 2 needs it consolidated.

---

## 1. Architecture

```
seed → beginAdventure → ┌─────────────── per-turn loop ───────────────┐
                        │ player.chooseAction(world, goal, history)    │  ← Phase 1: LLM goal-player
                        │   → text                                     │     Phase 2: scripted policy over legalActions()
                        │ grace.isMetaQuestion ? handleMetaQuestion     │
                        │   : playerMove(world, packs, text)            │  → { world', output }
                        │ ORACLE BANK(world, world', output, goal):     │  → [finding…]   (deterministic, free)
                        │ record(turn, action, narration, mech, canonΔ) │
                        │ goal.satisfied(world') || stuck(N) ? break    │
                        └──────────────────────────────────────────────┘
   → SessionReport { seed, goal, turns, findings[], goalCompleted, CED }
   → (many seeds) → DiscoveryCurve + seam-grouped BugList + standing regression seeds
```

**Components:**

1. **The goal** — a typed object, not a vibe: `{ id, description, satisfied(world)→bool, progressMetric(world)→number }`. Script #1: *"leave the first building and reach the first NPC with a concern."* `progressMetric` powers the soft-lock oracle (no progress in N turns → dead-progress).
2. **The player** —
   - *Phase 1:* an LLM player (fork the `dm-playtest.mjs` persona) seeded with the goal + reflect-when-stuck (TITAN: after ~15–20 no-progress turns, review history and re-strategize). Emits free-text actions; `playerMove` parses them. Cheap (few seeds).
   - *Phase 2:* a **scripted** goal-pursuer that selects from `legalActions(world)` — deterministic, **zero LLM cost**, runs on hundreds of seeds.
3. **The oracle bank** (per `HARNESS_USAGE_STRATEGY.md` §"oracle stack"; THE_TABLE_TEST is the spec):
   - **Tier 0** — wrap existing `scripts/playtest.js` invariants (crash/determinism/save/caps). Free.
   - **Tier 1 — NEW deterministic (the lived-bug catchers; build these first):**
     - **state-desync** — narration claims vs `buildCanonGroundTruth` delta ("you step outside" → did `scene.interior` flip? "open the pouch" → inventory change? "Rook falls" → foe dead + consequence delta written?). *The crown jewel — build first, run widest.*
     - **spatial-correctness** — narrated direction/destination == committed destination (catches "go south → end up north"). Needs a small design pass on how destination intent is captured.
     - **soft-lock / goal** — `goal.progressMetric` flat for N turns → dead-progress finding.
     - **free-action** — actions that must resolve without a roll (e.g. "go outside") must not roll.
     - **consequence (TABLE_TEST)** — a *living* NPC died → a proportionate faction/hostility delta must exist.
     - **§0 token-scan** — narration must never leak the cosmology (deterministic forbidden-token check).
   - **Tier 2 — LLM coherence judge (paid, surgical, LATER):** ConStory taxonomy, checked **against the Canon Log**, **cross-family** (never Opus-judging-Opus; Vols 10/14), as a *discovery pointer*. Cheapest start: re-judge existing `dm-playtest.mjs` transcripts (Jin et al.) — signal at zero new play.
4. **The finding record** — `{ seed, turn, goal, oracleId, severity, claim, committedState, transcriptSlice }`. Every finding is an **LLM-off, one-command repro** (replay the seed to the turn). Self-fix-ready by construction.
5. **The aggregator** — across seeds: the **discovery curve** (new-findings-per-100-seeds; flatten = "found ~all"; Vol 9 capture-recapture), **seam-grouping** (~20 findings → ~3–5 systemic seams), **CED** (incoherence/turn) + **goal-completion rate**.

---

## 2. Build phases

**Phase 0 — free first taste (optional, hours).** Re-judge existing `dm-playtest.mjs` gate transcripts for coherence (Jin et al. shape, against `buildCanonGroundTruth`). Proves the judge concept at zero new play. Validates the ConStory taxonomy against our real output.

**Phase 1 — the MVP finder (days, near-free). THE FIRST THING WE LET LOOSE.**
- Fork `dm-playtest.mjs` → `scripts/playtest-harness.mjs`.
- Build the typed goal (#1: escape first building → reach first concern) + an LLM goal-player with reflect-when-stuck.
- Build the **Tier-1 deterministic oracles** (`engine/harness/oracles.js`): state-desync, soft-lock/goal, free-action (consequence + spatial + §0 follow within the phase).
- Run on `tallow` from Wayfarers' Outpost, a handful of seeds; emit the structured `SessionReport`.
- **Done-when:** runs autonomously start→goal-or-stuck; emits a structured finding list with one-command repros; **reproduces ≥1 bug from Tim's playthrough** (the proof it sees what a human sees); deterministic oracles add **zero** API cost.

**Phase 2 — let it loose at scale (the real wish).**
- Consolidate **`legalActions(world)`** (one affordance function aggregating the scattered classifiers — Codex lane, touches intent routing near `playloop.js`).
- Swap the LLM player for the **scripted goal-pursuer** over `legalActions`.
- Run **hundreds of seeds unattended in CI**; emit the discovery curve + CED + goal-completion rate.
- Wire **goal-completion-rate + CED as a first-class gate** — the gate that must be green before anything is called **"playable"** (`HARNESS_USAGE_STRATEGY.md` §"two traps"). Add to `npm run check`.
- **Done-when:** one command runs N seeds free; discovery curve + meters reported; "playable" gate live.

**Phase 3 — self-fix loop (LATER, trust-gated).** find→group-by-seam→propose-fix→re-run-seeds→lock-regression. Human-approves each seam fix until trusted. Design Phases 1–2 outputs to feed this; do not build it yet.

---

## 3. File plan
- **New:** `scripts/playtest-harness.mjs` (the runner/driver), `engine/harness/oracles.js` (the deterministic oracle bank), `engine/harness/goals.js` (typed goals). Phase 2: `engine/harness/legalActions.js` (or fold into an existing affordance module).
- **Reused (no rewrite):** `engine/playloop.js` (`beginAdventure`/`playerMove`), `engine/ref/rubric.js` (`buildCanonGroundTruth`/`JUDGE_SYSTEM`), `scripts/dm-playtest.mjs` (player/loop scaffold), `scripts/playtest.js` (Tier-0 invariants), `engine/world/demoRegion.js` (`DEMO_SEED`).

## 4. Invariants this respects
- **Road A intact:** the player *proposes* actions; the engine commits; the oracles read committed state. The LLM judge (Tier 2) is a discovery pointer, never authority (Vols 10/14).
- **Determinism:** seed-replay is the repro mechanism; the scripted player (Phase 2) is deterministic. No `Math.random()`.
- **Two traps (institutional):** the harness gates the word **"playable," never "fun."** Green = *functional*, not *good*; "clunky but coherent" is invisible to it. Human playtime relocates to judging *magic*, not hunting broken plumbing.
