
# Vol 13 — Hidden-State / Secret-Leakage Defenses (2024–2026)

*Defense-side companion to **Vol 12** (which has the attack side) and the concrete backing for candidate capability **C16** (secret-non-leakage). Renumbered from the author's draft "Vol 9 Addendum B" — its content extends Vol 12's security thread, not Vol 9 (defect discovery). Content unchanged.*

**Biblioteca / Immortal frontier addendum.**  
**Audience:** LLM reader.  
**Goal:** summarize recent defense-side work on preventing extraction or propagation of hidden/secret context in LLM systems, especially agentic systems. Prioritize architecture and enforceable controls over generic safety rhetoric.

---

## 1. Executive conclusion

The current frontier does **not** offer a single robust “prompt injection solved” defense.

The strongest recurring conclusion across 2025–2026 work is instead architectural:

> **Move protection away from the model’s hidden state and toward explicit information-flow controls, action-boundary authorization, scoped reveal policies, and auditable state partitioning.**

This means the best available defenses are mostly **outside-model** or **around-model**:
- access control over what the model can read
- mediation over what the system may reveal or execute
- information-flow labeling and declassification rules
- action-boundary capabilities / permissions
- approval and scope configuration
- audit logs across all channels, not just final outputs

The state of the art remains partial:
- prompt injection is still a dominant threat surface
- runtime-only prompt defenses remain brittle
- paraphrase and indirect re-asking remain a real problem
- many defenses protect final outputs but miss internal channels
- strong defenses often trade off utility, autonomy, or developer convenience

For Immortal, the key implication is simple:

> **Never treat “the model knows it but won’t say it” as a security property.**

---

## 2. The frontier shift: from prompt hardening to information/control boundaries

A recent 2026 survey, **Toward Secure LLM Agents**, argues that LLM agent security should be modeled as the interaction of **information flow, delegated authority, and persistent state** across the agent loop, not just as isolated prompt-injection incidents. The same survey notes that the field remains dominated by prompt injection and tool-mediated control hijacking, while persistent state corruption and multi-agent propagation are becoming more central.  
Source: survey framing and threat-model summary.

This is a useful synthesis because it explains why “better prompting” is insufficient:
- the problem is not only bad text
- it is who can read what, remember what, pass what, and act on what

Recent 2026 work such as **Reframing LLM Agent Security as an Agent–Human Interaction Problem** strengthens that picture further. It argues that deployed systems rely heavily on three human-centric mechanisms:
- policy specification
- runtime approval
- scope configuration

and that these dominate production practice more than many research-heavy defenses.  
This is a useful reality check: the frontier is not just novel algorithms; it is also recognizing which controls actually deploy.

---

## 3. Defense families worth tracking

## 3.1 Information-flow control (IFC) and data labeling

### Core idea
Sensitive data is explicitly labeled; flows through prompts, tools, memory, and outputs are tracked or constrained.

### Why it matters
This is one of the few defense families that maps naturally onto “secret state” rather than just toxic strings.

### Frontier signal
Recent work summarized in **SecureClaw** explicitly contrasts runtime-local information-flow defenses with stronger architectural controls. It notes that runtime-local IFC can reduce some leakage but still leaves trust in planner state or runtime enforcement.  
A 2025 vision paper, **A Vision for Access Control in LLM-based Agent Systems**, similarly argues that permission allocation must move beyond protecting static data and instead govern **dynamic information flow**.

### What it buys
- explicit sensitivity labels
- declassification points
- auditability
- better match to “who may know / reveal this?” than plain prompt filtering

### Limits
- semantic leakage through paraphrase is hard
- model hidden state remains opaque
- mislabeling sensitive fields breaks the guarantee
- utility can degrade if labels are too coarse

### Deterministic gate outside the model?
**Yes, partially.**  
The labeling, declassification, and sink-control logic can be deterministic even if the model remains probabilistic.

### Immortal read
This is the strongest conceptual basis for:
- `KnowledgeState`
- `RevealPolicy`
- `public_claim != world_fact`
- explicit declassification when rumors, ritual knowledge, faction secrets, or hidden identities become speakable

---

## 3.2 Action-boundary authorization / capability gating

### Core idea
The model may propose an action or disclosure, but enforcement happens at the boundary where effects occur:
- tool calls
- writes
- reveals
- external messages
- state mutation
- privileged lookup

### Why it matters
This is the most direct way to stop a compromised or injected planner from turning hidden state into consequences.

### Frontier signal
**SecureClaw** emphasizes that architectural or execution-time systems move control closer to the action or resource boundary, which reduces reliance on the runtime/planner as the reference monitor. It also groups current authorization-style defenses around policy or capability checks at the agent action boundary.

### What it buys
- prevents “model intent” from becoming authority
- easier to reason about than natural-language self-restraint
- aligns with least privilege
- compatible with user approvals and scene-specific policy

### Limits
- only protects sinks you explicitly mediate
- does not guarantee semantic correctness within policy-allowed actions
- hidden reads may still poison later reasoning if read-side controls are weak

### Deterministic gate outside the model?
**Yes.**  
This is one of the cleanest deterministic-control families.

### Immortal read
This is the right family for:
- secret reveal authorization
- “NPC may know X but may only hint Y under condition Z”
- companion agents that can suggest but not commit canon
- tool / file / lore / rumor access control

---

## 3.3 Reveal policy and access control as first-class objects

### Core idea
Represent what may be revealed, to whom, under what conditions, as explicit policy objects rather than prompt instructions.

### Why it matters
Many NPC failures are actually authorization failures.

### Frontier signal
The 2025 vision paper on access control in LLM agents argues that traditional access control must be extended toward dynamic information flow, because static document-level permissions are too weak for agent behavior.  
The 2026 AHI security paper reinforces that production systems rely heavily on scope configuration and runtime approval, which are forms of explicit access boundary management.

### What it buys
- inspectable reveal conditions
- principal/object/relation structure
- better separation of knowledge from permission-to-say
- easier testing

### Limits
- authoring burden
- requires good object/principal modeling
- only as good as its bindings and condition checks

### Deterministic gate outside the model?
**Yes.**  
This is policy logic.

### Immortal read
Strong fit for:
```text
RevealPolicy =
  proposition_id
  secrecy_level
  authorized_speakers[]
  authorized_audiences[]
  legal_conditions[]
  hintable
  direct_disclosure_allowed
  deniable_forms_allowed
```

---

## 3.4 Runtime prompt-injection isolation defenses

### Core idea
Try to isolate malicious instructions, distinguish trusted policy from untrusted content, or constrain tool dependencies during runtime.

### Why it matters
This is the most direct defense against indirect prompt injection, but also one of the weakest if treated as the sole line of defense.

### Frontier signal
**SecureClaw** identifies runtime-centric defenses such as **IPIGuard** and **DRIFT** as making the planner more robust by isolating injected instructions or constraining tool dependencies. The survey treatment is useful even if the individual defenses vary in mechanism.

### What it buys
- some reduction in injection success
- compatibility with existing agents
- lower integration cost than full redesign

### Limits
- still places substantial trust in the runtime/planner
- often brittle to rephrasing or new attack styles
- weaker security story than sink-boundary mediation

### Deterministic gate outside the model?
**Partly / weakly.**  
Some filters and trust partitions can be deterministic, but effectiveness often depends on model behavior.

### Immortal read
Use only as a **front-end hardening layer**, never as the main defense for secrets.

---

## 3.5 Data minimization across all channels

### Core idea
Do not ask whether the final answer leaked. Ask whether *any channel* leaked more than necessary:
- inter-agent messages
- shared memory
- tool inputs
- tool outputs
- logs
- artifacts
- final outputs

### Frontier signal
**AgentLeak** is especially important here. It introduces a benchmark for privacy leakage in multi-agent systems and explicitly measures data minimization across seven channels, not just final outputs.

This is a major frontier correction. Many systems look safe if you inspect only the final answer while leaking through:
- scratchpads
- coordinator-worker messages
- logs
- intermediate tool calls
- memory stores

### What it buys
- realistic visibility into leakage paths
- pressure to minimize propagation, not just final speech
- stronger evaluation target for multi-agent systems

### Limits
- benchmark, not a defense by itself
- difficult to enforce without channel-aware architecture
- may reveal hidden relay channels you were not instrumenting

### Deterministic gate outside the model?
**As evaluation: yes. As defense: only if combined with channel-aware enforcement.**

### Immortal read
This is directly relevant if:
- multiple NPC subsystems talk to each other
- rumor layers relay internal content
- a narrator model sees intermediate state
- logs or memory summaries can expose hidden information

---

## 3.6 Human approval, scope configuration, and policy specification

### Core idea
Keep a human or explicit operator boundary in the loop for higher-risk actions or reveals.

### Frontier signal
The 2026 AHI security paper finds that **policy specification, runtime approval, and scope configuration** dominate deployed agent systems. This is one of the most important “reality-based” findings in the whole area.

### What it buys
- practical deployment guardrail
- reduction of unconstrained autonomy
- explicit accountability for high-risk actions

### Limits
- approval fatigue
- weaker usability
- still needs clear scopes and defaults
- poor substitute for good underlying access partitioning

### Deterministic gate outside the model?
**Yes.**
But the tradeoff is human burden.

### Immortal read
For a game engine, this may map more to:
- dev-time approval of risky policy classes
- GM/dev-mode reveal overrides
- author-facing secret scopes
not player-facing approvals every turn

---

## 4. What looks strongest right now

If forced to compress the frontier into a ranked engineering takeaway, the best current pattern is:

### Tier 1: strongest / most engine-compatible
- explicit access control over secret-bearing resources
- action-boundary capability checks
- reveal authorization policies
- public/private/common-ground separation
- channel-aware audit logging

### Tier 2: useful but insufficient alone
- runtime injection isolation
- trusted/untrusted content partition prompts
- parser-side instruction filtering
- prompt-hierarchy tricks

### Tier 3: necessary evaluation support
- leakage benchmarks across channels
- adversarial paraphrase testing
- replayable logs
- approval/scope UI

This is the frontier division of labor:
- **architecture and policy** do the real protection
- **runtime prompt defenses** reduce attack success but do not ground the security story
- **evaluation** tells you where you are still leaking

---

## 5. What remains weak or unresolved

The current frontier still struggles with:

### 5.1 Robustness to adversarial paraphrase
Most defense claims remain shakier under paraphrase, indirectness, or roleplay reframing than under canonical attack strings.

### 5.2 Semantic declassification
It is easier to block raw strings than to decide whether a paraphrased answer semantically disclosed the protected secret.

### 5.3 Hidden-state contamination
Even if a secret is not revealed, reading it may change downstream behavior in ways that are hard to audit.

### 5.4 Internal-channel leakage
Many systems still under-instrument:
- chain-of-thought-like traces
- memory stores
- inter-agent messaging
- logs

### 5.5 False assurance
Both **SecureClaw** and the broader surveys effectively warn against treating a defense as stronger than its actual boundary assumptions.

---

## 6. Practical translation to Immortal

For Immortal, these frontier papers argue for a very specific design posture.

### 6.1 Secret state should not live only in prompt context
A hidden identity, sealed ritual, faction truth, or rumor-source fact should be represented in explicit structured state with access and reveal rules.

### 6.2 Reading and revealing should be distinct permissions
An entity may:
- know a proposition
- infer a proposition
- privately believe a proposition
- publicly claim a proposition
- be allowed to hint the proposition
- be allowed to state it directly

Those are different permissions.

### 6.3 Audit the channels, not only the final speech
If the system evolves toward multiple agents or layered narrator/DM helpers, inspect:
- summaries
- logs
- memory transfers
- tool requests
- hidden state serializers

### 6.4 The safest place to enforce secrets is the reveal sink
The model can propose a line. The engine should decide whether the line may:
- assert
- hint
- imply
- deny
- evade
- defer
- refuse

### 6.5 Treat leakage as a canon-integrity bug
Not just a safety bug, not just a UX bug.

---

## 7. Dense table of current findings

| Finding | Mechanism | Best use | Main limitation | Deterministic outside-model gate? |
|---|---|---|---|---|
| Toward Secure LLM Agents (2026) | survey synthesis around info flow, delegated authority, persistent state | threat model and architecture framing | survey, not a single deployable defense | n/a |
| SecureClaw (2026) | move trust to action/resource boundary; reduce plaintext exposure and unsafe effects | architectural control baseline | utility loss; does not guarantee semantic correctness | yes |
| A Vision for Access Control in LLM-based Agent Systems (2025) | dynamic access control / permissioning beyond static docs | policy design for secret-bearing systems | vision-stage; semantics remain hard | yes |
| AgentLeak (2026) | benchmark leakage across final + internal channels | evaluation of channel leakage and data minimization | benchmark, not direct defense | partly |
| Reframing LLM Agent Security as AHI (2026) | production-centric analysis of approvals, policy spec, scope config | operational architecture choices | human burden tradeoffs | yes |
| Runtime injection-isolation defenses (2025–2026, via survey synthesis) | isolate malicious instructions / constrain tool dependencies | front-end hardening | brittle if used alone | partly |

---

## 8. References

1. **Toward Secure LLM Agents: Threat Surfaces, Attacks, Defenses, and Evaluation** (2026).  
   arXiv HTML: https://arxiv.org/html/2606.10749v1

2. **SecureClaw: Clawing Back Control of LLM Agents** (2026).  
   arXiv HTML: https://arxiv.org/html/2606.09549v1

3. **AgentLeak: A Full-Stack Benchmark for Privacy Leakage in Multi-Agent LLM Systems** (2026).  
   arXiv HTML: https://arxiv.org/html/2602.11510v1  
   PDF: https://arxiv.org/pdf/2602.11510

4. **A Vision for Access Control in LLM-based Agent Systems** (2025).  
   arXiv HTML: https://arxiv.org/html/2510.11108v2

5. **Reframing LLM Agent Security as an Agent–Human Interaction Problem** (2026).  
   arXiv HTML: https://arxiv.org/html/2605.24309v1

6. **The Attack and Defense Landscape of Agentic AI** (2026).  
   arXiv HTML: https://arxiv.org/html/2603.11088v1

---

## 9. Working summary

The frontier answer to hidden-state defense is not “prompt better.”

It is:

- partition knowledge explicitly
- control reads and reveals
- mediate action and disclosure at the boundary
- minimize propagation across all channels
- log everything that touches secret-bearing state
- treat prompt/runtime hardening as useful but secondary

For Immortal, the best translation is:
- `KnowledgeState`
- `RevealPolicy`
- sink-level authorization
- public/private/common-ground separation
- leak-aware test harnesses
