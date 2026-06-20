# Vol 8 — Evaluation Harness

**Biblioteca / Immortal reference volume.**  
**Purpose:** define how to test and validate a deterministic social/pragmatic layer so it can graduate from interesting design theory into reliable engine infrastructure.

---

## 1. Thesis

A social-pragmatic subsystem is only real if it can be **tested, replayed, inspected, and falsified**.

The hardest failure modes in dialogue-heavy systems are often not obvious at the moment they occur. They show up later as:
- hidden state drift
- paraphrase sensitivity
- silent canon corruption
- inconsistent clarification
- unstable witness/publicity handling
- relation deltas that do not match prior events
- narration implying facts that state does not contain
- ambiguous utterances being resolved differently on replay

That means evaluation cannot be an afterthought. It has to be part of the architecture.

Core rule:

> **Every social interpretation that matters to canon or policy should be observable in logs and testable by harness.**

---

## 2. Why this matters for Immortal

Immortal already treats combat, world facts, and resolution as deterministic core concerns. If IG-11 or any broader “social physics” layer becomes real engine logic, it needs the same level of discipline.

This volume exists to answer questions like:
- Did two paraphrases produce the same pragmatic packet?
- Did the system clarify when it should have?
- Did a public claim get logged as a claim rather than promoted to a fact?
- Did witness scope alter consequences correctly?
- Did scene protocol change the legal move set?
- Did trust/fear/resentment deltas match the interpreted event?
- Did replay produce the same result?
- Can a failure be diagnosed after the fact from logs alone?

Without this, even a clever architecture will drift back into “the model seemed to think…”

---

## 3. What must be testable

At minimum, the harness should be able to inspect and assert over:

- raw input
- normalized/pragmatic packet
- confidence and ambiguity set
- scene protocol
- discourse obligations
- public claim ledger entries
- relation deltas
- chosen legal action
- clarification reason
- final narration/output
- event log / replay record

If any socially meaningful outcome cannot be inspected, it is likely to become a source of hidden drift.

---

## 4. Test layers

A full harness should use multiple layers rather than one giant end-to-end pile.

### 4.1 Unit tests
Test narrow transforms and deterministic rules:
- speech-act detection from known inputs
- presupposition extraction
- scene legality rules
- relation-delta rules
- witness-scope transforms
- public-claim logging

These should be cheap and numerous.

### 4.2 Golden tests
Store canonical expected outputs for representative scenarios:
- parsed packet
- state delta
- chosen action
- clarification decision
- resulting narration constraints

Good for catching regressions in known patterns.

### 4.3 Property tests
Assert invariants over families of inputs:
- paraphrase-equivalent lines should map to same packet fields
- claims should not become world facts without a rule path
- narration must not introduce unsupported canon
- low-confidence cases should route to clarify/defer bands

These are critical for social systems because edge cases explode combinatorially.

### 4.4 Scenario / integration tests
Multi-turn scenes with evolving state:
- bargaining rounds
- interrogation with repeated questioning
- public accusation with witnesses
- apology and repair arc
- bluff then exposure
- public humiliation affecting later compliance

These test continuity, not just local correctness.

### 4.5 Replay tests
Given the same input stream and same initial state, the same packet/state/action outputs should be produced.

If not, the system is not deterministic enough to trust.

---

## 5. Core invariant families

The harness should assert hard invariants derived from the prior volumes.

### 5.1 Canon / narration separation
Narration may realize state but must not define unsupported canon.

Examples:
- if narration says a threat was “empty,” that must be supported by state or policy
- if narration implies the NPC believes a lie, there must be corresponding belief-state update
- if narration says a character is ashamed, there should be appraisal/affect support if shame is canonically meaningful

### 5.2 Claim / fact separation
Public claims are logged as claims, not facts, unless some later rule path promotes them.

### 5.3 Interpret richly, commit narrowly
In ambiguous cases, the safe packet should be narrower than the candidate interpretation set.

### 5.4 Clarification legality
Clarification should trigger when ambiguity is both:
- consequential
- insufficiently resolved by scene/context/confidence

### 5.5 Scene protocol authority
Scene protocol should change legal action sets and interpretation priorities.

### 5.6 Relation consistency
Trust, fear, respect, resentment, etc. should only move through authorized update paths.

### 5.7 Witness/publicity consistency
Who heard/saw what should be traceable and should alter public consequences.

---

## 6. Paraphrase invariance

This is one of the highest-value test categories.

A well-designed social layer should be robust to many surface variations that mean the same thing.

Examples:
- “Open the door.”
- “Could you open the door?”
- “Would you mind opening the door?”
- “Get that door.”

These may differ in politeness or directness, but often should preserve core force and target.

### 6.1 What should remain invariant
Depending on case:
- force category
- target
- proposition
- scene legality
- obligation created
- public claim category

### 6.2 What may vary safely
- directness
- politeness
- stance
- confidence
- relation delta magnitude
- narrational realization

### 6.3 Hard cases
The harness should explicitly test where paraphrase *should not* preserve meaning:
- warning vs threat
- request vs order
- accusation vs question
- flirtation vs coercion
- ritual recitation vs improvisation

This prevents false invariance.

---

## 7. Clarification correctness

A strong harness should treat clarification as a first-class outcome to validate.

### 7.1 False negative clarification
System commits when it should have clarified.

Examples:
- ambiguous theft approach
- “Do it” when multiple actions are salient
- loaded question where imported presupposition is unclear
- order/threat ambiguity under high-stakes scene protocol

### 7.2 False positive clarification
System asks for clarification when context already makes the move clear.

This is also bad because it destroys flow.

### 7.3 Testable criteria
Clarification should be more likely when:
- consequence divergence is high
- confidence is low
- scene protocol does not resolve the ambiguity
- imported claims are contested
- multiple legal readings remain plausible

Clarification should be less likely when:
- only one interpretation remains legal
- the ambiguity is narrationally minor
- the underlying action packet is already narrow enough to proceed safely

---

## 8. Claim / presupposition / implicature tests

Vol 3 requires explicit tests for meaning layers.

### 8.1 Asserted content tests
Did the system capture what was actually asserted?

### 8.2 Presupposition tests
Did it detect imported assumptions?
Did it treat them as contestable where appropriate?

### 8.3 Implicature tests
Did it derive likely implied meaning without overcommitting to hard fact?

### 8.4 Common-ground tests
Did it update shared/public discourse status appropriately?

Critical example:
> “Have you stopped stealing?”
Expected harness checks:
- accusation move registered
- presupposed prior stealing extracted
- prior stealing **not** silently added as world fact
- target gets legal response paths such as deny premise / challenge / answer / deflect

---

## 9. Scene protocol tests

Vol 4 implies a large family of scenario tests.

### 9.1 Same line, different scene
Use the same utterance across:
- tavern
- court
- ritual
- military hierarchy
- bargaining scene
- private confession

Assert:
- different legality class
- different likely force
- different sanction risk
- different witness/publicity effects
- different clarification policy when appropriate

### 9.2 Silence tests
Silence should not be treated uniformly.

Test:
- silence in interrogation
- silence in ritual
- silence after insult in public duel protocol
- silence in private grief/confession scene

### 9.3 Role tests
Same line spoken by:
- superior
- peer
- subordinate
- priest
- stranger
- witness

should often produce different outcomes.

---

## 10. Deception and witness tests

Vol 5 requires explicit public/private-state evaluation.

### 10.1 Bluff preservation
A bluff should be logged as a public claim with tactical effect, not collapsed into immediate truth or falsehood.

### 10.2 Exposure pathways
Later evidence, witness report, or procedural verification should be able to trigger:
- trust drop
- status loss
- contradiction logging
- scene-specific sanctions

### 10.3 Audience-split tests
One line should be able to affect:
- addressee
- witnesses
- authority
- ally

differently, with those differences inspectable.

### 10.4 Deniability tests
A veiled threat should preserve some literal deniable reading while still producing threat-like effects for the target if context supports it.

---

## 11. Relational-state tests

Vol 6 implies a distinct set of checks.

### 11.1 Mixed relation tests
Ensure systems can represent:
- respected but distrusted
- feared but admired
- loved but resented
- loyal yet suspicious

### 11.2 Decay tests
Transient anger should decay faster than resentment unless reinforced.

### 11.3 Threshold tests
Repeated slights may accumulate into grievance even if each one alone is too small.

### 11.4 Public/private tests
Public humiliation should differ from private criticism in shame/status effects.

### 11.5 Delayed update tests
Learning later that reassurance was deception should trigger delayed relation changes.

---

## 12. Narration-constraint tests

Because narration is downstream, the harness should test not only state, but that narration stays within bounds.

Useful assertions:
- narration does not introduce unsupported facts
- narration respects chosen legal action
- narration does not silently change who knows what
- narration realizes confidence/ambiguity appropriately
- narration reflects relation/appraisal state without inventing new canonical deltas

A practical pattern:
- test state/action strictly
- test narration for allowed/forbidden semantic content rather than exact wording

This avoids brittleness while preserving constraints.

---

## 13. Logging requirements

A useful harness depends on good logs. Minimum per-turn log shape:

```text
TurnLog =
  turn_id
  raw_input
  normalized_input
  scene_protocol
  speaker
  addressee
  audience_scope
  candidate_packets[]
  confidence_scores
  safe_packet
  state_deltas
  chosen_action
  clarification_reason
  narration_output
```

Helpful extras:
- rule ids fired
- retrieval hits used
- prior obligations read
- witness list
- relation state before/after
- explanation traces for tests

Without this, failures become anecdotes instead of actionable bugs.

---

## 14. Corpus design

The harness should not rely only on random ad hoc examples. Build a small curated corpus of scenario families.

Recommended families:
- request/order/threat ambiguity
- accusation and loaded questions
- bargaining turns
- bluff and later exposure
- public humiliation
- apology and repair
- ritual protocol breaches
- witness-sensitive deniable threats
- paraphrase clusters
- public/private contrast pairs

Each family should include:
- scene
- roles
- witness scope
- initial relation state
- raw input variants
- expected packet fields
- expected legal actions
- expected deltas
- allowed clarification outcomes

---

## 15. Acceptance criteria for graduating a rule

A social rule should move from “interesting idea” to “engine feature” only when it passes an explicit bar.

Suggested graduation bar:
1. Packet representation defined
2. State update path explicit
3. Legal action effects explicit
4. Logging complete
5. Golden tests written
6. Paraphrase tests written
7. Replay deterministic
8. Narration constraints defined
9. Failure modes documented

This is how social logic avoids becoming a grab bag of vibe heuristics.

---

## 16. Minimal first harness for Immortal

A useful first harness does not need to cover everything. Start with the highest-value invariants.

### Phase A
- claim/fact separation tests
- clarification correctness tests
- paraphrase-equivalence suites
- replay tests for pragmatic packet + action selection
- narration-does-not-create-canon tests

### Phase B
- scene protocol legality suites
- witness/publicity suites
- deception/bluff exposure suites
- relation-delta suites

### Phase C
- long multi-turn scenario corpora
- fuzz/property tests over paraphrase generators
- benchmark dashboards
- packet diff tooling
- regression triage reports

This mirrors the architecture maturity path from Vol 7.

---

## 17. Strong heuristics

1. **Test the packet, not just the prose.**
2. **Replayability is a feature, not a luxury.**
3. **Clarification decisions deserve explicit assertions.**
4. **Public claims must remain separate from facts.**
5. **Scene, role, and witness scope should be test inputs, not hidden assumptions.**
6. **Narration should be constrained by state, never treated as the state.**
7. **A bug you cannot inspect will recur.**

---

## 18. Relation to the rest of the Biblioteca

- **Vol 1** states the overall architecture thesis.
- **Vol 2** defines speech acts, obligations, repair.
- **Vol 3** defines presupposition, implicature, common ground.
- **Vol 4** defines scene protocol and legality.
- **Vol 5** defines deception, bluffing, audience split.
- **Vol 6** defines appraisal and relation state.
- **Vol 7** wires interpretation, state, policy, and generation into a hybrid architecture.
- **Vol 8** defines how to prove those layers are stable, deterministic, and inspectable.

---

## 19. Design implications for Immortal

The highest-value design recommendation is:

> Create a first-class social/pragmatic regression harness before the subsystem becomes large.

The second is:

> Log every canon-relevant interpretation and state delta in a way tests can assert over.

The third is:

> Treat paraphrase invariance, clarification correctness, and claim/fact separation as top-level acceptance criteria.

If those three are solid, the system can grow safely. If not, every new social rule will increase drift.

---

## 20. References / precedent to mine

- Dialogue-state tracking and dialogue-policy evaluation traditions in spoken dialogue systems.
- Work on grounding and repair for evaluating mutual understanding and conversational recovery.
- Pragmatics benchmarks such as PUB for testing implicature, presupposition, deixis, and related phenomena.
- Social deduction and hidden-state dialogue work for testing trust, bluffing, and contradiction handling.
- Standard software-testing practice for golden tests, property tests, fuzzing, and replay determinism.

---

## 21. Working summary

The main lesson is:

> if a social interpretation matters, it should have a test.

A good evaluation harness should:
- inspect the packet
- assert the state deltas
- verify the chosen action
- constrain narration
- replay deterministically
- stress paraphrases, witnesses, scene shifts, and deception
- log enough to debug every failure

That is how “social physics” becomes engineering instead of folklore.
