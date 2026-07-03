---
name: dispatch
description: Run a worker brief as a background subagent in an isolated worktree — replaces hand-carrying prompts between windows. Use when Tim says "dispatch X", "send X to a worker", "run these in parallel", or when Basecamp needs worker lanes and no separate account (Codex / Pro farm) is required.
---

# /dispatch — subagent worker lanes (no more clipboard relay)

This is the default dispatch path, proven 2026-07-02 (5 parallel Fable subagents, shipped v0.22.0).
Hand-carry to another window ONLY when the lane genuinely needs a separate account: Codex, or the
Pro-farm terminal. Everything else runs here.

## Steps

1. **Resolve the brief.** Argument is a brief file (`docs/briefs/*.md`, `docs/PACKET_*.md`) or a packet
   ID from `docs/PACKETS.md`. Read it. A model name in the FILENAME (e.g. `*.codex.md`) is only who it
   was *written for* — it never blocks dispatching here. Do not ask Tim who should run it.
2. **Pick the model** from the brief's lane/model header, mapped to the Agent tool's options:
   deep-engine/hard-architecture → `fable` (if the window is open) else `opus`; grace/narration/content →
   `sonnet`; unstated → omit (inherit). Codex-only briefs: run them here on `opus` unless Tim explicitly
   wants the Codex window — then print the paste-ready prompt instead and say so.
3. **Serialize hot files.** If the brief touches `playloop.js`, `escapeCombat.js`, `dialogue.js`,
   `grace/`, `composer.js`, `state.js`, `rng.js`, `effectsCore.js`, or bumps `WORLD_VERSION`: only ONE
   such dispatch in flight at a time. Non-hot lanes (content / UI / docs) parallelize freely.
4. **Pre-allocate test numbers.** Run `scripts/next-test-number.sh <prefix> <count>` and hand each agent
   its numbers IN THE PROMPT ("your new tests are U331–U332"). This is what prevents the triple-U322
   collision of 2026-07-02.
5. **Spawn** via the Agent tool: `isolation: "worktree"`, `run_in_background: true`, model from step 2.
   Prompt = the brief's full text plus this standing trailer:
   - **FIRST — fix your worktree base (known harness trap, 2026-07-03).** The `isolation: "worktree"`
     worktree is branched from `main`, which is **~886 commits STALE** behind `v2-polish` (the mainline) —
     current files (e.g. recently-added scripts/docs) are simply absent. Before any work, in your worktree
     run `git fetch origin && git reset --hard origin/v2-polish` and confirm `git log --oneline -1` shows a
     recent v2-polish commit. Commit there and let Basecamp cherry-pick. **Do NOT "work in the main checkout"
     as a workaround** — that races Basecamp's integration and risks corrupting the live tree.
   - Follow `docs/WORKER_BRIEF.md` conventions (Step-0 self-assemble, verification ladder, output contract).
   - Make ALL judgment calls yourself; never wait on Tim. If truly blocked, take the reversible option
     and flag it in the report.
   - Commit locally in your worktree, atomic by path, do NOT push. Report: commit SHA, files changed,
     tests run with pass counts, and a plain-English paragraph for Tim.
   - Use ONLY the test numbers you were assigned.
6. **Integrate when workers return** (Basecamp's job, never delegated):
   a. `git fetch origin && bash scripts/lane-check.sh` — refresh HEAD first; origin may have advanced while you read.
   b. Cherry-pick / merge each worker branch; resolve test-number or doc-append overlaps.
   c. `npm run check` green → version bump (package.json + public/v1.js title AND build line, lockstep) → push.
   d. Report to Tim in plain English: what landed, the new version number, anything flagged.
7. **Paid gates:** check `node scripts/budget.mjs` before any `dm-playtest` run; record with
   `node scripts/budget.mjs spend <amt> "<what>"` after.
