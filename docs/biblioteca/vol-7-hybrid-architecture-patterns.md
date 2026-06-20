# Vol 7 — Hybrid Architecture Patterns

**Biblioteca / Immortal reference volume.**  
**Purpose:** describe the strongest architecture patterns for combining natural-language interpretation, explicit state, policy selection, planning, and downstream generation in interactive systems; identify which responsibilities should remain deterministic and inspectable, and where LLMs help most without becoming runtime authority.

---

## 1. Thesis

The strongest pattern across classic dialogue systems, interactive drama, social simulation, and current LLM-mediated NPC systems is not “let the model handle everything.”

It is:

> **parse richly, constrain hard, update explicit state, choose legal action, generate phrasing last.**

This hybrid pattern shows up in different forms across:
- classical dialogue managers
- Façade’s shallow NLU + drama management + believable agents
- Talk of the Town’s obligations/goals/topics pipeline
- Versu’s social-practice affordance architecture
- modern voice/NPC systems that map free speech back to structured options
- commercial runtimes exposing goals, relation, emotion, memory, and conversation state

The practical lesson is that language should usually enter the system as an interpreted candidate control signal, not as direct authority over canon.

---

## 2. Why this matters for Immortal

Immortal already has the correct bias:
- deterministic core
- inspectable state
- narration downstream
- LLM polish last

Vol 7 formalizes that instinct into an explicit architecture vocabulary so future packets do not drift toward soft, hidden, or irreplayable behavior.

It addresses questions such as:
- Which decisions should be made by parser/classifier logic vs policy rules vs generator?
- When should the system clarify rather than commit?
- How should confidence, ambiguity, and abstention work?
- How should memory and retrieval feed interpretation without silently redefining canon?
- How do you keep free-form language while preserving replay safety and determinism?
- Which logs are needed so social failures are debuggable?

---

## 3. Precedent and architectural lineage

### 3.1 Classical dialogue management

Traditional dialogue systems distinguish:
- natural language understanding
- dialogue state tracking
- dialogue policy
- natural language generation

Even where the details differ, this decomposition remains valuable because it separates:
- interpretation
- state update
- action choice
- phrasing

### 3.2 Façade

Façade remains a strong precedent because it integrated:
- shallow natural language understanding
- discourse-act interpretation
- believable agents
- drama management
- behavior authoring
- real-time performance

Its lesson is not that shallow NLU solves dialogue. Its lesson is that strong experience can emerge when broad free-form input is routed into structured internal control layers.

### 3.3 Talk of the Town

Talk of the Town is valuable because its dialogue manager explicitly frames turns around:
- dialogue moves
- obligations
- conversational goals
- topics of conversation

This is a crisp example of intermediate representation doing the real work:
- language is interpreted into conversationally meaningful structures
- those structures drive turn behavior
- generation then realizes the chosen move

### 3.4 Versu

Versu’s social-practice design offers a complementary lesson:
- scene protocol provides contextual affordances
- characters remain autonomous
- local decisions are made inside a constrained, socially legible frame

This suggests a hybrid architecture where:
- scene protocol shapes legal action space
- agent state shapes preferences
- parser proposes structured interpretations
- final action is policy-driven

### 3.5 Modern hybrid voice/NPC systems

Recent voice-controlled NPC work increasingly uses a middle-ground design:
- allow free-form player speech
- interpret it through an LLM or classifier layer
- map it to bounded dialogue options or action schemas
- preserve narrative coherence and consistency

That is especially relevant for Immortal because it validates the design principle that expressive input need not imply unbounded canonical authority.

### 3.6 Commercial NPC/runtime patterns

Commercial runtimes such as Inworld expose structured runtime concepts like:
- intent
- goals
- relationship variables
- emotion
- memory
- conversation state

Even if internals vary, the product surface confirms the same market convergence:
- raw text alone is not enough
- characters need explicit latent state
- orchestration matters

---

## 4. The core 5-stage pattern

### Stage 1 — Interpret richly
Convert raw utterance / action description into a typed candidate packet.

Typical fields:
- proposition
- force
- stance
- target
- presuppositions
- implicatures
- scene protocol context
- deception possibilities
- confidence
- ambiguity set

### Stage 2 — Update explicit state narrowly
Update only the inspectable records that the interpretation justifies:
- discourse obligations
- public claims
- scene-local flags
- relation deltas
- memory/event log
- unresolved ambiguities

Do not let prose or broad model intuition silently mutate hidden canonical state.

### Stage 3 — Choose legal action
Given:
- world state
- discourse state
- scene protocol
- relation state
- policy rules
- confidence thresholds

select a legal next action:
- answer
- refuse
- challenge
- clarify
- sanction
- comply
- deflect
- escalate
- de-escalate
- end scene

### Stage 4 — Generate phrasing last
Once the action is chosen, generation realizes it in style.

### Stage 5 — Log everything needed for replay/debugging
Store:
- input
- parsed packet
- confidence
- chosen interpretation
- state deltas
- chosen policy action
- realized narration

This stage is what makes the system inspectable rather than mystical.

---

## 5. Responsibilities by layer

### 5.1 Interpreter / grace layer
Responsible for:
- candidate speech-act hypotheses
- ambiguity detection
- extracting structured content from raw language
- classifying scene-relevant features
- surfacing low-confidence cases

Should not:
- finalize world truth
- directly apply large hidden state changes
- override legality/policy

### 5.2 State layer
Responsible for:
- canonical world facts
- discourse obligations
- public claim ledger
- relation state
- scene protocol
- event log
- memory entries

Should be:
- typed
- inspectable
- replayable
- serializable

### 5.3 Policy layer
Responsible for:
- legal action selection
- sanction rules
- clarification policy
- fallback behavior
- threshold rules
- escalation/de-escalation

Should not:
- free-associate in prose
- bury decisions in generation

### 5.4 Generator layer
Responsible for:
- realization
- style
- tone
- rhetorical surface
- paraphrase and pacing
- non-canonical expressive detail

Should not:
- define canon
- invent state deltas
- silently resolve ambiguity that policy left open

---

## 6. Confidence and abstention

### 6.1 Why confidence matters
Interpretation is often ambiguous:
- indirect request vs literal question
- threat vs warning
- joke vs insult
- ritual formula vs improvised language
- denial vs evasion
- lawful command vs social pressure

If the system commits too early, it corrupts canon.
If it refuses to commit at all, it becomes inert.

The answer is confidence-aware routing.

### 6.2 Practical routing bands

```text
high_confidence        -> commit narrow packet and continue
medium_confidence      -> commit partial packet or seek light clarification
low_confidence         -> clarify, defer, or choose conservative fallback
contradictory_signals  -> explicitly surface ambiguity
unsafe_to_commit       -> no canon update without clarification
```

### 6.3 Clarification should be a legal action
Clarification is not parser failure. It is a real game move.

---

## 7. Fallback and conservative commit rules

A good hybrid architecture should have explicit “minimum safe commit” logic.

Examples:
- record that a threat-like line was uttered without deciding full intent
- record the public claim but not its truth
- register that an accusation was made while leaving the imported presupposition contested
- update an obligation to respond without deciding the final relation delta yet

This supports the broader rule:

> **Interpret richly, commit narrowly.**

---

## 8. Structured action spaces

Free-form input can still land in a bounded action space.

Examples:
- player speech maps to dialogue move classes
- negotiation language maps to offer/counter/reject/sweeten/challenge
- interrogation language maps to ask/press/deny/deflect/refuse/confess
- public rank scenes map to command/acknowledge/defy/appeal/request-clarification

Recent voice-NPC work that maps free speech back to predefined dialogue options is an important practical precedent because it preserves player expression while keeping internal control coherent.

Immortal should view action-space snapping not as a downgrade, but as a controllability tool.

---

## 9. Retrieval and memory in the hybrid stack

Memory should support interpretation and generation, but with strong boundaries.

### 9.1 Good uses
- retrieve relevant prior public claims
- retrieve unresolved obligations
- retrieve prior insults, debts, rescues, betrayals
- retrieve scene protocol context
- retrieve known facts relevant to clarification or challenge

### 9.2 Bad uses
- letting retrieval silently redefine truth
- using long-context prose as the only state
- relying on model memory instead of canonical event logs
- allowing retrieved narration to override explicit records

A safe rule:

> retrieval can inform candidate interpretation; canonical records decide what is true.

---

## 10. Planner vs policy vs utility selection

Not every game needs a full planner. But a hybrid architecture should distinguish:
- policy for legal/required responses
- utility for preference among legal options
- planning for multi-step goals

Examples:
- obligation to answer may come from policy
- choice between honest answer, deflection, or threat may come from utility using relation/fear/goals
- multi-step political maneuvering may come from planner or authored long-horizon behavior

This division prevents every interaction from becoming a monolithic opaque “model choice.”

---

## 11. Logging and observability

A pragmatic/social system without logs is almost impossible to debug.

Minimum log packet for each turn:

```text
raw_input
context_window_id
scene_protocol
candidate_interpretations[]
confidence_scores
chosen_interpretation
clarification_reason_if_any
state_deltas
chosen_policy_action
generated_output
```

Useful extras:
- retrieval hits used
- rule ids triggered
- threshold values crossed
- witness/publicity context
- relation deltas before/after
- explanation string for test harnesses

---

## 12. Common anti-patterns

- the omnipotent generator
- the classifier graveyard
- long-context as pseudo-state
- canon by narration
- no abstention path

---

## 13. Suggested Immortal architecture packet

```text
PragmaticPacket =
  proposition
  force
  stance
  target
  directness
  presuppositions[]
  implicatures[]
  scene_mode
  speaker_role
  target_role
  audience_scope
  deception_mode
  public_claim
  confidence
  ambiguity_set[]
  appraisal_tags[]
  provisional_relation_deltas
  legal_actions[]
  clarification_prompts[]
```

Not every field must be filled every turn. The point is to unify what would otherwise become scattered detectors.

---

## 14. Minimal routing pseudocode

```text
candidate_packet = interpret(input, context)

safe_packet = narrow_commit(candidate_packet, confidence_rules, scene_protocol)

state' = apply_safe_updates(state, safe_packet)

legal_actions = compute_legal_actions(state', scene_protocol, obligations, relation_state)

chosen_action = choose_action(legal_actions, goals, utility, policy)

surface_text = realize(chosen_action, state', style_constraints)

log_turn(input, candidate_packet, safe_packet, state_delta, chosen_action, surface_text)
```

This captures the core discipline.

---

## 15. Clarification policy

Good triggers:
- ambiguity across force categories
- scene protocol makes the distinction high consequence
- imported presupposition is contested
- claim would change canon too much if wrong
- deniability is high and witnesses matter
- player phrasing is under-specified between materially different approaches

Clarification examples:
- “Are you asking, ordering, or threatening?”
- “Are you accusing him directly, or implying it?”
- “Is that a refusal, or a request for a better offer?”
- “Are you invoking rank here, or speaking as an equal?”

This is not weakness. It is controlled interpretation.

---

## 16. Evaluation criteria for a hybrid stack

A hybrid architecture is working if:
- paraphrases map to the same packet when they should
- ambiguous lines trigger clarification when consequence differences are large
- public claims do not become world facts automatically
- narration remains consistent with explicit state
- replay yields the same state deltas from the same inputs
- logs make failures understandable
- scene protocol changes legal action sets
- relation state alters policy without requiring prose hacks
- the generator can vary style without changing canon

---

## 17. Recommended implementation priorities

### Phase A
- unified pragmatic packet
- confidence/clarify routing
- public claim ledger
- scene protocol hook
- obligation tracking

### Phase B
- relation/appraisal integration
- deception fields
- better logging/observability
- legal-action computation by scene

### Phase C
- planner/utility integration
- richer memory retrieval discipline
- benchmark harness and scenario corpora
- authoring tools for protocol/rule design

The order matters: control layer first, richness later.

---

## 18. Strong heuristics

1. Never let generation own canon.
2. Treat clarification as a normal action, not an error.
3. Prefer typed packets over many disconnected detectors.
4. Use retrieval to inform, not to decide truth.
5. Keep public claim separate from world fact.
6. Confidence should route behavior.
7. Logs are part of the architecture, not a debugging afterthought.

---

## 19. Relation to the rest of the Biblioteca

- Vol 1 states the broad architecture thesis.
- Vol 2 specifies speech acts, force, obligations, repair.
- Vol 3 adds implicature, presupposition, common ground.
- Vol 4 adds scene protocol and legality.
- Vol 5 adds deception, audience split, and claim/fact separation.
- Vol 6 adds appraisal and relational state.
- Vol 7 tells you how to wire all of that together into a deterministic system with free-form language input.
- Vol 8 should convert this architecture into evaluation and acceptance tests.

---

## 20. Design implications for Immortal

The most important design recommendation is:

> formalize the grace layer as a typed interpreter that proposes packets but does not own policy.

The second is:

> create a narrow-commit gate between interpretation and canonical update.

The third is:

> define legal next actions before generation, and treat narration as realization only.

These three moves preserve the engine’s current strengths while giving it room to grow socially without drift.

---

## 21. References / precedent to mine

- Mateas and Stern. **Integrating Plot, Character and Natural Language in the Interactive Drama Façade.**
- Mateas and Stern. **Natural Language Understanding in Façade: Surface-Text Processing.**
- Ryan et al. **Dialogue Generation in Talk of the Town** and related dialogue-manager papers.
- Evans and Short. **Versu—A Simulationist Storytelling System.**
- Recent voice-controlled NPC work mapping free-form speech back to predefined dialogue options.
- Commercial runtime docs exposing explicit intent, goals, emotion, relationship, and conversation state.

---

## 22. Working summary

The architecture lesson is simple:

> use language models as powerful interpreters and realizers inside a stricter stateful system.

A good hybrid stack:
- interprets richly
- commits narrowly
- updates explicit state
- chooses legal action
- generates phrasing last
- logs everything important

That is the safest route to expressive but deterministic social play.
