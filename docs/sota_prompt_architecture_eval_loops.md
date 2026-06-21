# SOTA Playbook: Prompt Architecture, Eval Loops, and Self-Improving Coding Agents

**Audience:** LLM coding/research agents working inside the Immortal Engine repo.  
**Date:** 2026-06-21  
**Purpose:** Convert current SOTA in agentic coding, prompt/context engineering, and eval-driven iteration into a repo-native operating model.

---

## 0. Executive Thesis

The current best practice is no longer “write a better prompt.”

The stronger pattern is:

```text
context architecture
→ bounded agent loop
→ deterministic eval harness
→ trace/failure capture
→ prompt/workflow revision
→ regression + holdout testing
→ human review for judgment
→ versioned release
```

For Immortal Engine, the correct adaptation is:

```text
LLM proposes better process or patch.
Deterministic core proves no drift.
Corpus locks prevent regression.
Paid/LLM gate discovers qualitative failures.
Human taste decides whether the DM behavior is actually acceptable.
```

Do not let an agent optimize the truth standard. Let it optimize the workflow that is measured against the truth standard.

---

## 1. Definitions

### 1.1 Prompt engineering

Manual crafting of instructions, examples, constraints, and output formats.

Useful, but fragile when prompts become long, stateful, and project-specific.

### 1.2 Context engineering

Systematic design of the full information payload available to the model:

- project rules
- task packet
- repo map
- examples
- failure transcripts
- relevant code excerpts
- tool descriptions
- eval results
- prior decisions
- memory
- output contract

Context engineering is broader and more durable than prompt engineering.

### 1.3 Harness engineering

Design of the agent scaffold:

- how the agent receives tasks
- how it reads files
- how it runs commands
- how it edits
- how it gets reviewed
- how loops terminate
- how traces/failures become durable improvements

### 1.4 Loop engineering

A controlled self-improvement loop where agents use feedback, traces, evals, and bounded task packets to improve prompts/workflows or code.

In production-grade use, the loop is not unbounded autonomy. It is a managed process with stopping criteria, regression gates, cost controls, and human review.

---

## 2. SOTA Findings

### 2.1 Agents are model + harness, not model alone

When evaluating an agent, evaluate the model and the harness together. The harness determines tool access, action sequencing, context policy, memory, command execution, trace capture, and review loops.

**Implication for Immortal:**  
Do not ask “Is Opus smart enough?” in isolation. Ask:

```text
Did the task packet, context, tool loop, tests, corpus locks, and autonomy rules cause the agent to do the correct work?
```

**Repo rule:**  
Every major agent failure should be classified as one or more:

- model reasoning failure
- missing context
- bad prompt/task packet
- bad tool access
- bad eval
- missing corpus lock
- missing invariant
- too much autonomy
- wrong layer selected
- human acceptance criterion unclear

---

### 2.2 The best agents use simple composable loops

Anthropic’s agent guidance emphasizes simple, composable workflows over complex frameworks. The field repeatedly rediscovers that reliable agents need clear boundaries, tools, and evaluation more than elaborate autonomy.

**Recommended Immortal loop:**

```text
1. orient
2. verify artifacts
3. generate hypotheses
4. falsify cheaply
5. reproduce
6. patch minimally
7. lock with corpus/paraphrases
8. run convergence
9. run node --test
10. ask before paid gate
11. report / optionally commit only if authorized
```

Do not let a coding agent improvise its own loop unless the task is explicitly workflow-research.

---

### 2.3 ReAct remains the basic action pattern

ReAct-style agents interleave reasoning and action:

```text
reason about next step
→ take tool action
→ observe result
→ update plan
→ continue
```

This reduces hallucination compared with pure chain-of-thought because the agent can ground itself in external observations.

**Immortal adaptation:**  
Require “claim → evidence” discipline:

```text
Any claim about code behavior must be backed by:
- opened file path + function/line area, or
- test output, or
- command output, or
- verified repo doc.
```

Never accept “probably” architecture claims from a cold-start agent.

---

### 2.4 Self-refinement helps, but only if the feedback signal is real

Self-Refine and Reflexion-style methods show that models can improve outputs by generating feedback, reflecting, and revising. But in coding systems, self-feedback is unsafe unless tied to external evidence.

**Good self-refinement:**

```text
The agent reviews its patch against:
- failing test
- adjacent tests
- invariants
- corpus locks
- determinism tripwires
- diff size
- rollback plan
```

**Bad self-refinement:**

```text
The agent decides its own output “feels better” and rewrites until it is satisfied.
```

**Immortal rule:**  
Self-critique is advisory. Tests and invariants are controlling.

---

### 2.5 Agentless/localized repair is often better than full autonomy

Agentless research argues that many software-engineering tasks can be handled with a simpler, interpretable pipeline:

```text
localization
→ repair
→ patch validation
```

without letting the LLM freely decide all future actions.

**Immortal adaptation:**  
For narration-quality bugs, prefer:

```text
find failure class
→ locate likely layer
→ inspect exact file
→ add/modify corpus lock
→ patch minimal routing/narration
→ verify
```

over broad autonomous exploration.

**Heuristic:**  
If the agent asks to refactor before it can name the failure class and target layer, stop it.

---

### 2.6 Coding-agent benchmarks reveal the danger of weak tests

Recent SWE-Bench criticism and UTBoost-style work show that passing a benchmark test can fail to prove correctness if tests are weak, leaky, or incomplete.

**Immortal adaptation:**  
A narration fix must not merely satisfy the visible transcript. It needs:

- paraphrases
- diverge negatives
- adjacent capability checks
- determinism checks
- full regression
- fresh gate discovery later if budget permits

**Repo rule:**  
Every fixed qualitative failure should produce at least one durable regression artifact.

For narration, the preferred artifact is:

```text
corpus locked case
with ≥5 paraphrases
with diverge negatives
with surface_matches
with surface_excludes
```

---

### 2.7 Evals must be offline + online/trace-like

Modern eval practice separates:

- curated offline datasets
- production/trace-derived examples
- human feedback
- LLM-as-judge feedback
- regression tests
- holdout tests
- monitoring for new failures

**Immortal mapping:**

| SOTA eval concept | Immortal equivalent |
|---|---|
| offline eval dataset | corpus/convergence |
| unit/integration tests | `node --test` |
| deterministic replay | worldHash + U19/U21/U22/U27/U30 |
| production traces | playtest/gate transcripts |
| human feedback | user judgment / DM Test |
| model judge | paid Opus gate |
| holdout set | withheld gate failures not shown to prompt-writer |
| regression gate | convergence must stay 100% |

---

### 2.8 LLM-as-judge is useful but biased

LLM judges can help score subjective behavior, but research shows position bias, verbosity bias, bandwagon effects, and inconsistency. Debiasing work helps, but the safest practical pattern is to treat LLM judges as discovery tools, not final truth.

**Immortal rule:**

```text
Paid Opus gate discovers failure classes.
Corpus locks prove deterministic regressions are fixed.
Human taste decides borderline DM behavior.
```

Do not optimize only for raw paid gate percentage. It is stochastic.

---

### 2.9 Prompt optimization should become “prompts as code”

DSPy and related frameworks represent a move from brittle prompt strings toward modular, testable programs. The lesson is not necessarily “use DSPy.” The lesson is:

```text
prompts should be modular
versioned
evaluated
assembled from reusable sections
optimized against metrics
reviewed like code
```

**Immortal adaptation:**

Create repo-native prompt architecture:

```text
docs/prompt/sections/
docs/prompt/templates/
docs/prompt/examples/
docs/prompt/evals/
scripts/prompt/assemblePrompt.mjs
tests/prompt/
```

Only add scripts if repo conventions support them. Start docs-only if needed.

---

### 2.10 Context management is now a primary engineering discipline

Long-horizon coding agents fail when context explodes or collapses. Current context-engineering research emphasizes:

- stable task semantics
- compressed but faithful memory
- high-fidelity recent interactions
- explicit context refresh points
- retrieval/generation/processing/management as separate concerns

**Immortal rule:**  
Do not dump the whole repo into the agent. Give it a context manifest:

```text
always load:
- invariants
- current task packet
- output contract
- autonomy rules

load if relevant:
- failure transcripts
- corpus example
- layer docs
- file excerpts
- command results

never load by default:
- unrelated docs
- stale gate reports
- giant logs
- raw full test output unless needed
```

---

## 3. Prompt Architecture Principles for Immortal

### 3.1 Every agent prompt must have a declared altitude

Required field:

```text
ALTITUDE:
- repo architecture
- narration-quality track
- scoped packet
- single bugfix
- corpus lock
- paid gate review
- handoff
```

Agents fail when they do architecture while asked to fix a bug, or patch code while asked to design workflow.

---

### 3.2 Every prompt must declare autonomy

Required field:

```text
AUTONOMY:
- inspect only
- propose only
- edit allowed, no commit
- edit + commit only after LAND
- paid gate forbidden
- paid gate allowed only after explicit approval
```

Default for Immortal:

```text
edit allowed, no commit; paid gate forbidden unless explicitly approved
```

---

### 3.3 Every prompt must contain a missing-artifact rule

Required section:

```text
MISSING ARTIFACT RULE:
If an instruction relies on an unverified file/API/behavior/test/log, STOP.
Do one:
A) ask for the smallest exact artifact, or
B) run one deterministic locate/read command and paste the result.
No edits until verified.
```

This is the single strongest anti-hallucination guard.

---

### 3.4 Every hard task must force competing hypotheses

Required section:

```text
Before editing:
- produce 2–5 competing hypotheses
- include one outside-the-box hypothesis
- list evidence for/against
- name the cheapest falsification action
```

This prevents first-explanation lock-in.

---

### 3.5 Every fix must say what layer it is in

Required field:

```text
LAYER:
- prompt/workflow
- parser/intent
- narration wording
- narration routing
- resolver/rules
- state/effects
- RNG
- Canon Log/event log
- tests/fixtures
- docs
```

Default safe layers for narration-quality track:

```text
prompt/workflow
parser/intent
narration wording
narration routing
tests/fixtures
docs
```

Danger layers requiring stop/approval:

```text
state/effects
RNG
Canon Log/event log
mechanics semantics
```

---

### 3.6 Every prompt must define done-when

Required section:

```text
DONE WHEN:
- targeted test passes
- corpus/convergence remains 100%
- determinism tripwires pass
- full test suite passes if practical
- no new capability regressions
- residual risk is stated
- rollback plan exists
```

---

## 4. Recommended Repo-Native Prompt Architecture

### 4.1 Phase 1: Docs-only, low risk

Add/maintain:

```text
docs/PROMPT_ARCHITECTURE.md
docs/PROMPT_PACKETS.md
docs/prompt/templates/NARRATION_QUALITY_BUGFIX.md
docs/prompt/templates/HARD_DEBUG_ESCALATION.md
docs/prompt/templates/CORPUS_LOCK.md
docs/prompt/templates/PAID_GATE_REQUEST.md
docs/prompt/templates/HANDOFF.md
docs/prompt/templates/SCOPED_PACKET_PROPOSAL.md
docs/prompt/sections/AUTONOMY.md
docs/prompt/sections/MISSING_ARTIFACT_RULE.md
docs/prompt/sections/OUTPUT_CONTRACT.md
docs/prompt/sections/VERIFICATION_LADDER.md
```

### 4.2 Phase 2: Deterministic prompt assembler

Only after docs are stable.

Potential files:

```text
scripts/prompt/assemblePrompt.mjs
scripts/prompt/collectPromptContext.mjs
tests/prompt/assemblePrompt.test.mjs
docs/prompt/examples/
```

Properties:

- reads local files only
- deterministic Markdown output
- no network calls
- no LLM calls
- no paid gates
- no runtime game behavior changes
- testable with snapshot or sentinel assertions

### 4.3 Phase 3: Trace-to-packet loop

Later packet.

Flow:

```text
gate/playtest transcript
→ classify failure
→ extract player/DM/judge triple
→ propose corpus lock
→ generate scoped bugfix prompt
→ run free tests
→ optionally request paid gate
```

Do not automate patching before classification is reliable.

---

## 5. The Immortal Agent Improvement Loop

### 5.1 Loop overview

```text
1. Capture failure
2. Classify failure
3. Decide layer
4. Create task packet
5. Assemble prompt
6. Agent investigates
7. Agent patches minimally
8. Add/modify corpus lock
9. Run verification ladder
10. Human reviews taste
11. Commit only when authorized
12. Store learning as prompt/workflow update if general
```

### 5.2 Capture failure

Preferred format:

```text
FAILURE_ID:
SOURCE:
DATE:
PLAYER_INPUT:
ACTUAL_DM_OUTPUT:
EXPECTED_DM_BEHAVIOR:
JUDGE_REASON:
FAILURE_CLASS:
LIKELY_LAYER:
NOTES:
```

### 5.3 Classify failure

Suggested taxonomy:

```text
empty_success
empty_filler
invented_barrier
generic_kickback
wrong_layer_response
roll_without_fiction
fiction_without_resolution
over-acquiescence
state_claim_without_canon
mechanics_leak
meta_answer_instead_of_dm
pronoun/referent_failure
ambiguous_action_needs_clarification
```

### 5.4 Decide layer

Use this rule:

```text
If the deterministic outcome is correct but the words are wrong:
  narration wording/routing or prompt/workflow.

If the wrong check/action is selected:
  parser/intent or resolver/rules.

If state changes incorrectly:
  effects/state, STOP and scope.

If replay/worldHash changes unexpectedly:
  RNG/determinism, STOP and scope.
```

### 5.5 Add corpus lock before or with patch

For qualitative narration fixes:

```text
- at least 5 paraphrases
- at least 2 diverge negatives
- surface_matches for required behavior
- surface_excludes for bad pattern
- cite source failure
- status locked only when stable
```

### 5.6 Verification ladder

Preferred:

```text
1. smallest targeted test or throwaway harness
2. affected corpus file / convergence subset if available
3. npm run convergence
4. determinism tripwires if separable
5. node --test
6. free playtest quick/full if relevant
7. paid gate only after user approval
```

---

## 6. Prompt Templates

### 6.1 Universal Header

```text
ROLE:
You are an Opus 4.8 / Claude Code agent working inside Immortal Engine.

ALTITUDE:
[repo architecture / narration-quality track / scoped packet / single bugfix / corpus lock / handoff]

TASK:
[exact task]

AUTONOMY:
- inspect files: yes
- run free commands: yes
- edit files: [yes/no]
- commit: no unless I say LAND or COMMIT
- paid gates: no unless explicitly approved

INVARIANTS:
- narration is not canon
- LLM is never runtime authority
- RNG only through engine/rng.js
- mutation only through effectsCore.applyDeltas
- worldHash stable under replay
- LLM layer never throws; fallback to base narration
- anti-kick-back bias: resolve intent in fiction

MISSING ARTIFACT RULE:
If this task relies on an unverified file/API/test/behavior, STOP and locate/request the smallest artifact before editing.

OPERATING LOOP:
investigate → hypothesize → reproduce → patch minimally → lock → verify → report
```

### 6.2 Narration Bugfix Packet

```text
TASK TYPE:
Narration-quality bugfix.

FAILURE:
Player:
Actual DM:
Judge reason:
Expected behavior:

FIRST RESPONSE REQUIRED:
1. likely layer
2. 2–4 hypotheses
3. smallest files/tests to inspect
4. first deterministic command/file-read
5. no edits until code path verified

PATCH RULE:
Fix words/routing only unless verified evidence proves otherwise.

LOCK RULE:
Add or update corpus/paraphrase coverage with diverge negatives.
```

### 6.3 Hard Debug Escalation

```text
The previous fix failed. Do not patch again yet.

Reopen:
- failing output
- patch diff
- touched tests
- relevant invariants

Build a new hypothesis table with:
- test-harness explanation
- stale fixture/data explanation
- event-order/state-machine explanation
- boundary/API contract explanation
- unusual explanation

Run only the highest-value falsification command first.
```

### 6.4 Paid Gate Request

```text
You may not run the paid gate yet.

Prepare a paid gate request containing:
- what free verification already passed
- exact command to run
- estimated cost
- what failure class the gate is expected to detect
- what result would count as success
- what result would require a new packet
```

### 6.5 Prompt-Architecture Task

```text
TASK TYPE:
Prompt/workflow architecture only.

Do not patch gameplay behavior.
Do not touch canon/state/RNG/mechanics.

Goal:
Improve repo-native prompt generation and agent workflow artifacts.

Required:
- inspect existing docs/scripts
- propose minimal packet before edits
- prefer docs/templates first
- scripts only if deterministic and local-only
- no LLM calls
- no network calls
- no paid gates
```

---

## 7. Anti-Patterns

### 7.1 “Self-prompt until it works”

Bad because the agent may redefine success.

Replace with:

```text
self-prompt workflow
→ run fixed evals
→ inspect failures
→ revise workflow
→ rerun fixed + holdout evals
```

### 7.2 Raw gate percentage worship

Bad because persona runs are stochastic and judge-like systems are biased/noisy.

Replace with:

```text
Use gate to discover classes.
Use corpus to prove class fixes.
Use human review for taste.
Track new-class discovery rate separately from raw percent.
```

### 7.3 Prompt bloat

Bad because every rule consumes context and can conflict.

Replace with:

```text
small invariant core
+ task-specific packet
+ relevant examples
+ explicit autonomy
+ output contract
```

### 7.4 Agent decides layer after editing

Bad because it encourages wrong-layer patches.

Replace with:

```text
agent must declare likely layer before edit
danger layers require STOP/approval
```

### 7.5 Tests added only after patch

Risky because test gets shaped to patch.

Replace with:

```text
write or identify expected behavior before production edit when possible
```

### 7.6 LLM judge as final authority

Bad because LLM judges have measurable biases.

Replace with:

```text
judge = signal
corpus/test = regression proof
human = taste authority
```

---

## 8. Metrics to Track

### 8.1 Prompt/workflow metrics

```text
prompt_version
task_type
model
effort/mode
token_cost
wall_time
files_touched
commands_run
tests_passed
agent_stop_count_missing_artifact
user_interventions
```

### 8.2 Quality metrics

```text
failure_class_fixed
new_failure_classes_discovered
corpus_cases_added
diverge_negatives_added
regressions_found
regressions_escaped
paid_gate_failures_before
paid_gate_failures_after
```

### 8.3 Determinism metrics

```text
convergence pass rate
worldHash stability
U19/U21/U22/U27/U30 status
node --test pass/fail
RNG violations
effectsCore boundary violations
```

### 8.4 Human judgment metrics

```text
accepted_as_real_DM
rejected_reason
too_empty
too_generic
too_menu_like
invented_barrier
mechanics_leak
style_only_residual
dead_end_residual
```

---

## 9. Human-in-the-Loop Policy

### 9.1 Human must decide

- product principle changes
- acceptance standard changes
- whether a borderline DM answer is acceptable
- whether to run paid gate
- whether to commit/land
- any change touching canon/state/RNG/effects/event log

### 9.2 Agent may decide

- which files to inspect after orientation
- which hypothesis to falsify first
- how to write a minimal corpus lock
- how to patch safe narration/routing defects
- which free tests to run

### 9.3 Agent must stop

- unverified artifact needed
- dangerous layer required
- paid cost required
- tests conflict with product principle
- fix requires broad refactor
- acceptance standard is ambiguous

---

## 10. Recommended Immediate Process for Immortal

### 10.1 Add a prompt architecture doc

Create or update:

```text
docs/PROMPT_ARCHITECTURE.md
```

Contents:

- purpose
- prompt types
- invariant loading
- task packet format
- context manifest
- eval loop
- missing artifact rule
- autonomy levels
- output contracts
- verification ladder

### 10.2 Add prompt templates

Create:

```text
docs/prompt/templates/NARRATION_QUALITY_BUGFIX.md
docs/prompt/templates/HARD_DEBUG_ESCALATION.md
docs/prompt/templates/PROMPT_ARCHITECTURE_TASK.md
docs/prompt/templates/PAID_GATE_REQUEST.md
docs/prompt/templates/HANDOFF.md
```

### 10.3 Add a failure packet schema

Create:

```text
docs/prompt/FAILURE_PACKET_SCHEMA.md
```

Schema:

```text
FAILURE_ID:
SOURCE:
DATE:
PLAYER_INPUT:
ACTUAL_DM_OUTPUT:
JUDGE_REASON:
EXPECTED_BEHAVIOR:
FAILURE_CLASS:
LIKELY_LAYER:
LOCK_TARGET:
DIVERGE_NEGATIVES:
PAID_GATE_NEEDED:
```

### 10.4 Add a context manifest schema

Create:

```text
docs/prompt/CONTEXT_MANIFEST_SCHEMA.md
```

Schema:

```text
ALWAYS_INCLUDE:
TASK_SPECIFIC_INCLUDE:
FORBIDDEN_BY_DEFAULT:
STALE_UNLESS_REVERIFIED:
COMMANDS_TO_VERIFY:
```

### 10.5 Later: deterministic assembler

Only after templates stabilize.

```text
node scripts/prompt/assemblePrompt.mjs --template narration-quality --failure FID
```

---

## 11. Recommended First Prompt to Give Opus 4.8

```text
NEW TASK: Build a repo-native prompt architecture for Immortal Engine.

Do not patch gameplay behavior.
Do not touch canon/state/RNG/mechanics.
This task is prompt/workflow architecture only.

Goal:
Turn our current ad hoc self-prompting workflow into durable repo-native prompt architecture.

The architecture must let a future coding agent generate self-contained prompts that include:
- verified invariants
- current task packet
- autonomy level
- missing artifact rule
- real failure transcripts when relevant
- corpus lock format when relevant
- command ladder from package.json
- operating loop
- forbidden actions
- done-when
- output contract
- rollback plan

Required first step:
Run exactly one deterministic orientation command:

pwd && git status --short && find . -maxdepth 4 -type f \( -name "package.json" -o -name "CLAUDE.md" -o -name "AGENTS.md" -o -name "IMMORTAL_INVARIANTS.md" -o -name "PACKETS.md" -o -name "REPO_MAP.md" -o -name "THE_DM_TEST.md" -o -name "THE_REF.md" -o -name "CAPABILITY_LEDGER.md" -o -name "BASECAMP.md" -o -name "*prompt*" -o -name "*packet*" -o -name "*handoff*" -o -name "*workflow*" -o -name "*playtest*" -o -name "*gate*" -o -name "*corpus*.mjs" \) | sort

Then inspect only the smallest relevant docs/files.

Before editing, produce:

PROGRESS: -10..10

Summary:
- existing prompt/workflow architecture found
- proposed minimal packet
- risks / unknowns

[PROPOSED PACKET]
- files to inspect
- files likely to add/change
- verification commands
- rollback plan

Rules:
- Prefer docs/templates first.
- Scripts only if deterministic, local-only, and consistent with repo conventions.
- No LLM calls.
- No network calls.
- No paid gates.
- No commits unless I say LAND or COMMIT.
- If anything requires unverified files/APIs/behavior, STOP and locate/request the smallest artifact.
```

---

## 12. Source-Derived Takeaways

### Anthropic / Claude Code

- Use project memory files such as `CLAUDE.md` for persistent instructions and repository conventions.
- Use hooks and skills carefully to enforce workflow and reduce repeated context load.
- Treat tools as contracts between nondeterministic agents and deterministic systems.
- Evaluate agent harnesses, not only model responses.
- Prefer simple composable agent patterns over complex frameworks.
- Adaptive thinking / effort controls matter for hard coding tasks, but do not replace evals.

### OpenAI / Codex

- Mature agent improvement uses traces, evals, human/model feedback, and Codex-ready handoffs.
- Production traces become evals.
- Ambiguous cases route to humans.
- Improvements become bounded product or harness changes.
- Agent work should be inspected through traces before becoming eval loops.

### SWE-agent / Agentless / SWE-Bench research

- Agent-computer interfaces matter.
- Simple localization-repair-validation pipelines can be competitive and more interpretable.
- Weak tests can make bad patches look good.
- Benchmarks can overestimate real-world coding-agent capability.
- Realistic user-style tasks and stronger test augmentation are important.

### DSPy / prompt optimization

- Treat prompt systems as modular programs, not long strings.
- Optimize against metrics.
- Separate task signatures, examples, and optimization.
- Version and test prompt modules.

### LLM-as-judge research

- LLM judges are useful but biased.
- Known biases include position, verbosity, sentiment, and bandwagon effects.
- Use judges for discovery and triage, not sole authority.
- Pair judge output with deterministic tests and human review.

---

## 13. Source List

1. Anthropic, “Introducing Claude Opus 4.8,” 2026-05-28.  
   https://www.anthropic.com/news/claude-opus-4-8

2. Anthropic, “Claude Opus 4.8” product page.  
   https://www.anthropic.com/claude/opus

3. Anthropic Docs, “Prompting best practices.”  
   https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

4. Anthropic Docs, “Claude Code memory.”  
   https://docs.anthropic.com/en/docs/claude-code/memory

5. Anthropic Docs, “Claude Code hooks.”  
   https://docs.anthropic.com/en/docs/claude-code/hooks

6. Anthropic Docs, “Claude Code hooks guide.”  
   https://docs.anthropic.com/en/docs/claude-code/hooks-guide

7. Anthropic Docs, “Claude Code skills.”  
   https://docs.anthropic.com/en/docs/claude-code/skills

8. Anthropic Docs, “Claude Code overview.”  
   https://docs.anthropic.com/en/docs/claude-code/overview

9. Anthropic Engineering, “Building effective agents,” 2024-12-19.  
   https://www.anthropic.com/research/building-effective-agents

10. Anthropic Engineering, “The ‘think’ tool: Enabling Claude to stop and think,” 2025-03-20.  
    https://www.anthropic.com/engineering/claude-think-tool

11. Anthropic Engineering, “Writing effective tools for AI agents,” 2025-09-11.  
    https://www.anthropic.com/engineering/writing-tools-for-agents

12. Anthropic Engineering, “Effective context engineering for AI agents,” 2025-09-29.  
    https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

13. Anthropic Engineering, “Demystifying evals for AI agents,” 2026-01-09.  
    https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

14. OpenAI Developers, “Prompt engineering.”  
    https://developers.openai.com/api/docs/guides/prompt-engineering

15. OpenAI Developers, “Evaluate agent workflows.”  
    https://developers.openai.com/api/docs/guides/agent-evals

16. OpenAI Developers, “Trace grading.”  
    https://developers.openai.com/api/docs/guides/trace-grading

17. OpenAI Cookbook, “Build an Agent Improvement Loop with Traces, Evals, and Codex,” 2026-05-12.  
    https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop

18. OpenAI, “Building self-improving tax agents with Codex,” 2026-05-27.  
    https://openai.com/index/building-self-improving-tax-agents-with-codex/

19. OpenAI, “Harness engineering,” 2026-02-11.  
    https://openai.com/index/harness-engineering/

20. OpenAI Codex docs, “Subagents.”  
    https://developers.openai.com/codex/concepts/subagents

21. OpenAI Codex use case, “Add evals to your AI application.”  
    https://developers.openai.com/codex/use-cases/ai-app-evals

22. LangSmith, “Evaluation docs.”  
    https://docs.langchain.com/langsmith/evaluation

23. Promptfoo docs, “Getting started.”  
    https://www.promptfoo.dev/docs/getting-started/

24. Promptfoo docs, “Configuration reference.”  
    https://www.promptfoo.dev/docs/configuration/reference/

25. Yao et al., “ReAct: Synergizing Reasoning and Acting in Language Models,” 2022.  
    https://arxiv.org/abs/2210.03629

26. Shinn et al., “Reflexion: Language Agents with Verbal Reinforcement Learning,” 2023.  
    https://arxiv.org/abs/2303.11366

27. Madaan et al., “Self-Refine: Iterative Refinement with Self-Feedback,” 2023.  
    https://arxiv.org/abs/2303.17651

28. Yang et al., “SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering,” NeurIPS 2024.  
    https://proceedings.neurips.cc/paper_files/paper/2024/file/5a7c947568c1b1328ccc5230172e1e7c-Paper-Conference.pdf

29. Xia et al., “Demystifying LLM-Based Software Engineering Agents,” FSE 2025.  
    https://dl.acm.org/doi/abs/10.1145/3715754

30. Wang et al., “Agents in Software Engineering: Survey, Landscape, and Vision,” 2024.  
    https://arxiv.org/abs/2409.09030

31. Liu et al., “Large Language Model-Based Agents for Software Engineering: A Survey,” 2024.  
    https://arxiv.org/abs/2409.02977

32. Opsahl-Ong et al., “Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs,” 2024.  
    https://arxiv.org/abs/2406.11695

33. DSPy documentation.  
    https://dspy.ai/

34. DSPy optimizers documentation.  
    https://dspy.ai/learn/optimization/optimizers/

35. Stanford HAI, “DSPy: Compiling Declarative Language Model Calls into State-of-the-Art Pipelines.”  
    https://hai.stanford.edu/research/dspy-compiling-declarative-language-model-calls-into-state-of-the-art-pipelines

36. Shi et al., “Judging the Judges: A Systematic Study of Position Bias in LLM-as-a-Judge,” 2024.  
    https://arxiv.org/abs/2406.07791

37. Yang et al., “Any Large Language Model Can Be a Reliable Judge: Debiasing with a Reasoning-based Bias Detector,” 2025.  
    https://arxiv.org/abs/2505.17100

38. Yu et al., “UTBoost: Rigorous Evaluation of Coding Agents on SWE-Bench,” 2025.  
    https://arxiv.org/abs/2506.09289

39. Garg et al., “Saving SWE-Bench: A Benchmark Mutation Approach for Realistic Agent Evaluation,” 2025.  
    https://arxiv.org/abs/2510.08996

40. Aleithan et al., “SWE-Bench+: Enhanced Coding Benchmark for LLMs,” 2024.  
    https://arxiv.org/abs/2410.06992

41. Mei et al., “A Survey of Context Engineering for Large Language Models,” 2025.  
    https://arxiv.org/abs/2507.13334

42. Liu et al., “Context as a Tool: Context Management for Long-Horizon SWE-Agents,” 2025.  
    https://arxiv.org/abs/2512.22087

43. Zhang et al., “Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models,” 2025.  
    https://arxiv.org/abs/2510.04618

44. Mohsenimofidi et al., “Context Engineering for AI Agents in Open-Source Software,” 2025.  
    https://arxiv.org/abs/2510.21413

45. Business Insider, “Forget prompt engineering: ‘Loop engineering’ is all the rage now,” 2026.  
    https://www.businessinsider.com/what-are-loops-ai-engineering-tips-2026-6

---

## 14. Final Operating Rule

For Immortal Engine, use this as the top-level standard:

```text
Prompts are not disposable chat messages.
They are versioned workflow artifacts.

Every agent prompt must:
- declare altitude,
- declare autonomy,
- load verified invariants,
- include only relevant context,
- force investigation before edits,
- require competing hypotheses for hard problems,
- define missing-artifact stop behavior,
- lock fixes with tests,
- preserve deterministic rails,
- route subjective judgment through human review,
- and report proof, residual risk, and rollback.
```
