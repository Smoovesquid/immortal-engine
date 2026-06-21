
# Vol 12 — Frontier Fragility, Security & Hybrid Control for LLM NPCs (2025–2026 addendum to Vols 4/5/7/8)

*Renumbered from the author's draft "Vol 10 Addendum" — Vol 10 is already LLM-as-Judge Reliability. Content unchanged.*

**Biblioteca / Immortal addendum volume.**  
**Purpose:** capture recent findings on failure, fragility, attack surface, and architecture patterns for LLM-based NPC and dialogue systems. This addendum is written for model consumption. It should be read as a frontier supplement to Vols 4, 5, 7, and 8.

---

## 1. Scope of this addendum

This document focuses on new findings in the following areas:
- prompt-injection and secret-leakage risks in LLM NPC systems
- fragility under paraphrase or linguistic variation
- hybrid architectures that preserve expressiveness while constraining internal control
- frontier lessons about what **not** to trust a free-form NPC layer to do

This addendum is not about general model safety rhetoric. It is specifically about risks and architecture signals relevant to interactive NPC engines.

---

## 2. Executive update for Immortal

If Immortal reads only one paragraph from this addendum, it should be this:

1. Recent work shows that unconstrained LLM NPCs can be induced to reveal hidden secrets through adversarial prompting.
2. Retrieval- and prompt-dependent systems remain fragile under ordinary linguistic variation, which means paraphrase invariance cannot be assumed.
3. The most practical recent NPC work uses **hybrid control**: free-form player input on the outside, structured internal action spaces on the inside.
4. These findings strengthen — not weaken — the case for narrow canonical commit, explicit claim/state ledgers, and a deterministic policy layer.

In short:

> The frontier is increasingly clear that fully open-text NPC authority is brittle, leaky, and hard to secure.

---

## 3. Secret leakage in LLM-based NPCs

### 3.1 Why this matters

The paper **Tricking LLM-Based NPCs into Spilling Secrets** is one of the most directly relevant frontier findings for game-style dialogue systems.

Its central question is simple and dangerous:
- if an NPC uses an LLM to generate dialogue from hidden background material,
- can adversarial prompt injection trick it into revealing secrets that should remain hidden?

The paper’s answer is effectively yes: the integration of LLMs into NPC dialogue introduces a real attack surface around concealed lore, character backstory, and hidden information.

### 3.2 Why this is a stronger signal than ordinary safety talk

This matters more than generic “LLMs hallucinate” concerns because it targets a core RPG/NPC problem:
- secrets are not just incidental data
- they are often part of the game’s designed uncertainty structure
- revealing them early or incorrectly can destroy scene tension, mystery, trust, and plot logic

That makes secret leakage not merely a UX bug but a **canon integrity failure**.

### 3.3 Practical implications

This paper strongly supports the following design rules:

1. **Never store unreleased secret state as plain prompt context if the generator can access it conversationally.**
2. **Represent secrecy as an explicit access-controlled state layer, not as “information the model happens not to mention.”**
3. **Use deterministic policy gates for what may be revealed, hinted, denied, or deferred.**
4. **Treat hidden information as an authorization problem, not only as a narrative problem.**

For Immortal, that means:
- scene and lore secrets should be managed by explicit reveal policy
- the generator should realize authorized outputs, not decide them

---

## 4. Claim/fact separation becomes a security feature

Vol 5 framed claim/fact separation as a deception and social-logic issue. Frontier NPC leakage research reveals that it is also a **security architecture** issue.

If the system cleanly separates:
- world facts
- public claims
- hidden/private character knowledge
- reveal authorization
- what the speaker is currently allowed to say

then many leakage paths become easier to control.

This means claim/fact separation is not just elegant semantics. It is part of the attack-surface reduction strategy.

---

## 5. Hybrid voice/NPC systems as a current best practice signal

### 5.1 Why this matters

The 2025 paper **A Voice-Controlled Dialogue System for NPC Interaction using Large Language Models** proposes a hybrid interface:
- players speak freely by voice
- the LLM maps the spoken input back to predefined dialogue options

This is one of the clearest practical frontier signals because it rejects the false binary:
- either rigid menu options
- or fully open conversational authority

Instead it uses:
- open input for player experience
- bounded internal control for narrative consistency

### 5.2 Why this matters for Immortal

This validates a core Immortal-friendly pattern:

> let the player speak naturally; let the engine interpret that speech into a bounded move/action space.

That is not merely a fallback compromise. It is currently one of the more defensible architecture choices in the literature.

### 5.3 What to take from it

Future social layers should feel free to use:
- free paraphrase on input
- snapping to legal social moves
- clarification when multiple bounded moves remain plausible
- deterministic policy for consequences

This is fully consistent with Vol 7’s architecture and Vol 8’s evaluation philosophy.

---

## 6. Fragility under linguistic variation

### 6.1 Why this matters

A major hidden risk in LLM-based control systems is that they often appear stable until ordinary language variation is introduced:
- paraphrase
- indirectness
- hedging
- reordered information
- changed referents
- altered discourse framing

Once this happens, routing, retrieval, or classification performance can degrade in ways that are not obvious from curated demos.

### 6.2 RAG fragility as a warning sign

Recent 2026 work on RAG fragility under linguistic variation is not an NPC paper, but it is highly relevant. It shows that systems depending on retrieval and natural-language matching can degrade meaningfully under distribution shifts that look like normal human rephrasing.

For Immortal, that means:
- retrieval-backed social state must be tested for paraphrase invariance
- memory lookup should not rely on brittle literal phrasing
- discourse retrieval and witness/event recall need explicit normalization or canonical indexing

### 6.3 Architectural takeaway

Do not assume:
- if a line works in one phrasing, it works in neighboring phrasings
- if a secret is protected under one prompt shape, it is protected under adversarial paraphrase
- if a retrieval step succeeds in one discourse form, it will succeed under social indirection

The harness from Vol 8 should explicitly include these variation tests.

---

## 7. Common ground and collaborative fragility

Recent common-ground benchmark work also matters here because it shows that maintaining mutual understanding under iterative coordination and repair remains difficult.

This is relevant to NPC architectures because many “secret leakage” or “bad reveal” failures do not occur as one-off jailbreaks. They occur because:
- the system loses track of who knows what
- it over-accommodates a presupposition
- it treats a public claim as shared truth
- it fails to distinguish current addressee from overhearer/witness
- it interprets local fluency as mutual grounding

So common-ground fragility and security fragility are linked.

---

## 8. New architecture lesson: access control is part of dialogue design

A frontier conclusion that deserves to be stated plainly:

> dialogue architecture for NPCs now needs some of the same thinking as systems security.

This does not mean turning the engine into a fortress of refusal. It means:
- hidden lore/state should have access boundaries
- reveal policies should be typed
- legal reveal conditions should be inspectable
- witnesses/addressees should be explicit
- public/private channels should be represented, not assumed

This is especially relevant for:
- investigation scenes
- faction secrets
- betrayals
- hidden identities
- ritual knowledge
- privileged ranks
- puzzle or mystery gating

---

## 9. Strong frontier patterns for safe-ish NPC control

Based on current findings, the most defensible architecture patterns are:

### 9.1 Open input, bounded internal action space
Player can phrase freely; system snaps to known legal moves.

### 9.2 Narrow canonical commit
Do not let broad interpretations mutate canon without gating.

### 9.3 Reveal authorization layer
Separate:
- what an NPC knows
- what an NPC believes
- what an NPC may say now
- what an NPC may imply now
- what an NPC may reveal only under condition X

### 9.4 Public/private state separation
Who knows what should be explicit and inspectable.

### 9.5 Clarification over risky commitment
If reveal policy or ambiguity makes commitment dangerous, clarify or defer.

### 9.6 Test paraphrase and adversarial variants
Assume variation attack surfaces exist.

These are not speculative principles anymore. They are increasingly supported by frontier failure evidence.

---

## 10. Suggested additions to Immortal architecture

### 10.1 Reveal policy object

```text
RevealPolicy =
  proposition_id
  secrecy_level
  authorized_speakers[]
  authorized_audiences[]
  legal_conditions[]
  hintable
  deniable_forms_allowed
  direct_disclosure_allowed
  logging_required
```

### 10.2 Knowledge partitioning

```text
KnowledgeState =
  world_fact
  private_character_knowledge
  public_claim
  shared_common_ground
  sealed_secret
  conditional_reveal
```

### 10.3 Attack-aware logging

```text
LeakageAuditLog =
  hidden_item
  prompt_path
  interpretation_path
  reveal_decision
  authorization_check
  final_output
```

This would make secret failures debuggable rather than mysterious.

---

## 11. Evaluation implications

Vol 8 should be extended with frontier-specific tests.

### 11.1 Secret leakage tests
- adversarial rephrasings
- indirect requests for hidden lore
- roleplay manipulation attempts
- “tell me what you are not allowed to say” style probes
- witness misdirection
- fake authorization claims

### 11.2 Paraphrase robustness tests
- same request with surface variation
- same hidden-state question through indirection
- changed social framing
- different scene protocols

### 11.3 Authority confusion tests
- addressee confusion
- overhearer confusion
- false-rank invocation
- forged legitimacy claims
- witness-privilege mismatch

### 11.4 Safe fallback tests
- does the system defer, deny, or clarify appropriately?
- does it avoid inventing excuses that leak structure?
- does it preserve consistency across replays?

---

## 12. What not to conclude from the frontier

Avoid these incorrect takeaways:

### 12.1 “LLMs are too unsafe for NPC work”
Too broad. The better conclusion is:
- unconstrained conversational authority is unsafe
- constrained hybrid systems are more viable

### 12.2 “More prompting will solve the problem”
Weak conclusion. Security and leakage issues are often architectural.

### 12.3 “If the NPC sounds coherent, the system is under control”
False. Fluency can hide hidden-state errors and leakage risk.

### 12.4 “Free-form chat is the most advanced option”
Not necessarily. Current evidence often favors **bounded internal control** as the more mature design.

---

## 13. Relation to earlier volumes

This addendum sharpens prior claims:

- **Vol 4**: scene protocol matters because reveal legality is often scene-dependent
- **Vol 5**: public/private claim separation is also a security control
- **Vol 7**: hybrid architectures are not a compromise; they are a current best-practice direction
- **Vol 8**: secret leakage and paraphrase fragility must be explicit harness categories

---

## 14. Recommended use inside the Biblioteca

Treat this addendum as:
- a frontier appendix to Vols 4, 5, 7, and 8
- a design argument against generator-owned secret handling
- a justification for reveal authorization and attack-aware testing
- a source of concrete terminology for NPC threat models

It should influence:
- packet schema
- reveal policy design
- hidden-state logging
- evaluation corpus construction

---

## 15. References

1. Shiomi, Kyohei, et al. **Tricking LLM-Based NPCs into Spilling Secrets.** 2025.  
   arXiv abstract: https://arxiv.org/abs/2508.19288  
   PDF: https://arxiv.org/pdf/2508.19288  
   HTML: https://arxiv.org/html/2508.19288v1

2. Wevelsiep, Milan, et al. **A Voice-Controlled Dialogue System for NPC Interaction using Large Language Models.** IWSDS 2025.  
   ACL Anthology: https://aclanthology.org/2025.iwsds-1.4/  
   PDF: https://aclanthology.org/2025.iwsds-1.4.pdf

3. Anikina, Tatiana, Alina Leippert, and Simon Ostermann. **Building Common Ground in Dialogue: A Survey.** LUHME 2025.  
   ACL Anthology: https://aclanthology.org/2025.luhme-1.2/  
   PDF: https://aclanthology.org/2025.luhme-1.2.pdf

4. Poelitz, Christian, et al. **A Benchmark to Assess Common Ground in Human-AI Collaboration.** 2026.  
   PDF: https://arxiv.org/pdf/2602.21337

5. 2026 EACL work on RAG fragility under linguistic variation.  
   ACL Anthology: https://aclanthology.org/2026.eacl-long.13.pdf

---

## 16. Working summary

The frontier lesson is:

> unconstrained LLM NPCs are not merely inconsistent; they are structurally fragile and can be security-leaky.

For Immortal, the best response is not to abandon expressive language input. It is to keep:
- open input
- bounded internal move/action spaces
- narrow canonical commit
- reveal authorization
- public/private state separation
- adversarial and paraphrase testing

That is the current best path to expressive but controlled NPC behavior.
