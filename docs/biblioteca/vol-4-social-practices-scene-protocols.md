
# Vol 4 — Social Practices & Scene Protocols

**Biblioteca / Immortal reference volume.**  
**Purpose:** document classic and modern precedent for treating a *scene* as a rule-bearing social frame that changes the legal move set, the meaning of silence, the force of an insult, the consequences of refusal, and the pathways of escalation.

---

## 1. Thesis

The same utterance means different things in different scenes because the scene contributes **norms, roles, permissions, expectations, taboos, and sanctions**.

A demand made:
- in a **courtroom**
- during a **ritual**
- in a **military chain of command**
- in a **private confession**
- during a **market bargain**
- before **witnesses**
- under **duel protocol**

is not just the same semantic proposition with different flavor. It is often a different **social move** with different legal next responses.

That observation is one of the strongest reasons to avoid treating dialogue as free-floating text. Interactive systems gain leverage by representing a current **scene protocol** explicitly and letting that protocol shape interpretation and legal outcome selection.

Core rule:

> **Interpret utterances relative to a scene protocol, not in a vacuum.**

---

## 2. Why this matters for Immortal

Immortal already distinguishes deterministic resolution from downstream narration. Scene protocols provide a principled next layer on the deterministic side for social interaction.

They answer questions such as:
- What moves are legal *here*?
- What counts as disrespect, defiance, blasphemy, contempt, consent, surrender, hospitality violation, or lawful refusal *here*?
- Who is authorized to command whom *here*?
- Does silence count as refusal, obedience, hesitation, piety, fear, or tactical ambiguity *here*?
- What does a public audience do to threat credibility, shame, bluff risk, face pressure, and sanction severity?
- When should the engine **clarify** instead of committing because two scene-legal interpretations are both plausible?

Scene protocols are especially valuable because they compress a large amount of “human DM intuition” into a reusable rule object:
- court mode
- bargaining mode
- interrogation mode
- ritual mode
- tavern mode
- rank/command mode
- duel/challenge mode
- romance/courtship mode
- witness testimony mode
- public accusation mode

---

## 3. Historical precedent

### 3.1 Scripts, plans, and recurring situations

A long line of work in AI and narrative treats recurring social situations as structured patterns rather than unbounded chaos. The details differ across traditions, but the central idea is stable:

- there are recurring *kinds* of social situations
- each has expected participant roles
- each opens some actions and closes others
- departures from expectation are meaningful and often narratively productive

This broad idea sits behind older “script” traditions, planning approaches, and later social simulation systems.

For Immortal, the key takeaway is not to reproduce old script systems wholesale, but to preserve the useful part:
- recurring scenes are computationally tractable if represented as explicit structures.

### 3.2 Versu: social practices as computational backbone

The most important direct precedent is **Versu**. Emily Short and Richard Evans describe a **social practice** as a recurring social situation and implement practices as **reactive joint plans** that provide affordances to participating agents. The practice does not directly control agents; agents remain autonomous and choose among offered actions using utility-based reactive selection.

This is crucial for engine design. A scene protocol should:
- constrain and suggest
- not puppet participants
- expose legal moves and contextual salience
- leave room for local agency and character-specific choice

A useful reading of Versu for Immortal is:

> the scene is a rule-bearing frame that shapes action selection without annihilating character autonomy.

That is far better than either extreme:
- pure authored branches
- pure unconstrained freeform chat

### 3.3 Social simulation after Versu

Later work on social simulation and simulationist interactive narrative continues this pattern: strong experiences emerge when character behavior is conditioned by **roles, norms, relationship structures, and situation-specific affordances**, not just by generic traits or text prompting.

Recent work discussing social simulation and storylets also reinforces the design point that high-reactivity systems need some notion of structured social circumstance to avoid “everyone always has the same move set everywhere.”

---

## 4. Core concept: the scene protocol

A **scene protocol** is a typed runtime object describing the current social frame.

It is not the scene’s prose description. It is the rule object behind the prose.

Minimum meaning:

- what kind of scene this is
- which roles are instantiated
- what actions are licensed
- what actions are taboo
- how obligations transform
- how publicity/witnesses matter
- what sanctions exist
- what counts as escalation
- what counts as graceful exit

A practical abstraction:

```text
SceneProtocol =
  id
  scene_mode
  roles[]
  entry_conditions[]
  exit_conditions[]
  legal_moves[]
  dispreferred_moves[]
  taboo_moves[]
  obligation_rules[]
  rank_rules[]
  witness_rules[]
  sanction_rules[]
  repair_rules[]
  escalation_rules[]
  clarify_rules[]
```

The point is not that every scene must be fully authored at high fidelity. The point is that the engine must have *some* explicit scene frame if it wants reliable interpretation.

---

## 5. What scene protocols do

### 5.1 Restrict legal move sets

In many scenes, the same sentence-form is legal or illegal depending on context.

Examples:
- A direct order may be legal under military command protocol and socially absurd in casual tavern banter.
- A demand for confession may be legal in interrogation and unacceptable in ritual prayer.
- Public contradiction of a superior may be sanctioned in court but tolerated in private counsel.

This does not require total determinism of outcomes. It requires deterministic representation of:
- whether the move is legal
- whether it is rude but legal
- whether it is taboo
- whether it triggers clarification
- whether it escalates

### 5.2 Alter interpretation of the same move

Example:
> “Kneel.”

Possible interpretations:
- formal command under rank protocol
- ritual instruction
- coercive threat
- romantic play
- humiliating public dominance display
- theatrical flourish
- blasphemous misuse of sacred language

The proposition is thin; scene protocol determines most of the actual meaning.

### 5.3 Transform silence

Silence is one of the biggest places where scene protocols matter.

Silence may mean:
- respectful waiting
- refusal
- fear
- tactical non-commitment
- inability to answer
- contempt
- piety
- obedience
- collapse of grounding

A protocol helps determine which reading is default and what repair is expected.

### 5.4 Transform witness effects

Witness presence changes:
- shame
- threat credibility
- reputational damage
- deniability
- likelihood of face-saving language
- legality of contradiction
- danger of refusal
- value of public concession

This is one reason scene protocols should carry a witness/publicity model instead of treating audience as an incidental narrative detail.

### 5.5 Change sanction tables

The same insult can produce:
- awkwardness
- loss of trust
- formal censure
- duel challenge
- sacrilege accusation
- arrest
- exile
- laughter

depending on scene protocol.

---

## 6. Social practices vs raw language interpretation

A common failure mode in LLM-mediated NPC systems is to over-invest in utterance-level classification and under-invest in scene-level structure.

That failure looks like:
- strong local interpretation of a line
- weak understanding of what the *situation* permits
- inconsistent consequences
- brittle handling of silence, deflection, or witness presence
- repetitive “generic conflict mode” everywhere

The corrective is simple:

> interpret the line *through* the scene protocol.

That means scene protocol should often outrank local textual cues when deciding:
- what force labels are plausible
- which implicatures are available
- what consequences can lawfully follow
- whether clarification is required
- what repairs are socially admissible

---

## 7. Canonical scene families

The engine does not need every possible social practice on day one. It needs a strong initial set with explicit rules.

### 7.1 Bargaining / haggling

Typical features:
- price/cost concession ladder
- offers and counteroffers
- face-saving exits
- bluff opportunities
- bounded hostility
- strong role for anchoring
- public witness can affect fairness pressure

Key legal moves:
- offer
- counteroffer
- reject
- signal walk-away
- sweeten
- question value
- invoke status / scarcity / urgency
- threaten to leave
- ask for guarantee

Key engine concern:
- do not reduce all bargaining to persuasion checks; it is a structured exchange with reversible commitments and tactical information management.

### 7.2 Interrogation

Typical features:
- asymmetry of power
- pressure and resistance
- high value of omissions and inconsistencies
- repeated questioning
- forced clarification
- evidentiary reveals
- silence/hesitation become meaningful

Key legal moves:
- ask
- press
- accuse
- deny
- partial admit
- demand specificity
- challenge premise
- refuse
- bargain for safety
- exploit ambiguity

Key engine concern:
- explicit tracking of questions asked, obligations created, and unresolved contradictions.

### 7.3 Court / hearing / tribunal

Typical features:
- formal turn rights
- rank and permission
- witness scope
- procedural legitimacy
- penalties for interruption, contempt, or irrelevance
- truth claims evaluated under public record conditions

Key legal moves:
- petition
- object
- testify
- accuse
- challenge evidence
- request leave to speak
- confess
- submit plea
- call witness
- refuse on grounds

Key engine concern:
- rank and procedure shape meaning as much as content.

### 7.4 Ritual / sacred protocol

Typical features:
- taboo triggers
- role purity or authorization
- formulaic language
- sequence-sensitive actions
- misstep can be blasphemy, not mere awkwardness
- silence may be reverence rather than refusal

Key legal moves:
- invoke
- recite
- witness
- request blessing
- confess impurity
- interrupt taboo violation
- challenge false priestly authority

Key engine concern:
- scene rules are often stronger than character preference.

### 7.5 Rank / command hierarchy

Typical features:
- formal authority
- lawful refusal conditions
- obedience delay windows
- insubordination thresholds
- delegated authority
- private dissent vs public dissent distinction

Key legal moves:
- command
- acknowledge
- comply
- respectfully question
- refuse on lawful grounds
- countermand
- appeal upward
- defy

Key engine concern:
- authority should be explicit state, not inferred only from tone.

### 7.6 Duel challenge / honor scene

Typical features:
- public face
- honor norms
- challenge issuance
- choice of terms
- seconding or witnessing
- controlled escalation
- insult has codified consequences

Key legal moves:
- insult
- demand satisfaction
- accept
- refuse with shame
- negotiate terms
- name place/time
- withdraw under formula

Key engine concern:
- honor protocol can transform a casual insult into a mechanically meaningful escalation ladder.

### 7.7 Private confession / vulnerable disclosure

Typical features:
- trust and confidentiality
- high relational stakes
- lower formality
- strong role for reassurance, betrayal, silence, and repair
- witness intrusion radically changes meaning

Key legal moves:
- confess
- disclose
- reassure
- reject
- forgive
- withhold
- exploit
- promise secrecy

Key engine concern:
- same literal content in public is often a different act entirely.

---

## 8. Roles inside a scene

Scene protocols are not just modes. They also instantiate **roles**.

Example role slots:
- judge / petitioner / accused / witness / advocate
- buyer / seller / broker / observer
- commander / subordinate / peer
- priest / supplicant / profaner / witness
- host / guest / gatekeeper
- challenger / challenged / second / crowd

Roles matter because:
- they govern permissions
- they shape default obligations
- they modify sanctions
- they determine whose silence counts
- they affect uptake of insults, orders, and refusals

A useful rule:

> A move’s legality is often a function of `(scene_mode, speaker_role, target_role, publicity)`.

---

## 9. Publicity and audience scope

This deserves a first-class field.

Suggested runtime view:

```text
AudienceScope =
  private
  addressee_only
  small_witnessed
  public_local
  public_formal_record
  hidden_overhearers
```

Audience matters for at least five reasons:

1. **Face pressure**  
   Public refusal hurts differently than private refusal.

2. **Deniability**  
   Some statements are crafted for addressee understanding while remaining deniable before witnesses.

3. **Reputation**  
   Public accusation and public humiliation create different downstream state than private accusation.

4. **Sanction**  
   Court contempt with witnesses is different from muttering in an alley.

5. **Strategic signaling**  
   Speakers often target multiple audiences at once.

This is the bridge from scene protocol to Vol 5’s audience-split deception logic.

---

## 10. Protocol legality model

A practical legality classifier for social moves:

```text
legal
legal_but_costly
dispreferred
taboo
requires_clarification
impossible_here
```

This is more useful than a binary legal/illegal split.

Examples:
- interrupting in court: `legal_but_costly` or `taboo`, depending on role and moment
- direct price demand in bargaining: `legal`
- flirtation during formal inquest: often `dispreferred` or `taboo`
- ritual improvisation by unauthorized novice: maybe `requires_clarification` or `taboo`
- calling for duel in temple liturgy: likely `impossible_here` or severe escalation

---

## 11. Clarification as scene-aware policy

One of the strongest uses of scene protocols is improving clarification policy.

Example:
> “Are you going to do as you’re told?”

In a rank scene, this might be:
- command reinforcement
- threat
- disciplinary warning

In a bargain, it might be:
- pressure tactic
- conversational aggression

In a romance scene, it may be coercive or playful depending on prior established frame.

A good engine should not commit early when:
- two force readings are both protocol-legal
- the consequence difference is large
- confidence is low
- scene norms make misreadings especially costly

So clarification should ask scene-sensitive questions:
- “Is that an order or a threat?”
- “Are you invoking rank here?”
- “Is this part of the ritual, or are you breaking protocol?”
- “Are you refusing the offer, or asking for a better one?”

---

## 12. Failure modes in scene-unaware systems

### 12.1 Generic NPC flattening

Every location and event feels socially the same.

Symptom:
- identical response patterns in tavern, courtroom, and funeral rite.

### 12.2 Overreliance on sentiment

Hostility, positivity, or confidence substitute for real social logic.

Symptom:
- systems detect “negative tone” but miss that the move is procedurally valid objection, lawful refusal, ritual correction, or formal accusation.

### 12.3 Broken sanction consistency

A serious breach in one scene is ignored, while a trivial breach in another causes nonsense escalation.

### 12.4 Witness blindness

Public/private distinction does not alter stakes.

### 12.5 No role sensitivity

Anyone can order anyone; interruptions and objections carry no procedural meaning.

### 12.6 Weak silence interpretation

Silence is handled as empty text rather than a scene-dependent move.

---

## 13. Design pattern for Immortal

Recommended pipeline:

### Stage 1 — parse utterance into pragmatic packet candidate
From Vol 2–3:
- proposition
- force hypotheses
- stance
- target
- presuppositions
- implicatures
- confidence

### Stage 2 — apply scene protocol filter
Evaluate candidate moves against:
- scene mode
- speaker role
- target role
- audience scope
- current obligations
- taboo table
- sanction table

Output:
- legal interpretation set
- dispreferred interpretations
- clarification need
- provisional consequence envelope

### Stage 3 — update scene-local state
Examples:
- question obligation opened
- challenge unresolved
- bargain round advanced
- rank defiance registered
- public insult witnessed
- ritual purity violation flagged

### Stage 4 — choose legal action
Examples:
- answer
- object
- refuse
- threaten
- sanction
- defer
- summon witness
- escalate
- clarify
- reframe

### Stage 5 — generate phrasing last
Narration realizes chosen state. It does not define protocol legality retroactively.

---

## 14. Suggested packet additions

Vol 2–3 cover utterance-level fields. Scene protocols need additional fields.

```text
scene_mode
speaker_role
target_role
audience_scope
protocol_legality
protocol_cost
taboo_risk
sanction_risk
public_face_risk
witness_visibility
escalation_band
repair_options[]
clarification_prompts[]
```

Optional derived fields:
- `authority_basis`
- `lawful_refusal_available`
- `ritual_authorization`
- `bargain_round`
- `procedural_turn_right`

---

## 15. Minimal starter implementation strategy

Do not attempt “all social situations” first.

A sane initial packetization plan:

### Phase A
Implement three scene protocols:
- bargaining
- rank/command
- interrogation

Why:
- high gameplay value
- strong mechanical identity
- different meanings for silence, refusal, and ambiguity
- easy to test for turn-to-turn continuity

### Phase B
Add:
- public accusation / witness scene
- ritual / sacred protocol
- private confession

### Phase C
Add:
- court / hearing
- duel / honor challenge
- romance / courtship

The goal is not volume; it is reliable contrast.

---

## 16. Evaluation questions

A scene protocol is working if:

- the same literal line yields different legal interpretations in different scenes
- public vs private delivery changes consequences
- role changes matter
- silence receives protocol-specific interpretations
- clarification improves when ambiguity is scene-specific
- sanctions and escalation are consistent across replays
- narration never overrides protocol legality

Good test prompts:
- issue the same order in tavern, military camp, temple, and market
- remain silent under accusation in court vs interrogation vs prayer
- insult a superior privately vs publicly
- refuse a command under lawful vs unlawful conditions
- ask an intimate question in public vs private

---

## 17. Strong design heuristics

1. **Scene outranks vibe.**  
   Tone alone should not dominate interpretation when protocol is explicit.

2. **Roles outrank generic personality.**  
   In formal scenes, role permissions often dominate “would this character normally say that?”

3. **Publicity multiplies consequences.**  
   Witnesses are not decoration.

4. **Silence is a move.**  
   But not the same move everywhere.

5. **Clarify when protocol branches diverge sharply.**  
   Especially if two legal readings imply very different canonical consequences.

6. **Narrate after legality.**  
   Never let prose define whether a move was allowed.

---

## 18. Relation to the rest of the Biblioteca

- **Vol 2** defines force, obligation, repair, grounding.
- **Vol 3** defines implicature, presupposition, common ground.
- **Vol 4** says those do not run in a vacuum; they are filtered through scene protocol.
- **Vol 5** will extend this into deception, bluffing, plausible deniability, witnesses, and audience-split communication.
- **Vol 6** will describe how scene-filtered outcomes change long-term relational state.

---

## 19. Design implications for Immortal

Immortal already has the right architecture bias:
- deterministic state transition
- LLM phrasing last
- canon narrow, inspectable, and replayable

Scene protocols are the next natural extension of that bias.

They solve a real problem:
- ad hoc detectors are useful but thin
- scene-dependent interpretation is currently where “DM intuition” hides
- formalizing scenes makes social interaction less magical and more testable

The strongest recommendation from this volume is:

> Introduce a typed `scene_protocol` layer before letting social utterances touch canon.

That layer should:
- condition interpretation
- determine legal response sets
- drive clarification policy
- define sanctions and witness effects
- keep narration downstream

This is likely more valuable in practice than trying to solve sarcasm in isolation, because many pragmatic effects only become legible once the scene itself is represented.

---

## 20. References / precedent to mine

- Evans, Richard, and Emily Short. **Versu—A Simulationist Storytelling System.** Core precedent for social practices as reactive joint plans that provide contextual affordances rather than directly puppeting agents.
- Dameris et al. **Praxish: A Rational Reconstruction of a Logic-Based DSL for Social Simulation.** Useful for understanding the authoring and logic substrate around Versu-like social simulation.
- Johnson-Bey et al. **A Sandbox for Simulation-based Emergent Narrative.** Good survey-like positioning document connecting social simulation systems such as Versu, PsychSim, Ensemble, and successors.
- Johnson-Bey et al. **Building Visual Novels with Social Simulation and Storylets.** Useful for the modern authoring perspective on combining social simulation with narrative control.
- Fried et al. **Pragmatics in Language Grounding: Phenomena, Tasks, and Modeling Approaches.** Good for grounding scene-sensitive interpretation in broader grounded-pragmatics thinking.
- Clark and Brennan; Clark and Schaefer. **Grounding in communication** tradition. Important for repair, uptake, acknowledgment, and audience-sensitive interpretation.

---

## 21. Working summary

The most important lesson from precedent is simple:

> A scene is not scenery. It is a rule-bearing social frame.

For an engine, that means:
- model the scene protocol explicitly
- let it shape legal move sets and interpretation
- keep consequences deterministic and inspectable
- narrate last

That is how social interaction stops being a pile of ad hoc exceptions and starts becoming system design.
