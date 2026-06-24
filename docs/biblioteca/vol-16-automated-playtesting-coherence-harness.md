# Vol 16 — Automated Playtesting & Lived-Coherence Harnesses (2021–2026 frontier)

*Ingested 2026-06-24, DEMAND-PULLED (RESEARCH_SCAN discipline): Tim hit the gap by hand — the game "tests
well" on the per-turn DM-text gate but "doesn't make coherent sense" when actually played. The named near-term
need is the **Human Playtest Harness** (an agent that plays the real game end-to-end and surfaces bugs the way a
human would). No existing volume covers it: Vol 8 tests a **rule**, Vol 9 measures **coverage/stopping**, Vols
10/14 calibrate the **judge**, Vol 15 covers the **LLM-GM authoring** frontier and only *seeds* this
("possibility-space simulation as a dev tool"). This volume is the **play-the-game-to-find-bugs** sibling.*

**Biblioteca / Immortal frontier addendum.**
**Audience:** LLM reader.
**Goal:** survey current (2021–26) work on **automated playtesting agents** (agents that *play* a game to find
bugs) and **lived-coherence evaluation** (catching cross-turn incoherence in long-form interactive narrative),
for lessons transferable to a deterministic TTRPG engine whose game is **already text + a deterministic Canon
Log**, where the LLM is the DM's voice and **never** runtime authority.

---

## Decision-card — why this matters for Immortal

**The punchline: the harness we want is a validated, *assemblable* pattern — not a from-scratch invention.** It
has been built at least twice in the last year (TITAN, Lap), the hard "coherence judge" half is solved
(ConStory-Checker), and **our exact application class** — bug detection in an LLM-powered text game — has its own
paper (Jin et al., ACL 2024). Two findings reframe the whole effort:

1. **Automated coherence-checking beats human experts.** ConStory-Checker scored **F1 0.678 vs human experts'
   0.229** at catching injected consistency bugs (2026). So automating the playtest is not a lossy convenience —
   it catches *more* incoherence than playing it by hand. This is the direct answer to "so I don't have to take
   forever playtesting myself."
2. **The hard part of every paper is FREE for us.** TITAN, Lap, SEED, Inspector all spend most of their
   machinery on *perception* — turning pixels / 3D state into something an agent can reason about. **Our game is
   already text + a deterministic Canon Log.** So our coherence judge can check the prose against the *actual
   engine state* (the "screen says X / DM said Y / state holds Z" desync oracle is trivial when you own the
   state). SCORE bolts on symbolic state-tracking to get this; *we already are the state.*

**Road-A-safe.** The coherence judge **proposes** (a discovery pointer), the deterministic Canon Log
**confirms** — the LLM never gains authority over canon. Same invariant as the rest of the engine; identical to
the Vol 10 "judge-free corpus is PRIMARY, gate-judge is a SECONDARY noisy pointer" discipline.

The frontier maps almost 1:1 onto pieces we already have or are about to build:

| SOTA piece (citation) | What it IS / becomes in Immortal |
|---|---|
| **TITAN's four oracles** — Crash · Task-Status(stuck) · Execution-Time · Functional/Logic (2509.22170) | our `scripts/playtest.js` CRASH/perf classes (have) **+** the new **soft-lock/goal oracle** (Task-Status) **+** the **coherence oracle** (Functional/Logic). The harness is "add two oracles," not "build from zero." |
| **TITAN reflective stuck-detection** — 20 no-progress actions → diagnose → re-strategize; persistent state-action transition graph | the goal-directed player's **anti-spin loop** and the literal **"a quest that can't be completed / a fight with no exit"** detector |
| **TITAN constrained action templates** — Move/Talk/Attack/Use/PickUp/Explore via RAG retrieval | our **legal-action / affordance set** (already computed each turn). Directly answers the #1 stated failure (action-space paralysis): the player picks from legal moves, never free-flails |
| **ConStory taxonomy** — 5 categories / 19 subtypes (2603.05890) | the **coherence bug classes**; most map onto the existing capability ledger — Memory/Knowledge Contradiction → C9 / NPC-forgets; Core-Rule Violation → C8 narration≤mechanics; Quantitative Mismatch → CRUNCH_INCONSISTENCY; Nomenclature Confusion → CANON_HALLUCINATION |
| **ConStory-Checker pipeline** — extract suspect spans → pair → evidence-chain (quote + offset + class) → JSON report | the **coherence-judge architecture** (structured, reproducible, atomic — fits Vols 10/14). Reuse THE_REF scaffolding (`validateNarrationCandidate`, the gate `JUDGE_SYSTEM`) |
| **CED** — Consistency Error Density (errors / 10k words) | the **coherence meter** — a *rate* that can asymptote over infinite play, the coherence-axis analogue of the convergence % (Vol 9) |
| **Jin et al. (ACL 2024)** — detect hallucination / forgetfulness / misinterpretation from *game logs* | re-judge our **existing gate transcripts** for coherence post-hoc, cheaply — no new play needed to start |
| **SCORE symbolic state-tracking** (2503.23512) | unnecessary to build — the **Canon Log IS the symbolic ground truth** the prose is checked against |
| **Reachability / softlock** — Go-Explore (2209.00570), SEED curiosity-trajectories, CTL softlock (FDG'21) | the **dead-progress / soft-lock oracle**; the cheap version is TITAN's stuck-monitor, no RL needed |
| **User-sim drift** without typed goal + state (2601.15290) | the player must carry a **typed goal object + tracked state**, not a "confused newbie" vibe prompt (our gate's persona prompts are exactly the fragile form to upgrade) |

**New, actionable seeds (the build shape):**
- **Two tiers of "actual game."** A fast **engine-loop tier** (drive the in-process play loop) for volume — the
  bulk of coherence/goal/state bugs; plus a thin **real-browser tier** (`v1.html` via the preview harness) for a
  small set of "what the human actually sees" passes (pure render/UI desync only shows there). Scalpel, not the
  volume knob — the browser harness is slow + quirky (15s sessions, profile wipes).
- **A goal-directed player** seeded with a real objective (script #1 = the make-or-break loop: *take a quest from
  The Lasting Word → do the deed → reach the next town → get greeted by name*), choosing from the legal-action
  set, with TITAN-style stuck-reflection.
- **A coherence judge** that emits a ConStory-style structured report **checked against the Canon Log**, so every
  finding ships with seed + transcript + the exact state contradiction = deterministically reproducible.
- **A soft-lock / goal oracle** = "no progress toward the typed goal in N turns" → dead-progress report.

**Eval lens it adds (on top of Vol 8):** Vol 8 proves a *rule* is stable; this measures whether a *whole
session* stays coherent and whether a *goal is completable* — the orthogonal axis the per-turn gate is blind to.
The meter is **CED-style** (incoherence per unit of play) + **goal-completion rate**.

**Cautions (binding):**
- Vols 10/14 still hold: **no Opus-judging-Opus** for the coherence judge; prefer cross-family/panel + atomic
  checks; F1 0.678 is good-not-perfect → it is a **discovery pointer confirmed against deterministic state**, not
  a verdict.
- Most game-testing SOTA targets **visual / 3D / real-time** games — *do not import their perception/pixel
  machinery*; for us it's dead weight. Take their **oracle design + control loop + taxonomy**, leave their
  computer-vision.

**Reach for it:** scoping/designing the **Human Playtest Harness**; any **coherence / consistency oracle**;
**soft-lock / reachability / goal-completion** testing; a **goal-directed simulated player**; or any "play the
game end-to-end to find bugs" tooling. Sibling to Vol 8 (test a rule), Vol 9 (coverage), Vol 15 (LLM-GM
authoring). The build plan that consumes this lives in `docs/HUMAN_PLAYTEST_HARNESS.md`.

---

# Biblioteca Frontier Addendum — Automated Playtesting Agents & Lived-Coherence Evaluation (2021–2026)

**Audience:** LLM reader.
**Purpose:** collect current work on (a) agents that *play* a game to find bugs and (b) automated detection of
cross-turn / long-horizon narrative incoherence, with emphasis on what transfers to a deterministic text-first
TTRPG engine that already owns its world state.

---

## 1. Executive conclusion

Two literatures have matured to the point where the "Human Playtest Harness" is an **assembly problem**:

> **(A) Automated game-playing QA agents** (RL-era 2018–22, LLM-era 2024–26) reliably out-explore human testers
> and surface crash / reachability / stuck / logic bugs an author would never script.
> **(B) Long-form narrative-coherence evaluation** (2025–26) now has a *taxonomy of incoherence* and an
> *automated checker that beats human experts*.

The recurring winning shape across both:
- **A bounded action set** the agent selects from (not free generation) — the cure for action-space paralysis.
- **A bank of cheap oracles**, each watching for one failure family (crash · stuck · slow · contradiction).
- **A structured, evidence-bearing report** (quote + location + class), not a scalar score.
- **A ground-truth substrate** the prose/behaviour is checked against — which the strongest systems bolt on, and
  which Immortal already has (Canon Log).

---

## 2. The most directly transferable current work

## 2.1 TITAN — LLM agent as automated game tester (the architecture to copy)

### Citation
"Leveraging LLM Agents for Automated Video Game Testing" — arXiv:2509.22170 (2025). Evaluated on two commercial
MMORPGs (a 3D PC title, 5+ yrs live; a mobile title, 10 yrs live), 20 tasks.

### Mechanism
Four modules: **Perception Abstraction** (state → concise text; discretize health/coords into High/Med/Low);
**Action Optimization** (constrain to high-level templates — Move/Talk/Attack/Use/PickUp/Explore — RAG-retrieved
per state/task, filtering irrelevant choices); **Reflective Reasoning** (when 20 consecutive actions yield no
progress, the agent reviews history + coverage map, diagnoses the impasse, proposes a new strategy; a persistent
state-action transition graph carries learning across runs); **Issue Diagnosis** = four oracles — Crash Monitor,
Task-Status Monitor (flags stuck tasks), Execution-Time Monitor (≥10× baseline = perf anomaly), Functional/Logic
oracle (LLM-assisted subtle-defect detection).

### What the paper explicitly says
Bugs surfaced that rule-bound agents miss: **model-logic** (clipping into void — from "willingness to deviate
from prescribed paths"), **hang-interaction** (freeze under a specific UI delivery path), **step-counting** (a
quest marked complete after *five* kills instead of the required *six* — exposed by interrupt-driven play).
Numbers: **82% bug detection (15 bugs) vs ReAct/Wuji ~45%**; **state coverage 73% vs human tester ~34%**; task
completion 95%. Stated limits: perception/token limits on huge partially-observable states; action-space
paralysis without constraint; weakness on long-horizon task logic; poor cross-genre generalization; less useful
in reflex-heavy or minimal-narrative genres.

### Transferable lesson
This *is* the harness blueprint. The four oracles are exactly the failure families we care about, and the
reflective stuck-detector is the soft-lock detector. The step-counting bug is the canonical "lived-coherence /
goal" bug Tim means.

### Engine implication
Adopt the **oracle-bank + constrained-action + reflective-stuck** design. Two modules are free or cheap for us:
**Perception** (we hand the agent structured text + Canon Log, no vision) and **Action Optimization** (our
legal-action set already exists). The new build is the **Task-Status (soft-lock/goal) oracle** and the
**Functional/Logic (coherence) oracle**; Crash/perf already exist in `scripts/playtest.js`.

## 2.2 Lap — LLM-based automatic playtest (the minimal proof)

### Citation
"Towards LLM-Based Automatic Playtest" — arXiv:2507.09490 (2025). Match-3 (CasseBonbons, a Candy-Crush-like).

### Mechanism
Three stages: perceive (screenshot → m×n matrix), prompt (state + few-shot strategy examples + rules), execute
(LLM move → ADB swipe). Oracle = code-coverage (JaCoCo) + crash-on-terminate.

### What the paper explicitly says
**79% line coverage vs 75% (LIT baseline) / 3–5% (random Monkey); 5 unique crashes vs 1.** Limits:
hallucinated invalid moves; unfit for real-time; untested beyond match-3.

### Transferable lesson
Even a thin perceive→prompt→act loop with a coverage+crash oracle beats scripted/random bots. Confirms the
*shape* works; TITAN shows how to scale it with oracles + reflection.

### Engine implication
The fast engine-loop tier can start this thin and still beat hand-play on coverage. Coverage is a useful
*secondary* signal (which engine paths the playthrough exercised), under the primary goal/coherence oracles.

## 2.3 Jin et al. — automatic bug detection in an LLM-powered text game (OUR class)

### Citation
"Automatic Bug Detection in LLM-Powered Text-Based Games Using LLMs" — Jin, Rao, Peng, Botchway, Quaye,
Brockett, Dolan (Microsoft Research), ACL Findings 2024 (2024.findings-acl.907). Game: *DejaBoom!*

### Mechanism
A systematic LLM-based method that reads **player game logs** and flags bugs — no surveys, no fresh play
required. Targets three defect families specific to LLM-driven games: **hallucinations**, **forgetfulness**,
**misinterpretations of prompts** — surfacing as "logical inconsistencies and deviations from intended design."

### What the paper explicitly says
The structured log-analysis method **outperforms unstructured LLM bug-catching** at identifying bugs inherent to
LLM-powered interactive games.

### Transferable lesson
Our exact problem has precedent and a result: an LLM, given *structure*, reliably finds hallucination /
forgetfulness / misinterpretation in an LLM text game from logs. "Structured beats unstructured" rhymes with our
whole Road-A thesis (typed packets > free prose).

### Engine implication
**Cheapest possible start:** point a structured log-judge at our **existing `dm-playtest.mjs` gate transcripts**
and re-score them for coherence (hallucination/forgetfulness/misinterpretation). Zero new play; immediate signal
on the corpus we already paid for.

## 2.4 ConStory-Bench / ConStory-Checker — the coherence taxonomy + judge

### Citation
"Lost in Stories: Consistency Bugs in Long Story Generation by LLMs" — arXiv:2603.05890 (2026). 2,000 prompts,
8–10k-word stories, four task types (generation/continuation/expansion/completion).

### Mechanism
**Taxonomy — 5 categories / 19 subtypes:** (1) **Timeline & Plot Logic** (absolute-time, duration, simultaneity
contradictions; causeless effects; causal-logic violations; abandoned plot elements); (2) **Characterization**
(memory contradictions, knowledge contradictions, skill fluctuations, forgotten abilities); (3) **World-building
& Setting** (core-rules, social-norms, geographical contradictions); (4) **Factual & Detail** (appearance
mismatches, nomenclature confusions, quantitative mismatches); (5) **Narrative & Style** (perspective
confusions, tone inconsistencies, style shifts). **Checker — 4 stages:** category-guided extraction (find
contradiction-prone spans) → contradiction pairing (compare spans pairwise) → evidence chains (quote + char
offsets + class) → JSON report. **Metrics:** CED (errors / 10k words); GRR (length-aware rank).

### What the paper explicitly says
ConStory-Checker reached **F1 0.678 overall vs human experts' F1 0.229** on a 1,000-injected-error diagnostic
set. Models "contradict their own established facts, character traits, and world rules" as length grows.

### Transferable lesson
A ready-made bug taxonomy and a structured, reproducible judge — and hard evidence that automated coherence
detection is *better than human*. The taxonomy is plug-in bug classes for our harness.

### Engine implication
Adopt the taxonomy as the **coherence oracle's class list** (it pre-maps onto C8/C9/CRUNCH/CANON_HALLUCINATION).
Adopt the **extract→pair→evidence→JSON** pipeline as the judge shape (reuse THE_REF's `validateNarrationCandidate`
+ `JUDGE_SYSTEM`). Crucial upgrade vs the paper: their checker compares the story **against itself**; ours
compares the prose **against the Canon Log**, turning many "is this self-consistent?" judgments into deterministic
"does the prose match state?" checks — higher precision, less judge exposure.

## 2.5 Reachability / soft-lock — the dead-progress oracle lineage

### Citation
Go-Explore for reachability — arXiv:2209.00570 (Microsoft, IEEE ToG); EA SEED "Automatic Gameplay Testing with
Curiosity-Conditioned Trajectories" + "Augmenting Automated Game Testing with DRL" (Bergdahl et al., IEEE CoG
2020, arXiv:2103.15819); "Softlock Detection for Super Metroid with Computation Tree Logic" (FDG 2021,
doi:10.1145/3472538.3472542); Inspector pixel-based testing (arXiv:2207.08379).

### Mechanism
RL/exploration agents save checkpoints and seek "promising" frontiers to prove every intended area is reachable
and to find places a player "is not allowed to go, cannot go, or gets stuck" (SEED's own framing). The CTL work
formally model-checks for states from which no goal state is reachable (a softlock). "Blockers" (e.g. a door)
and "enablers" make reachability logic non-trivial.

### What the work explicitly says
A large fraction of game bugs are **reachability** bugs; exploration agents find stuck-points and unreachable
regions without human demonstration.

### Transferable lesson
"Can the player actually finish?" is a first-class, well-studied bug family. We don't need RL — a **goal-directed
player + a "no progress toward the typed goal in N turns" monitor** (TITAN's Task-Status) is the cheap, directly
usable form.

### Engine implication
The soft-lock oracle = the stuck-monitor over the typed goal. For coverage of *intended* reachability (every
town/quest/NPC the design intends is actually reachable on a seed), a Go-Explore-style frontier walk over the
node graph is a later, optional enrichment — the engine's deterministic map makes it tractable.

---

## 3. Current failure modes & cautions (what breaks these harnesses)

### 3.1 Action-space paralysis
Unconstrained agents emit invalid/irrelevant actions and stall (TITAN, Lap). **Fix:** select from the legal-action
set; never free-generate the move. Immortal already computes legality each turn.

### 3.2 Persona / goal drift between runs
Simulated players "drift between runs" without "structured persona definitions and explicit goal tracking"
(arXiv:2601.15290; AWS Strands Evals). **Fix:** a typed goal object + tracked progress state, not a vibe prompt.
Our gate personas are the fragile form to upgrade.

### 3.3 Perception / context limits
Huge partially-observable visual states exceed token/memory limits (TITAN). **Not our problem** — we are
text + structured state. The lesson is to keep the agent's view a *concise projection*, which we control.

### 3.4 Judge unreliability
Coherence judges are good-not-perfect (F1 ~0.68) and inherit all of Vols 10/14: generator non-invariance
(no Opus-judging-Opus), self-preference, CoT-can-harm. **Fix:** atomic/binary checks anchored to Canon Log
ground truth; cross-family/panel; the judge is a discovery pointer, the deterministic state is the verdict.

### 3.5 Real-time / reflex genres
LLM agents add little where reasoning isn't the bottleneck (TITAN, Lap). Irrelevant to us (turn-based, text).

---

## 4. Dense finding table

| Finding | Source | Engine use |
|---|---|---|
| LLM-agent tester beats prior bots on bug-detection (82% vs ~45%) + coverage (73% vs human 34%) | TITAN 2509.22170 | adopt oracle-bank + reflective-stuck architecture |
| Four-oracle design (crash/stuck/slow/logic) | TITAN | crash/perf=have; stuck=soft-lock oracle; logic=coherence oracle |
| Constrained high-level action templates beat free generation | TITAN | select from legal-action set |
| Thin perceive→prompt→act + coverage/crash oracle beats random/scripted (79% vs 3–5%) | Lap 2507.09490 | the minimal fast engine-loop tier |
| Structured LLM log-analysis finds hallucination/forgetfulness/misinterpretation in an LLM text game, beats unstructured | Jin et al. ACL 2024 | re-judge existing gate transcripts cheaply |
| Taxonomy of 5 categories / 19 subtypes of narrative incoherence | ConStory 2603.05890 | the coherence oracle's bug-class list |
| Extract→pair→evidence→JSON structured judge; CED rate metric | ConStory | the coherence-judge shape + the coherence meter |
| Automated coherence checker > human experts (F1 0.678 vs 0.229) | ConStory | the morale/decision case for automating the playtest |
| Symbolic state-tracking improves coherence detection | SCORE 2503.23512 | unnecessary — Canon Log already is it |
| Reachability is a dominant bug family; exploration finds stuck-points | Go-Explore 2209.00570, SEED | the dead-progress / soft-lock oracle |
| Formal softlock = no goal-state reachable (model checking) | CTL FDG'21 | optional formal enrichment over the node graph |
| Persona/user-sim drifts without typed goal + state | 2601.15290, Strands | typed goal object, not a vibe prompt |
| Unified text-game agent benchmark (Jericho/ALFWorld/ScienceWorld/TextWorld) | TALES 2504.14128 | reference substrate for text-agent evaluation patterns |
| Persona-driven LLM agent does realistic UI/UX testing + reflective reasoning | UXAgent 2502.12561 | the browser-tier player (reasons over the real `v1.html` surface) |

---

## 5. Recommended immediate use in Immortal

1. **Treat the harness as assembly, not invention.** Mechanical oracles (`scripts/playtest.js`) + player/judge
   scaffolding (`scripts/dm-playtest.mjs`) + ground truth (Canon Log) already exist.
2. **Build two new oracles:** soft-lock/goal (TITAN Task-Status) and coherence (ConStory taxonomy + checker,
   checked against Canon Log).
3. **Upgrade the player** from vibe-persona to **typed-goal + tracked-state**, choosing from the legal-action
   set, with stuck-reflection.
4. **Start free:** re-judge existing gate transcripts for coherence (Jin et al. shape) before building any new
   play loop — immediate signal at zero new cost.
5. **Meter it** with a CED-style incoherence rate + goal-completion rate — a *rate that asymptotes*, fitting the
   convergence framework (Vol 9). Keep the judge a discovery pointer; Canon Log is the verdict (Vol 10).
6. **Two tiers:** fast engine-loop for volume; thin real-browser pass (UXAgent shape) for render/UI desync only.

---

## 6. References / precedent to mine
- TITAN — Leveraging LLM Agents for Automated Video Game Testing — arXiv:2509.22170 (2025)
- Lap — Towards LLM-Based Automatic Playtest — arXiv:2507.09490 (2025)
- Jin et al. — Automatic Bug Detection in LLM-Powered Text-Based Games Using LLMs — ACL Findings 2024 (2024.findings-acl.907)
- ConStory — Lost in Stories: Consistency Bugs in Long Story Generation by LLMs — arXiv:2603.05890 (2026)
- SCORE — Story Coherence and Retrieval Enhancement for AI Narratives — arXiv:2503.23512 (2025)
- TALES — Text Adventure Learning Environment Suite — arXiv:2504.14128 (2025); TextQuests; J-TTL
- Go-Explore — Complex 3D Game Environments for Automated Reachability Testing — arXiv:2209.00570 (Microsoft, IEEE ToG)
- EA SEED — Curiosity-Conditioned Trajectories; Augmenting Automated Game Testing with DRL — Bergdahl et al., IEEE CoG 2020, arXiv:2103.15819
- Softlock Detection for Super Metroid with Computation Tree Logic — FDG 2021, doi:10.1145/3472538.3472542
- Inspector — Pixel-Based Automated Game Testing — arXiv:2207.08379
- UXAgent — LLM Agent-Based Usability Testing — arXiv:2502.12561 (2025)
- Agentic Persona Control & Task State Tracking for Realistic User Simulation — arXiv:2601.15290 (2026); AWS Strands Evals
- PersonaGym — arXiv:2407.18416; Open-Ended Glitch Detection w/ Agentic Reasoning — arXiv:2604.07818 (2026); Cooperative Multi-agent Game Testing — arXiv:2405.11347

---

## 7. Working summary
The Human Playtest Harness is a known pattern with a strong evidence base. **Build a goal-directed player that
selects from the legal-action set and reflects when stuck; run a bank of cheap oracles (crash/perf already exist;
add soft-lock/goal and coherence); judge coherence with a structured extract→pair→evidence pipeline checked
against the Canon Log; meter with an asymptotable incoherence rate + goal-completion rate; start by re-judging
existing transcripts for free.** The hardest module in the literature (perception) is free for us; the coherence
judge — the half we've never had — is solved and beats human experts. Road-A intact throughout: the judge
proposes, the Canon Log commits.
