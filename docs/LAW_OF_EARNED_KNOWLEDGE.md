# The Law of Earned Knowledge

**Status: governing principle, written 2026-06-22.** A Rung-1 *competence* rule, not flavor. Sibling to
`docs/THE_DM_TEST.md` (resolve intent in the fiction) and `docs/THE_REF.md` (the narration judge); the
engine-wide generalization of `docs/DEMO_REGION.md` §0 (the hidden why). Pairs with candidate **C16**
(secret-non-leakage / reveal sinks) in `docs/CAPABILITY_LEDGER.md`.

---

## The Law

> **The DM is not an encyclopedia.** The DM may surface grounded facts the player has earned access to,
> and may honestly decline unknowns — but must **not** hand over mystery lore, hidden motives, secret
> control, §0 cosmology, or unobserved facts just because the player asks or rolls well.

## Why this is competence, not flavor

A good DM withholds. Lore is a **reward earned through play**, not exposition read aloud. "What's the
history of this temple?" is answered by the murals you find, the bones you step over, the survivor who
talks if you're kind — not by a lecture. Hand it over for free and you've spent the discovery currency
and made the world a quiz-show host reading answer cards.

This rule exists because the base LLM's instinct runs the **opposite** way: asked "tell me about X," it
*explains* — helpfully, fluently, and often by **inventing**. That helpfulness-to-explain bias is the
single most corrosive thing a narration layer can do to a mystery-driven game. The Law is the standing
counterweight. It is the epistemic complement to THE_DM_TEST: *resolve intent in the fiction* — and
sometimes the faithful resolution is **to withhold, decline, or point at the world**, in character.

---

## The tiers

Six kinds of "information," each with a hard rule. The DM's job at every turn is to classify the ask and
obey the tier — deliver, decline, or route to the source.

### Tier 1 — Earnable local knowledge
*Examples:* the public founding fact, a visible mural's detail, a known local event, the public
population figure, the inn's prior owner.
**Rule:** deliver **only from canon/data — never fabricate.** A successful roll may unlock *delivery*
**only if canon actually holds the fact.** The roll gates access to what exists; it never manufactures
what doesn't.

### Tier 2 — Unknown / unmodeled knowledge
*Examples:* a name, date, count, or history the world never authored.
**Rule:** **honest decline.** No invention; no roll-to-fabricate. A successful roll on an ungrounded ask
is still a decline — the success means "your character tried hard," not "the fact now exists."

### Tier 3 — Protected mystery lore / §0 hidden why
*Examples:* the cosmology, the sealed core secret, the answer the whole game is built to make the player
discover.
**Rule:** **never delivered by narrator explanation or a generic knowledge roll — regardless of success.**
It is revealed **only through designed experience / reveal sinks** (reaching the thing, the scripted
discovery, the source that breaks). Narration may show **symptoms, rumors, faith, residue, or
consequences** — never the hidden cause. (This is §0, generalized from the demo region to the engine.)

### Tier 4 — Other minds' hidden state
*Examples:* an NPC's motive, secret allegiance, whether they're lying, what they know, what they're hiding.
**Rule:** **not delivered by an omniscient narrator.** It must come from the **source** — pressure,
trust-gated dialogue, investigation, or explicitly modeled data (the perspective filter's
`secrets` / `omittedFacts`). The narrator never reads a mind for free.

### Tier 5 — Unobserved world state
*Examples:* what's behind a closed door, faraway places, future events, unseen objects.
**Rule:** **do not pre-render.** Route to action / observation / investigation, or honestly decline. The
DM narrates the observed; it does not collapse the unobserved on request. (Aligns with IG-6: observation
collapses reality, not a question.)

### Tier 6 — Mechanical / authorial meta
*Examples:* hidden DCs, hidden stats, the thread-weave, authorial intent, the meta-story (IG-7/IG-9).
**Rule:** **do not reveal** unless explicitly scoped as UI/debug. The dice math and the DM's hidden
purpose are not in-fiction facts.

---

## How this maps onto the engine today (audit, 2026-06-22)

Most of the Law is **already enforced** — the hole is narrow and named.

| Tier | Today | Where |
|---|---|---|
| 1–2 (earnable / unknown) | **Built.** The World-Query Resolver classifies a place/person ask, resolves a typed fact from canon, or returns null → honest-decline; the `isInfoSeekingText` net declines ungrounded demands pre-roll; failed rolls keep info out of reach. | `engine/world/placeQuery.js`, `engine/world/personQuery.js`; `engine/grace/gracefulAdjudication.js`; `engine/llmAdapter.js:150` |
| place-meaning (tier 3-adjacent) | **Built.** "describe what is here; never interpret or explain what it means." | `engine/llmAdapter.js:116` |
| 4 (other minds) | **Partly built.** NPC voice is epistemically bounded (vivid/dim/myth ladder; "invent no names/dates/history; say you don't know"); confrontation routes to NPC reaction, not narrator answer. | `server/npcVoicePrompt.js:169`; `gracefulAdjudication.js` (`isConfrontationChallenge`) |
| **THE HOLE** | **`engine/llmAdapter.js:151`** — on a *successful* knowledge roll where the player asks for a proper noun, the narrator is told to *"state a concrete answer… **invent a plausible one.**"* This is the only narrator path licensed to **fabricate**, and it has **no tier-awareness**: no protected-lore floor (tier 3), no source-routing (tier 4), no "grounded-or-decline" discipline (tiers 1–2). A good roll can mint deep lore the world never authored. | `engine/llmAdapter.js:151` |

The hole exists for a real reason — it was added in Road-A to kill *atmospheric deflection* ("a name
forms in your mind") on a **succeeded** ask, which the gate scored as bad DMing. The fix must preserve
that win (no return to vague deflection when a grounded answer exists) while removing the **fabrication**.
That is packet **EK-1** in `docs/PACKETS.md`.

---

## Relationship to the other laws

- **THE_DM_TEST** — its epistemic complement: resolve in the fiction; *withholding/declining in character*
  is a legitimate resolution, not a system bounce.
- **§0 (DEMO_REGION)** — tier 3 *is* §0, lifted from the region to an engine-wide rule.
- **THE_REF** — gives the narration judge a **second axis**: not only "right facts, wrong words"
  (delivery quality) but "did the DM hand over what should have been **earned**?" (a tier violation).
- **C16 / reveal sinks (Biblioteca Vols 12–13)** — tiers 3–4 are **access-controlled state**: the narrator
  is **not** a reveal sink. Protected lore unlocks only at its designed sink.

## Done-when (the Law, as an invariant)

Every narrator and NPC path either (a) delivers a **grounded, earned** fact, (b) **honest-declines** an
unknown, or (c) **routes to the source**. **No path fabricates** a protected or ungrounded fact on
request or on a roll. THE_REF can name a tier violation as a failure class.
