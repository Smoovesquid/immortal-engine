# REPUTATION — the unification ruling

*Authored 2026-07-06 (Fable day). The shared keystone under the three sibling consequence
contracts — `MORAL_PHYSICS.md`, `briefs/PROSE_TO_WORLD_CONTRACT.md`, `briefs/SOCIAL_PHYSICS_CONTRACT.md`
— each of which reaches into the same tangle of "what people have heard about you." They were
written well but separately, and the contradiction hunt (`briefs/CONTRADICTION_HUNT_2026-07-06.md`)
proved they quietly disagree on which store is authoritative and inherited a dead code path none
of them caught. This is a **ruling** (a decision on principle), not a rebuild. It reconciles the
laws that exist; it invents no new store and forces no migration to ship the next feature.*

**Governing principle:** *one truth, one belief-interface, one read-sink, one magnitude law.*
The engine owns what happened and how far it spread; belief is epistemic and never collapses truth;
consumers never touch the raw stores; the model sets direction, never the number.

---

## 1. The five layers (deconfusing the conflation)

"Reputation" is five distinct things the codebase currently blurs into three overlapping stores.
Name them and the redundancy becomes obvious:

| # | Layer | The question | Canonical owner | Today |
|---|---|---|---|---|
| 1 | **Truth** | What did you actually do? | `world.deeds[]` (+ canon log; `recordDeed`) | single-owned ✓ |
| 2 | **Belief** | What does *this* NPC think happened? | `world.claims[]` — epistemic, distortion/weight/provenance, **body always null** (`claims.js`) | model exists, minted at ONE site (`playloop.js:152`), read only by `npc/dialogue.js:890` — nearly dark |
| 3 | **Reach** | How does belief travel NPC→NPC? | propagation — **TWO engines:** `propagateClaims` (`claims.js`) *and* `rumor/propagate.js` | REDUNDANT ✗ · both modulated by the `npc.relationships` social graph (`claims.js:125`, `worldTick.js:523`) |
| 4 | **Standing** | How does belief/truth change treatment? | trust `npc.conversationState.trustLevel` (0..10); faction rep `world.reputation.factions` (−100..100); NPC↔faction `npc.disposition`; NPC↔NPC `npc.relationships{bond,history}` | single-owned ✓ (SP-1 gave faction rep its producer) |
| 5 | **Surfacing** | What reputation reaches *here, now*? | `rumorsReaching(world, nodeId)` | one sink — but reads `rumors` + `deeds`, ignores `claims` |

Layers 1 and 4 are healthy (each single-owned). **The disease is layers 2–3–5:** `claims`,
`rumors`, and the `deeds`-read-synthesis are three representations of "what's heard," with two
propagation engines, and a read-sink that consults two of the three.

---

## 2. What's actually broken (grounded)

- **F1 — the inherited dead path.** `rumorsReaching.js:101` gates player-deed reputation on
  `severity >= 25`, but `recordDeed` stores `dominant.sev` whose ceiling is `DEED_SEV.HEAVY = 20`.
  The branch never fires. All three contracts *cite this path as if it works.* Player-deed
  reputation does not travel.
- **F2 — no authoritative substrate.** `MORAL_PHYSICS` leaned on `claims`; `PROSE_TO_WORLD` builds
  on `rumors`; `SOCIAL_PHYSICS` consumes `deeds`→`rumorsReaching`. Three laws, three answers to
  "where does reputation live."
- **Two propagation engines** (`propagateClaims` + `rumor/propagate.js`) do the same job (Layer 3)
  with two data shapes. A new reputation feature must currently *pick a side* — and each contract picked differently.

---

## 3. The ruling

**R1 — `world.deeds` is the sole source of TRUTH (Layer 1).** Every consequence — moral, social,
prose-collapse — reads deeds (or the canon log) for "what happened." Canon Log wins on divergence
(existing invariant). No consequence is computed from a *belief* store.

**R2 — `rumorsReaching` is the sole READ-SINK for reputation (Layer 5).** No consumer reads
`claims`, `rumors`, or `deeds` directly to decide treatment or greeting — they call
`rumorsReaching(world, nodeId)`. This makes the sink the **abstraction boundary**: it hides which
store answered, so the Layer-2/3 implementation can converge underneath without touching a single
consumer. (Live already for social + prose; the one direct `claims` reader, `npc/dialogue.js:890`,
migrates behind the sink.)

**R3 — one BELIEF-interface (Layer 2/3); `claims` is the convergence target.** Freeze the
*interface* now, converge the *implementation* later:
- **The interface (binding today):** (a) belief is epistemic and **never collapses engine truth**
  — the two-variance wall (`claims.js` header): epistemic variance accumulates, ontological truth
  is untouched, and nothing is promoted to fact without a non-LLM step; (b) the stored form carries
  a **skeleton + metadata** (subject, holder, distortion/tier, provenance) and **never a canonical
  prose body** — bodies are S3 (LLM-supplied at speak-time, or stored out-of-hash per
  `PROSE_TO_WORLD` §2 Hash-law S3, `worldHash.js:37`); (c) propagation is deterministic (seeded,
  replayable, `worldHash`-stable).
- **The target:** `world.claims` is the convergence endpoint — it *structurally* enforces (a) (body
  always null) and carries the richer model (weight-decay, provenance, fracture, cycle-block) that
  `world.rumors`' stored-garbled-body pattern only approximates. `world.rumors`/`rumor/*` is
  **legacy**, to be migrated onto `claims` *behind `rumorsReaching`*.
- **The freeze (SOBRIETY — no rebuild to ship):** no THIRD store, ever. New reputation reach is
  written through the `claims` interface. Existing `rumors`-based work (e.g. `PROSE_TO_WORLD` PW-3)
  **keeps shipping unchanged** — `rumorsReaching` hides the store — and migrates opportunistically,
  never as a blocking rewrite.

**R4 — direction from detectors, MAGNITUDE from tables (the shared Vol-11 law).** Every reputation
delta's *direction* may come from a deterministic detector (`tryDarkDeed`, provocation, dialogue
mode); every delta's *size* comes from a deterministic table (`reactionTable.js`, `deedFactionDeltas`),
routed through `effectsCore.applyDeltas`. **The LLM never sets a reputation number.** All three
contracts already obey this; it is hereby the cross-cutting invariant, not three parallel copies.

**R5 — the first proof is fixing F1.** The dead deed-reputation threshold is the concrete bug all
three contracts inherited from the shared sink. Fixing it (calibrate the gate to the real deed-severity
ceiling, or accumulate severity per subject — a design-owned magnitude tuned by a determinism test,
never a blind flip) is the first packet that *demonstrates* the unification is adopted, because it
lights up the sink every contract now depends on.

---

## 4. Sequencing (nothing rebuilds; the redundancy stops growing)

1. **Adopt the sink (R2)** — document `rumorsReaching` as the sole read; migrate `dialogue.js:890`'s
   direct `claims` read behind it. Small, no behavior change.
2. **Fix F1 (R5)** — reputation travels for the first time. Determinism-tested. *(= `MORAL_PHYSICS` MP-1.)*
3. **Freeze `rumors` (R3)** — a grep-checkable rule at PR time: no new writer of `world.rumors`;
   new reach goes through the `claims` interface.
4. **Converge opportunistically** — when a `rumor/*` path is next touched for another reason, port it
   onto `claims`; retire `rumor/propagate.js` when its last writer is gone. No dedicated rebuild packet.

The order matters: the sink (1) is the boundary that lets 3–4 happen invisibly. Do 1 before any
Layer-2/3 change.

---

## 5. Adoption + falsifier

**Each sibling contract points here for its substrate.** Adoption step: add one line to
`MORAL_PHYSICS.md`, `PROSE_TO_WORLD_CONTRACT.md`, `SOCIAL_PHYSICS_CONTRACT.md` — *"reputation
substrate: governed by `REPUTATION_UNIFICATION.md`."* (`MORAL_PHYSICS` MP-1 already carries the F2
dependency; the other two get the pointer.)

**Also owed:** the collapse-trigger vs deed-trigger composition check (hunt F4) — the one turn where
a prose-collapse and a moral deed both fire on the same player text. Verify at step 1.

**The ruling is law when:**
- a determinism test shows a HEAVY cruelty witnessed in Aldermere lowers a Greenwood stranger's
  opening disposition (F1 dead path is alive), byte-identical under replay;
- `grep` finds **no consumer** reading `world.claims`/`world.rumors`/`world.deeds` directly for
  standing or greeting — all go through `rumorsReaching`;
- `grep` finds **no new `world.rumors` writer** since the freeze, and **no fourth store**.

Until all three hold, reputation is unified in *ruling* but not yet in *fact* — flag any divergence
against this doc; do not resolve it silently.

---

## Reconciliation with the stack

Adds no cosmology and overturns no locked decision in the three contracts — it names the shared
layer they each assumed and rules the one question they answered differently. On conflict, the
IMMORTAL_INVARIANTS (determinism, narration≠canon) and Canon-Log-wins outrank this doc; flag, don't
resolve silently.
