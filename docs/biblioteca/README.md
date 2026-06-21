# The Biblioteca

**The research library — how other people have already solved these problems.** Sibling to the
[Idea Garden](../IDEA_GARDEN.md): the Garden holds *our* raw ideas (capture without committing); the
Biblioteca holds *the outside world's* solved knowledge — precedent, prior art, and state-of-the-art to
**mine before reinventing**. When a design question comes up ("how should NPCs react under pressure?",
"how do we model accusations / loaded questions / bargaining?"), the answer often already exists in the
literature. Check here first.

*Claude: gists live in MEMORY.md so associations fire without opening this file. When you're designing a
social / pragmatic / dialogue / NPC / intent feature, consult the relevant volume FIRST and cite it in the
design — don't re-derive from scratch. Cross-link findings to the Idea Garden (especially
[[IG-11]] social physics, which this library is the academic backing for).*

---

## How to use it
- **Before** scoping a social/behavioral rule (a new "social physics" rung — see IDEA_GARDEN IG-11), skim
  the matching volume for the established pattern, the failure modes others hit, and the vocabulary.
- **Cite it** in the packet/verdict so the reasoning is traceable ("per Biblioteca Vol 1 §15, interpret →
  state → policy → narration").
- **Capture without reinventing:** if you find a paper/system that solves something, add it here even if we
  won't build it now — same discipline as the Garden, pointed outward.

---

## Why this matters for Immortal (the punchline of Vol 1)
Vol 1's central architecture is **the one this engine already runs**, which is the strongest possible
endorsement that we're on the right road:

| Vol 1 says | Immortal already does |
|---|---|
| Interpret → update state → choose legal action → **generate phrasing last** (§1, §15) | grace layer → `resolve` (d20 vs DC) → deterministic outcome → **LLM narration polish last** |
| "**Interpret richly, commit narrowly**" (Appendix C) | deliver-or-decline + `narration ≠ canon` |
| Narration must **realize** state, never define it (§19.6) | IMMORTAL_INVARIANTS: narration is not canon; LLM is never runtime authority |
| Convert NL into a **typed, inspectable pragmatic packet** before it touches canon (§22) | the grace layer already does this *informally* — `isInfoSeekingText`, `isConfrontationChallenge`, the meta-query interceptors are ad-hoc speech-act detectors |

So Vol 1 is the precedent backing for **IG-11 "social physics"**: much of "human DM behavior" is rule-bound
and belongs on the deterministic side. The paper names the **next rules** to reach for, several of which we
have only as one-offs:
- **Discourse obligations** (§4, §6.2) — a question/accusation creates an *obligation to respond*; this
  generalizes our continuity guard + ledger questions into a real turn-to-turn coherence engine.
- **Social practices / scene protocols** (Versu, §7.2) — court vs tavern vs combat vs ritual each change the
  *legal move set* and what counts as insult/obedience/blasphemy. Possibly more important than raw sarcasm
  detection. A natural home for scene-mode-dependent grace rules.
- **Presupposition / loaded questions** (§3.4, §4.4) — "have you stopped stealing?" imports a claim; a DM
  should be able to challenge/accept/contest it.
- **Clarification as a first-class, legal outcome** (§19.3, Rec 5) — "are you asking, or threatening?" —
  sibling to our existing `isNullAction`/clarify and IG-10 absurd-decline.
- **Pragmatic packet with typed subfields** (§5) — formalizing the ad-hoc detectors into one inspectable
  object (proposition / force / stance / presupposition / implicature / social-deltas / confidence). The
  architectural target if IG-11 graduates from one-off rules to a layer.

The caution Vol 1 repeats, which matches our invariants exactly: **LLMs are great front-ends/decoders but
weak at hidden-state, adversarial ambiguity, and rule-faithful multi-turn consistency** — so reliability
stays in the deterministic core, the LLM stays downstream. (Road A, not Road B.)

---

## Catalog

### Vol 1 — Pragmatic Logic for Interactive Systems, Games, and NPC Engines  →  [`vol-1-pragmatic-logic.md`](vol-1-pragmatic-logic.md)
*Foundations, precedent, state of the art.* Which conversational phenomena can be modeled as explicit
logic/state transitions, what systems already did it (Façade, **Versu** social practices, Talk of the Town,
believable-agents, generative agents), and what the frontier (PUB benchmark, pragmatics surveys, social-
deduction LLM work) says. Core thesis: **interpret richly, commit narrowly** — convert natural language into
a typed, inspectable pragmatic packet *before* it affects canon. Includes a working taxonomy (speech-act /
force / stance / presupposition / implicature / social-mechanic / policy levels), a 5-stage deterministic
architecture, common failure modes, and a minimal engine checklist. **Most relevant sections for us:** §4
(conversation as logic operations), §7.2 (Versu social practices), §14 (the taxonomy), §15 (the 5-stage
pattern), §19 (design implications for Immortal — written for this engine by name).

### Vol 2 — Speech Acts & Force  →  [`vol-2-speech-acts-force.md`](vol-2-speech-acts-force.md)
*What an utterance is DOING (illocutionary force), what it obligates next, felicity, and clarification.*
Force ≠ sentence form ("can you move?" = request, not ability query). Acts create **obligations** (a
question / accusation / offer stays live until answered, declined, or contested) and acts can FAIL (felicity
— a declaration without authority is bluster, not a demotion). **Immortal hook:** the deterministic heart of
social physics — *speech act → open obligation → narrow canonical update*. Backs H-42 (confrontation =
accusation force → NPC reaction), the deliver-or-decline contract (obligation to respond), and
clarification-as-a-legal-outcome (sibling to `isNullAction` / IG-10). Concrete next rules: the obligation
ladders (§6.4) and the request/order/threat/warning cluster (§13).

### Vol 3 — Implicature, Presupposition & Common Ground  →  [`vol-3-implicature-presupposition-common-ground.md`](vol-3-implicature-presupposition-common-ground.md)
*What a line IMPORTS beyond what it asserts.* The four-way split: asserted / presupposed / implicated /
common-ground-proposal. **Loaded questions** ("have you stopped stealing?") smuggle a claim in sideways — a
DM must be able to challenge the premise, not just answer. **Immortal hook:** the master safety rule — keep
a **discourse ledger distinct from canon** (an NPC's claim is "asserted," not "true"); maps onto `ledger.js`
/ Canon Log + narration≠canon, and is the backbone for `RUMOR_LAYER`. Strongly limit auto-accommodating
hostile presuppositions (the canon-pollution guard).

### Vol 4 — Social Practices & Scene Protocols  →  [`vol-4-social-practices-scene-protocols.md`](vol-4-social-practices-scene-protocols.md)
*A scene is a rule-bearing frame, not scenery — it changes the legal move set, the meaning of silence, the
force of an insult, the cost of refusal.* "Kneel" in court ≠ ritual ≠ tavern ≠ duel. Versu's social-practices
precedent: constrain + suggest, don't puppet. **Immortal hook:** the home for scene-mode-dependent grace
rules — interpret the line *through* the scene protocol; `legal_but_costly` / `taboo` /
`requires_clarification` beats a binary legal/illegal. The `fateBand`→tone knob is a thin proto-version; a
typed `scene_protocol` layer is the growth path.

### Vol 5 — Deception, Bluffing & Audience Split  →  [`vol-5-deception-bluffing-audience-split.md`](vol-5-deception-bluffing-audience-split.md)
*Lies / bluffs / omission / deniable-threats as structured public-vs-private state, not "the NPC is lying"
flavor.* Master rule: **treat claims as claims** — a `PublicClaimLedger` separate from `WorldState` enables
bluffing without canon corruption, witness-sensitive reputation, and evidence-driven exposure later.
Audience-split (one line, different uptake per hearer) + deniability bands. **Immortal hook:** narration≠canon
taken to its conclusion, the deep backing for `RUMOR_LAYER` and `withheldFacts`; bluff resolution deferred
until challenged.

### Vol 6 — Emotional Appraisal & Relational State  →  [`vol-6-emotional-appraisal-relational-state.md`](vol-6-emotional-appraisal-relational-state.md)
*Emotion as inspectable state, not prose mood: event → appraisal tags → transient affect → persistent
relation.* Keep **trust / respect / fear / resentment / loyalty / suspicion separable** (respect can rise
while affection falls) — never one "affinity" meter. Transient affect decays; relations move slowly past
thresholds. **Immortal hook:** generalizes the NPC `disposition` / `emotionalColoring` / `hostile` flag (H-44
read that flag — a proto relation-read) into a real `RelationState` that policy consumes; appraisal bridges
the social events Vol 2–5 detect to durable consequences.

### Vol 7 — Hybrid Architecture Patterns  →  [`vol-7-hybrid-architecture-patterns.md`](vol-7-hybrid-architecture-patterns.md)  ·  *the wiring blueprint*
*How to wire all the above into a deterministic system: interpret richly → commit narrowly → update explicit
state → choose legal action → generate phrasing last → log everything.* Confidence-aware routing (high →
commit; low → clarify); a unified **pragmatic packet** replaces scattered detectors; "formalize the grace
layer as a typed interpreter that PROPOSES packets but does not OWN policy." **Immortal hook:** this is
literally the engine's current architecture (grace → `resolve` → deterministic outcome → LLM narration →
Canon Log) named and generalized — and it's the **IG-11 graduation path**: promote the ad-hoc grace detectors
(`isInfoSeekingText`, `isConfrontationChallenge`, the meta-query interceptors) into one typed packet + a
narrow-commit gate. **Read before any big grace-layer refactor.**

### Vol 8 — Evaluation Harness  →  [`vol-8-evaluation-harness.md`](vol-8-evaluation-harness.md)  ·  *the proof layer*
*How to prove the Vol 2–7 layers are stable, deterministic, and inspectable — so a social rule graduates
from "interesting idea" to engine feature instead of a grab-bag of vibe heuristics.* Five test layers (unit /
golden / property / scenario / replay, §4); the invariant families to assert (canon≠narration, claim≠fact,
interpret-richly-commit-narrowly, clarification legality, §5); **paraphrase invariance as the highest-value
category** (§6 — incl. §6.3 *false* invariance: warning≠threat, request≠order must still **diverge**, so it is
not naive "all rephrasings are equal"); a 9-point **rule-graduation bar** (§15); a Phase A/B/C build order
mirroring Vol 7's maturity path (§16). **Immortal hook:** the unwritten harness our own gate meta-lesson kept
pointing at ("a passing unit test is not a passing gate", post-H-45). It is the **measurement half** of closing
the iterative-fix loop — the regression / paraphrase / replay spec. What it deliberately does **not** contain,
and a planning doc must add on top: the *victory redefinition* (split the bouncing gate % into a frozen-corpus
regression signal + a discovery-rate signal that can asymptote even over infinite input) and the **capability
ledger** enumerating the finite failure-categories. Vol 8 tells you how to test a rule; it does not tell you
when the whole loop is done.

### Vol 9 — Defect Discovery & Coverage Saturation  →  [`vol-9-defect-discovery-coverage-saturation.md`](vol-9-defect-discovery-coverage-saturation.md)  ·  *the stopping rule*
*Makes the convergence DISCOVERY signal quantitative + checks the REGRESSION corpus isn't hollow.*
**Capture-recapture / Chao1** estimates how many capabilities remain UNDISCOVERED from how often gate runs
re-find the same ones (turns "≈1 new → finite" into "~N remain, CI […]"); **mutation testing** (hand-rolled
targeted mutants) proves the locked assertions are protective, not trivially-passing (the rigorous version of
the invariant-#19 hand-check); accumulation curves + a composite done-rule. **Reach for it:** after any gate,
or when asked "is the loop closeable / how close to done / are the assertions strong enough."

### Vol 10 — LLM-as-Judge Reliability  →  [`vol-10-llm-as-judge-reliability.md`](vol-10-llm-as-judge-reliability.md)  ·  *the judge's error bars*
*How much to trust + how to harden the gate, which runs Opus as BOTH player and judge.* Self-preference /
verbosity / variance biases + shared-blind-spot risk; mitigations = **reference-guided + atomic-binary judging
anchored to `canonGroundTruth`** (systematizes the H-45 recal), decouple player/judge model, low-temp +
length-normalize. The reframe: **the judge-free corpus is the PRIMARY signal; the gate-judge is a SECONDARY
noisy discovery pointer, confirmed deterministically** — which is why we already minimize judge exposure.
**Reach for it:** before trusting a gate verdict, or when the % bounces.

### Vol 11 — Frontier Pragmatics, Common Ground & Social Meaning  →  [`vol-11-frontier-pragmatics-common-ground.md`](vol-11-frontier-pragmatics-common-ground.md)  ·  *2025–26 frontier addendum to Vols 1–6*
*Recent (2025–26) papers on pragmatic competence, common ground, and social meaning.* **Headline for us:**
models get the *direction* of social meaning right but are **poorly calibrated on magnitude** (Mühlenbernd
2026) → the citable rule for the IG-11 social layer: **never let an LLM magnitude estimate mutate canonical
social state — route deltas through deterministic tables.** Plus ALTPRAG contrastive-alternatives + thought-
based training (corpus/benchmark ideas) and common-ground-as-first-class-subsystem (validates explicit
discourse state). Candidate packet fields: `social_magnitude_estimate` · `magnitude_confidence` ·
`common_ground_status` · `repair_needed`. **Reach for it:** scoping any social-physics / NPC-reaction /
trust-fear-respect-delta capability.

### Vol 12 — Frontier Fragility, Security & Hybrid Control for LLM NPCs  →  [`vol-12-frontier-fragility-security-hybrid-control.md`](vol-12-frontier-fragility-security-hybrid-control.md)  ·  *2025–26 frontier addendum to Vols 4/5/7/8*
*Recent (2025–26) work on how LLM-NPC systems FAIL.* **Headline for us:** **secret leakage** — hidden lore in
prompt context is adversarially extractable ("Tricking LLM NPCs into Spilling Secrets", 2025) → represent
secrecy as **access-controlled state with a deterministic reveal-authorization gate** (`RevealPolicy` /
`KnowledgeState` schemas, §10), not "info the model happens not to mention." Direct hit on RUMOR_LAYER /
`withheldFacts` / the IG-8 secret → **candidate capability C16 (secret-non-leakage)**. Also: **paraphrase/RAG
fragility** (independent backing for the convergence paraphrase-invariance core + "test secrets under
adversarial paraphrase") and hybrid open-input/bounded-action control (validates Vol 7). **Reach for it:** any
hidden-lore / secret / mystery-gating / RUMOR_LAYER work, or designing leakage/paraphrase tests.

### Vol 13 — Hidden-State / Secret-Leakage Defenses  →  [`vol-13-hidden-state-secret-leakage-defenses.md`](vol-13-hidden-state-secret-leakage-defenses.md)  ·  *defense-side companion to Vol 12; backs C16*
*2024–26 DEFENSE-side work on preventing secret/hidden-state extraction.* **The principle for us:** *never treat
"the model knows it but won't say it" as a security property* — represent secrets as **access-controlled state**
and enforce at the **reveal sink** (the engine decides assert/hint/imply/deny/evade/defer/refuse; the model only
proposes). Tier-1 defenses (access control over secret resources · action-boundary capability checks · reveal-
authorization policies · public/private separation · channel-aware audit) are all **deterministic-gate-able** —
fits the engine's commit invariant exactly. Validates Vol 12's `RevealPolicy`/`KnowledgeState`; AgentLeak warns
leakage hides in non-final channels (scratchpads/logs/memory). **Reach for it:** scoping **C16** / any RUMOR_LAYER
/ `withheldFacts` / hidden-identity / mystery-gating work.

### Vol 14 — LLM-Judge Reliability & Eval-Coverage Saturation  →  [`vol-14-judge-reliability-eval-coverage-saturation.md`](vol-14-judge-reliability-eval-coverage-saturation.md)  ·  *2025–26 frontier addendum to Vols 9 & 10*
*Freshens Vol 10 (judge) + Vol 9 (coverage) with current work.* **Two live hits on our gate:** judges are **not
generator-invariant** (2026) → **Opus-judging-Opus is a cited risk**, favor cross-family/panel; and **CoT can
*harm* judging** (don't "make the judge think harder"). Plus judgment *distributions* > single-point, system-rank
≠ instance-score (JuStRank), **rubric quality has its own failure modes** (RIFT — "test the rubric, not just the
judge"), balanced-accuracy for prevalence. **Coverage:** ProbeLLM (failure-discovery as structured MCTS search,
beats random persona probing), benchmark-**saturation** studies (formalizes "is the corpus still discriminating"),
track failure-MODES not counts. **Reach for it:** before trusting a gate verdict, recalibrating the gate, or
judging whether coverage has saturated.

### Vol 15 — LLM Game-Mastering, Interactive-Narrative Agents & Interactive Drama  →  [`vol-15-llm-gamemaster-interactive-narrative.md`](vol-15-llm-gamemaster-interactive-narrative.md)  ·  *2023–26 frontier; the games / interactive-drama side of Vols 1 & 7*
*Current LLM-GM / interactive-narrative systems — Drama Llama & Dramamancer (storylets + LLM realization),
WhatELSE (executable narrative-space + external validation), Elsewise (possibility-space visualization),
Orchestrated Reality (the free-prose-state critique), Co-Creativity-at-the-Table (qualitative TTRPG findings),
Façade (drama manager).* **Headline: the frontier independently RE-DERIVES our core — "GM proposes, the
deterministic system commits"** — the strongest external endorsement yet of Road A. Its named failure modes are
our active threads: **free-prose state-assertion = C8 / `narration≠canon`** (the 2026-06-21 gate's fabricated-
ledger bug); **yes-to-everything / no pushback = deliver-or-decline / [[IG-10]] / C13** ("yes-and → yes/no/clarify,
fiction first" = THE_DM_TEST); **narrative structurelessness = needs a scene/beat manager = [[IG-7]]**. **New
seeds:** GM-moves-as-deterministic-affordances (→ `conductor`/`instrument`; the GM-move half of [[IG-11]]);
**possibility-space SIMULATION as a dev tool** (the convergence harness + Opus gate are a proto); external-
validator-for-executable-narrative (= C8 + invariants). **Reach for it:** any LLM-GM architecture/boundary
question ("should the LLM own X?"), the C8 narration-validator track, scene/beat/storylet/drama-manager design,
GM-move/affordance design, or possibility-space / long-horizon-eval tooling.

*The arc: Vol 2–6 build the layers, Vol 7 wires them, Vol 8 tests them, Vols 9–10 calibrate the testing; **Vols 11–14 = the 2025–26 frontier layer** — new pragmatics (11), fragility/leakage (12), secret-leakage DEFENSES (13 → C16), current judge+coverage SOTA (14); **Vol 15 = the LLM-GM / interactive-drama frontier** (2023–26) — the games-side endorsement of "GM proposes / system commits", plus GM-moves-as-affordances + possibility-space simulation. The frontier vols are SOTA-dated; re-mine periodically.*
