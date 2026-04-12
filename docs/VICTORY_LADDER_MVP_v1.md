# IMMORTAL ENGINE
# Victory Ladder MVP v1.0 (Revised)

> **Status:** Superseded by `NORTH_STAR.md` (2026-04-11). The finite-arc, gate-ladder commercialization model described in the original v1.0 has been retired. This document is retained for historical context and revised below to reflect the current direction.

---

## What changed

The original Victory Ladder defined a linear gate sequence (Gates 0-8) culminating in a paid single-pack product with finite 60-90 minute campaigns, Stripe billing, account systems, and a closed beta.

That framing assumed the engine's value proposition was a *finished campaign arc*. The current vision (`NORTH_STAR.md`) reframes the engine as an **infinite, deterministic, AI-narrated RPG** where the only true endings are player death or voluntary retirement. The commercialization ladder has been replaced by a vertical-slice development model (`SLICE_PLAN.md`).

---

## Current progression model

There is no "victory ladder" in the original sense. Development is organized as **worker passes** on parallel tracks converging into a playable vertical slice:

- **Track T** (Crunch): stats, items, spells, bestiary, loot, leveling -- all landed (T1-T3).
- **Track R** (Rumor): rumor schema, LLM-backed minting, propagation, verification -- all landed (R1-R3).
- **Track O** (Local LLM): Ollama provider, NPC brain with personality-aware decisions -- landed (O1-O2).
- **Track I** (Importer): pack validator, prose-to-world pipeline, Westmarch slice pack -- landed (I1-I3).
- **Track S** (UI): four-panel surface spine -- landed (S1).
- **Pass M1** (Integration): vertical slice playable end-to-end -- landed.

---

## What survived from the original ladder

Several original gate concepts remain valid, though they are no longer gating milestones:

- **Engine freeze contract** (Gate 0): determinism, Canon Log authority, worldHash stability, save format versioning. These are permanent engine rails, not a gate to pass through.
- **LLM containment** (Gate 2): the LLM never mutates canon. This is enforced by architecture and tested by U34-U40.
- **Single pack scope** (Gate 3): the vertical slice uses one pack (`fantasy`). Multi-pack support is deferred.
- **Replay guarantee** (from Gate 1): same seed + same transcript = same worldHash. This is a non-negotiable invariant, not a gate.

---

## What was retired

- **Finite campaign arcs** (Gate 1): no convergence triggers, no ending thresholds, no 60-90 minute target. Dread, scars, threads, and inevitability remain as world weather, not termination conditions.
- **Sequel continuation** (Gate 1, 4): campaigns do not end and chain into sequels. The world persists.
- **Account system** (Gate 5): deferred to post-slice.
- **Closed beta / monetization** (Gates 6-8): deferred. No Stripe, no paid tier, no beta cohort.
- **Region theme vectors / faction personality axes** (Gate 3.1): replaced by the prose-to-world importer. Regions are authored via prose, not procedural vectors.

---

## Current acceptance model

Instead of numbered gates with explicit AC checklists, the engine uses:

1. **Test suites** with prefixed naming (S#, N#, U##, C#, G0#) covering determinism, invariants, narration, NPC depth, and goals.
2. **Playtest harness** (`scripts/playtest.js`) checking 10 bug classes across headless simulations.
3. **Worker-pass specs** in `SLICE_PLAN.md` with per-pass commit conventions and test gates.

---

## References

- `docs/NORTH_STAR.md` -- canonical vision (infinite play, rumor collapse, prose-to-world)
- `docs/SLICE_PLAN.md` -- worker-pass breakdown for the vertical slice
- `docs/CRUNCH_V1.md` -- RPG mechanical substrate spec
- `docs/RUMOR_LAYER.md` -- rumor architecture
- `docs/PROSE_TO_WORLD.md` -- prose importer architecture
