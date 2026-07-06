# MP-4 — corruption→pact: the gift arrives unbidden (Tier 4 goes live)

**Spec (read FIRST, it is the law):** `docs/MORAL_PHYSICS.md` §4 (T4 row: "free power is the
loudest sign; you are being claimed") + §8 (packet row) + §6 (seams). Predecessors LANDED — study
their shape: MP-2 (`engine/morality/escalation.js`, tier fn + `darkGiftThresholds()` accessor on
forbiddenGates — PACT_CORRUPTION is READ, never forked) and MP-3 (worldTick delivery + latch
pattern `huntedT`/re-arm; the U454-E living-anchor re-pin ritual).

**Step 0 (mandatory).** Your worktree is branched from `main`, **~900 commits STALE** behind
`v2-polish`. Before ANY work: `git fetch origin && git reset --hard origin/v2-polish`; confirm
`git log --oneline -1` shows v0.30.8 or newer (MP-3 + CONSEQ-1 must be in your base — check
`engine/worldTick.js` contains the hunt block). Do NOT work in the main checkout. Then follow
`docs/WORKER_BRIEF.md`.

## Deliverable — the dark gift as an omen

1. **The trigger:** when an actor's standing corruption reaches the threshold
   `forbiddenGates`' own tables define (via MP-2's `darkGiftThresholds()` — do not fork the
   number), Tier 4 is live: the world-tick DELIVERS the gift through the EXISTING
   `forbiddenGates.darkGiftForThreshold` organ. The gift arrives UNBIDDEN — the player never asked;
   free power is the sign they are being claimed.
2. **Latch + re-arm** exactly on MP-3's `huntedT` precedent: once per crossing, re-arms only after
   corruption falls back below (if the organ's semantics differ, honor the organ and flag it).
3. **High-variance, treacherous** — whatever the existing organ's tables grant; engine-owned, seeded,
   replayable. No new effect content: the ladder is a ROUTER (§4).
4. **Hide-the-math:** nothing numeric in any player-facing string; the gift is diegetic. NO DM-prompt
   surfacing line — that is MP-5's packet, not yours.
5. **State:** any latch field is additive with default 0 (`ensureWorld` + invariant, MP-3's pattern);
   NO WORLD_VERSION bump. If new fields enter the fingerprint, re-pin U454-E with the living-anchor
   comment ritual and justify the SOLE delta — and note: Basecamp recomputes at integration if
   another packet lands ahead of you (it happened to MP-3+CONSEQ-1 today; expect it).

## Constraints

- Files: `engine/magic/forbiddenGates.js` · `engine/morality/escalation.js` · `engine/worldTick.js`
  · `engine/state.js`/`engine/invariants.js` (additive only) · your tests. Stay OFF `playloop.js`,
  `engine/effectsCore.js` (tier/heat stamping is landed — you read, not write), `engine/instrument.js`,
  `public/map/**`, `scripts/screenTruth*`, `scripts/check.mjs`, `package.json` + `public/v1.js`
  (NEVER bump version files — Basecamp owns the release), `server.js` fixtures.
- `rng.js` sole randomness, seeded per-system (MP-3's own-stream precedent so no-pact runs are
  byte-identical to before); mutations via `applyDeltas` where state changes.
- Fair combat never contributes corruption (U556's law stands).
- The screen goldens and `npm run playtest:screen` must stay green (it is a standing check rung now).

## Tests — U570–U572 (your assigned numbers; use ONLY these — the allocator re-offers unmerged claims)

- **U570** pact algebra: threshold read from forbiddenGates (assert === darkGiftThresholds(), never a
  literal); latch boundary edges (at/under threshold; once per crossing; re-arm behavior).
- **U571** the gift fires: scripted corruption run crosses the threshold → the tick delivers the gift
  deterministically (same seed = same tick, same gift); below threshold = nothing; no numeric moral
  value in any player-facing string.
- **U572** determinism wall: byte-identical `worldHash` across two replays of the scripted pact run;
  a no-deed default boot unchanged vs the U454-E anchor.

## Done-when

Full `node --test` green · determinism green · `npm run playtest:quick` clean · `npm run check`
GREEN (includes the screen rung) · live playtest per `docs/PLAYTEST_PROTOCOL.md` — drive a real
over-threshold run in the browser and watch the gift arrive (screenshot receipt; use a NON-default
port: `PORT=5185 npm run dev`) · commit in YOUR WORKTREE ONLY (atomic by path; do NOT push; do NOT
touch the main checkout) · plain-English report: commit SHA, files, test counts, what the gift
looks like in play, any organ-semantics judgment calls flagged.

## Standing conduct

Make ALL judgment calls yourself; never wait on Tim; take the reversible option and flag it.
