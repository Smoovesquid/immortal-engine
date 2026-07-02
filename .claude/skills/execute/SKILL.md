---
name: execute
description: Execute a worker brief file end-to-end, unattended. Use when Tim types "execute <brief>", "run this brief", names a brief file with "please get it done", or pastes a bare brief filename. With "review"/"check this prompt first", critique before running.
---

# /execute — one line in, finished packet out

Formalizes Tim's "Execute: brief.md" habit. Spelling, capitalization, word order, and full-vs-bare
paths all vary — never bounce back over syntax.

## Resolve

Find the brief: try the literal path, then `docs/briefs/<name>`, then glob `docs/**/*<name>*`. Fuzzy-match
case-insensitively. If several match, pick the newest and say which you picked (don't stop to ask).

**Lane names never stall execution.** A model in the filename or header (`*.codex.md`, "route: Sonnet")
is who the brief was *written for*. Tim handed it to THIS window, so this window runs it. Only exception:
if the brief requires a capability this window truly lacks, say so in one line and do the rest.

## Review mode

If Tim says "review", "check this prompt", "what do you think (don't run it)": critique before executing —
does it collide with locked design docs (DND_XCOM, map art direction, IMMORTAL_INVARIANTS, obscure-goals)?
with in-flight lanes or hot files? is the done-when falsifiable? is anything left for Tim to decide
mid-run (that's a defect — fix the brief)? Give a verdict + concrete edits, then wait for "go".

## Execute

1. Follow the brief. Where it's silent, `docs/WORKER_BRIEF.md` conventions govern (Step-0 self-assemble,
   minimal verified edits, verification ladder, no paid gate without approval).
2. **Never route a decision back to Tim mid-run.** He's not a coder and is usually away. If genuinely
   blocked, take the reversible option and flag it in the report.
3. New tests: allocate numbers with `scripts/next-test-number.sh <prefix>` — never guess.
4. **Self-playtest before reporting done.** Player-visible changes get played through live `v1.html`
   (per `docs/PLAYTEST_PROTOCOL.md`) — a report without playtest evidence is not DONE.
5. Land per the brief's stated policy; default when unstated: commit locally, atomic by path, do NOT
   push (Basecamp verifies + pushes). If the brief says push, bump the version first (package.json +
   `public/v1.js` title AND build line) and state the new number.

## Report (always end with this)

Commit SHA + push status per policy · files changed · tests run with pass counts · playtest evidence ·
anything flagged — then a short **plain-English paragraph**: what was broken, what changed, why it
matters. No trailing "want me to…?".
