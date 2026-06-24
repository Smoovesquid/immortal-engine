# Human Playtest Harness — how to AIM it (the usage strategy)

*Companion to `docs/HUMAN_PLAYTEST_HARNESS.md` (how we BUILD it — a separate lane). This doc is
"how we deploy it for maximum value." Research backing: `docs/biblioteca/vol-16-automated-playtesting-coherence-harness.md`.
Reference spec for "correct": [THE_TABLE_TEST](THE_TABLE_TEST.md) — would this happen at a real D&D table?*

---

## The one fact that changes everything for *this* game

Every automated-playtesting paper spends most of its machinery on **perception** — turning pixels /
3D state into something an agent can reason about. **We don't have that problem: we own the Canon
Log.** That hands us the single highest-value oracle for free, and it is *not* the fancy LLM
coherence judge:

> **The deterministic desync oracle:** after each turn, diff what the narration *claims* happened
> against what the Canon Log *committed*. The engine already produces both. "You step outside" → did
> `scene.interior` flip? "You open the pouch" → did inventory change? "Rook falls" → is the foe dead,
> and did killing a *living NPC* write a consequence delta?

This catches the entire movement / state-desync bug class, runs in CI for **zero LLM cost**, and has
**none** of the judge-reliability risk (Vols 10/14). It only exists because of determinism + the
Canon Log. **Turn it on first, run it widest.**

## The dream, graded: the instinct is right; four refinements make it optimal

The dream — *"point it at the first building, find every problem, fix, move on"* — is **correct**:
- The first building is the **funnel**; every player traverses it, so its bugs block *everyone*. Max blast radius.
- "Localized, saturate, fix, advance" matches the world-wiring-one-location-at-a-time pivot.

The refinements:

1. **Measure "every," don't chase it.** Run the player across ~200 *seeds* of the beat (deterministic =
   cheap) and watch the discovery curve. When new-bugs-per-100-seeds flattens (Vol 9 capture-recapture),
   you've found ~all of them — "every problem" as a *number*, not a vibe. This is the answer to "so I
   don't playtest forever."
2. **Fix by *seam*, not by *building*.** The ~20 first-building findings collapse into ~3–5 systemic
   seams (movement-commit, intent-routing, combat-lethality, consequence-wiring). Fix the seam once →
   re-run the same seeds → watch the desync rate drop to zero. Most fixes harden *every* location.
3. **The player carries a typed *goal*, not a vibe.** "Escape the building and reach the first NPC who
   has a concern." It selects from the **legal-action set** (never free-flails — the cure for
   action-space paralysis) and reflects when stuck 15–20 turns (TITAN). A goal is what surfaces the
   *soft-lock / can't-progress* class — the actual "stuck at the beginning."
4. **Free-wide, paid-narrow.** Deterministic oracles run on hundreds of seeds every CI; the paid LLM
   judge runs on a handful of representative sessions as a discovery *pointer*, never the verdict.

## The oracle stack, by cost

- **Tier 0 — existing deterministic invariants** (`scripts/playtest.js`): crash, determinism, save-
  corruption, invariant-violation, soft caps. Run on every seed. Free.
- **Tier 1 — the NEW deterministic oracles (highest leverage; catch the lived bugs):**
  - **State-desync** — narrated change vs committed Canon Log (the crown jewel above).
  - **Spatial-correctness** — narrated *direction/destination* == committed destination. (Catches
    "head south → end up north"; richer than bare desync — needs real design, flag to the build lane.)
  - **Soft-lock / goal** — no progress toward the typed goal in N turns → dead-progress report.
  - **Free-action** — actions that should resolve with no roll (e.g. "go outside") must not roll.
  - **Consequence** — a living NPC died → a proportionate faction/hostility delta must exist. (THE_TABLE_TEST.)
  - **§0 token-scan** — narration must never leak the cosmology (deterministic forbidden-token check).
- **Tier 2 — the LLM coherence judge (paid, noisy, surgical):** ConStory taxonomy, checked **against the
  Canon Log**, **cross-family** (never Opus-judging-Opus), as a discovery pointer. Cheapest start of
  all: re-judge existing `dm-playtest.mjs` transcripts (Jin et al.) — signal at zero new play.

## The find → analyze → fix → move-on loop
1. **Point** the goal-directed player at the beat; run it across many seeds.
2. **Saturate** until the discovery curve flattens (you now *know* you've found ~all of it).
3. **Triage by seam** — group findings into the ~3–5 systemic seams.
4. **Fix the seam** — each finding ships a seed + transcript + exact state contradiction = an LLM-off,
   deterministically reproducible repro. Fix the smallest seam, re-run the seeds, watch the rate hit zero.
5. **Lock it** — the failing seed becomes a standing regression test.
6. **Advance the goal** to the next beat and repeat.

## Sequence (what to aim it at, in order)
1. **First building** — goal *get out + reach the first concern*. The funnel; where the player gets stuck.
2. **The make-or-break loop** — quest → deed → next town → greeted by name. The thing we called "proven"
   that was never human-walked.
3. **Combat (escape lane)** — lethality + consequence. Carry an *evil-play* goal that tries to murder and
   checks the town reacts (THE_TABLE_TEST).
4. **Breadth** — more towns, dungeons — only once 1–3 are coherent.

## What it solves — and what it deliberately does NOT (be honest)
- **The "is it broken?" layer — yes, strongly.** "I couldn't leave," "the DM lied about where I am,"
  "I'm stuck," "murder did nothing," "this quest can't finish." A goal-directed agent hits the same
  *functional walls* a human does, across hundreds of paths, and automated coherence-checking *beats
  human experts* at finding it (F1 0.678 vs 0.229). This is the bulk of what makes a playthrough "a mess."
- **The "is it *good*?" layer — no, and don't expect it to.** Prose that sings, a world that feels
  *alive*, pacing, fun, whether a new player even understands they *can* search the room — the harness
  is blind to all of it. It certifies *coherent*, not *delightful*.
- **So it RELOCATES human playtesting, it doesn't replace it.** Today human playtime went to the
  *machine's* job — hunting broken plumbing by hand. After the harness, the plumbing is proven, so human
  playtime becomes the *human's* job: judging whether it's magic. That's the only part worth your time.

## The two traps (the institutional point)
- **Make goal-completion-rate + CED (incoherence-per-turn) a first-class gate**, equal to the corpus and
  the Opus gate — and specifically **the gate that must be green before anyone says "playable."** Today's
  whole failure was claiming "proven" on the *words* axis while the *play* axis was never measured. This
  harness *is* the play axis.
- **A green harness means *functional*, not *good*.** That is today's trap, one level up — "clunky but
  coherent" is invisible to every oracle in it. Wire the harness to gate the word **"playable,"** never
  the word **"fun."** Fun still comes out of human hands on the keyboard.

## One dependency to confirm with the build lane
Vol 16 assumes the engine exposes a clean `legalActions(world)` each turn ("already computed"). If that
legality is scattered across the intent classifiers (`isExploreIntent`, `classifyTrivial`, the meta
handlers, the escape-combat verbs), consolidating it into one affordance function is the single piece of
plumbing the goal-directed player needs.
