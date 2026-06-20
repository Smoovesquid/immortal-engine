# Vol 3 — Implicature, Presupposition & Common Ground
**The Biblioteca — Volume 3**
**Subtitle:** *What a line imports, implies, assumes, and tries to place on the conversational record.*

> If Vol 2 asks **what act is being attempted?**, Vol 3 asks:  
> **What additional content rides along with that act, and what is the conversation now expected to treat as shared, contested, or merely suggested?**

---

## 0. Executive summary

Human dialogue carries more than explicit propositions. Speakers routinely:
- **imply** more than they say,
- **presuppose** background facts,
- **accommodate** unstated assumptions into the discourse,
- and negotiate a shifting body of apparently shared information called **common ground**.

For interactive systems, this is not an academic side issue. It determines whether the engine can handle:

- loaded questions,
- rumors and insinuations,
- accusations hidden inside presupposition,
- polite denials that still imply refusal,
- public speech that changes what witnesses treat as "on the record,"
- and manipulative dialogue that tries to smuggle claims into canon.

The practical design lesson is:

> **Separate asserted content, presupposed content, implicated content, and common-ground proposals.**

These are not the same thing and should not commit in the same way.

---

## 1. The four-way split the engine needs

A single utterance may contribute at least four distinct content layers.

### 1.1 Asserted content
What the speaker explicitly puts forward as the main point.

Example:
> "The captain stole the seal."

Asserted:
- captain stole the seal

### 1.2 Presupposed content
Background assumptions the utterance treats as already in place or taken for granted.

Example:
> "The captain stopped stealing from the treasury."

Presupposed:
- the captain used to steal from the treasury

Asserted:
- the captain no longer steals from the treasury

### 1.3 Implicated content
What the listener is invited to infer beyond what was said.

Example:
> "Some of the guards remained loyal."

Often implicated:
- not all of the guards remained loyal

### 1.4 Common-ground proposal
What the utterance is trying to place onto the conversational record as mutually available or mutually taken for granted.

Example:
> "As we both know, the duke never trusted priests."

This attempts to move "the duke never trusted priests" toward shared status, whether or not it deserves that status.

For an engine, collapsing these layers is dangerous. The same line can assert one thing, presuppose another, and implicate a third.

---

## 2. Why this matters for game logic

Without this split, the system will:
- accidentally canonize accusations hidden inside questions,
- let manipulative NPCs smuggle assumptions past the player,
- miss half the social payload of bargaining, rumor, and face-saving speech,
- and fail to distinguish **what is now true** from **what someone is trying to get everyone to treat as already true**.

### Canonical example
> "Have you stopped taking bribes?"

Possible layers:
- asserted: speaker asks whether bribery has ceased
- presupposed: addressee was taking bribes before
- force: question + accusation
- social effect: face threat, demand for defense
- common-ground pressure: attempts to make prior bribery discussable or assumed

A good engine should permit several lawful reactions:
- answer the surface question,
- reject the presupposition,
- demand evidence,
- object to the insult,
- answer partially while contesting premise,
- or refuse.

This is much richer than a naive Q/A model.

---

## 3. Implicature: meaning beyond what is said

The classic Gricean picture starts from the idea that listeners assume some degree of cooperativeness and infer extra meaning from how the speaker chose to speak.

### 3.1 Conversational implicature
Something suggested by the speaker's choice of utterance and context, but not literally stated.

Examples:
- "Some of them came." -> often implies not all
- "He has a nice handwriting." -> in a reference-letter context, may imply lack of stronger virtues
- "There's a tavern down the road." -> in response to "Where can we sleep?" may imply recommendation

### 3.2 Conventional implicature
Some expressions carry a conventional side-signal not identical to the main assertion.

Example:
> "She is poor but honest."

Asserted:
- she is poor
- she is honest

Conventionally implicated:
- poverty and honesty stand in some contrast or surprising relation

### 3.3 Why implicature matters computationally
Implicature is where:
- understatement,
- evasive answers,
- deniable threats,
- strategic omissions,
- and social nuance live.

A system need not solve all implicatures. But it should be able to represent when additional inferred meaning is likely and whether that meaning is strong enough to affect play.

---

## 4. Scalar implicature and choice among alternatives

One of the most useful operational cases is **scalar implicature**.

### 4.1 Basic pattern
If a speaker chooses a weaker term when a stronger one was available, listeners often infer the stronger one is not warranted.

Examples:
- some -> not all
- possible -> not certain
- warm -> not hot
- maybe -> not definitely

### 4.2 Game relevance
This matters in:
- testimony,
- clue interpretation,
- partial confessions,
- bargaining,
- military reports,
- rumor quality.

Example:
> "Some of the relics survived the fire."

Potential inference:
- not all survived

This should not auto-commit to canon as a hard fact. Instead, it should enter as an **implicated possibility with confidence**.

### 4.3 Runtime representation

```json
{
  "asserted": ["some_relics_survived"],
  "implicatures": [
    {
      "content": "not_all_relics_survived",
      "type": "scalar",
      "strength": 0.74,
      "cancelable": true
    }
  ]
}
```

Cancelable matters because implicatures are defeasible:
> "Some of the relics survived — in fact, all of them did."

---

## 5. Relevance, quantity, manner, relation

Grice's cooperative framing is often summarized with pressures such as:
- be sufficiently informative,
- be truthful,
- be relevant,
- be clear.

You do not need the philosophical machinery in full to get practical value from it. Computationally, the key idea is:

> **Listeners explain utterance choices by asking why this form was chosen here.**

That explains:
- why omission matters,
- why too-weak wording matters,
- why weirdly indirect wording signals social motive,
- why off-topic answers are interpreted as evasive or strategically meaningful.

### Example
Question:
> "Did you see the assassin?"

Answer:
> "I was at the market all morning."

Literal reply does not answer yes/no.  
Likely pragmatic reading:
- evasion,
- alibi offering,
- maybe implicit denial,
- maybe relevance challenge.

A deterministic engine can mark:
- answer status: nonresponsive / partial
- implied move: self-exculpation
- obligation status: original question still open

This is exactly the kind of layered handling Vol 2 and Vol 3 together make possible.

---

## 6. Presupposition: what the line takes for granted

Presuppositions are among the most important mechanisms for social manipulation and coherence.

### 6.1 Core idea
A presupposition is information treated as backgrounded or taken for granted rather than asserted as the main point.

Example:
> "Mara regrets betraying the temple."

Presupposed:
- Mara betrayed the temple

Asserted:
- Mara regrets it

### 6.2 Common triggers
Important trigger families include:

- **definite descriptions**  
  "the king", "her brother", "the real heir"

- **factive verbs**  
  know, realize, regret, discover, be aware

- **change-of-state verbs**  
  stop, continue, start, resume, return

- **iteratives / additives**  
  again, too, also

- **clefts and focus constructions**  
  "It was Jorin who opened the gate."

- **temporal clauses / subordinate clauses**  
  "Before she confessed..."

- **possessives / relational terms**  
  "his sword", "their alliance"

### 6.3 Why this matters in games
Presuppositions are how language tries to **sneak claims in sideways**.

Examples:
- "When did you start poisoning people?"
- "Why did the queen betray you again?"
- "Which of your accomplices opened the vault?"
- "Are you still taking orders from the bishop?"

A system that only sees the top-level interrogative misses the imported claim.

---

## 7. Presupposition failure, challenge, and accommodation

### 7.1 Failure
Sometimes the background assumption is not acceptable.

Example:
> "The king of Riverglass has returned."
If the game world has no king of Riverglass, the presupposition fails.

### 7.2 Challenge
A hearer may reject the presupposition directly:
- "I was never taking bribes."
- "What do you mean 'again'?"
- "I have no accomplices."
- "There is no treaty."

### 7.3 Accommodation
Sometimes listeners silently accept or provisionally incorporate the presupposition to keep the conversation moving.

Example:
> "Sorry I'm late — the stableboy lost the lantern again."
If nothing contradicts it, listeners may simply update:
- there is a stableboy
- he lost the lantern before

In games, accommodation is dangerous if it happens automatically for adversarial or high-stakes content. The engine should distinguish:

- low-stakes accommodation,
- provisional accommodation,
- contested background,
- blocked presupposition.

### 7.4 Suggested statuses

```json
{
  "presuppositions": [
    {
      "content": "target_previously_took_bribes",
      "status": "contested",
      "source": "change_of_state_trigger_stop",
      "public_visibility": "witnessed"
    }
  ]
}
```

---

## 8. Common ground: what the conversation treats as shared

Common ground is the evolving stock of information the participants are treating as mutually available for current discourse.

For engine design, the most useful simplification is:

> **Common ground is not all belief. It is the subset currently treated as on the conversational table as shared enough to build on.**

### 8.1 Why it matters
Common ground affects:
- reference resolution ("the relic" only works if salient),
- what counts as a contradiction,
- what presuppositions are licensed,
- what tone is insulting or absurd,
- what witnesses are presumed to know,
- and what later lines can invoke with "as we know..."

### 8.2 Common ground is dynamic
A conversation can:
- add to common ground,
- test it,
- fake it,
- contest it,
- narrow it for a subdialogue,
- or split it across audiences.

### 8.3 Useful engine distinction
Keep at least three layers distinct:
- **world truth / canon**
- **agent belief**
- **common ground / discourse record**

These should not collapse.

Example:
A liar tells the crowd "The gate is secure."
- world truth: false
- liar belief: maybe false
- crowd belief: maybe true
- public common ground: the statement is now on record as publicly asserted
- contested status: unresolved

That is dramatically richer and mechanically safer.

---

## 9. Assertion as proposal to update common ground

On a Stalnaker-style pragmatic view, an assertion proposes adding its content to the common ground if accepted.

That means an assertion is not identical to a world-state mutation. It is:
1. a move,
2. whose content may be accepted, contested, ignored, or suspended.

This is critical for game dialogue:
- an NPC saying "The prince is dead" should not automatically make it true,
- but it should change the discourse state and likely the beliefs of listeners.

Possible statuses:
- `asserted_uncontested`
- `asserted_contested`
- `asserted_ignored`
- `asserted_accepted_into_common_ground`
- `asserted_refuted`

This gives the engine a cleaner account of rumors, testimony, lies, and witness handling.

---

## 10. Loaded questions and imported accusations

Loaded questions are a high-value special case because they combine:
- force (question),
- presupposition,
- accusation,
- face threat,
- and often strategic deniability.

Examples:
- "Have you stopped cheating?"
- "Which one of you stole it?"
- "Why did you betray us?"
- "When were you planning to tell me?"

### 10.1 Why they are powerful
They pressure the addressee into choosing between:
- answering the surface question,
- rejecting the imported premise,
- or appearing evasive.

### 10.2 Engine handling pattern
A loaded question should produce at least:
- a `question` obligation,
- an embedded `presupposition`,
- often an `accusation` or `suspicion` social effect,
- and a legal response set that includes `challenge_presupposition`.

Example packet:

```json
{
  "primary_force": "question",
  "secondary_forces": ["accusation"],
  "presuppositions": [
    {
      "content": "addressee_was_taking_bribes",
      "status": "proposed_contestable"
    }
  ],
  "obligations_created": [
    {
      "holder": "addressee",
      "type": "respond_or_contest"
    }
  ]
}
```

This is one of the cleanest bridges from theory to engine rules.

---

## 11. Rumor, insinuation, and deniable content

Not all pragmatic payload is crisp implicature. Some speech aims to leave residue without fully committing.

Examples:
- "People are talking."
- "I would hate for anyone to misunderstand your relationship with the bishop."
- "Strange how often accidents happen around your ventures."
- "I never said she was a traitor."

These moves often:
- stop short of assertion,
- increase suspicion,
- seed possible common-ground drift,
- preserve deniability.

A useful runtime distinction:
- `asserted_fact`
- `implicated_content`
- `insinuated_content`
- `rumor_token`
- `reputational_shadow`

Not all of these should be truth-evaluable canon. But they should matter.

---

## 12. Cancellation and defeasibility

Implicatures are often **cancelable**.

Examples:
- "Some of the guards survived — in fact, all of them did."
- "He's an honest merchant, though of course that's not surprising."
- "If she has returned, which I doubt..."

This matters because:
- not every inference should harden into state,
- later speech can revise the pragmatic interpretation,
- a system should be able to downgrade or retract implicated content.

Recommended field:
- `defeasible: true/false`
- `cancellation_seen: true/false`
- `commitment_level: weak | moderate | strong`

Presuppositions are trickier: they can be challenged rather than simply canceled, but they also need status tracking rather than direct canonization.

---

## 13. Publicity and witness scope

Common ground is not always universal. In games, it is often **audience-scoped**.

Relevant scopes:
- private to speaker/hearer,
- local group,
- courtroom/public assembly,
- faction-specific,
- record-bearing institution,
- rumor network.

This matters because the same utterance can:
- create private suspicion,
- create public accusation,
- generate court-record implications,
- or split audience interpretations.

Suggested field:

```json
{
  "discourse_scope": "public_hearing",
  "witnesses": ["npc.guard.1", "npc.guard.2", "npc.merchant.4"]
}
```

Then:
- assertion may update public discourse record,
- presupposition challenge may save face publicly,
- implicature may spread socially even if never asserted.

---

## 14. Common ground vs belief vs canon

This distinction cannot be overstated.

### 14.1 Canon / world truth
What is actually true in the game state.

### 14.2 Belief state
What a given agent believes.

### 14.3 Common ground / discourse record
What participants are currently treating as shared enough for the conversation.

### 14.4 Why you need all three
Suppose a witness falsely claims:
> "The priest opened the vault."

Then:
- canon may remain unknown or false,
- witness belief may be sincere or deceptive,
- other listeners may or may not believe it,
- public common ground may now include that **this accusation was publicly made**,
- future references like "the vault incident" are now easier to invoke.

Without this separation, every rumor system becomes either mushy or unsafe.

---

## 15. A discourse ledger model

A practical implementation strategy is to treat discourse updates as ledger entries rather than direct truth writes.

### 15.1 Ledger entry types
- assertion proposed
- assertion accepted
- assertion contested
- presupposition introduced
- presupposition challenged
- implicature inferred
- implicature canceled
- topic made salient
- reference made public
- commitment made public
- rumor seeded
- clarification requested

### 15.2 Why ledgers help
They give you:
- replayability,
- inspectability,
- resistance to LLM drift,
- witness/publicity handling,
- and clean downstream logic.

Example:

```json
{
  "entry_id": "d_301",
  "turn": 44,
  "speaker": "npc.councilor",
  "type": "presupposition_introduced",
  "content": "player_has_secret_contact",
  "status": "contested",
  "scope": "public_council",
  "source_utterance": "When did you first begin meeting your contact?"
}
```

This is enormously helpful for social scenes.

---

## 16. Response patterns to presupposition and implicature

### 16.1 Responses to presupposition
- accept silently
- answer while accepting
- answer while disputing
- reject the presupposition directly
- demand clarification
- challenge legitimacy of question
- redirect to higher-level issue ("That is not the point")

### 16.2 Responses to implicature
- confirm
- deny
- strengthen
- cancel
- exploit ambiguity
- ignore
- meta-comment ("Don't put words in my mouth")

This gives the engine a more realistic response space than mere proposition-level contradiction.

---

## 17. Reference, salience, and common-ground maintenance

Common ground also governs **reference**:
- "the dagger"
- "that man"
- "your friend"
- "the real heir"

What makes these usable is not only world existence but discourse salience and shared recognition.

A deterministic engine should be able to say:
- referent resolved,
- referent ambiguous,
- referent not in common ground,
- referent exists but is not mutually identifiable.

This connects directly to repair:
- "Which dagger?"
- "Who do you mean by 'your friend'?"
- "There are two captains present."

Reference failures are often the earliest and safest clarification triggers.

---

## 18. The danger of automatic accommodation

Human conversation often smooths over presuppositions to stay efficient. Engines should be much more selective.

Automatic accommodation is risky when:
- the presupposition imports wrongdoing,
- the scene is adversarial,
- the statement is public and reputation-bearing,
- the content would meaningfully alter canon or social standing,
- the speaker is known to manipulate.

Better policy:
- **low-stakes mundane background**: allow easy accommodation
- **high-stakes adversarial background**: mark as proposed/contestable, not accepted
- **authority-bearing institutional speech**: treat with protocol-specific rules
- **player-facing loaded content**: surface challenge opportunity

This is one of the most important safeguards against accidental canon pollution.

---

## 19. Minimal pragmatic packet for implicature/presupposition/common ground

```json
{
  "utterance_id": "u_0140",
  "asserted_content": [
    "question_about_whether_bribes_have_stopped"
  ],
  "presuppositions": [
    {
      "content": "addressee_previously_took_bribes",
      "trigger": "stop",
      "status": "proposed_contestable",
      "scope": "public"
    }
  ],
  "implicatures": [
    {
      "content": "speaker_suspects_corruption",
      "type": "conversational",
      "strength": 0.83,
      "defeasible": true
    }
  ],
  "common_ground_effects": [
    {
      "type": "issue_made_salient",
      "content": "bribery_allegation",
      "status": "publicly_live"
    }
  ],
  "response_licenses": [
    "answer",
    "deny_presupposition",
    "challenge_question",
    "request_evidence",
    "refuse"
  ],
  "confidence": 0.87
}
```

This is inspectable, replayable, and much safer than flattening everything into one proposition.

---

## 20. Five-stage runtime pattern for Vol 3 phenomena

### Stage 1 — Parse explicit assertion and trigger candidates
Detect:
- presupposition triggers,
- scalar terms,
- focus constructions,
- additive/iterative markers,
- obviously relevant omissions,
- common-ground phrases ("as we know", "again", "still")

### Stage 2 — Generate bounded pragmatic hypotheses
Candidate outputs:
- presupposition list,
- implicature list,
- salience/common-ground proposals,
- confidence and defeasibility tags.

### Stage 3 — Constrain by scene, stakes, and trust
Use:
- current mode,
- adversarial/cooperative context,
- audience scope,
- prior contested topics,
- known manipulation tendency,
- witness presence.

### Stage 4 — Commit narrowly
Write to discourse ledger:
- proposed presupposition,
- open challenge opportunity,
- implicated possibility,
- public salience tag,
- not raw world truth unless independently warranted.

### Stage 5 — Narrate
Realize the conversation in dialogue or summary form, downstream of ledger state.

---

## 21. Failure modes in existing systems

### 21.1 Presupposition collapse
System treats all imported assumptions as truth.

### 21.2 Literalism
System answers the surface question while ignoring the accusation inside it.

### 21.3 No distinction between rumor and fact
Public allegation immediately mutates canon.

### 21.4 No common-ground model
Characters refer to entities or assumptions with no shared salience.

### 21.5 No cancelability handling
Implicatures become permanent state despite later explicit cancellation.

### 21.6 No scope model
Private insinuation and public accusation have identical effects.

### 21.7 No contestability status
Imported assumptions cannot be challenged cleanly.

These failures make social dialogue feel simultaneously brittle and incoherent.

---

## 22. Design implications for Immortal

### 22.1 Add a discourse ledger distinct from canon
Not everything spoken is a world-state write. Many things are discourse objects.

### 22.2 Promote presupposition and implicature into typed packet fields
At minimum:
- `asserted_content`
- `presuppositions`
- `implicatures`
- `common_ground_effects`
- `contestability`
- `scope`

### 22.3 Loaded questions deserve first-class handling
This is too common and too valuable to leave implicit.

### 22.4 Make common-ground updates explicit and scoped
Private, local public, institutional public, factional public.

### 22.5 Strongly limit automatic accommodation
Especially for hostile, manipulative, or reputationally dangerous content.

### 22.6 Preserve defeasibility
Do not harden implicatures into canon without corroboration or acceptance.

### 22.7 Let NPCs contest premises, not only answers
This is crucial for believable social resistance.

---

## 23. Minimal schema target

```ts
type PresuppositionStatus =
  | "licensed"
  | "proposed_contestable"
  | "accepted"
  | "contested"
  | "blocked";

type ImplicatureType =
  | "scalar"
  | "relevance"
  | "manner"
  | "quantity"
  | "conventional"
  | "insinuation"
  | "other";

type PragmaticImportPacket = {
  utteranceId: string;
  assertedContent: string[];
  presuppositions: {
    content: string;
    trigger: string;
    status: PresuppositionStatus;
    scope: "private" | "local_public" | "broad_public";
  }[];
  implicatures: {
    content: string;
    type: ImplicatureType;
    strength: number;
    defeasible: boolean;
    canceled?: boolean;
  }[];
  commonGroundEffects: {
    type:
      | "proposal_add"
      | "salience_raise"
      | "public_record"
      | "issue_live"
      | "shared_assumption_claim";
    content: string;
    status: "proposed" | "accepted" | "contested";
  }[];
  responseLicenses: string[];
  confidence: number;
};
```

This does not claim to solve all pragmatics. It gives the engine a lawful place to put the important parts.

---

## 24. Worked examples

### A. "Have you stopped stealing from the shrine?"
- asserted: question about cessation
- presupposed: addressee stole from shrine before
- force: question + accusation
- common-ground effect: theft allegation now live
- legal responses: answer / deny premise / demand proof / object / refuse

### B. "Some of the guards remained loyal."
- asserted: at least some loyal
- implicated: not all loyal
- common-ground effect: loyalty fracture becomes salient
- commit policy: implication stays defeasible

### C. "The queen regrets exiling your father."
- asserted: queen regrets
- presupposed: queen exiled your father
- social effect: acknowledgment of wrongdoing may repair relation if accepted

### D. "As we both know, the treaty was always a sham."
- asserted: treaty was a sham
- common-ground proposal: speaker claims shared view
- manipulative move: attempts to skip contest stage by invoking false sharedness

### E. "There's a monastery on the hill."
Context: asked where to hide for the night.
- asserted: monastery exists on hill
- implicated: monastery may provide shelter
- possible relation effect: helpfulness

---

## 25. A practical policy matrix

| Phenomenon | Safe default |
|---|---|
| ordinary assertion | add to discourse record as asserted; not truth until accepted/evidenced if stakes matter |
| low-stakes presupposition | allow provisional accommodation |
| hostile loaded question | mark presupposition contestable; do not auto-accommodate |
| scalar implicature | keep defeasible and weak-to-moderate |
| rumor/insinuation | create reputational/suspicion state, not truth |
| public allegation | public discourse record + witness updates |
| canceled implicature | retract or downgrade inference |
| false sharedness ("as we know") | common-ground proposal, not auto-shared fact |

This table alone can prevent many coherence failures.

---

## 26. Relationship to other volumes

- **Vol 2** gives the act/force layer.
- **Vol 3** gives the imported-content layer.
- **Vol 4** will make common ground and presupposition scene-relative through social practices.
- **Vol 5** will add deception, deniability, and audience split.
- **Vol 8** should test paraphrase invariance and contestability handling for all of the above.

In practice, the most valuable combined packet will likely be:
- proposition
- force
- stance
- presuppositions
- implicatures
- common-ground deltas
- response licenses
- confidence

That is a tractable, inspectable substrate for "social physics."

---

## Appendix A — Minimal discourse ledger sketch

```json
[
  {
    "entryType": "assertion_proposed",
    "content": "captain_took_bribes",
    "speaker": "npc.merchant",
    "scope": "public_market",
    "status": "contested"
  },
  {
    "entryType": "presupposition_introduced",
    "content": "captain_took_bribes_before",
    "speaker": "player",
    "sourceTurn": 82,
    "status": "challenged"
  },
  {
    "entryType": "implicature_inferred",
    "content": "not_all_guards_loyal",
    "sourceTurn": 83,
    "strength": 0.74,
    "defeasible": true
  }
]
```

---

## Appendix B — Questions worth asking before committing a pragmatic import

- Is this content asserted, presupposed, implicated, or merely hinted?
- Who is expected to accept it?
- Is it contestable right now?
- What is the audience scope?
- Is it low-stakes enough to accommodate?
- Would auto-committing it pollute canon?
- Is the content defeasible or cancelable?
- Should this affect world truth, belief, discourse record, or only salience?

If these questions are explicit, the system will make far fewer "social hallucinations."

---

## Appendix C — Select bibliography / starting points

### Foundational theory
- Grice, H. P. "Logic and Conversation." In *Syntax and Semantics 3: Speech Acts*, 1975.
- Stalnaker, Robert. "Pragmatic Presuppositions." In *Context and Content*, 1974/1978 and later collections.
- Levinson, Stephen C. *Pragmatics*. Cambridge University Press, 1983.
- Gazdar, Gerald. *Pragmatics: Implicature, Presupposition, and Logical Form*. Academic Press, 1979.

### Reference entries / accessible syntheses
- Stanford Encyclopedia of Philosophy — "Implicature"
- Stanford Encyclopedia of Philosophy — "Presupposition"
- Stanford Encyclopedia of Philosophy — "Common Ground in Pragmatics"

### Common ground, grounding, discourse
- Clark, Herbert H. *Using Language*. Cambridge University Press, 1996.
- Clark, Herbert H. "Grounding in Communication." 1991.
- Clark, Herbert H., and Edward F. Schaefer. "Contributing to Discourse." *Cognitive Science* 13(2), 1989.

### Computational and modern relevance
- Traum, David R. "Discourse Obligations in Dialogue Processing." ACL, 1994.
- PUB benchmark papers on pragmatics understanding for LLMs.
- Recent work on pragmatic understanding / implied meaning benchmarks.

### Game/system-relevant precedents
- Ryan et al. on *Talk of the Town* dialogue moves, obligations, and topics.
- Vol 1 references on Façade, Versu, believable/social agents.

---

## Closing note

Vol 3's narrow practical claim is this:

> The engine should not ask only "what was said?"  
> It should ask "what was asserted, what was imported, what was implied, and what is now on the record?"

That is the difference between a dialogue system that merely paraphrases conversation and one that can **reason about social meaning without letting that meaning leak recklessly into canon**.
