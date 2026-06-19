
# Pragmatic Logic for Interactive Systems, Games, and NPC Engines
## Volume 1 — Foundations, Precedent, and State of the Art

**Purpose.** This note is a deep reference document for mining structural ideas for **Immortal Engine** and similar deterministic, stateful, voice-native interactive systems. It is written to answer a specific design question:

> Which conversational phenomena can be modeled as explicit logic or state transitions, what systems have already used such ideas, and what does the current frontier suggest about building a robust engine?

This volume focuses on **pragmatics as control logic**: not merely what words literally mean, but what speakers are **doing** with them, what is **implied**, what is **presupposed**, what obligations are created, and how these can become machine-actionable state updates.

---

## Executive Summary

A large portion of conversational behavior can be modeled as **deterministic or semi-deterministic transforms over context**, especially when the engine has explicit access to:

- the literal utterance
- current world state
- discourse state
- speaker goals
- listener model
- social relationship state
- norms and role expectations
- uncertainty/confidence

This does **not** mean “human conversation is fully reducible to neat rules.” It means many operationally useful parts of dialogue can be represented as bounded, inspectable structures. The strongest practical pattern across the literature and shipped systems is:

1. **Interpret utterance into bounded intermediate state**
2. **Update explicit world/social/discourse state**
3. **Choose a legal action or policy**
4. **Generate phrasing last**

That architecture appears repeatedly across:
- classic speech-act and pragmatics theory
- dialogue systems and conversational AI
- interactive drama and social simulation
- game dialogue managers
- modern LLM/NPC stacks

The field has substantial precedent, but no complete general solution. The current state of the art is **hybrid**: LLMs are useful for interpretation and expression, but reliability still comes from **constraints, schemas, planners, memory systems, social state, and rule-based policy layers**.

---

## 1. The Core Claim

A useful engine-oriented formulation is:

```text
meaning = f(literal_content, context, common_ground, speaker_goal, listener_model, world_state, norms)
```

A stronger operational representation is:

```text
utterance_effect =
    proposition
  + illocutionary_force
  + stance
  + presuppositions
  + implicatures
  + discourse_obligations
  + social_updates
  + action_candidates
```

This is more useful than a plain text-in/text-out model because it separates different layers that are often entangled in natural language:

- **Proposition**: what is explicitly asserted or described
- **Illocutionary force**: what act is being performed (request, threat, promise, warning, refusal, invitation, accusation, joke, etc.)
- **Stance**: the speaker’s attitude toward the proposition/addressee
- **Presupposition**: what must already be taken for granted for the utterance to “fit”
- **Implicature**: what is suggested without being explicitly said
- **Discourse obligations**: what the addressee is now expected to answer or address
- **Social updates**: trust shifts, offense, respect, suspicion, intimacy, fear, embarrassment
- **Action candidates**: what responses or world actions become newly available, required, or blocked

For a deterministic engine, the key move is to stop treating an utterance as a single opaque semantic object and instead treat it as a **packet with typed subfields**.

---

## 2. Why Pragmatics Matters for Games

In ordinary software, “literal intent” often suffices:
- book a flight
- cancel an order
- answer a FAQ
- set a timer

In games and social simulations, literal meaning is often the least important part.

A line such as:

> “Can you move?”

may mean:
- an ability query
- a request
- an order
- a warning
- a threat
- a flirtatious tease
- a sarcastic rebuke
- a tactical feint

The literal string is underspecified. The gameplay-relevant meaning depends on:
- roles
- current conflict state
- power difference
- trust
- urgency
- world danger
- prior lines
- known intentions
- whether the addressee is blocking a path
- whether combat or stealth is active

Once you care about negotiation, betrayal, court intrigue, interrogation, coercion, persuasion, taunting, deception, alliance, etiquette, taboo, or emotional injury, pragmatics stops being optional.

---

## 3. Classical Foundations

### 3.1 Austin and Speech Acts

J. L. Austin’s framework matters because it breaks utterances into layers:
- **locutionary act**: the words said
- **illocutionary act**: the act done in saying them
- **perlocutionary act**: the effects produced on the listener

That distinction remains foundational for any engine that wants to separate:
- text surface
- action type
- downstream consequence

A promise, threat, request, apology, warning, and accusation are not just propositions; they are moves in a social game.

**Design relevance:** do not parse only for semantic content. Parse for performed act.

### 3.2 Searle / Speech-Act Taxonomies

Later speech-act theory organized communicative acts into recurring classes such as:
- assertives / constatives
- directives
- commissives
- expressives
- declarations / acknowledgments

This is useful for engine design because it provides a first stable type system for dialogue actions. Even if one does not adopt a philosophical taxonomy wholesale, the engine benefit is obvious: many utterances are better handled as typed events than as untyped text.

### 3.3 Grice and Implicature

Grice’s core contribution is that speakers routinely mean more than they literally say, and listeners infer those meanings using cooperative assumptions and context.

Examples:
- “Some of the guards are asleep.” → often implies not all.
- “It’s cold in here.” → may imply shut the window.
- “Great job.” said after a disaster → may imply the opposite.

**Design relevance:** a pragmatic engine should treat omissions, underinformativeness, contradiction to context, and form/context mismatch as inference triggers.

### 3.4 Presupposition and Common Ground

Presupposition theory and common-ground models matter because utterances can alter more than beliefs: they also assume and negotiate what is treated as already shared.

Example:
- “Have you stopped stealing from the temple?”
  - presupposes prior theft
  - may create pressure even before the answer

This is crucial in persuasion, accusation, interrogation, politics, and social rank play.

**Design relevance:** dialogue moves should be able to:
- introduce claims
- challenge presuppositions
- accept them
- refuse them
- mark them as contested

### 3.5 Force / Content Distinction

A core insight from speech-act work is that **the same propositional content can be wrapped in different forces**:

- “You will leave.”
- “Leave.”
- “Could you leave?”
- “You should probably leave.”
- “Do you want to leave alive?”

Different force, same broad target action. An engine that only extracts proposition misses the gameplay.

---

## 4. Conversation as Logic Operations

Many recurring conversational phenomena can be represented as a small family of operations over state and expectation.

### 4.1 Inversion
Surface says `P`; intended meaning trends toward `not P`.

Used in:
- sarcasm
- mock agreement
- certain rhetorical praise/blame forms

### 4.2 Scaling Distortion
Surface magnitude differs deliberately from expected magnitude.

Used in:
- understatement
- hyperbole
- litotes

### 4.3 Force Shift
Sentence form differs from intended act.

Used in:
- rhetorical questions
- indirect requests
- hints
- veiled threats
- “advice” functioning as a command

### 4.4 Presupposition Loading
An utterance imports background assumptions as if already accepted.

Used in:
- loaded questions
- accusations
- gossip
- legal/political framing
- manipulative interrogation

### 4.5 Omission-Based Inference
Meaning derives from what was left unsaid.

Used in:
- implicature
- strategic omission
- non-answer answers
- selective praise
- evasion

### 4.6 Mapping / Substitution
Meaning is achieved by systematic relation rather than literal identity.

Used in:
- metaphor
- metonymy
- synecdoche
- euphemism
- dysphemism

### 4.7 Audience-Split Interpretation
The same string has different operative meanings for different hearers.

Used in:
- dog whistles
- insider cues
- plausible deniability speech
- coded faction language

### 4.8 Commitment Modulation
Speakers vary explicitness and certainty to manage accountability.

Used in:
- hedging
- vague promises
- passive voice for blame avoidance
- softened refusals
- strategic ambiguity

These are useful not because they are philosophically complete, but because they make dialogue **computable as state change**.

---

## 5. A Practical Engine Representation

A robust game-facing utterance object might look like this:

```yaml
utterance_packet:
  raw_text: "Great job."
  literal_proposition:
    type: evaluation
    valence: positive
    target: addressee_last_action
  speech_act:
    primary: evaluation
    secondary: rebuke
    confidence: 0.79
  stance:
    sarcasm: 0.91
    contempt: 0.74
    playfulness: 0.11
  presuppositions: []
  implicatures:
    - addressee_performed_badly
  discourse_effects:
    creates_obligation:
      - defend_self
      - apologize
      - counterattack
  social_updates:
    trust_delta: -0.08
    respect_delta: -0.05
    tension_delta: +0.22
  policy_flags:
    challengeable: true
    clarify_if_uncertain: true
    safe_to_execute_world_action: false
```

The exact schema is less important than the principle:
- split interpretation into inspectable fields
- separate detection from consequence
- let downstream rules consume the fields

---

## 6. Classic Computational Precedent

### 6.1 Dialogue Systems and Dialogue Acts

Long before LLMs, conversational systems used **dialogue acts** to classify utterances by communicative function. Systems recognized categories such as:
- statement
- yes/no question
- wh-question
- backchannel
- agreement
- disagreement
- apology
- command
- request

This was not sufficient for deep social simulation, but it established a key engineering pattern:
> free-form language becomes a structured latent representation that supports policy and prediction.

Dialogue-act modeling remains one of the cleanest precedents for operationalizing conversational logic.

### 6.2 Discourse Obligations

Dialogue research also introduced the idea that utterances create **obligations**:
- a question creates an obligation to answer
- a greeting creates an obligation to greet back
- a request pressures a response
- a challenge expects defense or retreat

This is extremely relevant for games. Obligations give you:
- turn-to-turn coherence
- a reason why some responses feel “called for”
- a way to model rudeness, evasion, interruption, and dominance

### 6.3 Grounding and Common Ground Management

Dialogue managers often track what has been:
- introduced
- accepted
- misunderstood
- repaired
- grounded as shared

In a deterministic interactive engine, this is not just linguistic hygiene. It affects:
- whether an NPC believes the player understood the quest
- whether a warning was actually received
- whether a lie was successfully planted into shared belief
- whether a refusal counts as explicit defiance

---

## 7. Interactive Drama and Social Simulation Precedent

### 7.1 *Façade* (Mateas & Stern)

*Façade* remains a landmark because it integrated:
- broad, shallow natural-language processing
- believable characters
- drama management
- reactive behavior structures
- authored dramatic beats

The important lesson is not that *Façade* “solved” natural conversation. It did not. The lesson is that natural-language input can drive a live dramatic system when mapped into constrained internal structures.

**Structural takeaway for Immortal:**
- free language is useful
- but only when attached to a dramatic or social policy layer
- authored/control structures remain crucial

### 7.2 *Versu* (Evans & Short)

*Versu* is one of the strongest direct precedents for pragmatics-as-logic in interactive fiction.

Its key concept is the **social practice**:
- a recurring social situation represented computationally
- role-sensitive but not hard-coded to one character
- offering affordances rather than dictating behavior
- combined with autonomous agent selection

A practice is close to a reusable social protocol. Examples in a broader system might include:
- formal introduction
- dinner-party etiquette
- audience with nobility
- interrogation
- flirtation
- bargaining
- duel prelude
- funeral attendance
- accusation before witnesses

This is extremely powerful because it shifts conversation from isolated sentence parsing to:
> “What social game are we in right now, and what moves are legal, expected, risky, or scandalous?”

For Immortal, this may be more important than raw sarcasm detection. A noble court apology and a tavern apology are not the same mechanic.

### 7.3 *Talk of the Town* / Lightweight Videogame Dialogue Manager

The *Talk of the Town* line of work is highly relevant because it operationalizes conversation using:
- dialogue moves
- conversational obligations
- topics
- conversational goals
- knowledge and belief structures

The system is notable for treating dialogue as a stateful process that can:
- create obligations
- advance or shift topics
- satisfy goals
- surface character beliefs in generated lines

This is close to the architecture many game teams now reinvent around LLMs, except here the state machinery is explicit rather than hidden in a prompt.

**Design takeaway:** the minimum viable serious dialogue system is not a generator; it is a manager over:
- obligation
- topic
- goal
- turn allocation
- knowledge/belief

---

## 8. Believable Agents, Emotion, and Social State

### 8.1 The “Believable Agents” tradition

Work on believable agents long predates LLMs and emphasizes:
- personality
- emotion
- social responsiveness
- audience interpretation
- coherence over time

This literature matters because it frames an old but still valid truth:
> A character feels believable not when every sentence is clever, but when action, affect, memory, and relation stay coherent.

### 8.2 Appraisal and Emotion Architectures

Recent work on appraisal-based emotion architectures for game agents is relevant because many “pragmatic” effects depend on emotional appraisal:
- whether sarcasm reads as playful or cruel
- whether an insult triggers shame, anger, or fear
- whether a request feels generous or controlling
- whether a compliment is accepted or distrusted

Emotion should not merely decorate response text. In stronger designs it functions as:
- a state filter on action choice
- a weighting factor on interpretation
- a persistence layer for social consequence

### 8.3 Social-agent architectures

Broader social-agent architectures often integrate:
- beliefs
- desires
- intentions
- norms
- personality
- emotions
- social relationships

This family of work is relevant because game dialogue should not be treated as isolated text classification. It is usually an interface to deeper motivational and social systems.

---

## 9. The LLM Era: What Changed and What Did Not

LLMs changed two things dramatically:

1. **Surface fluency**
2. **Breadth of paraphrase and interpretive flexibility**

They did **not** remove the need for:
- state
- explicit action schemas
- grounded world models
- policy layers
- consistency control
- uncertainty handling
- inspectable memory

That is the key engineering mistake in many “just talk to the NPC” demos.

### What LLMs are genuinely good at
- paraphrase understanding
- soft classification with context
- style and tone rendering
- proposing candidate interpretations
- filling in naturalistic wording
- handling long-tail phrasing that rigid parsers miss

### What LLMs are still weak at
- stable hidden-state tracking across long interactions
- deterministic handling of adversarial ambiguity
- reliable sarcasm/irony interpretation under sparse context
- clean separation of proposition vs force vs stance
- explicit common-ground bookkeeping
- calibrated uncertainty in pragmatic inference
- rule-faithful multi-turn consistency

So the real shift is not “LLMs solved dialogue.” It is:
> LLMs are excellent front-ends and expressive decoders for systems that still need strong internal structure.

---

## 10. Current Commercial Pattern: Runtime Character Systems

Modern character platforms already expose structured dimensions such as:
- emotion
- relationship
- memory
- goals
- conversation state
- actions or skills
- safety rules
- narrative constraints

This is telling. The industry is converging on a practical truth:
> You cannot build compelling interactive characters with text generation alone; you need explicit latent state.

In commercial terms, these systems often market “believability,” but architecturally the interesting part is the shape of the runtime:
- character config
- memory stores
- relation variables
- conversational state
- action hooks
- goal graphs
- moderation layers

These are not unlike what a deterministic RPG engine would want, except a game-first engine usually needs stronger inspectability and repeatability.

---

## 11. Hybrid Voice/NPC Systems

Recent work on voice-controlled NPC interaction often uses a **hybrid** pattern:

- allow the player to speak naturally
- transcribe and interpret the speech
- map it to a bounded set of existing dialogue moves or options
- preserve narrative or quest coherence

This is a major clue for design:
- open natural language can improve player agency
- but unconstrained freeform response spaces can damage consistency
- a bounded action space is often the right compromise

For Immortal, the equivalent may be:
- player speaks freely
- engine maps speech to pragmatic packet + world intent
- rules determine which move is legal
- narration/response generation renders the result

---

## 12. Benchmarks and the Research Frontier in Pragmatics

### 12.1 PUB Benchmark

Recent benchmark work confirms a point that game builders should take seriously:
LLMs are much stronger on semantics than on pragmatics.

The PUB benchmark covers four major pragmatic phenomena:
- implicature
- presupposition
- reference
- deixis

The benchmark shows:
- model performance still trails humans
- performance varies a lot across pragmatic subskills
- improvements in chat/instruction tuning do not uniformly solve the problem

**Meaning for engine design:** if you care about “what the player really meant,” do not assume a frontier model is enough. Add schema, constraints, and confidence handling.

### 12.2 2025 Pragmatics Survey

Recent survey work on pragmatics in the LLM era emphasizes that evaluation remains difficult and fragmented. Pragmatic competence spans many phenomena:
- implicature
- irony
- deixis
- reference
- presupposition
- politeness
- figurative language
- social reasoning

Datasets are heterogeneous, task setups vary, and real-world relevance is uneven. That suggests caution: benchmark gains do not automatically transfer to live NPC interaction.

### 12.3 Thought-based Training for Pragmatic Understanding

A 2025 findings paper reported that explicit reasoning-oriented training improved pragmatic understanding, including notable gains in implicature recovery and transfer to unseen tasks.

The deeper lesson is not “chain of thought solves pragmatics.” It is:
> making intermediate reasoning structure explicit tends to help with hidden-meaning tasks.

For engine design, that argues in favor of **intermediate representation**. Even if the final shipped engine never exposes chain-of-thought-like internals, it should still create explicit internal fields for pragmatic interpretation.

---

## 13. Social Deduction Games as a Testbed

Social deduction games are unusually valuable because they stress:
- bluffing
- accusation
- persuasion
- hidden roles
- trust calibration
- lying under uncertainty
- reading indirect signals
- counterfactual reasoning

Recent LLM work on social deduction and persuasive agents is important because it moves beyond static QA into live inference under deception.

This is highly relevant to any RPG engine that wants:
- interrogation
- factional intrigue
- courtroom scenes
- spycraft
- betrayal
- table talk with consequences

These domains demand more than intent classification. They require:
- hidden-state maintenance
- belief tracking
- suspicion models
- strategic speech analysis
- audience-dependent reasoning

---

## 14. A Working Taxonomy for Engine Use

Below is a practical taxonomy of conversational phenomena that can be turned into machine-usable logic.

### 14.1 Speech-Act Level
What is the speaker trying to do?

- assert
- ask
- request
- order
- advise
- warn
- threaten
- promise
- offer
- refuse
- apologize
- accuse
- praise
- insult
- flirt
- deceive
- joke
- taunt
- challenge
- concede
- negotiate
- stall

### 14.2 Force-Shift Level
How much does the surface form differ from the act?

- literal
- indirect
- highly indirect
- rhetorical
- veiled
- deniable

### 14.3 Stance Level
What attitude colors the act?

- sincere
- sarcastic
- playful
- contemptuous
- fearful
- submissive
- dominant
- flirtatious
- formal
- deferential
- hostile
- resigned

### 14.4 Presupposition Level
What is being smuggled in?

- shared background
- loaded accusation
- status assumption
- role assumption
- prior-event assumption
- norm assumption

### 14.5 Implicature Level
What is being suggested but not said?

- partial disclosure
- intended refusal
- expected action
- criticism by omission
- claim of exclusivity
- invitation
- threat
- doubt

### 14.6 Social-Mechanic Level
What system state should change?

- trust
- respect
- fear
- affection
- embarrassment
- suspicion
- obligation
- leverage
- faction standing
- taboo violation
- emotional arousal
- willingness to cooperate
- willingness to disclose
- willingness to obey

### 14.7 Policy Level
What should the engine do next?

- accept interpretation
- clarify
- refuse action as illegal/incoherent
- escalate conflict
- present counterplay
- challenge presupposition
- update quest/rumor/canon state
- trigger witness reactions
- log uncertainty

---

## 15. Strong Design Pattern for Deterministic Systems

A robust architecture for your use case likely looks like:

### Stage 1 — Raw Input Capture
- text / transcript
- speaker
- addressee(s)
- scene
- prosody cues if available
- timestamp / turn index

### Stage 2 — Bounded Interpretation
Infer:
- probable speech act(s)
- intended target
- stance
- topic
- presuppositions
- implicatures
- requested world action
- confidence
- ambiguity class

### Stage 3 — Rule Evaluation
Given:
- current world state
- current discourse state
- role/status norms
- safety / legality rules
- scene mode (combat, court, tavern, stealth, ritual, negotiation)

Determine:
- legal interpretations
- illegal/impossible interpretations
- whether clarification is mandatory
- obligation updates
- social-state deltas
- world-state deltas
- candidate responses

### Stage 4 — Canonical Event Emission
Emit deterministic events such as:
- `conversation.request`
- `conversation.insult`
- `conversation.sarcastic_rebuke`
- `conversation.loaded_question`
- `conversation.refusal`
- `relationship.trust_changed`
- `faction.respect_changed`
- `npc.challenge_presupposition`
- `scene.clarification_required`

### Stage 5 — Expression / Narration
Only after the engine knows what happened:
- render NPC speech
- narrate body language
- update UI
- store memory
- append canonical log entry

This keeps expression free while keeping mechanics deterministic.

---

## 16. Why “Sarcasm Detection” Is Too Small a Goal

Sarcasm is useful, but it is only one case in a larger family: **surface/intended mismatch**.

If you build only sarcasm handling, you will miss structurally related mechanics:
- rhetorical questions
- backhanded compliments
- mock politeness
- understatements
- veiled threats
- non-answer answers
- strategic vagueness
- false concessions
- coded speech

The better goal is:
> Build a small ontology of pragmatic transforms and a stable event schema for their consequences.

---

## 17. Common Failure Modes

### 17.1 Over-delegating meaning to the LLM
If the model both interprets and decides consequence, you lose inspectability and repeatability.

### 17.2 Treating one utterance as one meaning
Real dialogue often has multiple simultaneous layers:
- proposition
- force
- stance
- social move
- strategic motive

### 17.3 Ignoring uncertainty
Sometimes the right system behavior is not to choose but to:
- ask for clarification
- represent multiple candidate interpretations
- use role/context to narrow options

### 17.4 No discourse memory
Meaning often depends on:
- what was asked two turns ago
- who failed to answer
- what obligation remains open
- what accusation was left uncontested

### 17.5 No audience model
The same line means different things to:
- ally
- stranger
- subordinate
- noble
- lover
- witness
- rival faction member

### 17.6 No norm model
Politeness, insult, impropriety, taboo, and obligation are norm-relative. Without norms, social scenes flatten.

---

## 18. What the State of the Art Really Is

The state of the art is **not** a fully general pragmatic reasoner that robustly understands human-like nuance in arbitrary live interaction.

The state of the art is a bundle of partially overlapping capabilities:
- dialogue-act classification
- pragmatic benchmarks
- social-state runtime systems
- memory-augmented agent architectures
- constrained voice/NPC mapping
- social deduction and persuasion experiments
- emotionally informed response generation

The strongest systems combine:
- explicit state
- retrieval/memory
- scene or role priors
- bounded action spaces
- model-based interpretation
- rule-based consequences
- generated expression

That is the right takeaway for a deterministic game engine.

---

## 19. Design Implications for Immortal Engine

### 19.1 Use “pragmatic packets,” not raw text as canonical state
Do not log only:
- the string
- a summary

Log:
- literal proposition
- force
- stance
- implicated content
- presupposed content
- confidence
- affected entities
- obligation changes
- social deltas

### 19.2 Separate interpretation from consequence
You want to be able to inspect:
- what the parser thought happened
- what the rules allowed
- what the engine actually committed to canon

### 19.3 Make clarification a first-class mechanic
Ambiguity is not always failure. Sometimes the right move is a diegetic clarification:
- “Are you asking politely, or making a threat?”
- “Do you mean surrender your weapon, or simply step back?”
- “Are you accusing me in earnest?”

This can be dramatically rich and mechanically clean.

### 19.4 Social practices may be more important than general NLP
Courtroom, tavern, battlefield, chapel, prison cell, funeral, market stall, guild hall — each scene can change:
- legal move set
- politeness norms
- sanction severity
- witness effects
- what counts as insult, obedience, seduction, blasphemy, treason

### 19.5 Build for hidden-state conflict
A strong engine should distinguish:
- what was said
- what was meant
- what each listener inferred
- what each listener publicly pretended to infer

That is where intrigue mechanics live.

### 19.6 Keep narration downstream of mechanics
Generated language should realize state, not define it.

---

## 20. Suggested Packetization for Further Research Volumes

This volume is broad. A practical reference library could split future volumes into packets such as:

1. **Volume 2 — Speech Acts and Force**
   - formal act taxonomy
   - indirection
   - obligations
   - repair and grounding

2. **Volume 3 — Implicature, Presupposition, and Common Ground**
   - hidden meaning
   - loaded questions
   - topic and shared belief management

3. **Volume 4 — Social Practices and Scene Protocols**
   - court, bargaining, interrogation, romance, religious ritual, rank hierarchy

4. **Volume 5 — Deception, Bluffing, and Audience Split**
   - lies, half-truths, plausible deniability, witness-dependent meaning

5. **Volume 6 — Emotional Appraisal and Relational State**
   - affective appraisal
   - trust/fear/respect mechanics
   - persistence and decay

6. **Volume 7 — Hybrid Architecture Patterns**
   - parser + state machine + planner + generator
   - confidence thresholds
   - clarification triggers
   - event logging

7. **Volume 8 — Evaluation Harness**
   - determinism tests
   - paraphrase invariance
   - hidden-state consistency
   - replay verification

---

## 21. Practical Recommendations

### Recommendation 1
Treat pragmatics as a **bounded intermediate representation**, not as a mysterious emergent property of the narrator model.

### Recommendation 2
Model at least these fields explicitly:
- speech_act
- stance
- implicatures
- presuppositions
- discourse_obligations
- social_deltas
- confidence
- clarification_needed

### Recommendation 3
Introduce **scene practices** or **social protocols** as reusable modules:
- bargaining
- pleading
- accusation
- oath-taking
- seduction
- command hierarchy
- hospitality etiquette
- ritual speech

### Recommendation 4
Use LLMs primarily for:
- candidate interpretation generation
- paraphrase robustness
- surface realization
not for final authority on canon or mechanics.

### Recommendation 5
Make “refusal to resolve ambiguity” a legal outcome.
Sometimes the system should say:
- insufficient grounding
- contradictory cues
- multiple live readings
- social clarification required

### Recommendation 6
Log both **public discourse state** and **private inferred state**.
That supports lies, suspicion, misunderstandings, and dramatic irony.

---

## 22. Concluding Position

There is strong precedent for using conversational logic as leverage in interactive systems. The most relevant lineage does not come from a single “sarcasm engine,” but from a long arc of work on:
- speech acts
- implicature
- common ground
- dialogue acts
- discourse obligations
- interactive drama
- social practices
- believable agents
- memory- and goal-driven NPC architectures

The frontier is now clear enough to justify a serious engine design principle:

> **Natural language should be converted into a typed, inspectable pragmatic state before it is allowed to affect world canon.**

That principle is consistent with both classic theory and modern system-building. It is especially appropriate for a deterministic, stateful RPG engine where correctness, replayability, and drift prevention matter more than dazzling improvisation.

---

## References

### Foundational pragmatics and speech-act theory

1. Green, M. S. “Speech Acts.” *Stanford Encyclopedia of Philosophy*.
   - https://plato.stanford.edu/entries/speech-acts/

2. Davis, W. “Implicature.” *Stanford Encyclopedia of Philosophy*.
   - https://plato.stanford.edu/entries/implicature/

3. Beaver, D. I., & Geurts, B. “Presupposition.” *Stanford Encyclopedia of Philosophy*.
   - https://plato.stanford.edu/entries/presupposition/

4. Recanati, F. “Pragmatics.” *Stanford Encyclopedia of Philosophy*.
   - https://plato.stanford.edu/entries/pragmatics/

5. Geurts, B. “Common Ground in Pragmatics.” *Stanford Encyclopedia of Philosophy*.
   - https://plato.stanford.edu/entries/common-ground-pragmatics/

6. Longworth, G. “John Langshaw Austin.” *Stanford Encyclopedia of Philosophy*.
   - https://plato.stanford.edu/entries/austin-jl/

### Dialogue systems and discourse structure

7. Jurafsky, D., & Martin, J. H. “Dialogue and Conversational Agents.”
   - https://www.cs.columbia.edu/~julia/papers/J%26M19.pdf

8. Stolcke, A. et al. “Dialog Act Modeling for Conversational Speech.”
   - https://www.sri.com/wp-content/uploads/2021/12/dialog_act_modeling_for_conversational_speech.pdf

9. Traum, D. R. “Discourse Obligations in Dialogue Processing.” ACL 1994.
   - https://aclanthology.org/P94-1001.pdf

### Interactive drama, social simulation, and game dialogue

10. Mateas, M., & Stern, A. “An Experiment in Building a Fully-Realized Interactive Drama.”
    - https://users.soe.ucsc.edu/~michaelm/publications/mateas-gdc2003.pdf

11. Mateas, M., & Stern, A. “Structuring Content in the Façade Interactive Drama.”
    - https://cdn.aaai.org/ojs/18722/18722-52-22361-1-10-20210928.pdf

12. Evans, R., & Short, E. “Versu—A Simulationist Storytelling System.”
    - https://cs.uky.edu/~sgware/reading/papers/evans2014versu.pdf

13. Ryan, J. O., & Mateas, M. “A Lightweight Videogame Dialogue Manager.”
    - https://www.researchgate.net/publication/303329650_A_Lightweight_Videogame_Dialogue_Manager

14. Ryan, J. O., Samuel, B., & others. “Characters Who Speak Their Minds: Dialogue Generation in Talk of the Town.”
    - discoverable via: https://www.semanticscholar.org/paper/A-Lightweight-Videogame-Dialogue-Manager-Ryan-Mateas/b0535beef0015c48eb59bb43a2a683905ac03b2e

15. Reilly, W. S. N. *Believable Social and Emotional Agents*.
    - https://csd.cs.cmu.edu/sites/default/files/phd-thesis/CMU-CS-96-138.pdf

16. Dameris, J. et al. “Praxish: A Rational Reconstruction of a Logic-Based DSL for Social Practices.”
    - https://mkremins.github.io/publications/Praxish_AIIDE2023.pdf

### Modern LLM / NPC / agent architectures

17. Park, J. S. et al. “Generative Agents: Interactive Simulacra of Human Behavior.”
    - https://arxiv.org/abs/2304.03442

18. Inworld AI Documentation — Character Runtime Overview.
    - https://docs.inworld.ai/unreal-engine/runtime/character-reference/overview

19. Inworld AI Documentation — Character Template.
    - https://docs.inworld.ai/unreal-engine/runtime/templates/character

20. Inworld AI Documentation — Runtime Character Guide.
    - https://docs.inworld.ai/guides/runtime-character

21. Wevelsiep, M. et al. “A Voice-Controlled Dialogue System for NPC Interaction using Large Language Models.”
    - https://aclanthology.org/2025.iwsds-1.4.pdf

22. Naram, J. V. “Context-Aware and Emotion-Based Game Conversations.”
    - https://www.diva-portal.org/smash/get/diva2%3A2013165/FULLTEXT01.pdf

23. Croissant, M. et al. “An Appraisal-Based Chain-of-Emotion Architecture for Affective Language Model Game Agents.”
    - https://pmc.ncbi.nlm.nih.gov/articles/PMC11086867/
    - arXiv version: https://arxiv.org/pdf/2309.05076

24. Bourgais, M. et al. “BEN: An Architecture for the Behavior of Social Agents.”
    - https://www.jasss.org/23/4/12.html

### Pragmatics benchmarks and recent research

25. Sravanthi, S. L. et al. “PUB: A Pragmatics Understanding Benchmark for Assessing LLMs’ Pragmatics Capabilities.”
    - https://aclanthology.org/2024.findings-acl.719.pdf

26. IBM Research page for PUB.
    - https://research.ibm.com/publications/pub-a-pragmatics-understanding-benchmark-for-assessing-llms-pragmatics-capabilities

27. Ma, B. et al. “Pragmatics in the Era of Large Language Models: A Survey on Datasets, Evaluation, Opportunities and Challenges.”
    - https://aclanthology.org/2025.acl-long.425/

28. Sravanthi, S. L. et al. “Learning to Think for Pragmatic Understanding.”
    - https://aclanthology.org/2025.findings-acl.1218.pdf
    - arXiv version: https://arxiv.org/pdf/2506.13559

29. Anwar, S. et al. “Dual-Task Dialogue Understanding.”
    - https://ceur-ws.org/Vol-3822/short5.pdf

### Social deduction / persuasion / deceptive dialogue

30. Sarkar, B. et al. “Training Language Models for Social Deduction with Multi-Agent Reinforcement Learning.”
    - https://socialdeductionllm.github.io/imgs/SocialDeductionPaper.pdf

31. Zheng, Z. et al. “Learning Persuasive Agents in Social Deduction Games.”
    - https://openreview.net/forum?id=vXWlOKBnpq

32. Bauer, N. “Evaluating Large Language Models in a Complex Hidden Role Game.”
    - https://gipplab.uni-goettingen.de/wp-content/papercite-data/pdf/bauer2025.pdf

33. “Training Compact Language Models for Artificial Emotional Intelligence: From Bluffing to Trust in a Social Deduction Game.”
    - https://www.researchgate.net/publication/395658447_Training_compact_language_models_for_artificial_emotional_intelligence_from_bluffing_to_trust_in_a_social_deduction_game

---

## Appendix A — Minimal Engine Checklist

Use this if you want the shortest possible implementation target.

- [ ] Speech-act classification
- [ ] Stance detection
- [ ] Presupposition extraction
- [ ] Implicature candidates
- [ ] Topic tracking
- [ ] Discourse obligations
- [ ] Scene/social-practice module
- [ ] Trust/respect/fear state updates
- [ ] Clarification trigger logic
- [ ] Canonical event logging
- [ ] Expression generation downstream only
- [ ] Replay determinism tests

## Appendix B — Candidate Canonical Event Types

```text
conversation.assert
conversation.ask
conversation.request
conversation.command
conversation.warn
conversation.threaten
conversation.promise
conversation.offer
conversation.refuse
conversation.apologize
conversation.accuse
conversation.insult
conversation.flirt
conversation.taunt
conversation.challenge
conversation.sarcasm
conversation.loaded_question
conversation.evasion
conversation.clarification_required
relationship.trust_changed
relationship.respect_changed
relationship.fear_changed
discourse.topic_changed
discourse.obligation_created
discourse.obligation_discharged
belief.claim_introduced
belief.presupposition_contested
```

## Appendix C — One-Sentence Design Rule

**Interpret richly, commit narrowly.**
