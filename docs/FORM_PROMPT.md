# THE FORM PROMPT — a portable worker brief (adapt per task, per model)

*Distilled 2026-07-04 from the dispatch pattern that produces long, self-verifying autonomous
runs (MAP-OCC / WS-1 / WS-2 / NODE-DESYNC lanes). This is the PORTABLE version — for any model,
any repo, any tool. The in-repo machinery it generalizes: `WORKER_BRIEF.md` (self-assembling
template) + `PROMPT_ARCHITECTURE.md` (the constitution) + the `dispatch` skill.*

## Why it works — the six levers

1. **Done = verification, not effort.** The finish line is something a MACHINE prints (tests
   green, build clean, repro fixed), never "I think it's good." A worker with an objective
   finish line cannot stop early.
2. **Reproduce before fixing.** The first deliverable is always proof the problem exists and is
   understood. Kills blind patching.
3. **Autonomy clause.** No one is watching, so asking a question = the work dies. Forbid
   questions; mandate the reversible option + a flag instead.
4. **Honesty clause.** Failures reported red, premises corrected out loud, divergences
   documented. You get truth back instead of reassurance.
5. **Self-contained evidence.** The worker starts with zero context. Everything needed —
   quotes, file:line pointers, exact repro — lives IN the prompt. Specificity buys endurance:
   vague prompts get fast shallow answers; exact prompts run for half an hour because the
   worker always knows what "not done yet" looks like.
6. **Hard boundaries.** Files it owns, files it must never touch, invariants that must hold.
   Boundaries are what make parallel lanes safe and diffs reviewable.

---

## THE FORM (copy from here; replace {BRACES}; delete sections that don't apply)

```markdown
# {TASK-ID} — {one-line mission, imperative: "the map draws who's actually there"}

**You are a worker lane for {repo/project}. Execute this brief end-to-end, alone.**
**Files you own:** {paths}. **Files you must NOT touch:** {paths — and say who owns them}.
**Your test names/numbers:** {pre-allocated — prevents collisions with parallel workers}.

## Step 0 — ground yourself (before ANY work)
{Exact commands to reach the true starting state — checkout/branch/reset/install — plus how to
VERIFY you're on it: an expected commit hash, version string, or passing baseline command.}
If the state doesn't match, STOP and report that — do not improvise a workaround.

## The mission (one breath)
{2–4 sentences, plain language: what is broken or needed, and WHY it matters. If there's a
governing principle or design law, quote it here verbatim.}

## Evidence (self-contained — assume you know nothing beyond this document)
{The exact failing input → the exact wrong output, quoted. Error text verbatim. The user
story. Everything someone with amnesia would need to act without asking a single question.}

## Read first (targeted)
- {file:line — what it is and why it matters}
- {the precedent to MIRROR, not reinvent — "X already solved this shape at Y; copy its pattern"}
{For big files: "grep to locate, read slices, never the whole file."}

## The shape of the fix
1. **REPRODUCE FIRST.** {How: a script, a failing test, a manual sequence.} If you cannot
   reproduce it, STOP and report that finding — do not fix what you cannot see.
2. {Sub-fix A — constraint-level guidance; leave the diagnosis to the worker.}
3. {Sub-fix B.}

## Hard boundaries
- **FORBIDDEN:** {files / dependencies / patterns / behaviors}. If the fix seems to need a
  forbidden thing, STOP that line of work and flag it in the report — do not cross.
- **INVARIANTS that must hold:** {determinism, API compat, perf budget, zero behavior change
  elsewhere — whatever your project's non-negotiables are}.

## Definition of done (objective — the machine decides, not your judgment)
- New tests {names} written and passing, locking the fix.
- {Full verification command(s)} green: {expected counts if known}.
- The original evidence now produces {the correct output} — shown in the report.
- {Lint / typecheck / build / e2e — the full ladder your project has.}

## Autonomy & honesty rules
- Make EVERY judgment call yourself. Never stop to ask — no one is there to answer.
- If truly blocked, take the most REVERSIBLE option and FLAG it prominently in the report.
- If you discover this brief's premise is wrong, say so, do the right thing, and document
  the divergence. Do not silently obey a wrong spec; do not silently ignore it either.
- Report failures faithfully: a red result you couldn't fix is reported RED, never rounded
  up to "mostly working."
- Do ONLY this task. Adjacent problems you notice go in the report as findings, not fixes.

## Output contract
- {Commit/PR/artifact rules — e.g., "commit locally, atomic by path, do NOT push" or
  "open a PR against X" or "write the result to Y".}
- The final report MUST include: {the artifact/SHA} · files changed · every test command run
  with pass/fail counts · every flag, relock, or divergence with justification · and a
  **plain-English paragraph for {the human}: what was broken, what changed, why it matters —
  jargon translated on first use.**

## Rollback
{One line: how to undo everything this task did.}
```

---

## Adapting per model (what transfers, what to tighten)

- **Transfers unchanged to ANY model:** the verification ladder, the autonomy clause, the
  honesty clause, the output contract. These are the engine of the long run.
- **Stronger models (Opus/Fable-class):** can own the diagnosis. Give root-finding scope
  ("find where X commits and why"), fewer prescribed steps, wider boundaries.
- **Mid models (Sonnet/Codex-class):** tighten the fix shape (name the function, quote the
  lines), shrink the scope to one seam, add more read-first pointers. The clearer the spec,
  the cheaper the model that can run it.
- **Any model, any size:** NEVER delegate taste. Aesthetic/product judgment calls get decided
  in the brief BEFORE dispatch ("Tim ruled: X"), or the work waits for the human. A worker
  told to make taste calls makes confident wrong ones.
- **If the model can't run commands:** replace the verification ladder with "produce the exact
  commands a human will run, and the expected output of each" — keep the objective finish
  line even when the model can't press the buttons itself.

## The one-line version (when you have no time)

> Ground yourself in the real state → here is the evidence, verbatim → reproduce it before
> touching anything → fix within these boundaries → done means THESE commands print green →
> never ask, take the reversible option and flag it → report the truth, including failures,
> in plain English.
