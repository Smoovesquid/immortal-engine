
# Vol 11 — Frontier Pragmatics, Common Ground & Social Meaning (2025–2026 addendum to Vols 1–6)

*Renumbered from the author's draft "Vol 9 Addendum" — Vol 9 is already Defect Discovery. Content unchanged; "Vols 1–3" references below also implicate Vols 4–6.*

**Biblioteca / Immortal addendum volume.**  
**Purpose:** capture genuinely recent findings relevant to pragmatic reasoning, common-ground modeling, social meaning, and LLM-facing evaluation/training. This addendum is written for model consumption, not human skimming. It should be read as a frontier update layered on top of Vols 1–3, not as a replacement for them.

---

## 1. Scope of this addendum

This document tracks findings that appear materially newer than the classic lineage already covered in Vols 1–3:
- new benchmarks for pragmatic competence
- new training methods aimed at improving pragmatic inference directly
- new work on common ground and grounding as a systems problem
- new work on social-meaning calibration rather than mere label accuracy

This addendum is not a claim that pragmatics is solved. The actual frontier signal is narrower:

> The strongest new work improves **measurement**, **training supervision**, and **calibration analysis** of pragmatic competence. It does not eliminate the need for deterministic discourse/state machinery.

---

## 2. Executive update for Immortal

If Immortal reads only one paragraph from this addendum, it should be this:

1. The field is finally producing benchmarks and datasets that test **pragmatics explicitly**, rather than treating it as a side effect of generic language ability.
2. Recent work suggests that pragmatic competence is at least partly **trainable** via contrastive or thought-based supervision, not just an accidental consequence of scale.
3. Common-ground / grounding is increasingly being treated as a **first-class dialogue bottleneck**, which strongly supports explicit discourse-state design.
4. New social-meaning work suggests that models may get the **direction** of social inference right while still being poorly calibrated on **magnitude**, which matters for game-state updates.

Engine implication:
- keep the deterministic packet/state architecture from Vols 1–8
- but mine recent work for:
  - benchmark design
  - contrastive training ideas
  - common-ground schema
  - calibration-aware downstream gating

---

## 3. ALTPRAG and the emergence of pragmatic competence

### 3.1 Why this matters

One of the strongest frontier papers is **The Pragmatic Mind of Machines: Tracing the Emergence of Pragmatic Competence in Large Language Models**. Its value is not just a new benchmark name. Its deeper value is the framing:

- pragmatic competence is probed through **alternatives**
- models are tested across **training stages**
- the task requires not only selecting an intended meaning, but explaining **why a speaker would choose one utterance over a plausible alternative**

This is significant because much of pragmatics lives exactly in that gap:
- why this phrasing instead of another?
- why this indirectness instead of direct statement?
- why this scalar term instead of a stronger one?
- why this deniable form instead of an overt threat?

That framing is much closer to the real problem Immortal faces than flat label classification.

### 3.2 Main findings

The paper introduces **ALTPRAG**, a dataset grounded in pragmatic alternatives and evaluates 22 LLMs across three training stages:
- pre-training
- supervised fine-tuning
- preference optimization

The reported finding is that even base models show some sensitivity to pragmatic cues, and this improves with model/data scale, while SFT and RLHF add further gains, particularly in more cognitive-pragmatic scenarios.

The important inference is not “models now understand pragmatics.” It is:

> pragmatic competence appears to be an emergent but also compositional property that can be traced and potentially shaped across training stages.

### 3.3 Why this is useful to Immortal

ALTPRAG suggests several design patterns:
- evaluate utterances against **plausible alternatives**
- represent not just selected interpretation, but **contrastive explanation**
- prefer datasets/scenarios where the central question is *why this move, in this phrasing, here?*

Potential engine consequences:
- future parser training data should include **nearby alternative phrasings**
- clarification policies may be improved by asking which alternative reading best fits the social context
- packet design can explicitly encode “selected among plausible alternatives”

---

## 4. Thought-based training for pragmatic understanding

### 4.1 Why this matters

The paper **Understand the Implication: Learning to Think for Pragmatic Understanding** is one of the clearest recent attempts to improve pragmatics directly rather than just benchmark it.

Its key move is to build a dataset with explicit reasoning for:
- correct interpretations
- incorrect interpretations

and then use supervised fine-tuning and preference tuning over that reasoning signal.

### 4.2 Main findings

The paper reports:
- an **11.12%** accuracy gain across model families from thought-based learning
- **16.10%** transfer improvement on unseen pragmatics tasks such as presupposition and deixis, relative to label-trained models

That is a meaningful result because it suggests pragmatic ability may improve when models are trained to compare and reason about interpretations, not merely map text to labels.

### 4.3 Design consequences for Immortal

This finding supports several practical choices:
- store rationales in benchmark corpora even if runtime does not expose them
- prefer supervision that compares good and bad interpretations, not only final labels
- structure parser training around **why** an interpretation is selected
- use contrastive error examples for clarification and presupposition handling

This also supports a broader architectural point:
- the parser/grace layer can be improved with thought-like supervision
- but the **state commit gate** should remain deterministic

---

## 5. Common ground is moving toward center stage

### 5.1 Survey signal

The survey **Building Common Ground in Dialogue: A Survey** is important not because surveys are glamorous, but because it shows the field converging on grounding/common-ground as a major systems concern.

The survey categorizes **448 papers** and frames common ground as a broad, structured space involving:
- domain-specific knowledge
- personal/shared experiences
- commonsense knowledge
- static and dynamic forms
- unimodal and multimodal forms

That matters because it moves “shared understanding” out of vague conversational intuition and into a concrete systems design problem.

### 5.2 Why this is frontier-relevant

The significance for Immortal is not simply “shared context matters.” That was already known.

The new thing is that common ground is increasingly treated as:
- a distinct subsystem
- a thing that can be benchmarked
- a thing that breaks in recognizably patterned ways
- a thing dialogue systems must explicitly manage if they want stability

This is tightly aligned with:
- discourse ledgers
- witness/publicity tracking
- clarification and repair
- contestable presupposition handling

### 5.3 Practical takeaways

Immortal should read the common-ground frontier as strong validation for:
- explicit discourse/common-ground state
- repair/grounding logs
- nontrivial clarification policy
- separation between private belief, public claim, and mutually accepted ground

It also suggests future evaluation work should include:
- coordination tasks
- reference repair
- mutual-knowledge shifts
- shared-attention failure modes

---

## 6. New benchmark work on common ground and human–AI coordination

A recent 2026 benchmark, **A Benchmark to Assess Common Ground in Human-AI Collaboration**, is worth noting because it moves beyond isolated pragmatics questions into collaborative tasks requiring:
- iterative interaction
- joint action
- referential coordination
- repair
- varying conditions of situation awareness

This is relevant because many RPG interactions are not just about decoding one utterance. They are about maintaining shared understanding while solving something together.

The key lesson for Immortal is:

> common-ground capability should not be evaluated only with single-turn language probes. It should also be evaluated in iterative collaborative settings with repair pressure.

That insight is especially relevant for companion-mode play, clarification turns, and multi-turn scene continuity.

---

## 7. Social meaning: structure versus magnitude

### 7.1 Why this matters

A particularly interesting 2026 frontier paper is **Social Meaning in Large Language Models: Structure, Magnitude, and Pragmatic Prompting**.

Its central question is unusually useful for engine design:
- do models merely get the *qualitative direction* of social meaning right?
- or do they also get the *magnitude* and *relative calibration* right?

This is critical because a game engine often needs more than:
- “this sounds insulting”
It needs:
- how insulting?
- insulting enough to trigger sanction?
- insulting enough to lower trust but increase respect?
- insulting enough to force clarification or duel protocol?

### 7.2 Main thrust

The paper argues that models increasingly approximate human social-meaning structure, but calibration along the magnitude dimension remains a serious issue. It also reports that prompting around speaker knowledge and motives can improve calibration.

### 7.3 Why this matters for Immortal

This supports a crucial design rule:

> Do not allow the model’s uncalibrated magnitude estimates to directly mutate canonical social state.

Instead:
- let the model help identify likely social dimension(s)
- then route deltas through deterministic policy tables or bounded mappings

In practical terms:
- model may say “likely insult + contempt + status challenge”
- engine should decide whether that implies:
  - no relation delta
  - minor resentment increase
  - public sanction risk
  - honor challenge threshold
  - clarification requirement

This is one of the most useful frontier findings in the whole addendum because it directly explains why “LLM understands the vibe” is insufficient for reliable state updates.

---

## 8. What is genuinely new versus merely bigger models

### 8.1 Actually new / useful
- pragmatic evaluation through **contrastive alternatives**
- explicit training on **reasoning about implied meaning**
- common-ground surveys and benchmarks framing grounding as a systems problem
- calibration analysis of **social meaning magnitude**
- collaborative common-ground benchmarks with repair and coordination

### 8.2 Mostly the old problem at larger scale
- more models can answer some implicature questions
- zero-shot social reasoning looks more polished
- free-form dialogue feels more natural
- general “LLMs are socially smarter now” claims without inspectable intermediate structure

The first category should influence engine design.
The second category should influence only expectations about front-end quality.

---

## 9. Design implications for Vols 1–8

This frontier update does not overturn the earlier Biblioteca. It sharpens it.

### 9.1 Strengthened claims
The following earlier design choices are **more supported**, not less:
- explicit pragmatic packet
- common-ground / discourse state
- clarify as legal action
- narration downstream of canonical policy
- public-claim / world-fact separation
- deterministic delta mapping for social state

### 9.2 New extensions worth adding
Potential new packet fields or evaluation hooks:
- `alternative_readings[]`
- `contrastive_rationale`
- `social_magnitude_estimate`
- `magnitude_confidence`
- `common_ground_status`
- `coordination_failure_mode`
- `repair_needed`

### 9.3 New evaluation ideas
Future harnesses should add:
- alternative-choice tests
- rationale-quality checks
- common-ground repair scenarios
- collaborative referential tasks
- social-magnitude calibration suites

---

## 10. Limits of the frontier

The recent work is promising, but it should not be oversold.

The most important limits remain:
- contextual inference is still fragile
- multi-turn grounding is still hard
- calibration is weaker than qualitative classification
- social meaning often depends on scene, role, and witness structure that benchmarks simplify
- strong front-end understanding does not imply safe canonical updates

For Immortal, the correct interpretation is:

> Recent work makes the parser/evaluator frontier more interesting. It does not justify giving up the deterministic middle layer.

---

## 11. Recommended use inside the Biblioteca

Treat this addendum as:
- a **frontier appendix** to Vols 1–3
- a source of benchmark and training ideas
- a source of caution around magnitude calibration
- a strong justification for explicit common-ground modeling

Do **not** treat it as evidence that the old problem is solved.

---

## 12. References

1. Yu, Kefan, et al. **The Pragmatic Mind of Machines: Tracing the Emergence of Pragmatic Competence in Large Language Models.** EACL 2026 / arXiv 2025.  
   ACL Anthology: https://aclanthology.org/2026.eacl-long.9/  
   arXiv: https://arxiv.org/abs/2505.18497

2. Sravanthi, Settaluri Lakshmi, et al. **Understand the Implication: Learning to Think for Pragmatic Understanding.** Findings of ACL 2025.  
   ACL Anthology: https://aclanthology.org/2025.findings-acl.1218/  
   arXiv: https://arxiv.org/abs/2506.13559

3. Anikina, Tatiana, Alina Leippert, and Simon Ostermann. **Building Common Ground in Dialogue: A Survey.** LUHME 2025.  
   ACL Anthology: https://aclanthology.org/2025.luhme-1.2/  
   PDF: https://aclanthology.org/2025.luhme-1.2.pdf

4. Poelitz, Christian, et al. **A Benchmark to Assess Common Ground in Human-AI Collaboration.** 2026.  
   PDF: https://arxiv.org/pdf/2602.21337

5. Mühlenbernd, Roland. **Social Meaning in Large Language Models: Structure, Magnitude, and Pragmatic Prompting.** 2026.  
   HTML: https://arxiv.org/html/2604.02512v1  
   PDF: https://arxiv.org/pdf/2604.02512

---

## 13. Working summary

The frontier message is:

> Recent work is finally getting good at measuring and improving parts of pragmatics explicitly, especially through alternatives, reasoning supervision, common-ground framing, and social-meaning calibration.

For Immortal, this means:
- keep the deterministic packet/state architecture
- improve the parser and evaluation layer with frontier ideas
- never let uncalibrated social magnitude estimates directly define canon
- treat common ground as a real subsystem, not as prompt residue
