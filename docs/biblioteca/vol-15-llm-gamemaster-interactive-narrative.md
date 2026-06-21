# Vol 15 — LLM Game-Mastering, Interactive-Narrative Agents & Interactive Drama (2023–2026 frontier)

*Ingested 2026-06-21 from Tim's hand-off — DEMAND-PULLED, not stockpiled (RESEARCH_SCAN discipline): it
backs three ACTIVE threads — the **C8 "narration ≤ mechanics" validator** track (`llmAdapter.js`), **[[IG-10]]**
decline-the-absurd / **C13** (graduated H-67), and the **convergence eval** (Vols 8–10/14). The author's original
addendum is preserved verbatim below the decision-card.*

**Biblioteca / Immortal frontier addendum.**
**Audience:** LLM reader.
**Goal:** survey current (2023–26) LLM game-mastering, interactive-narrative-agent, and interactive-drama systems
for lessons transferable to a deterministic TTRPG engine where the LLM is the DM's voice/interface and **never**
runtime authority over world state.

---

## Decision-card — why this matters for Immortal

**The punchline: the 2023–26 LLM-GM frontier independently RE-DERIVES this engine's core principle** —
*"GM proposes, the deterministic system commits"* — the same endorsement Vols 1 and 7 give from the pragmatics
side, now from the games / interactive-drama side. We are on the defensible road (Road A), not a compromise.

The frontier's named failure modes map almost 1:1 onto rules/threads we already run or are actively fighting:

| Frontier failure mode (citation) | What it already IS in Immortal |
|---|---|
| **Free-prose world-state assertion** (Orchestrated Reality 2026) — the narrator *says* state instead of reading/writing validated state → statelessness, canon drift | the `narration ≠ canon` invariant + **C8 "narration ≤ mechanics" validator** (`llmAdapter.js` R1–R4e) — the exact layer the 2026-06-21 gate caught fabricating an "18 vs DC 12" ledger |
| **Lack of pushback / "yes to everything"** (Drama Llama 2025) — naive yes-and → over-acquiescence | the **deliver-or-decline** contract + **[[IG-10]]** decline-the-absurd + **C13** (graduated) + THE_DM_TEST. The frontier's "yes / no / yes-but / no-but / clarify / oppose — *fiction first*" IS THE_DM_TEST in GM-theory terms |
| **Narrative structurelessness / pacing collapse** (Façade; Drama Llama) — purely reactive local prose has no dramatic shape | needs a deterministic **scene/beat/tension manager** = **[[IG-7]]** (the DM's hidden thread-weaving purpose over `instrument.js`/`conductor.js`) + **[[IG-9]]** the light touch |
| **State amnesia** — prompt memory ≠ state | persistent canon / ledger / Canon Log outside the model (IMMORTAL_INVARIANTS) |

**New, actionable seeds (not yet built):**
- **GM moves as a deterministic affordance set** — reveal info · put-in-a-spot · show consequences · escalate
  threat · offer a hard choice · separate parties · advance a clock · ask for clarification · reflect NPC
  reaction · change scene pressure. Encode in the core (`conductor`/`instrument`); the LLM only *voices* them.
  This is the GM-move half of **[[IG-11]]** social physics ("behavior is rule-bound") and of Vol 1/7's
  "interpret richly, commit narrowly."
- **Possibility-space SIMULATION as a dev tool** (Elsewise, WhatELSE) — simulate many interaction traces from a
  seeded world-state to SEE where the voice layer drifts *before* release. **We already run a proto:**
  `npm run convergence` (deterministic trace-replay) + the Opus gate (free trace exploration). The frontier
  validates that instrument and points at "possibility-space visualization" as its grown-up form.
- **External validator whenever generated narrative must map to executable state** (WhatELSE) = the invariants
  layer + the C8 validator. Citable backing for hardening that validator next.

**Eval lens it adds (on top of Vol 8):** judge **agency + coherence-over-long-horizons + dramatic progression**,
and specifically *"does the DM over-acquiesce?"* (= IG-10/C13) and *"does narration over-commit beyond core
state?"* (= C8) — both already in our gate's VIBE/CRUNCH rubric, now externally grounded.

**Reach for it:** any LLM-GM architecture/boundary question ("should the LLM own X?"), the **C8 narration-validator**
track, scene/beat/storylet/drama-manager design, **GM-moves / affordance** design, or possibility-space /
dev-tooling / long-horizon-eval design.

---

# Biblioteca Frontier Addendum — LLM Game-Mastering, Interactive-Narrative Agents, and Interactive Drama (2023–2026)

**Audience:** LLM reader.  
**Purpose:** collect current work on LLM game-mastering, interactive-narrative agents, and interactive-drama systems, with emphasis on lessons transferable to a deterministic tabletop-RPG engine where the LLM is the DM’s voice/interface and **never** runtime authority over world state.

**Architectural lens:** the target engine already has the right core principle:  
> **GM proposes, deterministic system commits.**  
The question is how current systems structure that loop, where they fail, and how they evaluate whether the narrative agent is actually helping.

---

## 1. Executive conclusion

The frontier is increasingly converging on a point that strongly supports the target architecture:

> **LLMs are most useful as expressive renderers, interpreters, and local improvisers inside a more structured narrative/control substrate.**  
> **They are weakest when asked to directly own world state, causal progression, or long-session consistency in free prose.**

Across recent interactive-narrative systems, the strongest recurring patterns are:
- **storylet / schema / outline / planner / simulation structure first**
- **LLM realization second**
- **authorial or system-level control over possibility space**
- **explicit simulation / validation when generated events must be executable**
- **preview/simulation tools to expose where the model drifts outside intended narrative space**

Across recent analyses of LLM-driven game-mastering, the dominant failure modes are:
- state amnesia,
- narrative incoherence,
- lack of pushback / “yes to everything,”
- pacing drift,
- scene collapse into locally plausible but globally weak prose,
- weak interpersonal and fairness management,
- free-prose assertions of world state instead of reading/writing validated state.

This is not a story about “LLM GMs are impossible.” It is a story about **where the boundary must be drawn**.

---

## 2. The most directly transferable current work

## 2.1 Dramamancer / Drama Llama: structured possibility space + LLM responsiveness

### Citation
Sun, Wang, Chung, Roemmele, Kim, and Kreminski. **Drama Llama: An LLM-Powered Storylets Framework for Authorable Responsiveness in Interactive Narrative.** 2025. arXiv / likely journal submission.  
Link: https://arxiv.org/html/2501.09099v1

Wang, Sun, Wang, Roemmele, Chung, and Kreminski. **Design Techniques for LLM-Powered Interactive Storytelling: A Case Study of the Dramamancer System.** 2026. arXiv / extended abstract.  
Link: https://arxiv.org/abs/2601.18785

### Mechanism
Drama Llama combines **storylets** with LLM generation: authors define reusable narrative units and natural-language triggers, while the LLM helps elaborate content responsively. Dramamancer uses author-created **story schemas** and transforms them into interactive playthroughs driven by player input.

### What the papers explicitly say
Drama Llama states that purely LLM-based interactive storytelling tends to suffer from:
- **narrative structurelessness**, where events do not drive toward progression, and
- **lack of pushback**, where the system goes along with whatever the player suggests, even if it violates the author’s intent.  
The paper positions storylets as the structural counterweight to that drift.

The Dramamancer design paper explicitly asks what the **author, player, and LLM** should each contribute to the emerging story, which is exactly the right systems question for a deterministic-core DM.

### Transferable lesson
Do not ask the LLM to “be the GM” in the unrestricted sense. Ask it to:
- elaborate,
- bridge,
- phrase,
- and help select among structured narrative affordances.

Storylets/schemas are valuable because they preserve:
- narrative push,
- authored possibility boundaries,
- and recoverable causal structure.

### Engine implication
For a deterministic TTRPG engine, this strongly supports:
- **structured scene/beat/storylet affordances owned by the engine**
- the LLM as **voice + local elaborator**
- a rule that **player free input maps into engine-recognized fictional moves / intents**, not directly into world-state prose

This is close to “do what a real DM would do” because real DMs do improvise — but they improvise against scene structure, prep, pacing, genre, and consequence.

---

## 2.2 WhatELSE: narrative space shaping + executable plot generation

### Citation
Lu, Zhou, and Wang. **WhatELSE: Shaping Narrative Spaces at Configurable Level of Abstraction for AI-bridged Interactive Storytelling.** CHI 2025.  
Link: https://arxiv.org/html/2502.18641v1  
DOI shown in source: 10.1145/3706598.3713363

### Mechanism
WhatELSE is an authoring system for AI-bridged interactive narrative. Authors provide **example narratives** (“pivots”), the system abstracts them into an **outline / narrative space**, then uses an LLM plus **narrative planning** to unfold that space into executable game events. It provides multiple views of the narrative possibility space and simulates variants so authors can perceive/control it.

### What the paper explicitly says
The paper identifies two core problems:
1. authors cannot easily perceive or control the narrative space when they only write high-level prompts;
2. LLMs are **not trained to simulate causal dynamics** of a game mechanism and struggle with **long-term consistency**.

Its solution is to:
- use abstraction layers (pivot / outline / variants),
- use external simulation,
- and use narrative planning plus iterative validation/revision so generated plots remain executable in the external game environment.

### Transferable lesson
This is one of the strongest current supports for the target architecture:
- **LLMs should not own causal progression or executability**
- generated narrative events should be checked against an external stateful system
- author/system tools should expose the **possibility space**, not merely the current prose

### Engine implication
For a deterministic DM engine:
- keep **fictional possibility space** explicit,
- validate proposed scene/event continuations against deterministic world rules,
- and consider author/dev tools that visualize “what paths are open from here?” rather than only current narration.

The most transferable direct lesson is:
> **Use an external validator/simulator whenever generated narrative must correspond to executable world changes.**

---

## 2.3 Elsewise: previewing the player-experienced possibility space

### Citation
Wang, Chung, Roemmele, Sun, Wang, Almeda, Halperin, Lu, and Kreminski. **Elsewise: Authoring AI-Based Interactive Narrative with Possibility Space Visualization.** 2026. arXiv.  
Link: https://arxiv.org/abs/2601.15295

### Mechanism
Elsewise is an authoring tool for AI-based interactive narrative that visualizes **bundled storylines** so authors can inspect similarities and differences between possible playthroughs. It helps authors understand the gap between the designer’s intended space and the audience/player’s actual experienced possibilities.

### What the paper says
It emphasizes that generative systems widen the gap between:
- **author-envisioned** stories
- and **player-experienced** stories

The tool exists to reduce that gap through visualization and exploration of possibility space.

### Transferable lesson
A deterministic engine with an LLM voice layer still needs **developer visibility** into the space of likely narrative outcomes. Otherwise drift will not be apparent until after release or until a long session has already gone off the rails.

### Engine implication
A future author/debug tool should probably:
- simulate multiple interaction traces from a given scene/world state,
- inspect where the LLM voice layer leads the fiction rhetorically,
- detect where player-experienced narrative diverges from engine-supported consequence structure.

---

## 2.4 Orchestrated Reality: explicit statement of the free-prose state problem

### Citation
**Orchestrated Reality: From Role-Play to Living, Playable Game Worlds.** 2026. arXiv.  
Link: https://arxiv.org/html/2606.16014v1

### Mechanism
A position/architecture paper arguing for GM-like orchestration agents that move beyond speaking-character simulation to **world-state and narrative orchestration**.

### What the paper explicitly says
It identifies a crucial architectural failure:
- in most systems, the narrative voice asserts world state in **free prose** rather than reading/writing a **persistent, validated representation**.

It names recurring failures such as:
- **statelessness**,
- session memory collapse,
- world ceasing to exist when the context window ends.

### Transferable lesson
This paper is practically an argument for your architecture.

### Engine implication
Use it as an explicit citation for:
- **LLM should read validated state and propose narration**
- **LLM should not define state by saying it**
- **persistent world continuity requires explicit representation outside the model**

---

## 2.5 Co-Creativity at the Table: where LLM “DMs” help and where they fail

### Citation
**Co-Creativity at the Table: A Qualitative Analysis of Creative Interactions in the Podcast “Adventure AI.”** 2026. arXiv.  
Link: https://arxiv.org/html/2606.18010v1

### Mechanism
Qualitative analysis of a real play/podcast setting using AI in a TTRPG-like role.

### What the paper explicitly says
The paper’s summary is unusually direct:
- the LLM **did not manage the cohesion of the adventure**
- it **did not manage the interpersonal dynamics of the players**
- it **did excel at idea generation and descriptive text**

It also contextualizes DM work as including:
- storytelling,
- NPC performance,
- rules refereeing,
- session preparation,
- narrative cohesion,
- genre/thematic sense,
- fairness,
- diegetic vs extra-diegetic management,
- interpersonal table issues.

### Transferable lesson
Current LLM GM behavior is strongest at:
- descriptive phrasing,
- idea generation,
- local elaboration

It is weakest at:
- long-horizon cohesion,
- fairness management,
- multi-player social management,
- maintaining table contract and pacing.

### Engine implication
Your architecture should **not** ask the model to own:
- fairness,
- canon consistency,
- or table-procedural authority.

It can own:
- sensory description,
- NPC surface voice,
- local scene framing,
- and maybe candidate clarifications.

---

## 3. Older lineage that still transfers cleanly

## 3.1 Façade: drama manager + believable agents + shallow language

### Citation
Mateas and Stern. **Integrating Plot, Character and Natural Language Processing in the Interactive Drama Façade.** 2003.  
Link: https://users.soe.ucsc.edu/~michaelm/publications/mateas-tidse2003.pdf

Mateas and Stern. **Structuring Content in the Façade Interactive Drama Architecture.** 2005.  
Link: https://cdn.aaai.org/ojs/18722/18722-52-22361-1-10-20210928.pdf

### Mechanism
Façade integrates:
- story-level **drama management**
- believable agents
- shallow NLU
- beat-level authoring structures

### Transferable lesson
This is still one of the clearest answers to “how do I get both responsiveness and narrative shape?”
- keep a **higher-level drama manager / beat manager**
- let lower-level agents or the narrator respond locally
- keep a level that explicitly sequences dramatic progression

### Engine implication
Maintain something like:
- **scene/beat/tension manager** at the deterministic level,
- while the LLM realizes local dramatic expression.

---

## 3.2 Versu / social practices lineage

### Citation
Evans and Short. **Versu—A Simulationist Storytelling System.** 2014.

### Mechanism
Social practices as recurring structured situations providing contextual affordances without puppeting agents directly.

### Transferable lesson
This matters for a DM architecture because real GMing is heavily scene-protocol-dependent:
- tavern negotiation,
- interrogation,
- ritual,
- rank scene,
- romance scene,
- public accusation

### Engine implication
An LLM-voice DM should narrate **through** scene protocols and social practices already tracked by the core.

---

## 4. Current failure modes of LLM GMs / narrative agents

## 4.1 State amnesia / statelessness
### Evidence
Orchestrated Reality explicitly names statelessness as a recurring failure when world state exists only in free prose. WhatELSE also states that LLMs are known to struggle with long-term consistency and with generating plots executable in an external game mechanism.

### Transferable lesson
Prompt memory is not state.

### Engine implication
Persistent canon, unresolved obligations, NPC beliefs, scene protocol, and world facts must live outside the model.

## 4.2 Lack of pushback / “yes to everything”
### Evidence
Drama Llama explicitly says LLM systems struggle with **lack of pushback**, tending to go along with whatever the player suggests.

### Engine implication
The deterministic core should own:
- legality,
- plausibility,
- opposition,
- contested outcomes,
- and clarify/refuse/escalate branches.

## 4.3 Narrative structurelessness / pacing collapse
### Evidence
Drama Llama identifies **narrative structurelessness** as a core LLM failure. Co-Creativity at the Table reports poor cohesion. Façade’s entire architecture exists because purely reactive local generation does not produce satisfying dramatic shape.

### Engine implication
Keep a deterministic **tension/beat/scene progression** layer separate from LLM narration.

## 4.4 Free-prose over-commitment
### Evidence
Orchestrated Reality highlights the problem of narrative voice asserting world state in prose rather than interacting with validated state. WhatELSE adds that LLM-generated plots need external validation for causal soundness.

### Engine implication
Use a **GM proposes, system commits** boundary:
1. player input interpreted into intent candidates
2. core resolves mechanics/canon
3. LLM realizes only the committed outcome and allowable uncertainty

## 4.5 Weak fairness / interpersonal table management
### Evidence
Co-Creativity at the Table says the LLM did not manage interpersonal dynamics.

### Engine implication
If the system ever needs multiplayer support, table-management logic cannot be delegated to the narrator.

---

## 5. Control-loop patterns transferable to a deterministic-core DM

Recent work does not converge on a single loop, but the most useful recurring pattern is:

1. **Author / engine defines structured narrative space**  
   Seen in Drama Llama storylets, Dramamancer story schemas, WhatELSE outlines, Façade beats.

2. **External state/planning/validation constrains what can happen**  
   Seen in WhatELSE narrative planning + executable game event validation and the Orchestrated Reality critique.

3. **LLM expands locally**  
   Seen in descriptive scene realization, dialogue, and local responsiveness.

4. **Preview/simulate multiple possible traces**  
   Seen in Elsewise and WhatELSE.

### Engine implication
A useful DM loop is:
1. ingest player utterance/action
2. interpret candidate fictional intents
3. resolve mechanically and canonically in the core
4. consult scene/beat/tension state
5. choose legal narrative affordances / next dramatic pressures
6. ask LLM to realize the result in GM voice
7. log state and continue

---

## 6. Evaluation: how current work judges narrative agents

### 6.1 Author studies and control/perception studies
WhatELSE and Elsewise both emphasize author-facing evaluation:
- can authors perceive the possibility space?
- can they control it?
- can they anticipate player-experienced narratives?

### Engine implication
Add dev evaluation around:
- possibility-space visibility,
- author confidence in scene boundaries,
- divergence between intended and observed play traces.

### 6.2 Player experience: agency + coherence + engagement
Current systems evaluate:
- coherence,
- responsiveness/agency,
- engagement,
- believable interaction,
- meaningful consequence,
- dramatic progression.

### Engine implication
Your eval harness should include:
- player-agency perception,
- coherence over long horizons,
- whether player actions change the fiction in legible ways,
- whether dramatic escalation feels earned,
- whether the DM over-acquiesces.

### 6.3 Surprise vs control
Elsewise and WhatELSE both care about balancing:
- authorial control
- player interactivity
- emergence

### Engine implication
Evaluate whether the system produces **bounded surprise**: enough novelty to feel alive, not enough to exit the engine’s fiction.

---

## 7. GM-theory-adjacent lessons

There is not yet a strong body of recent CS papers explicitly formalizing PbtA principles like “be a fan of the characters” or improv “yes-and.” But several current systems implicitly support related ideas.

### 7.1 “Play to find out” rhymes with bounded possibility-space systems
WhatELSE and Elsewise both treat narrative as a **space of possibilities** shaped by author/system intent and player traversal.

### Engine implication
The deterministic engine owns the space and consequences; the LLM voice preserves the feeling of live discovery.

### 7.2 “Yes-and” must become “yes, no, or clarify — fiction first”
Recent failure analyses show that naive “yes-and” becomes over-acquiescence.

### Engine implication
Choose among:
- yes
- no
- yes but
- no but
- clarify
- oppose / contest / escalate

### 7.3 GM moves map well to deterministic affordance sets
“GM moves” can be operationalized as:
- reveal information,
- put someone in a spot,
- show consequences,
- escalate threat,
- offer a hard choice,
- separate parties,
- advance a clock,
- ask for clarification,
- reflect NPC reaction,
- change scene pressure

### Engine implication
Encode GM moves as deterministic narrative affordances selected by the core, with the LLM only voicing them.

---

## 8. Strongest design rules extracted from the frontier

1. **World state must be explicit and validated.**
2. **Narrative space should be structured.**
3. **LLM should elaborate within boundaries, not define boundaries.**
4. **Pushback must be owned by the system.**
5. **Long-session coherence needs a manager, not just memory.**
6. **Evaluate at the level of player agency + coherence + dramatic progression.**

---

## 9. Dense finding table

| Finding | Citation | Mechanism | Transferable lesson | Engine implication |
|---|---|---|---|---|
| Drama Llama | Sun et al., 2025 | storylets + LLM natural-language triggers and elaboration | combine responsiveness with authored structure | use storylet/scene affordances from core, LLM voices them |
| Dramamancer | Wang et al., 2026 | author story schema realized via LLM playthrough | separate author/player/LLM responsibilities | core owns schema; LLM realizes play moment |
| WhatELSE | Lu et al., CHI 2025 | pivot/outline/variant narrative space + planning + validation | AI needs external causal validation and visible possibility space | validate proposed narrative events against executable world state |
| Elsewise | Wang et al., 2026 | bundled storyline / possibility-space visualization | preview and inspect likely playthrough drift | build author/debug tools around likely traces |
| Co-Creativity at the Table | 2026 | qualitative analysis of AI TTRPG play | LLM best at ideas/description, weak at cohesion/interpersonal management | keep fairness/cohesion/procedure outside narrator |
| Orchestrated Reality | 2026 | critique of free-prose world-state ownership | world state in prose causes statelessness and canon drift | LLM must read/write through validated state boundary |
| Façade | Mateas & Stern, 2003/2005 | drama manager + believable agents + shallow language | dramatic shape requires higher-level management | keep beat/tension manager in deterministic core |

---

## 10. Recommended immediate use in a deterministic-core DM project

### 10.1 Treat the LLM as three things
- **interpreter** of player language into candidate fictional intent
- **realizer** of committed outcomes in GM voice
- **local improviser** inside engine-approved affordances

### 10.2 Do not treat it as these things
- world-state owner
- mechanics arbiter
- fairness manager
- long-horizon pacing authority
- sole source of opposition/pushback

### 10.3 Add or strengthen these deterministic layers
- scene/beat/tension manager
- possibility-space / affordance tracker
- legality/fiction plausibility check
- persistent canon store
- unresolved obligations and clocks
- pushback/clarification/opposition policy

### 10.4 Evaluate the system on
- coherence across long play traces
- player sense of agency
- whether consequences reflect intent in fiction
- whether the DM pushes back when it should
- whether pacing escalates/relieves at the right times
- whether narration ever over-commits beyond core state

---

## 11. References

1. Sun, Yuqian, Phoebe J. Wang, John Joon Young Chung, Melissa Roemmele, Taewook Kim, and Max Kreminski. **Drama Llama: An LLM-Powered Storylets Framework for Authorable Responsiveness in Interactive Narrative.** 2025.  
   Link: https://arxiv.org/html/2501.09099v1

2. Wang, Tiffany, Yuqian Sun, Yi Wang, Melissa Roemmele, John Joon Young Chung, and Max Kreminski. **Design Techniques for LLM-Powered Interactive Storytelling: A Case Study of the Dramamancer System.** 2026.  
   Link: https://arxiv.org/abs/2601.18785

3. Lu, Zhuoran, Qian Zhou, and Yi Wang. **WhatELSE: Shaping Narrative Spaces at Configurable Level of Abstraction for AI-bridged Interactive Storytelling.** CHI 2025.  
   Link: https://arxiv.org/html/2502.18641v1

4. Wang, Yi, John Joon Young Chung, Melissa Roemmele, Yuqian Sun, Tiffany Wang, Shm Garanganao Almeda, Brett A. Halperin, Yuwen Lu, and Max Kreminski. **Elsewise: Authoring AI-Based Interactive Narrative with Possibility Space Visualization.** 2026.  
   Link: https://arxiv.org/abs/2601.15295

5. **Co-Creativity at the Table: A Qualitative Analysis of Creative Interactions in the Podcast “Adventure AI.”** 2026.  
   Link: https://arxiv.org/html/2606.18010v1

6. **Orchestrated Reality: From Role-Play to Living, Playable Game Worlds.** 2026.  
   Link: https://arxiv.org/html/2606.16014v1

7. Mateas, Michael, and Andrew Stern. **Integrating Plot, Character and Natural Language Processing in the Interactive Drama Façade.** 2003.  
   Link: https://users.soe.ucsc.edu/~michaelm/publications/mateas-tidse2003.pdf

8. Mateas, Michael, and Andrew Stern. **Structuring Content in the Façade Interactive Drama Architecture.** 2005.  
   Link: https://cdn.aaai.org/ojs/18722/18722-52-22361-1-10-20210928.pdf

9. Gallotta, Roberto, Antonios Liapis, Julian Togelius, and Georgios N. Yannakakis. **Large Language Models and Games: A Survey and Roadmap.** 2024.  
   Link: https://arxiv.org/html/2402.18659v5

10. Sezen, Digdem, and Tonguc Sezen. **Emerging Practices in LLM-integrated Game Writing.** 2025.  
    Link: https://research.uca.ac.uk/6948/1/Emerging_Practices_in_LLM-integrated_Game_Writing%20Sezen-Sezen.pdf

---

## 12. Working summary

The frontier does not say “let the LLM be the Dungeon Master.”

It says:

- structure the narrative space,
- keep state and causality outside the model,
- use planning/validation where events must be executable,
- let the LLM provide vivid responsiveness and local improvisation,
- and evaluate on agency, coherence, and dramatic progression rather than on prose quality alone.

For a deterministic-core TTRPG engine, that is not a compromise. It is the most defensible current architecture.
