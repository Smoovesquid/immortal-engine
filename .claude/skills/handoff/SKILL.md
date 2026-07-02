---
name: handoff
description: Checkpoint this window's state and generate the next window's kickoff. Use when Tim says "handoff", "I need a prompt for a new basecamp/window", "I'm hitting my limit", "going to bed — set up the next session", or proactively when the session is deep and context is running low.
---

# /handoff — close a window without losing the thread

Replaces hand-written "kickoff prompt for a new basecamp" requests and reset-recovery pastes.

## Steps

1. **Sweep for loose ends before writing anything:**
   - `git status --short` + `git log origin/v2-polish..HEAD --oneline` — uncommitted or unpushed work?
     If this window made finished-but-uncommitted changes, commit them now (atomic, by path). If
     verified work is unpushed, run `bash scripts/lane-check.sh` and push. Don't hand off a dirty tree
     silently.
   - Any background agents / dispatched lanes still running? Note their state.
2. **Write `.claude/handoff-latest.md`** (overwrite; it's local-only, gitignored):
   - Date/time, branch, HEAD sha, version + build number.
   - **Done this session** — shipped work with commit shas, in plain English.
   - **In flight** — dispatched lanes (agent, brief, expected outcome), external windows Tim is running
     (Codex etc.), anything awaiting verification.
   - **Decisions made** — anything Tim ruled on that the next window must not re-litigate.
   - **Next moves** — the ordered short list, with the single recommended first action on top.
   - **Watch out** — known hazards (stale docs, half-landed lanes, budget state).
3. **Tell Tim exactly what to do next**, in two lines:
   - "Open a new window and type: **basecamp**" (the basecamp skill reads the handoff file automatically).
   - If a NON-basecamp window is what's needed (e.g. a specific brief), print the exact one-line
     kickoff instead (e.g. "execute: docs/briefs/XYZ.md").

Keep the handoff file under ~60 lines — it's a checkpoint, not a memoir. The next window re-derives
detail from git; this file carries only what git can't show (intent, decisions, in-flight external work).
