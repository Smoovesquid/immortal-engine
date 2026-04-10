# Autonomous Playtesting Protocol

Run this protocol when asked to playtest, or when making changes to engine/ code.

## Step 1: Establish Baseline

```bash
node --test 2>&1 | tail -5       # record pass/fail counts
node scripts/playtest.js --seeds 20 --turns 50   # fast smoke test
```

If either command fails, **stop and fix before proceeding**. The playtest script exit code is 1 when bugs exist.

## Step 2: Full Playtest Sweep

```bash
node scripts/playtest.js --seeds 50 --turns 200 --json > /tmp/playtest-report.json
```

Read the JSON output. Each bug has:
- `class` — the category (see Bug Classes below)
- `detail` — what exactly went wrong
- `context` — seed/fate/turn that triggered it

## Step 3: Triage and Fix

For each unique bug class, in priority order:

### Priority 1 — CRASH
The engine threw. Read the stack trace, find the function, fix it. These are always real bugs.

### Priority 2 — INVARIANT_VIOLATION
A value escaped its clamp. Find the code path that sets it without clamping. The fix is always adding or fixing a `clampInt()` call. Check `effectsCore.js`, `worldTick.js`, `state.js`.

### Priority 3 — DEATH_SPIRAL
Multiple threads at max tension + high clocks with no relief. Check:
- Is `threadRelief` delta being emitted on success in `resolve.js`?
- Is `applyDeltas` processing the `threadRelief` op?
- Is there a path where worldTick escalates faster than the player can relieve?

Fix by adding/tuning relief valves, NOT by removing escalation.

### Priority 4 — DETERMINISM_BREAK
Same seed produced different hashes. This means a function used `Math.random()`, `Date.now()`, `Map` iteration order, or some other non-deterministic source. Grep for these and replace with the seeded RNG from `engine/rng.js`.

### Priority 5 — SAVE_CORRUPTION
Export/import lost data. Check `engine/save.js` — a field exists on the world object that `exportWorld` doesn't serialize or `importWorld` doesn't restore. Add it.

### Priority 6 — ENDING_LEAK
State mutated after `ending.locked`. The guard in `playerMove()` should catch this. If it doesn't, the mutation is happening in a codepath that bypasses `playerMove`.

### Priority 7 — TIMELINE_RUNAWAY, CLOCK_MONOTONIC, NPC_OVERFLOW, THREAD_STARVATION
Tuning issues. Adjust caps, add FIFO trims, or introduce new relief/introduction mechanisms.

## Step 4: Verify Fix

After each fix:
```bash
node --test                       # all previously-passing tests must still pass
node scripts/playtest.js --seeds 20 --turns 100  # confirm bug is gone
```

## Step 5: Commit

Commit with format: `fix(<module>): <bug class> — <what changed>`

Example: `fix(effectsCore): INVARIANT_VIOLATION — clamp npcTrustDelta to [-2, +2]`

## Bug Classes Reference

| Class | Meaning | Likely Location |
|---|---|---|
| CRASH | Uncaught exception | Stack trace tells you |
| INVARIANT_VIOLATION | Value escaped bounds | effectsCore.js, state.js, worldTick.js |
| DEATH_SPIRAL | Unrecoverable escalation | resolve.js (relief), worldTick.js (escalation) |
| DETERMINISM_BREAK | Non-deterministic code | Grep for Math.random, Date.now |
| SAVE_CORRUPTION | Save/load data loss | save.js |
| ENDING_LEAK | Mutation after ending lock | playloop.js guard |
| TIMELINE_RUNAWAY | Unbounded timeline growth | worldTick.js, effectsCore.js |
| CLOCK_MONOTONIC | Clock never decreases | resolve.js (relief), worldTick.js (decay) |
| NPC_OVERFLOW | NPC data exceeds caps | effectsCore.js (npcKnowledgeShared, gossip) |
| THREAD_STARVATION | No active threads | conductor.js, instrument.js |

## Adding New Probes

Edit `scripts/playtest.js`. Follow the pattern:
1. Write a `probeXxx(world, context)` function that returns an array of bug objects.
2. Call it in the main simulation loop.
3. Add the bug class to `BUG_CLASSES` and this table.
