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

---

## Planned volumes (from Vol 1 §20 — write as the need comes due)
- **Vol 2 — Speech Acts & Force** (act taxonomy, indirection, obligations, repair/grounding)
- **Vol 3 — Implicature, Presupposition & Common Ground** (hidden meaning, loaded questions, shared belief)
- **Vol 4 — Social Practices & Scene Protocols** (court, bargaining, interrogation, romance, ritual, rank)
- **Vol 5 — Deception, Bluffing & Audience Split** (lies, half-truths, plausible deniability, witnesses)
- **Vol 6 — Emotional Appraisal & Relational State** (appraisal, trust/fear/respect, persistence/decay)
- **Vol 7 — Hybrid Architecture Patterns** (parser + state machine + planner + generator; confidence/clarify)
- **Vol 8 — Evaluation Harness** (determinism tests, paraphrase invariance, hidden-state consistency, replay)
