# Vol 6 — Emotional Appraisal & Relational State

**Biblioteca / Immortal reference volume.**  
**Purpose:** document how emotion and relationship change can be represented as inspectable state rather than left to narration mood; identify which parts belong in deterministic runtime state, which parts should remain soft or derived, and how precedent systems have handled appraisal, social emotion, and believable agent behavior.

---

## 1. Thesis

For interactive systems, the most useful way to think about emotion is not as a bag of flavor adjectives but as a structured **appraisal process** that converts interpreted events into:
- short-lived affective responses
- action tendencies
- persistent relational updates
- attention/salience changes
- threshold-triggered behavior shifts

The critical design move is to **separate transient emotion from durable relationship state**.

A practical engine rule:

> **Events and utterances produce appraisals; appraisals produce transient affect and longer-lived relational deltas; narration realizes those states but does not define them.**

This gives the system leverage without requiring a fully realistic psychology simulator.

---

## 2. Why this matters for Immortal

Immortal will constantly need answers to questions like:
- Was that line merely rude, or humiliating?
- Does a threat create immediate fear, long-term resentment, both, or neither?
- Can respect increase while trust decreases?
- When does public shame change future obedience?
- How quickly should anger fade relative to fear or gratitude?
- What is the difference between a temporary emotional spike and a persistent relationship shift?
- Which emotional states should alter legal move selection, dialogue posture, combat willingness, or bargaining flexibility?

A human DM often handles this with intuition. A deterministic engine needs more explicit state.

Without that explicit state, systems tend to fail in two opposite ways:
1. **too soft** — NPCs “feel” things only in prose, so nothing changes mechanically
2. **too hard** — every insult or gift causes rigid, simplistic, and unrealistic permanent changes

The useful middle path is:
- deterministic **appraisal tags**
- bounded transient emotion intensities
- separate persistent **relationship variables**
- explicit decay and reinforcement rules
- downstream behavior policies that consume those states

---

## 3. Precedent and conceptual lineage

### 3.1 Believable agents and affective architectures

Believable-agent work long emphasized that personality and emotion should shape action selection rather than existing only as decorative labels. Reilly’s thesis on believable social and emotional agents is an early, still-useful precedent for integrating social and emotional state into character behavior rather than treating it as external garnish.

For Immortal, the takeaway is straightforward:

> if emotion matters, it should influence decisions, not just descriptions.

### 3.2 Appraisal theory as the strongest computational substrate

The strongest computational lineage for usable emotional modeling is **appraisal theory**. Rather than treating emotion as a simple stimulus-response table, appraisal models treat emotions as arising from an agent’s evaluation of what an event means for:
- goals
- standards
- norms
- plans
- agency
- controllability
- expectedness
- future prospects
- social standing

This is why appraisal remains more useful for engine design than blunt sentiment models.

### 3.3 EMA and related computational appraisal models

Marsella and Gratch’s **EMA** work is especially relevant because it makes appraisal computational and dynamic rather than purely taxonomic. The core idea is that appraisals arise from the agent’s interpretation of its relation to the environment, and emotional responses can change as that interpretation is updated.

That is a major lesson for Immortal:
- emotion should not always be resolved in one instant
- some appraisals can change after evidence, reflection, or reinterpretation
- later realizations can transform fear into anger, relief into shame, or gratitude into suspicion

### 3.4 Social emotions and attributions

Work on social emotions and social attributions extends appraisal models into cases where emotion depends on:
- who caused the event
- whether it was intentional
- whether it was public
- whether it reflected status or disrespect
- whether it violated norms
- whether it exposed weakness or loyalty

This is where social-interaction engines gain a lot of leverage.

### 3.5 Surveys of emotion in social simulation

Surveys of emotion modeling in social simulation consistently show that appraisal-based approaches are the most useful bridge between psychological theory and agent design, because they can be tied to explicit events, goals, and social interpretation rather than to surface tone alone.

For Immortal, the important point is not to build a maximalist cognitive science replica. It is to adopt the smallest appraisal/relationship structure that gives robust behavior differences.

---

## 4. Core distinction: appraisal, affect, relation

A clean model needs at least three layers.

### 4.1 Appraisal
The agent’s interpretation of what an event means.

Example appraisal tags:
- threat
- insult
- betrayal
- aid
- recognition
- humiliation
- norm violation
- submission
- apology
- status challenge
- exclusion
- debt incurred
- trust confirmation
- uncertainty increase

### 4.2 Transient affect
Short-lived emotional or arousal states.

Examples:
- anger spike
- fear spike
- shame spike
- relief
- gratitude feeling
- hope
- dread
- embarrassment
- disgust
- grief

These should typically decay faster than relations.

### 4.3 Persistent relationship state
Longer-lived variables affecting future interpretation and behavior.

Examples:
- trust
- fear
- respect
- affection
- resentment
- loyalty
- jealousy
- dependence
- suspicion
- dominance/subordination expectation

This separation is the central architectural discipline of the volume.

---

## 5. What belongs in deterministic state

Not everything emotional should be represented equally.

### 5.1 Strong candidates for explicit state
- trust
- fear
- respect
- resentment
- loyalty
- suspicion
- obligation/debt
- public shame exposure
- grievance counters
- bond/attachment strength

### 5.2 Good candidates for bounded transient state
- current anger
- current fear arousal
- current shame
- current grief intensity
- current gratitude
- current confidence
- current embarrassment

### 5.3 Better as derived/narrative surface state
- exact facial-expression labels
- detailed mood poetry
- nuanced affective descriptors not tied to behavior
- unconstrained introspective prose

These are often best realized in narration from the underlying packet/state.

---

## 6. Appraisal dimensions that matter for games

A practical engine does not need every theory term. It needs the dimensions that produce distinct behavior.

- goal relevance
- valence
- agency
- intentionality
- controllability / coping potential
- expectedness
- status / face impact
- norm / value alignment
- publicity
- relationship source

These dimensions help generate different emotional and relational consequences from superficially similar events.

---

## 7. Social events that deserve explicit appraisal tags

### 7.1 Threat
Can generate:
- fear increase
- anger increase
- respect increase if threat is credible and bound to status/power
- trust decrease

### 7.2 Humiliation
Especially under witnesses:
- shame spike
- resentment increase
- trust decrease
- status-defense tendency increase

### 7.3 Rescue / costly aid
Can generate:
- gratitude
- trust increase
- loyalty increase
- debt/obligation increase

### 7.4 Betrayal
Can generate:
- trust collapse
- resentment increase
- grief
- vigilance/suspicion increase

### 7.5 Praise / recognition
Can generate:
- respect changes
- affection/trust changes
- public confidence changes
- attachment reinforcement

### 7.6 Apology / amends
Can generate:
- resentment reduction
- trust restoration potential
- debt balancing
- shame or forgiveness dynamics

### 7.7 Submission / deference
Can generate:
- respect, contempt, or dominance updates depending on culture and relation
- reduced immediate hostility
- altered future command expectations

### 7.8 Defiance
Can generate:
- anger
- respect
- fear
- admiration
depending heavily on scene protocol and roles

---

## 8. Relation variables should not collapse into one “affinity” meter

At minimum, keep these separable:
- trust
- respect
- fear
- affection
- resentment
- loyalty
- suspicion

Why this matters:
- respect can rise while affection falls
- fear can rise while trust remains low
- loyalty can persist under resentment
- affection can survive low respect
- gratitude can increase trust without increasing fear
- humiliation can increase fear and resentment while lowering respect

This gives much more believable behavior than a scalar “likes you / dislikes you” system.

---

## 9. Decay, reinforcement, and memory weighting

### 9.1 Transient affect should decay
Anger spikes, embarrassment, surprise, and relief usually fade unless reinforced.

### 9.2 Persistent relations should move slowly
Trust, resentment, loyalty, and fear should generally change through:
- repeated confirming events
- high-magnitude events
- public turning points
- betrayal/rescue thresholds
- explicit reconciliation or severance

### 9.3 Memory weighting matters
Useful weighting factors:
- recency
- magnitude
- publicity
- intentionality
- relationship closeness
- repetition
- costliness
- unresolvedness

### 9.4 Threshold effects
Certain transitions should occur only after thresholds:
- trust collapse after confirmed betrayal
- panic only when fear + helplessness exceed threshold
- vengeance motive only after grievance threshold
- obedience under intimidation only when fear outweighs defiance drivers

This prevents jittery overreaction.

---

## 10. Appraisal-to-behavior pathways

Emotion matters mechanically when it changes:
- action priority
- interpretation bias
- willingness to clarify
- escalation chance
- disclosure probability
- bargain flexibility
- combat commitment
- deference tendency
- help/refusal likelihood

Examples:
- higher fear may increase compliance, concealment, flight, or appeasement
- higher resentment may increase refusal, sabotage, coldness, or challenge
- higher trust may increase disclosure and acceptance of explanation
- higher respect may increase deference and seriousness of uptake
- high shame may reduce willingness to speak publicly
- high anger may reduce patience for clarification

The point is not to make behavior deterministic from emotion alone, but to make emotional state part of the policy context.

---

## 11. Suggested runtime packet / state design

### 11.1 Appraisal event object

```text
AppraisalEvent =
  source_event_id
  actor
  target
  appraisal_tags[]
  valence
  magnitude
  intentionality
  publicity
  agency
  controllability
  expectedness
  norm_alignment
  relationship_context
```

### 11.2 Transient affect state

```text
TransientAffect =
  anger
  fear
  shame
  relief
  gratitude
  grief
  confidence
  embarrassment
  disgust
  hope
```

### 11.3 Persistent relational state

```text
RelationState(actor, other) =
  trust
  respect
  fear
  affection
  resentment
  loyalty
  suspicion
  obligation_debt
  dominance_expectation
```

Optional:
- attachment
- envy
- forgiveness_readiness
- grievance_count
- public_face_damage

---

## 12. Scene-sensitive emotional interpretation

Vol 4 matters here. The same event can appraise differently across scene protocols.

Example:
> public contradiction of a superior

Possible appraisals by scene:
- court: procedural objection
- military rank scene: insubordination
- tavern: spirited banter
- ritual: sacrilege or impurity
- private counsel: honest warning

So emotional updates should often depend on:
- scene protocol
- role
- audience
- prior relationship
- cultural norm table

This prevents emotion logic from floating free of the social world.

---

## 13. Deception-sensitive emotional interpretation

Vol 5 also matters. Emotional updates often depend not just on what happened, but on whether the target later learns they were deceived.

Typical multi-stage pattern:
1. reassurance reduces fear
2. later evidence reveals deception
3. trust drops sharply
4. resentment spikes
5. shame may rise if deception was publicly visible

This argues for delayed relational updates in some cases, rather than resolving everything at utterance time.

---

## 14. Failure modes

- pure sentiment model
- single affinity meter
- no difference between transient and persistent
- no publicity modeling
- emotion not connected to policy
- overfitting prose

---

## 15. Design pattern for Immortal

### Stage 1 — interpret event or utterance
Use Vol 2–5 layers to determine:
- proposition/force/stance
- scene protocol
- deception/publicity
- presupposition/common-ground effects

### Stage 2 — derive appraisal
Map interpreted event to one or more appraisal tags with magnitude.

### Stage 3 — update transient affect
Short-lived intensities change first.

### Stage 4 — update persistent relation
Apply bounded deltas to trust/fear/respect/etc. with threshold and decay rules.

### Stage 5 — alter policy context
These states influence:
- next move legality or preference
- willingness to comply, disclose, challenge, forgive, retaliate, flee

### Stage 6 — narrate last
Narration expresses emotional texture from explicit state; it does not manufacture hidden canonical changes.

---

## 16. Minimal starter implementation strategy

Do not begin with a giant emotion ontology.

Recommended initial persistent relation set:
- trust
- respect
- fear
- resentment
- loyalty
- suspicion

Recommended initial transient set:
- anger
- fear
- shame
- gratitude
- confidence

Recommended initial appraisal tags:
- threat
- insult
- humiliation
- aid
- betrayal
- apology
- praise
- defiance
- submission
- debt_incurred

This is already enough to create large behavioral variation if consumed consistently.

---

## 17. Evaluation questions

A relational-emotion layer is working if:
- the same literal line causes different updates depending on scene and relation
- rescue and betrayal create durable effects beyond one turn
- public humiliation differs from private criticism
- respect can move independently from affection and trust
- repeated small harms can accumulate into grievance
- transient anger decays while resentment can persist
- narration remains consistent with explicit stored state
- replay produces the same deltas from the same inputs

---

## 18. Strong heuristics

1. Store relations, not moods, when in doubt.
2. Let appraisal bridge event and emotion.
3. Separate immediate feeling from durable bond change.
4. Publicity multiplies shame and status effects.
5. Mixed emotions should be possible.
6. Behavior policy should read the emotional state.
7. Narrate from state; never infer state only from narration.

---

## 19. Relation to the rest of the Biblioteca

- Vol 2 gives force, obligation, repair.
- Vol 3 gives implicature, presupposition, common ground.
- Vol 4 gives scene protocol and legality.
- Vol 5 gives public/private claim structure and deception.
- Vol 6 turns interpreted events into emotional and relational consequences.
- Vol 7 defines the hybrid architecture that wires all these layers together.

---

## 20. Design implications for Immortal

The highest-value design recommendation is:

> Introduce a dedicated `RelationState` separate from both world facts and narration.

The second-highest recommendation is:

> Model emotion as appraisal-driven deltas into transient affect plus persistent relation variables.

The third recommendation is:

> Use these states downstream in policy selection rather than only in prose generation.

That keeps the system deterministic, replayable, and behaviorally meaningful.

---

## 21. References / precedent to mine

- Reilly, W. Scott Neal. **Believable Social and Emotional Agents.**
- Marsella, Stacy, and Jonathan Gratch. **EMA: A Process Model of Appraisal Dynamics.**
- Gratch and Marsella. **A Domain-Independent Framework for Modeling Emotion.**
- Gratch et al. **Modeling Social Emotions and Social Attributions.**
- Bourgais et al. **Emotion Modeling in Social Simulation: A Survey.**

---

## 22. Working summary

The design lesson is:

> do not store “emotion” as decorative flavor; store the appraisals and relation changes that matter for later behavior.

A practical engine should:
- interpret the event
- derive appraisal tags
- update transient affect
- update persistent relations
- let policy consume those states
- narrate last

That is enough to make NPC emotional life mechanically legible without pretending to solve full human psychology.
