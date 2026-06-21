# Prompt Architecture & Improvement Loop — the operating model

**What this is.** The repo-native operating model for agent work on Immortal Engine — the SOTA "context
architecture → bounded loop → eval → revise → regression → human review" pattern, adapted. It is the
*constitution*; the *executable* pieces it points to already exist:

- **`docs/WORKER_BRIEF.md`** — the self-assembling task template (every agent prompt is built from it).
- **`docs/BASECAMP.md`** — the orchestrator role + the "Prompt assembly" protocol (turn a loose ask into a brief).
- **`npm run check`** — the one-command verification ladder (convergence + suite + determinism + git sync).
- **`npm run convergence`** — the free regression corpus (`tests/corpus/*.mjs`); **must stay 100%**.
- **`scripts/dm-playtest.mjs`** — the paid Opus discovery gate.
- **`docs/CAPABILITY_LEDGER.md`** — the finite capability list (C1–C16) + dated gate findings.
- **Automatic hooks** (`.claude/settings.local.json` → `scripts/hooks/`) — fire without anyone remembering.

> **One rule above all (Exec thesis):** the LLM optimizes the *workflow*, never the *truth standard*.
> Deterministic core proves no drift · corpus locks prevent regression · the paid gate discovers qualitative
> failures · **human taste decides whether DM behavior is acceptable.** Do not let an agent move the goalposts.

---

## 1. Every task declares six things (the WORKER_BRIEF fields)

`docs/WORKER_BRIEF.md` already encodes these; this is the standard they enforce:

1. **ALTITUDE** — repo-architecture · narration-quality track · scoped packet · single bugfix · corpus-lock ·
   paid-gate review · handoff. *(Agents fail when they do architecture while asked to fix a bug.)*
2. **AUTONOMY** — default **edit allowed, no commit; paid gate forbidden** unless explicitly approved. Commit
   only on `LAND`/`COMMIT`.
3. **LAYER** — declared *before* editing. Safe: prompt/workflow · parser/intent · narration wording/routing ·
   tests/fixtures · docs. **Danger (STOP + approval): state/effects · RNG · Canon Log/event log · mechanics
   semantics.** (A hook also guards these — §5.)
4. **MISSING-ARTIFACT RULE** — if the task relies on an unverified file/API/test/behavior, **STOP**; locate it
   with one deterministic command or ask. No edits until verified. *(The single strongest anti-hallucination guard.)*
5. **DONE-WHEN** — targeted test green · convergence 100% · determinism tripwires green · suite green · no new
   capability regressions · residual risk stated · rollback plan exists.
6. **OUTPUT CONTRACT** — `PROGRESS −10..10 / what was wrong / what changed / what proved it (cmds+counts) /
   files / tests / residual risk / rollback`.

For **hard** problems also force: ≥2 competing hypotheses (incl. one outside-the-box) + the cheapest
falsification, *before* editing. "Claim → evidence": no behavior claim without an opened file/line, a command
result, or a verified doc.

---

## 2. The improvement loop (bounded, not unbounded autonomy)

```
capture failure → classify → decide layer → assemble brief (WORKER_BRIEF)
  → investigate (reproduce LLM-off first) → patch minimally (safe layer)
  → lock with a corpus paraphrase-set → run the verification ladder (npm run check)
  → human reviews taste → commit only when authorized → record (ledger / changelog)
```

This is exactly the N-1…N-4 loop the changelog records. Localize-then-repair (Agentless-style) beats broad
autonomy: **if an agent wants to refactor before it can name the failure class and target layer, stop it.**

---

## 3. The eval model (three signals, never one)

| Signal | Instrument | Role |
|---|---|---|
| **Regression** | `npm run convergence` (free, deterministic, `tests/corpus/`) | Proves a fixed class stays fixed. **Must be 100%.** |
| **Determinism** | `node --test` incl. U19/U21/U22/U27/U30 + `worldHash` | Proves no drift. |
| **Discovery** | paid Opus gate (`scripts/dm-playtest.mjs`) | *Finds* new qualitative failure classes. Noisy. |
| **Taste** | Tim / `THE_DM_TEST` | Decides whether a borderline DM ruling is acceptable. |

**The bouncing-ruler rule (hard-won, gates 5–9):** the gate's headline % is stochastic (persona-sampled) and
the judge is biased — gate 7→8→9 went 12→5→10 on an only-improving engine. **Trust convergence + the
new-capability discovery rate, NOT the raw %.** Use the gate to discover classes; use the corpus to prove fixes;
use Tim for taste. Every fixed qualitative failure must leave a durable regression artifact (a locked corpus case,
≥5 paraphrases + diverge negatives).

---

## 4. Schemas

**Failure packet** (capture a gate/playtest failure):
```
FAILURE_ID · SOURCE · DATE · PLAYER_INPUT · ACTUAL_DM_OUTPUT · JUDGE_REASON ·
EXPECTED_BEHAVIOR · FAILURE_CLASS · LIKELY_LAYER · LOCK_TARGET (C#) ·
DIVERGE_NEGATIVES · PAID_GATE_NEEDED?
```
Failure classes: `empty_success · empty_filler · invented_barrier · generic_kickback · wrong_layer_response ·
roll_without_fiction · fiction_without_resolution · over_acquiescence · state_claim_without_canon ·
mechanics_leak · meta_answer_instead_of_dm · referent_failure · ambiguous_needs_clarification`.

**Context manifest** (what the agent loads — don't dump the repo):
```
ALWAYS: invariants (by reference) · the task packet · output contract · autonomy
IF RELEVANT: the newest gate failures · a matching corpus case · the layer's code · command results
NEVER BY DEFAULT: unrelated docs · stale gate reports · giant logs · full test output
```

---

## 5. The automatic layer (so the discipline doesn't depend on memory)

- **`npm run check`** — run the whole free ladder in one command (convergence → suite/determinism → git sync),
  one clean summary. Use it instead of remembering five commands.
- **Hooks** (`.claude/settings.local.json`, local; `scripts/hooks/`):
  - **danger-layer guard** (PreToolUse on Edit/Write) — warns before an edit touches `rng.js`, `csl/`,
    `effectsCore` mutation, or bumps `WORLD_VERSION` (enforces the §1.3 danger rule automatically).
  - **end-of-turn convergence** (Stop) — when `engine/` or `tests/corpus/` changed this turn, runs
    `npm run convergence` and reports the locked-pass line, so a regression can't slip by silently.
  - *Off-switch:* delete the `hooks` block from `.claude/settings.local.json`.

---

## 6. Human-in-the-loop (what an agent may NOT decide)

Tim decides: product-principle / acceptance-standard changes · whether a borderline DM answer is acceptable ·
whether to run the paid gate · whether to commit/land · anything touching canon/state/RNG/effects/event-log.
An agent may decide: which files to inspect after orientation · which hypothesis to falsify first · how to write
a minimal corpus lock · how to patch a *safe-layer* defect · which free tests to run.

---

## 7. Anti-patterns (replace, don't do)

- "Self-prompt until it works" → self-prompt the *workflow*, then run *fixed* evals + holdout; the agent never
  redefines success.
- Raw-gate-% worship → discover with the gate, prove with the corpus, judge with Tim.
- Prompt bloat → small invariant core + task packet + relevant examples + autonomy + output contract.
- Layer decided *after* editing → declare layer first; danger layers STOP.
- Tests written only to fit the patch → identify expected behavior before the production edit.

---

*Supersedes the legacy `docs/WORKFLOW.md` (old team/PR model). Backing research + full source list:
`docs/sota_prompt_architecture_eval_loops.md` is the desk reference this distills (keep that as the appendix; this
doc is the operating model).*
