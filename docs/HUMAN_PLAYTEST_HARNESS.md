# Human Playtest Harness — how we BUILD it

*Companion to `docs/HARNESS_USAGE_STRATEGY.md` (how we AIM it) and `docs/biblioteca/vol-16-automated-playtesting-coherence-harness.md` (the research backing). Oracle reference spec: [THE_TABLE_TEST](THE_TABLE_TEST.md) — "would this happen at a real D&D table?" This doc is the construction plan: components, file plan, reuse map, build phases, done-when.*

**Autonomy decision (Tim, 2026-06-24): FINDER first, then a GATED self-fix loop.** Phase 1 *plays + detects + reports*; it never edits engine code. Phase 3 (built 2026-06-24, `scripts/auto-playtest.mjs`) adds self-fix **without** loosening that stance: it works only on an isolated `auto-fix/<ts>` branch, every fix must clear a hard deterministic gate (the seam's LLM-off replay flips FAIL→PASS *and* the full suite stays green), and it never pushes or merges — Tim reviews + lands. A bad patch cannot survive (gate fails → auto-revert). "Self-fix" here means *proposes verified, reversible commits on a branch for review*, never "edits the trunk unattended."

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

**Phase 3 — the autonomous fix loop (BUILT 2026-06-24, `scripts/auto-playtest.mjs`).** One command: press go, walk away, come back to a branch of verified fixes + a short needs-human list. It wraps the Phase-1 finder.
- **The loop:** SETUP (refuse a dirty tracked tree → branch `auto-fix/<ts>` off the current head) → FIND (run the finder; `--find-player llm|scripted|replay:<log>`; the captured action logs make everything after this point deterministic even when discovery was stochastic) → GROUP findings into systemic **seams** (`oracleId::signature`, where the signature is the stable kebab slug leading the note) → TRIAGE via a **seam registry** (auto-fixable = localized + deterministically repro-gated, e.g. `free-action`; needs-human = state-commit / navigation-design / crash — returned untouched, diagnosed) → FIX each auto-fixable seam (bounded, `--max-attempts` default 3) → RE-RUN (replay the captured logs; confirm the seam dropped **and no new** seams appeared) → REPORT (`docs/playtests/harness/autofix-<ts>.md`) → STOP.
- **The hard gate (per attempt):** apply the candidate (the fix edits **plus** a generated regression test) → the seam's LLM-off **replay must flip FAIL→PASS** → the full **`node --test` stays green** (which subsumes the determinism gates U19/U21/U22/U27/U30). Pass → commit atomically (fix + regression test). Fail → **auto-revert** the attempt, retry up to max, else mark *couldn't-fix* (diagnosed, left clean).
- **The fixer is pluggable:** `proposeFix({ seam, codeContext }) → { edits[] }` via a coding model (Anthropic API default; a Codex-CLI drop-in for engine hot files per the routing memory). Edits are exact-string replacements; a malformed/no-op/not-found patch is simply a failed attempt.
- **Safety rails:** isolated branch only — **never** touches v2-polish, **never** pushes/merges (Tim lands); bounded by `--max-attempts` / `--max-seams` / `--time-budget`; full audit trail; every landed fix atomic + reversible. The fixer MAY edit hot files (`playloop.js`) — that's the job — but only through the gate.
- **The control logic is pure + dependency-injected** (`runFixLoop({ seams, fixer, gate, vcs })`); `scripts/auto-playtest.test.js` proves it **hermetically** with fakes — a good patch lands (commit, no revert), a bad one auto-reverts (no commit) — with no model calls, no git, no subprocess.
- **Proven (2026-06-24):** on `tallow` the loop auto-fixed the free-action seam (`inferInteriorAction` misrouted "I step inside the building." — the trailing period missed the `$`-anchored enter rule, so the engine rolled the dice for a roll-free move). Attempt 1's model patch failed the gate and **auto-reverted in the wild**; attempt 2 landed (replay flipped FAIL→PASS, suite 8584/0). The soft-lock seam was correctly returned as needs-human. Branch left for review; nothing pushed.

**Scope — room-level certification + run-to-saturation (BUILT 2026-06-24, FINDER-only).** Next certified path: object-interaction (look / search / take / examine), plus an objective "we've tested enough" terminator. *Additive to oracles/goals/harness — no playloop edits (the fix loop owns fixes).*
- **`object-interaction` oracle** (`engine/harness/oracles.js`, in `PER_TURN_ORACLES`). Diffs the narration CLAIM against committed state — reading state **directly** (node `furniture[]` + a generic all-buckets inventory count), NOT the shared Ref view, so the gate's judge input stays byte-stable and a new inventory bucket can never fool it. Three rules, each a structural contradiction the engine can't argue with (precision over recall): **acquired-nothing** (narration says you took an item, inventory didn't grow → phantom item), **denied-present-object** (you examined a target canon HAS at this node, narration says it isn't here), **failed-search-claimed-loot** (a failed roll still narrated a concrete find). The looser "named a noun absent from `furniture[]` on a bare examine" is a **deferred slot**: the fiction is richer than the furniture sockets (windows, walls, floors), so it can't clear the precision bar. Verified live: the engine already denies absent objects honestly, refuses heavy takes, reports empty searches — so the oracle is a **guard** (unit tests prove it fires on crafted contradictions; the live run proves it doesn't false-fire).
- **`probe-room` goal** (`engine/harness/goals.js`). A COVERAGE goal: drives the player onto every furniture socket so the oracle certifies the path on each. `progressMetric` = fraction of present objects probed; history-aware — the runner now threads `{ actionsLog }` to `progressMetric`/`satisfied` (backward-compatible; one-arg goals ignore it). Examine is the canonical (non-destructive) probe, keeping the denominator stable as it climbs.
- **`--until-boring` (run-to-saturation)** (`scripts/playtest-harness.mjs`). Explores WIDE — a fresh world per run (cycle seeds, then salt), varying LLM player — tracking the discovery curve of unique `seamKey`s. Stops on a **flat curve** (no new seam for `k` runs, default 8), **Chao1 saturation** (every seam re-seen, f1=0 ⇒ 0 remain), or a hard cap (`--max-seeds` / `--budget`). Reports the curve, the **Chao1 estimate + 95% CI** ("at least N remain", Vol 9 §2-3), the cost, and which cap stopped it. "Boring" = explored-wide-found-nothing-new, never player-repetition.
- **Tests:** `engine/harness/object-interaction.test.js` (oracle negatives/positives + a scripted `probe-room` session that covers `tallow`'s room clean) and `scripts/saturation.test.js` (`chao1` against hand-computed fixtures + `runToSaturation` on a FAKE discovery stream — flat-curve, Chao1-saturated, and every cap — zero model calls).
- **Proven (2026-06-24):** live `--until-boring --goal probe-room` on `tallow` (haiku player, capped) cleanly **saturated** — 3 runs, flat curve `0 → 0 → 0`, Chao1 `0.0 remain CI [0,0]`, **$0.0125**, stop `flat-curve` (the honest object path surfaces nothing, which is the right answer). Suite 8610/0.

---

## 3. File plan
- **New:** `scripts/playtest-harness.mjs` (the runner/driver; `--json` emits machine-readable findings for the Phase-3 gate; `--until-boring` runs to Chao1 saturation), `engine/harness/oracles.js` (the deterministic oracle bank — state-desync · free-action · object-interaction), `engine/harness/goals.js` (typed goals — reach-first-concern · probe-room). Tests: `engine/harness/oracles.test.js`, `engine/harness/object-interaction.test.js`, `scripts/saturation.test.js`. Phase 2: `engine/harness/legalActions.js` (or fold into an existing affordance module). Phase 3: `scripts/auto-playtest.mjs` (the autonomous loop) + `scripts/auto-playtest.test.js` (hermetic control-logic test); generated regression tests land at `engine/harness/regr.<seam>.test.js`.
- **Reused (no rewrite):** `engine/playloop.js` (`beginAdventure`/`playerMove`), `engine/ref/rubric.js` (`buildCanonGroundTruth`/`JUDGE_SYSTEM`), `scripts/dm-playtest.mjs` (player/loop scaffold), `scripts/playtest.js` (Tier-0 invariants), `engine/world/demoRegion.js` (`DEMO_SEED`).

## 4. Invariants this respects
- **Road A intact:** the player *proposes* actions; the engine commits; the oracles read committed state. The LLM judge (Tier 2) is a discovery pointer, never authority (Vols 10/14).
- **Determinism:** seed-replay is the repro mechanism; the scripted player (Phase 2) is deterministic. No `Math.random()`.
- **Two traps (institutional):** the harness gates the word **"playable," never "fun."** Green = *functional*, not *good*; "clunky but coherent" is invisible to it. Human playtime relocates to judging *magic*, not hunting broken plumbing.
