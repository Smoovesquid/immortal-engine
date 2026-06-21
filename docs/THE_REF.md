# THE REF — the narration-layer judge (Rung-1 narration track)

**Handover spec. Written 2026-06-21 by the outgoing Basecamp for the next one.** Read this cold and you
have everything to pick up the narration track. Pairs with [[IG-12]] in `docs/IDEA_GARDEN.md` (the idea)
and the gate-5 findings in `docs/CAPABILITY_LEDGER.md` (the evidence).

---

## Why this exists (read first)

The Rung-1 hard-tail loop (Road-A: one regex/state-guard per bug) drove the Opus experiential gate from
~35% fails down to single digits, then **plateaued**. Gates 3→4→5 went 5/48 → 7/48 → 10/48 — NOT a
regression (every landed fix held), but the **stochastic personas kept finding fresh long-tail veins**,
and the "zero-new-discovery" streak broke at gate 5.

The decisive finding (gate 5): **8 of 10 failures are "right content, badly delivered."** The engine
computed the correct mechanics/state, then narrated it as a *system artifact* — a machine-dump, an empty
"success," a "check your sheet," an invented wall. These are **narration-layer / Road-B** failures. A
regex can't fix "this is technically correct but reads like a UI." **The frontier moved off the
deterministic resolver and onto the words.**

Tim's idea (the Dungeon Ref, IG-12) is the mechanism for this layer: **a judge sitting above the DM.** He
also floated an "internal, the DM calls it when it's stuck" version. Those two fuse — see The Thesis.

> **This is NOT the player-facing appeals feature from IG-12.** That's a soul feature for later. THE REF
> here is the *engine-internal narration validator/regenerator*. Same mechanism (a second opinion on a DM
> output), different surface (runtime quality gate, invisible to the player).

---

## The Thesis (the fused idea — this is the centerpiece)

A judge that reviews *every* DM output is expensive and slow (doubles API calls + latency). A DM that
only escalates when it *knows* it's stuck is cheap but blind to its own confident failures ("it goes your
way" is emitted with total confidence). **Fuse them with a signal the engine already has.**

The gate-5 failures cluster on a SMALL SET of known "soft" code paths: the observe-only fallback, the
generic-resolve success template ("it goes your way" / "you see it through"), the deflect-to-sheet punt,
the "Nothing's happened yet" meta-deflection, the "that way is blocked" navigation dead-end. These are
identifiable paths, not random.

**So: tag every narration with the path/confidence that produced it (`narrationSource`), and invoke the
Ref ONLY on the soft sources.** That is simultaneously "the DM calls the Ref when it knows it's punting"
AND "a judge above the DM" — the same thing, gated by the DM's own self-knowledge of which branch it
took. Most turns are grounded answers → skip the Ref → no cost. You spend the judge exactly where the
failures live.

---

## Hard invariants (violate these and you detonate the moat — non-negotiable)

1. **Narration ≠ canon. The Ref touches WORDS ONLY.** It sees `(player input, the engine's computed
   mechanics line + state deltas, the proposed narration, canon ground-truth)` and outputs *better words
   that convey the SAME mechanics/facts.* It may NEVER alter the mechanics line, the deltas, the Canon
   Log, or RNG. This is the difference between a safe narration judge and the IG-8 cataclysm (an LLM that
   rewrites collapsed canon). State the contract in code and assert it.
2. **Determinism is preserved because the Ref is downstream of state.** `worldHash`/replay are computed
   from state, which the Ref never touches. The narration layer is *already* non-deterministic (the
   `llmAdapter` polish). The Ref lives in that same layer. Determinism tests (U19/21/22/27/30) must stay
   green — if they go red, the Ref leaked into state. That's the tripwire.
3. **Never throws — silent fallback.** Same rule as the whole LLM layer (`llmAdapter`/`llmPhysics`/
   `server/llmProvider`): if the judge errors, times out, or the key is missing, the game continues with
   the engine's base narration. The Ref is an *enhancement*, never a dependency.
4. **The LLM is never runtime authority over canon — it IS the author of the words.** The words were
   always the LLM's domain. The Ref extends that, it doesn't cross the line. The line is state/canon.

---

## Architecture — four tiers (do them in this order; do NOT build the LLM judge first)

**Tier 0 — fix the deterministic base narration (Road-A, free, do this FIRST).** Half the narration tail
isn't a judge problem; it's a *bad base string* problem. Gate 5 named them concretely:
- Inventory as a `weapons: …, armor: …` category dump → render as prose (`composer.js` / the inventory
  handler). RL t1, Newbie t6.
- "read it on your sheet" deflect → name the items (this is C6/C7, partly done).
- "open the book" → empty-success ("it goes your way") → deliver the book's content OR honest-decline
  (extend the C4 empty-success machinery from H-78 to **object-reading**, a new trigger).
- "go say hi to Kael" → "that way is blocked" to a *present* NPC → resolve the approach (the C12/C9
  invented-barrier class — 2 occurrences in gate 5).
These are normal Rung-1 packets (`N-#`). They need no Ref. Land them and the live judge has less to do.

**Tier 1 — deterministic narration-QUALITY filters (free, runtime).** Extend the EXISTING validator
`validateNarrationCandidate` (`engine/llmAdapter.js:344`) — which already rejects invented/over-claiming
polish and falls back to base narration — with quality detectors for the gate-5 classes that are
deterministically recognizable: machine-dump shape (`/^\w+:\s/m` category lists), known empty-filler
phrases co-occurring with a content question, "that way is blocked" when the target is a present NPC,
"Nothing's happened yet" on a substantive ask. On a hit: regenerate or fall back. This is the same
discipline as the R1–R5 rules already there. Free, fast, no API.

**Tier 2 — the Ref proper: a selective cross-family LLM judge + regen (costs API, gated).** When
`narrationSource` is a soft type AND Tier-1 didn't already resolve it, send `(input, mechanics, proposed
narration, canon ground-truth)` to a judge. If it flags a failure class, **regenerate** with a corrective
prompt ("your narration was an empty success / a machine-dump; deliver this exact content: <the facts the
engine computed>"). Key decisions:
- **Cross-family (Vol 14).** The narrator is Anthropic (Sonnet, `llmAdapter`). Vol 14 says judges are not
  generator-invariant and Opus-judging-Opus has a self-preference risk. Prefer a DIFFERENT family for the
  live judge — the OpenAI client already exists (`server/ai.js:1,25`). Or accept same-family with Vol 14's
  mitigations (atomic checks, no judge chain-of-thought). **Open decision — see below.**
- **Gated hard on cost/latency.** Only fires on soft-source turns (~10–20% of turns, not all). Add a
  per-session budget + rate guard. One regen call max per turn. If over budget → Tier-1 fallback.

**Discovery — the offline gate becomes the narration-track's convergence engine.** Extract the gate's
judge (`JUDGE_SYSTEM` + `canonGroundTruth` + the `bug_class` enum, `scripts/dm-playtest.mjs:190/263/306`)
into a **shared rubric module** so the live Ref and the offline gate score by the SAME definition of "a
bad ruling" (one source of truth). The gate keeps running to surface NEW narration-failure classes; each
graduates down into a Tier-0 fix or a Tier-1 filter — exactly how the Road-A convergence corpus works.

---

## The failure taxonomy (from gate 5 — the concrete target list)

| Class | Example (gate 5) | First home |
|---|---|---|
| **Machine-dump** | inventory as `weapons: …, armor: …` | Tier 0 (prose) + Tier 1 (shape detector) |
| **Empty-success** | "open the book" → "it goes your way" | Tier 0 (deliver-or-decline, extend H-78) |
| **Deflect-to-sheet** | "what am I carrying?" → "read your sheet" | Tier 0 (name the items) |
| **Invented barrier** | "say hi to Kael" → "that way is blocked" | Tier 0 (resolve approach) + Tier 1 |
| **Meta-deflection** | "Nothing's happened yet. What do you do?" | Tier 1 (detector) |
| **Non-sequitur / ignores the question** | "what's the pay?" → exits dump | Tier 2 (fuzzy — needs the judge) |

Note the split: the first five are mostly **deterministic** (Tier 0/1, free). Only the genuinely fuzzy
"did this answer the question" cases need **Tier 2** (the LLM judge). Don't over-build.

---

## Measurement — the narration-convergence loop (mirror Road-A)

Road-A is measurable because of `npm run convergence` (frozen paraphrase corpus, deterministic, free) +
the paid gate (discovery). Build the SAME for narration:
- **Narration corpus** (`tests/corpus/narration/` or a new prefix) — cases of `(input, fixture,
  bad-narration-pattern-to-exclude, good-narration-pattern-to-require)`. Locked cases are the regression
  signal: Tier-0/Tier-1 fixes must keep them green. Reuse the convergence runner (`scripts/convergence/`).
- **The gate** is the discovery signal (tag narration-failure classes, same as we tag `C#` now).
- **Done-when** (narration track): the narration corpus is green + N consecutive gates open zero new
  *narration* classes + residual is forgivable style, not dead-ends.

---

## First packets (suggested sequence for the next Basecamp)

- **N-1 (Tier 0, free):** the four named base-narration fixes — inventory-as-prose, name-items (kill
  deflect-to-sheet), object-reading deliver-or-decline (extend H-78), resolve-approach-to-present-NPC
  (kill the invented barrier). Four normal Rung-1 packets. Biggest free win; do first.
- **N-2 (scaffold):** extract the gate judge into a shared rubric module + stand up the narration corpus
  + the first locked cases from N-1. Makes the track measurable.
- **N-3 (Tier 1):** add the deterministic quality-filters to `validateNarrationCandidate` +
  `narrationSource` tagging on the soft paths in `playloop`/`composer`.
- **N-4 (Tier 2, experiment, flagged off by default):** the selective cross-family judge + regen, behind
  a flag, measured against the corpus + a paid gate. Only after N-1..N-3 prove the cheap tiers.

---

## Open decisions (the next Basecamp must make these — don't assume)

1. **Cross-family judge model?** OpenAI (already wired, true cross-family, but a second vendor key/cost)
   vs. same-family Anthropic with Vol 14 mitigations (atomic checks, no-CoT). Recommend: prototype N-4
   cross-family since the client exists; fall back to same-family-atomic if cost/latency hurts.
2. **Runtime judge vs. discovery-only first?** A defensible path is to ship Tier 0+1 (free) and use the
   gate as discovery-ONLY for a few rounds before paying for a live Tier-2 judge. The live judge is the
   most expensive, least-proven piece. Recommend: defer Tier 2 until Tier 0+1 plateaus.
3. **`narrationSource` taxonomy** — enumerate the soft paths precisely (audit `playloop`/`composer` for
   the fallback/template branches). This is the gate that makes Tier 2 affordable; get it right.
4. **Is this still "Basecamp / Rung-1," or a new rung?** It's the same loop (reproduce → fix → verify →
   gate) aimed at a new layer. Keep the BASECAMP discipline (`docs/BASECAMP.md`), the §7 verification, the
   shared-tree git rules. Just the corpus and the failure classes are narration-shaped now.

---

## Handover state (as of 2026-06-21)

- **Branch `v2-polish`**, origin tip `624da91`. Convergence **71/71 (100%)**, suite **8285/8285**.
- **Rung-1 Road-A**: H-75…H-80 all landed/verified (C12 attack-misroute, C7 item-effects, C4
  empty-success/provenance, C2 invented-social-target, C5 melee-stat). The deterministic corpus is
  near-saturated; the frontier is this doc.
- **Gates**: gate 3 (5/48, `-gate3-hardened.md`), gate 4 (7/48, `-gate4-postH77.md`), gate 5 (10/48,
  `opus-gate-2026-06-21.md`). Gate 5 is the one to read for the narration taxonomy.
- **Budget**: ~$1.71 estimated — BELOW the one-run floor. **Top up + re-confirm with Tim before any gate.**
- **Bootstrap**: `docs/BASECAMP.md` (the role), `docs/CAPABILITY_LEDGER.md` (Road-A status + the gate-5
  findings), `docs/biblioteca/` Vols 10/14/15 (judge reliability, GM-proposes/system-commits, the
  narration frontier). Vol 15 independently re-derives "GM proposes, deterministic system commits" — THE
  REF is the enforcement of that on the narration channel.

---

## The one-paragraph version (if you read nothing else)

The deterministic loop plateaued; the remaining failures are the DM saying the right thing in the wrong
words (machine-dumps, empty successes, invented walls). Fix the cheap half by improving the base
narration (Tier 0/1, free). For the fuzzy half, put a judge above the DM — but invoke it ONLY when the
engine emits narration via a known "soft" path (`narrationSource`), so it's cheap. The judge touches
WORDS only, never state or canon (that rail is sacred). Reuse what exists: `validateNarrationCandidate`
is the validator hook, the gate's `JUDGE_SYSTEM` is the rubric, `server/ai.js` is the cross-family client.
Measure it with a narration corpus the same way `npm run convergence` measures Road-A. Don't build the
expensive LLM judge first.
