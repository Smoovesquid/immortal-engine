
# Vol 5 — Deception, Bluffing & Audience Split

**Biblioteca / Immortal reference volume.**  
**Purpose:** collect the strongest conceptual and technical precedent for handling lies, bluffing, omission, plausible deniability, witness-sensitive communication, and multi-audience speech in interactive systems.

---

## 1. Thesis

Deception is not a single yes/no property of an utterance. It is a structured relation between:

- what the speaker privately believes
- what the speaker publicly claims
- what the target is meant to believe
- what witnesses are meant to infer
- what evidence can later expose
- what deniability remains if challenged

That makes deception a strong candidate for deterministic representation.

A useful engine principle:

> **Model deception as structured public/private state plus audience-specific inference risk, not as “the NPC is lying” flavor text.**

---

## 2. Why this matters for Immortal

Many high-value social moments in play are deception-adjacent:

- bluffing strength
- feigning confidence
- intimidation with weak backing
- selective truth
- hiding intent
- rumor seeding
- public posturing for witnesses
- secret communication in plain sight
- deniable threats
- “technically true” evasions
- manipulated presuppositions
- confessions aimed at one audience but overheard by another

A human DM often handles this intuitively. A deterministic engine needs explicit representational hooks.

Without them, systems collapse toward one of two bad outcomes:
1. **overcommitment** — they decide too early that a statement is simply true or false
2. **undercommitment** — they avoid updating any meaningful state and deception has no mechanical bite

The correct middle route is:
- public claim state
- private belief estimates
- audience-conditioned interpretations
- suspicion / confidence updates
- later evidence reconciliation

---

## 3. Historical and conceptual foundations

### 3.1 Public claim vs private belief

A clean minimal distinction:

```text
private_belief(speaker, p)
public_claim(speaker, p)
target_belief_estimate(listener, p)
```

Deception enters when the speaker’s public claim diverges from private belief or when the speaker strategically shapes belief by omission, framing, or ambiguity.

This seems obvious, but many dialogue systems collapse all content into a single “said fact” channel, which destroys the ability to represent bluffing or deniable speech.

### 3.2 Audience design and concealment

Clark’s work on audience design and on concealing meaning from overhearers is especially relevant. Speakers design utterances not just for a single listener, but relative to addressees, overhearers, and assumptions about who can recover what.

This matters because many deceptive or semi-deceptive lines are not aimed at one audience:
- the addressee hears the threat
- the witness hears a polite statement
- the ally hears a coded cue
- the speaker preserves deniability before the crowd

That is not exotic edge-case behavior. It is normal multi-audience communication.

### 3.3 Social deduction as computational testbed

Recent work in social deduction games uses language as evidence over hidden state and highlights how difficult it is for models to reason about deception, trust, and intention when roles are hidden and speech is strategic.

That literature matters for Immortal not because the engine is a werewolf clone, but because social deduction sharply exposes the design problem:
- claims are not world facts
- language changes belief under uncertainty
- evidence arrives over time
- public and private state diverge
- strategic revelation timing matters

---

## 4. Deception taxonomy

A good engine should not compress all deceptive behavior into `is_lying`.

### 4.1 Direct lie

Speaker publicly asserts `p` while privately believing `not p`.

Example:
> “I have no idea where the jewel is.”

### 4.2 Bluff

Speaker represents strength, confidence, intent, or resources beyond what they privately expect to be able to support.

Example:
> “Touch me and fifty guards will descend on you.”

A bluff is not necessarily a simple factual lie. It may concern:
- future action
- hidden allies
- willingness to escalate
- confidence level
- backing or status

### 4.3 Half-truth

Speaker asserts something true but chosen to mislead by omission or framing.

Example:
> “I was at the temple all night.”  
True, but leaves out “after the murder.”

### 4.4 Strategic omission

A relevant fact is withheld because including it would alter the target’s belief significantly.

### 4.5 Evasion

Speaker avoids direct commitment when commitment would be risky.

Example:
> “People say many things.”

### 4.6 Plausible deniability

Utterance is designed so the target receives the intended threatening or deceptive meaning while a witness-friendly literal reading remains available.

Example:
> “It would be unfortunate if someone got hurt on the road.”

### 4.7 Audience-split signaling

One utterance is tuned to produce different inferences in different audiences.

Example:
- ally hears a coded instruction
- rival hears a generic statement
- crowd hears a noble vow

### 4.8 False presupposition injection

Speaker asks or frames things in ways that import a claim without directly asserting it.

Example:
> “When did you start working with the smugglers?”

### 4.9 Masked uncertainty / feigned certainty

Speaker knows they are uncertain but presents confidence to control reactions.

### 4.10 Performative sincerity

Speaker performs visible honesty, grief, indignation, or humility as a persuasion tool regardless of underlying belief.

This borders Vol 6, but it matters because perceived sincerity alters listener updates.

---

## 5. Public/private state model

A useful runtime separation:

```text
WorldState              # canonical facts
PublicClaimLedger       # who publicly claimed what, where, before whom
PrivateBeliefModel      # per-agent estimates about propositions
TrustRelation           # confidence in speaker across contexts
SuspicionModel          # local deception or concealment estimate
EvidenceLedger          # observations, contradictions, witness reports
AudienceScope           # who heard / saw / can later testify
```

This is the minimum needed to make deception matter mechanically without overcommitting.

Important principle:

> Public claims are canon as *claims*, not as facts.

That one distinction unlocks a large amount of usable design space.

---

## 6. Why witnesses matter

A deception system without witness modeling is usually too flat.

Witnesses affect:
- reputational stakes
- deniability
- memory spread
- later contradiction potential
- shame / face pressure
- commitment strength
- cost of backtracking
- strategic choice of wording

Example:
> “I never threatened him.”

This denial behaves differently if:
- there were no witnesses
- there were hostile witnesses
- there was one loyal witness
- the statement was made in formal record
- the target alone heard the original threat

A good engine should not need global omniscience. It needs an explicit **who knows what was publicly observable** layer.

---

## 7. Audience-split communication

This is one of the highest-value concepts in the whole volume.

A single utterance may target multiple audiences with different intended uptake.

Suggested representation:

```text
AudienceSplitIntent =
  primary_addressee_effect
  ally_effect
  witness_effect
  authority_effect
  deniable_literal
  coded_submessage
```

Example:
> “You should be careful traveling alone.”

Possible intended split:
- addressee: threat
- witnesses: generic concern
- ally: proceed with intimidation
- authority if quoted later: concern only
- literal deniable reading: travel advice

This is exactly the kind of thing human players and DMs handle constantly and unconsciously. An engine can handle it if public/private state and witness scope are explicit.

---

## 8. Bluffing as strategic uncertainty management

Bluffing deserves separate treatment from lying because it often concerns:
- hidden capabilities
- willingness to pay costs
- support from allies
- confidence under uncertainty
- commitment to future escalation

A bluff is often resolved not when spoken, but when:
- challenged
- called
- tested
- contradicted by evidence
- exposed by witness report
- made costly by scene protocol

That implies a design rule:

> Many bluff consequences should be deferred until challenge, evidence, or escalation, rather than immediately collapsed into true/false resolution.

Example:
- player claims noble backing
- NPC provisionally updates intimidation pressure
- later formal verification may expose the bluff
- current scene may still bend around the apparent claim

This allows bluffing to have tactical force without corrupting canon.

---

## 9. Suspicion, trust, and confidence updates

Listeners do not usually jump from “fully believes” to “knows this is a lie.”

More common dynamics:
- mild unease
- contradiction noted
- provisional acceptance
- trust decay
- context-specific suspicion
- increased attention to future claims
- changed willingness to risk action on the speaker’s word

Suggested derived variables:
- `credibility_estimate[speaker, domain]`
- `suspicion_estimate[speaker, proposition]`
- `confidence_in_claim`
- `exposure_risk`
- `witness_support`
- `reputational_stakes`

This creates room for meaningful uncertainty rather than binary truth labels.

---

## 10. Deception and common ground

Deceptive communication often tries to manipulate what enters common ground or appears to have entered it.

Examples:
- pretending a premise is shared
- forcing others to publicly act as though a proposition is accepted
- using loaded questions to make denial costly
- making a public statement so silence appears to ratify it
- implying facts while preserving literal innocence

This is where Vol 3 and Vol 5 interlock tightly.

A good engine distinguishes:
- asserted proposition
- presupposed proposition
- implicated proposition
- proposition treated as common ground by one party
- proposition actually accepted into common ground by the scene

This keeps manipulation legible and contestable.

---

## 11. Deception under scene protocols

Vol 4 matters here. The meaning and risk of deception changes by scene.

### 11.1 Bargaining
Common deceptive forms:
- bluffing alternatives
- pretending indifference
- fake scarcity
- fake deadlines
- selective warranty language

### 11.2 Interrogation
Common deceptive forms:
- evasions
- partial admissions
- memory fogging
- shifting referents
- demanding specificity to buy time

### 11.3 Court / hearing
Common deceptive forms:
- procedural framing
- witness pressure
- selective testimony
- technically truthful but misleading statements
- strategic objection timing

### 11.4 Ritual
Common deceptive forms:
- false piety
- unauthorized authority performance
- hidden impurity
- sacrilegious disguise of intent

### 11.5 Public rank scene
Common deceptive forms:
- false confidence
- overstated backing
- implied authority
- “I am only advising you” when actually threatening

So a deception packet should be filtered through scene protocol before consequences are finalized.

---

## 12. Repair, challenge, and exposure pathways

A deception system is only interesting if there are structured ways it can be challenged.

Common challenge forms:
- direct contradiction
- evidence reveal
- witness appeal
- clarification demand
- premise challenge
- forced restatement under stricter wording
- authority verification
- replay/quote back
- consistency test across turns

The engine should represent not only deceptive moves, but also **exposure triggers** and **repair opportunities**.

Suggested fields:
```text
challengeable_by[]
repair_routes[]
exposure_triggers[]
```

Example:
- bluff about noble rank
- challengeable by heraldic knowledge, witness testimony, seal inspection
- repair route: retreat into ambiguous phrasing
- exposure trigger: arrival at court registry

---

## 13. Deniability bands

Useful practical distinction:

```text
none
weak
moderate
strong
```

Examples:

- “I will kill you.” → `none`
- “Accidents happen.” → `moderate` or `strong`
- “Travel is dangerous at night.” said after refusal → likely `moderate`
- “You would be wise to reconsider.” in tense context → variable by scene

Deniability matters because it changes:
- sanction likelihood
- intimidation effectiveness
- repair options if challenged

---

## 14. Minimal runtime packet for deceptive moves

```text
public_claim
claim_type                 # assertion / threat / vow / denial / testimony / implication / omission
private_belief_estimate
intended_target_belief
audience_scope
audience_split_intent
deception_mode             # lie / bluff / omission / evasion / deniable_threat / false_presupposition / coded_signal
confidence_display
actual_confidence_estimate
deniability_band
witness_support
exposure_risk
challengeability
repairability
```

Optional:
- `evidence_dependencies`
- `future_verification_path`
- `reputational_stakes`
- `immediate_tactical_effect`

---

## 15. Engine pattern for Immortal

### Stage 1 — parse utterance
Produce candidate pragmatic packet:
- proposition
- force
- stance
- presuppositions
- target
- confidence
- possible deception modes

### Stage 2 — filter through scene protocol
Evaluate:
- is deceptive ambiguity legal here?
- does public witness magnify consequences?
- what challenge paths exist in this scene?
- what sanctions apply if exposed?

### Stage 3 — record public claim narrowly
Do **not** convert public claims into world facts.
Record:
- claim text/proposition
- speaker
- audience
- time
- confidence display
- challengeability

### Stage 4 — update listener models
Update:
- trust
- suspicion
- belief estimate
- fear/respect if bluff has force
- willingness to act on the claim

### Stage 5 — defer truth collapse when appropriate
Especially for:
- bluff
- implied threat
- hidden backing
- selective omission

### Stage 6 — narrate last
Narration expresses confidence, strain, menace, or smoothness, but does not secretly turn claims into facts.

---

## 16. Failure modes in deception handling

### 16.1 Claim/fact collapse
System treats every statement as world truth.

Result:
- bluffing impossible
- lies corrupt canon
- interrogation feels fake

### 16.2 No uncertainty state
System can only mark “believed” or “disbelieved.”

Result:
- no suspicion gradients
- no fragile provisional trust
- no later evidence drama

### 16.3 Witness blindness
System ignores who heard what.

Result:
- public/private distinction disappears
- deniability mechanics vanish

### 16.4 No audience split
System assumes one utterance has one intended meaning for all hearers.

Result:
- coded speech, veiled threats, and political language become impossible

### 16.5 Overeager lie detection
System decides too confidently that a line is deception despite weak evidence.

Result:
- characters feel omniscient
- adversarial ambiguity disappears
- tension collapses

### 16.6 No exposure pathways
Bluffs never get tested, or all are immediately resolved.

Result:
- no sustained strategic uncertainty

---

## 17. Evaluation questions

A deception subsystem is working if:

- public claims are recorded without becoming facts
- witnesses change outcomes
- players can bluff and be provisionally believed
- later exposure can reverse trust or status without corrupting past logs
- coded or deniable lines can affect one audience differently than another
- suspicion updates are graded rather than binary
- scene type changes the consequences of the same deceptive move
- paraphrases preserve the same structured public/private packet

Good tests:
- direct lie in private vs public
- bluff noble backing with and without witnesses
- issue deniable threat before authority
- make a technically true but misleading claim
- seed rumor through intermediary
- answer interrogation question evasively over several turns
- challenge a prior public statement with new evidence

---

## 18. Design recommendations

1. **Treat claims as claims.**  
   This is the master rule.

2. **Represent witnesses explicitly.**  
   Otherwise deniability and public reputation collapse.

3. **Separate bluff from lie.**  
   Bluff often concerns capability or commitment, not just fact.

4. **Track suspicion gradients.**  
   Most social inference is probabilistic, not binary.

5. **Make exposure procedural.**  
   Contradiction should arrive through evidence, witnesses, and verification, not omniscient narration.

6. **Allow multi-audience meaning.**  
   This is normal language behavior, not an edge case.

7. **Keep narration downstream.**  
   The prose may show a smooth smile or shaking hands; the canonical object is still the packet.

---

## 19. Relation to other volumes

- **Vol 2** supplies force, obligations, repair.
- **Vol 3** supplies implicature, presupposition, common ground.
- **Vol 4** supplies scene protocols and witness/publicity structure.
- **Vol 5** adds adversarial communication, deniability, and hidden-state belief management.
- **Vol 6** will convert outcomes into persistent relational changes: trust, fear, resentment, respect.

---

## 20. Design implications for Immortal

The highest-value architectural recommendation is:

> Introduce a `PublicClaimLedger` and keep it separate from `WorldState`.

That one choice enables:
- lies without canon corruption
- bluffing without magical truth
- witness-sensitive reputation
- retroactive contradiction
- contestable rumors
- evidence-driven reveals
- replayable social history

The second-highest recommendation is:

> Add audience-split and deniability fields to the pragmatic packet for high-stakes scenes.

This is likely more valuable than a generic “lie detector,” because it models what social language is actually doing.

The third recommendation is:

> resolve exposure and trust consequences through deterministic policy, not through narration mood.

That keeps the system replayable and prevents hidden model judgments from silently deciding who fooled whom.

---

## 21. References / precedent to mine

- Clark, H. H., and collaborators on **audience design**, **hearers and speech acts**, and **concealing meaning from overhearers**. Essential for multi-audience communication and deniable meaning.
- Fried et al. **Pragmatics in Language Grounding.** Useful umbrella framing for pragmatics that depends on social norms, task goals, and discourse context.
- Social deduction / Avalon / Werewolf / Blood on the Clocktower LLM research. Useful because these games stress-test hidden state reasoning, bluffing, trust, and strategic revelation timing.
- Recent bluffing/trust work in social deduction contexts. Useful for identifying where current models fail and why explicit state remains necessary.
- Grounding and dialogue management literature for challenge/repair pathways when deception or ambiguity is contested.

---

## 22. Working summary

The central lesson of this volume is:

> deception is a state-management problem, not just a language-style problem.

If the engine wants bluffing, rumors, deniable threats, selective truth, witness-sensitive testimony, and political conversation to matter, it should represent:

- public claim
- private belief estimate
- intended audience effects
- deniability
- suspicion
- witness scope
- exposure pathways

Then:
- update state deterministically
- allow challenge and evidence later
- generate phrasing last

That gives the system leverage without surrendering canon to freeform interpretation.
