# OCC-STORY-2 — "up to something" becomes thread-driven (the world's plots place its people)

**Spec sources (read FIRST):** the OCC-STORY-2 row in `docs/PACKETS.md` (stage 2 of the placement
ruling) · OCC-STORY-1's landed shape (b092, worker `3e8862c2` → `5383caa9`: seed-stable story
anchors per role/epithet/faction, time-of-day movement, every occupant carries a narratable
`reason`) · CONSEQ-1 (b106, `4f460df4`): threads now REALLY carry `age`/`objective`/`trajectory`
across turns — the substrate this packet reads.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.30.9. Do NOT work in the main checkout.
Then `docs/WORKER_BRIEF.md`.

## Deliverable

Story anchors become THREAD-AWARE — still derived, still deterministic:

1. **Hot threads bias placement.** A live thread (in `world.instrument.threads` — read-only) whose
   tension/age crosses a NAMED threshold biases its related NPCs' anchors toward the thread's locus:
   the Lingerer haunts the chapel path *because the chapel thread is hot*; a road-worry draws a
   watcher toward the gate. Relation = the same seed-stable role/epithet/faction machinery
   OCC-STORY-1 built — extend its derivation, don't fork it.
2. **Reasons tell the live story.** The occupant's narratable `reason` reflects the thread's current
   state (its `objective` as it mutates — CONSEQ-1 makes this real): "watching the chapel path — the
   bell has not rung true for a week." No numerics, ever.
3. **A hostile indoors is a burglary IN PROGRESS, not an accident:** its `reason` says so, and IF an
   existing organ already records NPC deeds (MORAL_PHYSICS Arc A machinery — check `recordDeed`/
   `applyDeedCharges` for NPC actors), wire the witnessed burglary through THAT one call so MP-1's
   rumor bridge carries it. If no existing organ fits cleanly, DO NOT build one — flag it as the
   MP-arc follow-up and ship placement+reason only (the reversible option).

## The hash discipline (this is the subtle part — OCC-STORY-1 needed a documented re-pin)

- Boot placement must be UNCHANGED: at boot, threads are age-0 — pick thresholds so no bias fires on
  the default boot → the U454-E anchor (`…` chain, currently ends at MP-4's pin) does NOT move. If
  you conclude boot-hot tension SHOULD bias placement, stop and flag it instead of re-pinning.
- Post-boot, thread-driven placement shifts are fine and expected — deterministic per seed+state,
  byte-identical replay (prove ×2).

## Constraints

- Files: OCC-STORY-1's anchor/occupancy derivation modules (`engine/npc/**` / `engine/scene/**` —
  find its actual home) + your tests. READ `world.instrument.threads`; never write threads. Stay OFF
  `engine/playloop.js` (JR-HUNT-1's live lane), `engine/worldTick.js` + `engine/magic/**` (just
  landed, leave clean), `engine/llmAdapter.js`/`composer.js` (MP-5a's live lane), `engine/instrument.js`,
  `public/map/**` (WILD-SCALE-1's live lane), `scripts/**`, `package.json` + `public/v1.js` (never
  bump versions), `server.js` fixtures.
- `rng.js` only; derivations seeded; NPC dialogue caps and node-presence rules stand (Purity rule 8).
- The 7 screen goldens must stay byte-identical (default-boot placement unchanged guarantees this —
  it is also your canary that you didn't move the boot).

## Tests — U580–U582 (yours alone; ignore the allocator)

- **U580** hot-thread bias: scripted aged/hot thread → the related NPC's anchor lands at the thread
  locus with a thread-reflecting reason; cold thread → OCC-STORY-1 baseline byte-identical;
  deterministic ×2.
- **U581** the reason wall: reasons carry the thread's mutated objective in prose, ZERO numerics;
  indoor hostile carries the burglary reason (+ the one-call deed wiring if an organ existed).
- **U582** determinism + boot wall: default-boot U454-E anchor unchanged; goldens locked; multi-tick
  thread-driven placement replays byte-identical.

## Done-when

Full `node --test` green · `npm run check` GREEN (screen rung included) · live playtest per
`docs/PLAYTEST_PROTOCOL.md` (age the chapel thread in real turns, walk to the chapel path, meet the
Lingerer with the live reason; `PORT=5189 npm run dev`) · commit in YOUR WORKTREE ONLY (no push, no
main checkout) · plain-English report: commit SHA, files, test counts, the placement story you saw
live, and the burglary-organ decision you made (Tim is not a coder — translate jargon).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
