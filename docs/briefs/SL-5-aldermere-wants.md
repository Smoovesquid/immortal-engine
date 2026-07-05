# SL-5 — "Aldermere wants something" (Phase 1's named next)

**Model:** Claude Sonnet (content + narration-wiring lane). **Your tests: U488–U490**
(pre-allocated; do NOT run the allocator — parallel history may reserve neighbors).
**Spec of record:** `docs/briefs/SL-5-DRAFT.md` — read it IN FULL first; it is the fuller
spec (Candidate A detail, the 3–5-turn discovery sketches, the Armory trace with exact line
numbers). This brief is the settled-taste-calls execution order. Also: `docs/PACKETS.md` §SL-5
(the row + the SETTLED taste calls) · `docs/PRD.md` Phase 1 (the "Aldermere wants something" +
"cold-open beat" exit test).
**Governing law:** THE_DM_TEST (resolve intent in fiction) · **no quest log, EVER** (goals stay
obscure + player-held; nothing renders a list/panel/checklist — this is a HARD LAW, a shape that
needs UI enumeration is dead on arrival) · determinism-by-seed · narration ≠ canon.

## Step 0 — self-assemble (FIRST)

1. `git fetch origin && git reset --hard origin/v2-polish`; confirm `git log --oneline -1` is a
   recent v2-polish commit (expect `9c3b8fd9` "find you a face" or newer — your brief + the SL-5
   draft must exist in your worktree; if they don't, your reset didn't run).
2. Read `docs/briefs/SL-5-DRAFT.md` fully, then the seams it names:
   `engine/world/placeQuery.js` (`resolveConcern` at line 267 — its own inline comment anticipates
   this override), `engine/playloop.js` (the `pack.threads` seed block ~286–298 + the existing
   `createGoal` mint site + the D-B1 H2 `learn` verb path `proposeGoal.js`), `engine/composer.js`
   (the waking-opener line bank ~248–260), `engine/world/sliceRegion.js` (`LAYOUT` — where an
   authored table can live), and how the slice's town node id / slice-seed signal is established
   (`sliceRegion.js`/`demoRegion.js`).
3. `npm run check` GREEN before editing.

## The build (Candidate A + C, ONE bounded packet — the recommended pick)

Ship the curated-concern mechanism (A) with the cold-open worry line (C) folded in. Do NOT build
Candidate B (pinned living thread) — it's a documented Phase-2 rung; leave it parked.

**SETTLED taste calls (Tim, 2026-07-05 — do NOT relitigate):**
- **TWO curated worries, FIXED BY SEED, stable all session.** The town's authored worry pool is
  exactly two entries — one pointing at the **Greenwood road** ("the toll road's gone quiet — nobody's
  come up from the woods in two days"), one at the **Hollowed Chapel** ("the chapel bell rang, and
  nobody's rung it in a year"). The seed picks deterministically and the answer is STABLE for the whole
  session (asking the concern-question twice in one session yields the SAME worry — mirror `npcWant`'s
  `pick()` stable-per-seed behavior, NOT a re-roll). Both dangers are real in the world, but the surfaced
  civic worry is the one the seed chose.
- **The bandit camp (Crowfoot) is FOLDED INTO the Greenwood-road worry** — "the road's gone quiet" already
  covers it in fiction (the road IS the SL-4 bandit encounter node). Do NOT author a third, separate
  camp worry.
- **The cold-open line ships in THIS packet** (Candidate C), not as a fast-follow.

**The four pieces (all reuse existing mechanisms — invent no fifth):**
1. **Curated concern source (A).** Override `resolveConcern()`'s source for the slice's TOWN node only:
   return the seed-chosen curated worry from the 2-entry authored table instead of the generic role-pool.
   Gate on the SAME "is this the authored slice" signal `sliceRegion.js`/`demoRegion.js` already
   establish — every other pack/seed/node stays BYTE-IDENTICAL. The authored table (2 entries) lives
   inline in `placeQuery.js` or alongside `LAYOUT` in `sliceRegion.js` — your call.
2. **Commit → real goal (existing path).** "I'll look into it" / "I'll help" must mint the SAME `learn`
   goal the concern named, via the EXISTING D-B1 H2 `learn` verb path + `createGoal` site — NO new verb
   grammar, NO new mint path. Verify the round-trip (ask → commit → `world.goals` carries it).
3. **Consequence via the existing clock.** Seed the chosen worry as a thread at boot (sibling to the
   `pack.threads` block ~playloop.js:286–298) so it ages through the EXISTING `introduceThread` /
   `tickLivingThreads` clock and `mutateObjective` rewrites it after ~4+ unattended ticks — the SAME
   path PACK-1's Bridge Dispute / Drowned Twin already ride. NO new tick function.
4. **Cold-open worry line (C).** One new slice-seed-gated waking-opener entry in `composer.js`'s bank
   (sibling to the generic entry ~line 255), voicing the seed-chosen worry in the FIRST thing the player
   reads at wake — before they ask anything (see the draft's C transcript for tone). `tallow` / generic
   boots keep the existing generic opener unchanged.

## Hard constraints (from the §6 row — controlling)

- **allowed_files:** `engine/world/placeQuery.js`, the authored table (inline or `sliceRegion.js`),
  `engine/playloop.js` (thread-seed call only, ~5–10 lines), `engine/composer.js` (one line-bank entry),
  new `tests/U488*.js` / `U489*.js` / `U490*.js`.
- **forbidden:** `dialogue.js` / `grace/` (serial taste lane); `WORLD_VERSION` bump (reuse existing
  `instrument.threads` / `goals` shapes — NO schema change); `Math.random` (rng.js seeded-pick only);
  ANY §0 cosmology reference in the want text (civic/mundane danger ONLY — a quiet road, a ringing bell —
  never the Scar); changing `resolveConcern()` for any NON-slice node/pack (must stay byte-identical —
  verify against `tallow` and the generic `fantasy` boot).
- **invariants:** determinism U19/21/22/27/30 (same seed → same chosen worry, every time); convergence
  100% (re-run corpus; relock only if genuinely needed, documented); **no-quest-log** — `resolveConcern()`
  keeps returning ONE spoken `body` string, never an array/list a caller could enumerate (mirror
  `tests/U472`'s single-string discipline).

## Tests (U488–U490)

- **U488 — the curated want:** the slice's town node returns a curated worry (Greenwood or chapel, NOT
  the generic role-pool) on a concern-query; SAME seed → SAME worry across repeated asks (stability);
  a non-slice pack/node (generic `fantasy` boot) is byte-identical to today.
- **U489 — the round-trip goal:** ask-concern → "I'll look into it" mints the SAME `learn` goal in
  `world.goals` (targetRef matches the named worry); no quest-UI surface (the returned concern is one
  string, not a list).
- **U490 — consequence + cold-open:** an unattended worry ages ~5 ticks and its objective text has
  mutated (reuse `tickLivingThreads`'s test pattern); the cold-open waking line fires ONLY on the slice
  seed and is unchanged for `tallow` / generic boots; determinism ×2 (same seed → identical opener).

## Live-verify (map-fidelity sibling: prove it in the real player gesture)

Run your OWN server (`PORT=52xx node server.js` from your worktree — NEVER :5179, that origin holds
Tim's live save + the front-door overwrite-confirm landmine). LLM-off, drive the REAL gesture from a
fresh slice boot: (a) at wake, the cold-open voices the worry; (b) "what's troubling folk here?" names
the seed-chosen danger; (c) "I'll look into it" acknowledges a self-chosen goal — no quest banner. Capture
a short transcript into `docs/playtests/sl5/` as your receipt.

## Commit & report protocol

Commit in your worktree, atomic by path, `feat(slice): SL-5 — Aldermere's curated worry + cold-open`;
do NOT push; append your dated `docs/AGENT_CHANGELOG.md` section (seam, files, tests, the two authored
worry strings you wrote, receipt path, residual risk). Final report: commit SHA, tests with counts, the
LLM-off transcript, and a plain-English paragraph for Tim (what the town now wants, how a player finds it,
how it's tracked without a quest log). Make ALL judgment calls yourself; honest partials over rationalized
dones.
