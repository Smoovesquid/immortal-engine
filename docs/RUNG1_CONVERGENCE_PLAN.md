# Rung-1 Convergence Plan — redefining victory + closing the fix loop

**Status: ADOPTED 2026-07-03 (Tim) — §6 option (a), execute now.** Trigger: the treadmill evidence
(`docs/briefs/FAILURE_META_DIAGNOSIS.md` — ~25 packets on one root; `docs/briefs/SECOND_ORDER_DIAGNOSIS.md` —
scattered sinks force precision-bias) plus Tim's independent design memo
(`fable_rung1_llm_between_player_and_engine.md`) converging on the same boundary. Packetized as
**INT-1…INT-4** in `docs/PACKETS.md` (the single intake) — on conflict, the packets there win over this
doc's phase sketch.

**Reads first:** Biblioteca [Vol 7](biblioteca/vol-7-hybrid-architecture-patterns.md) (the wiring) +
[Vol 8](biblioteca/vol-8-evaluation-harness.md) (the harness spec) + `docs/RUNG1_QUEUE.md` (the live loop this
fixes). This doc sits **on top of** Vol 8: Vol 8 says how to test a rule; this says **when the whole loop is
done**, which Vol 8 is silent on.

---

## 0. The problem this solves

The Rung-1 hard-tail loop (gate → dominant cluster → Road-A patch → that class zeroes → re-gate → new cluster)
does **not terminate**, for two independent reasons:

1. **Victory is defined as an unreachable absolute.** "Zero HARD failures across the multi-seed gate" is
   *absence over an infinite, adversarially-sampled space*. You can't prove a negative by sampling. The gate
   explores freely, so each run draws fresh samples from (all phrasings × all world-states) and always finds
   one more failure. The headline % (4 → 10 → 16 → 11 → 10) measures **how rich this run's exploration was**,
   not progress. The ruler bounces because it isn't a ruler.
2. **The fixes are at the wrong layer.** Road A matches *surface forms* (regexes, `META_*`,
   `findInventedFactClaim` arms). Each new phrasing is a fresh miss by construction. You zero the *shapes you
   tested*, but the *category* they came from is infinite.

So redefining victory makes "done" **visible**; closing the loop makes it **reachable**. We've been doing
neither. We need both, in order.

---

## 1. Two fixes, one cure

| | Fixes | Without the other |
|---|---|---|
| **Redefine victory** (§2) | the *measurement* — turns a bouncing % into a convergence meter | you fix the right layer but still can't *prove* you're done |
| **Close the loop** (§3) | the *fix-layer* — makes the discovery rate actually fall | you get an honest meter that never converges |

They're complementary halves of one cure, not alternatives.

---

## 2. Redefine victory — the convergence meter

### 2.1 Split the one number into two signals
- **Regression signal** — a *frozen, versioned corpus*. Every fixed gate failure becomes a permanent
  **paraphrase-set** test (5–10 rephrasings of the same intent, not one). Must stay **100%**. This is Vol 8
  §4.2 (golden) + §6 (paraphrase invariance), incl. §6.3 *false* invariance (warning≠threat, request≠order
  must still **diverge**). It proves we never go backward — which the current `node --test` cannot prove
  against the gate's adversarial phrasings (the H-45 meta-lesson: "a passing unit test is not a passing gate").
- **Discovery signal** — fresh free exploration, scored as the **rate of *categorically*-new failures per
  run** (new capability gaps, not new phrasings). **This is the real progress meter, and it can asymptote to
  zero over infinite input** because the categories are finite.

### 2.2 The capability ledger
Enumerate the finite categories of DM obligation. The gate history already contains the draft (see §7). When a
gate failure arrives, it either maps to an existing capability (→ a paraphrase gap, add to that capability's
corpus) or opens a **new** capability (→ the discovery signal ticks). Maybe ~15–25 total, not infinite.

### 2.3 The new done-when bar
Rung-1 is **done** when:
1. the frozen regression corpus is green (no paraphrase regressions), **and**
2. **N consecutive gates open zero new capabilities** (discovery rate ≈ 0), **and**
3. the residual HARD-count is dominated by phrasing-tail / forgivable SOFT slips, not real defects.

Convergent, and you can *watch* the asymptote instead of squinting at a bouncing %.

### 2.4 The built-in diagnostic (is the loop even closeable?)
The discovery signal also tells you which world you're in:
- **Categories keep appearing** gate after gate → the finite-category assumption is false → no architecture
  closes it → fall back to a *statistical* victory bar (HARD-rate < X% with a confidence interval).
- **Categories stop appearing**, only phrasings recur → closeable → §3 closes it.

Current evidence points to **closeable**: RUNG1_QUEUE keeps citing recurring *lineages* — "the meta-query
answer-binding family (H-25/H-31/H-40/H-54 lineage)", combat-resolution recurring, lore-invention recurring.
Recurrence of *families* (not novel categories) is the signature of a finite category set being re-probed with
fresh phrasings.

---

## 3. Close the loop — graduate the grace layer (Vol 7 + Vol 8 §15)

### 3.1 The typed PragmaticPacket (Vol 7 §13)
Lift detection from *surface form* to *typed intent*. One interpreter maps any utterance → a typed packet
(force, proposition, target, **compound-parts**, confidence, ambiguity-set…); deterministic handlers commit
**narrowly per act-type**. The infinite phrasing tail collapses onto a **finite legal-action set** (Vol 7 §8).
Closure condition = Vol 7 §16's first criterion: *paraphrases map to the same packet when they should*.

### 3.2 Graduate one detector-family per packet — do NOT rewrite
Vol 7 §17: "control layer first, richness later." The README frames this as *graduation*, not rewrite. Steps:
- Introduce the packet as a typed **aggregation** of the existing detectors (each detector feeds one field) —
  no behavior change, fully regression-locked.
- Add the **narrow-commit gate** between interpretation and canonical update.
- Then collapse **one family at a time** (start with the meta-query answer-binding family — the biggest,
  best-understood lineage) into a single act-handler. Each step locked by the §2.1 corpus.

### 3.3 Per-family graduation bar = Vol 8 §15 (verbatim, 9 points)
A family graduates only when: (1) packet representation defined, (2) state-update path explicit, (3) legal
action effects explicit, (4) logging complete (Vol 8 §13 TurnLog), (5) golden tests written, (6) paraphrase
tests written, (7) replay deterministic, (8) narration constraints defined, (9) failure modes documented.

---

## 4. Why this is invariant-safe (it is NOT a Road-B flip)

The core invariant — "LLM never runtime authority over canon/mechanics" — is preserved: the LLM **interprets /
proposes** the packet; the deterministic layer **validates against canon and commits**. Interpretation ≠
authority. This is the hybrid the engine *already runs informally* (grace → `resolve` → deterministic outcome
→ LLM narration → Canon Log), just named and unified. Road B was parked for being LLM-authoritative; the
typed-packet version isn't, so the objection that parked it doesn't apply. Determinism rails (`rng.js`,
`effectsCore.applyDeltas`, stable `worldHash`) are untouched.

---

## 5. Sequence (recommended: Part 1 before Part 2)

Part 1 is the **prerequisite that de-risks** Part 2 — an unguarded refactor of `gracefulAdjudication.js` (the
most collision-prone grace file) without a regression corpus is exactly the trap.

- **Phase 0 — capability-ledger seed** (cheap, doc-only). Promote §7 below into a tracked ledger.
- **Phase 1 — convergence meter + frozen corpus** (harness; Vol 8 §16 Phase A). Build the two-signal split,
  backfill the corpus from every landed H-packet's gate transcript. *Redefine victory; close nothing yet.*
  Low risk, immediately makes the current loop honest.
- **Phase 2 — empty PragmaticPacket + narrow-commit gate** as an aggregation of existing detectors. No
  behavior change; suite + corpus stay green. *Control layer, no richness.*
- **Phase 3 — graduate families one at a time**, each regression-locked by Phase 1's corpus and gated by Vol 8
  §15. Order by lineage size: meta-query answer-binding first, then combat-resolution, lore-invention,
  referent-grounding, …

If we only ever ship Phases 0–1, we still win big: the loop becomes measurable and we learn whether it's
closeable (§2.4) before spending refactor risk.

---

## 6. Decision point (Tim)

- **(a) Execute now** — pivot the per-gate loop onto this; next sessions run Phase 0→1 instead of the next
  H-packet. Best if per-packet ROI feels like it's dropping.
- **(b) Park as North Star** — keep landing per-gate H-packets; adopt this the moment the discovery rate
  *feels* flat (which Phase 1 would make objective). Best if the current gate is still surfacing genuinely new
  categories worth cheap point-fixes.

My lean: **(b) with Phase 0 done now.** The capability-ledger seed is cheap, it immediately sharpens every
future verdict, and it's the thing that tells us *when* (a) becomes correct — without betting refactor risk
before the meter says converge.

---

## 7. Capability-ledger seed (starter set, from RUNG1_QUEUE gate history)

The finite category list — evidence that the discovery rate *can* asymptote. Each row = one DM obligation, its
recurring lineage, and where it currently lives (the scattered detectors a typed packet would unify).

| # | Capability (DM obligation) | Lineage / H-IDs | Current home (detectors to unify) |
|---|---|---|---|
| C1 | Answer **every part** of a compound query | H-25/H-31/H-40/H-54 | `handleMetaQuestion` fold logic |
| C2 | A **named referent** must be grounded before the turn resolves | H-56 | `ungroundedNpcReferentForText` (new) |
| C3 | A **declared check** ("roll WITS to read his face") gets a DC + roll | H-54 R4 | `META_EXPLICIT_CHECK_*` |
| C4 | Info-seeking **delivers a real grounded fact or honestly declines** | H-22/23/29/31/39 | `isInfoSeekingText`, `infoExtractionOutcome`, `declineInfoSeek` |
| C5 | A **rules/mechanic question** is answered straight, never rolled | H-25/H-54 R3 | `META_DAMAGE_RULE`, advice/skill-mod interceptors |
| C6 | **Number-transparency**: own stats/mods/AC/HP/items from the sheet | H-25/H-31/H-40 | `answerSkillModifier`, `META_ARMOR_VALUE`, `META_HELD_ITEMS` |
| C7 | **Item/consumable** query answers from real def; **use** applies the effect | H-45/H-47 | `answerItemQuery`, `tryUseConsumable`, `META_ITEM*` |
| C8 | **Narration ≤ mechanics** — no hit/defeat the dice didn't produce | H-26/H-28/H-43 | `llmAdapter` validator R1–R3 |
| C9 | **Canon non-invention** — no invented name/date/tenure/relationship | H-27/H-49/H-52 | `findInventedFactClaim`, lineage/age/relationship loops |
| C10 | A **declared attack** routes to real combat resolution | H-30/H-32/H-43/H-48/H-55 | playloop attack gates, `resolveEscapeCombatTurn` |
| C11 | **Confrontation under pressure** → in-character NPC reaction, not `gen:f` | H-42 | `isConfrontationChallenge`, `confrontationReaction` |
| C12 | **Movement/travel intent** resolves in fiction, never bounces to a travel-gate prompt | THE_DM_TEST residuals | playloop movement/`inferInteriorAction` |
| C13 | **Absurd / out-of-bounds** input declines in-character (not a system bounce) | IG-10 (parked) | — (Tier-B candidate) |
| C14 | **Meta / system check-in** ("you okay? you're repeating yourself") acknowledged, no roll | H-51 | `META_SYSTEM_CHECKIN` |

If gates keep mapping onto C1–C14 (only fresh phrasings), the loop is closeable and §3 closes it. A genuinely
new C15+ that *doesn't* fit any row is the discovery signal firing — track it.
