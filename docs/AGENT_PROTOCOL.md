# Multi-Agent Operating Protocol

**Why this exists:** on 2026-06-18 two planners (ChatGPT/Basecamp + Claude/Basecamp) each
dispatched a worker into `v2-polish` against the *same* combat seam (H-1..H-6). They happened to
touch different layers and stacked clean — pure luck. This protocol makes luck unnecessary.

Every agent (Claude, Codex/Keystone, any future worker) reads this before touching code.

## 1 — One queue, one owner
- **Claude/Basecamp owns the packet queue and the Rung-1 call.** It writes every worker prompt,
  assigns the model, and sets the sequence. There is exactly one "what's next."
- **Codex/Keystone is a worker backend**, not a parallel planner — best for deep, self-contained
  engine-resolution packets (combat routing, dice/state mechanics).
- **ChatGPT/Basecamp relays/formats** prompts; it does not independently queue work.

## 2 — One packet in flight at a time
- A *packet* = one bounded seam (usually one H-ID cluster) touching a known file set.
- **Serialize by default.** Run two packets in parallel ONLY when the queue owner has declared
  them *provably file-disjoint*. Anything touching `playloop.js`, `escapeCombat.js`, or the
  narration layer serializes — those files are collision-prone.

## 3 — Claim before code, log after
`docs/AGENT_CHANGELOG.md` is the shared ledger and the lock.
- **Before** any code edit, append + push a claim:
  `[CLAIMED] <seam> · <agent> · <UTC> · files: <paths>`
- Any agent treats a claimed seam **or a claimed file** as off-limits.
- **After**, replace the claim with a DONE entry (schema in §6) and push.
- A crashed/capped worker leaves a visible claim so the next one knows.

## 4 — Model fit
- **Opus:** planning, architecture, gnarly debugging, the Rung-1 call, prompt-writing. Sparingly
  (~5× burn).
- **Sonnet / Codex:** mechanical execution — reads, edits, the bug-fix loop, running tests. Default.
- **The LLM gate (`scripts/dm-playtest.mjs`) bills the `.env` API key** → owner-initiated, once per
  measurement milestone, NEVER by a worker mid-packet.

## 5 — Drift guards
- Mandatory bug-fix loop: reproduce → baseline FAILING test → fix → `node --test` →
  determinism U19/21/22/27/30 green → **atomic commit by path (no `git add -A`)** → **push every commit**.
- One canonical guide: **`CLAUDE.md` holds durable project rules.** `AGENTS.md` points to it and
  holds only Codex-specifics — it must not restate or contradict the rules (two copies = drift).
- **Untouchable by workers:** determinism rails (`rng.js` only; mutation via
  `effectsCore.applyDeltas`; `worldHash` stable) and canon authority. A fix needing a
  `WORLD_VERSION` bump or invariant change STOPS and returns to the queue owner.

## 6 — DONE-entry schema (for `docs/AGENT_CHANGELOG.md`)
```
<UTC date> — <Agent>
- Packet/seam: <Rung / H-ID>
- Commit(s): <hash…>
- Files changed: <paths>
- Summary: <what changed; what it deliberately did NOT do>
- Proof: <exact test cmd + pass count>
- Remaining/next: <follow-ups or none>
- Rollback: revert <hash>
```
