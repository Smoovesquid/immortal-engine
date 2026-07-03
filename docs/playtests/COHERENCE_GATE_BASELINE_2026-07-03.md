# Coherence Gate baseline — 2026-07-03 (CG-P2)

**The first state-grounded incoherence number, hand-verified.** `docs/briefs/COHERENCE_GATE.md` designed a
Tier-D deterministic checker (`scripts/coherence-gate.mjs`, shipped in CG-P1, commit `691374d`) that diffs
the Opus experiential gate's judged DM prose against the SAME per-turn Canon-Log bundle the judge held —
zero LLM, zero RNG, zero engine import, $0, fully reproducible. This doc (CG-P2) reruns it over all four
existing gate JSONLs, hand-verifies **every single flag** against the exact canon field it names, and scores
the design doc's four falsifiable predictions (§6) honestly — reporting the falsified parts as falsified,
not just the vindicated ones.

## Reproduce this

```
node scripts/coherence-gate.mjs docs/playtests/gate-runs/gate-2026-07-02T19-44-24-605Z-bridge.jsonl \
  docs/playtests/gate-runs/gate-2026-07-02T20-59-10-628Z-v1.jsonl \
  docs/playtests/gate-runs/gate-2026-07-03T03-56-04-236Z-v1.jsonl \
  docs/playtests/gate-runs/gate-2026-07-03T11-45-56-173Z-v1.jsonl
```

Or per file: `node scripts/coherence-gate.mjs docs/playtests/gate-runs/<one>.jsonl`.

## The headline — honest-floor table, all four runs

| Run | Regime | Turns | Judge-failed | **CG state-grounded flags** | **New signal (flagged, judge-PASSED)** | **Honest floor (union, de-duped)** |
|---|---|---|---|---|---|---|
| `gate-2026-07-02T19-44-24-605Z-bridge.jsonl` (pre-ROM-3) | bridge | 48 | 9 | **0** | 0 | **9/48** |
| `gate-2026-07-02T20-59-10-628Z-v1.jsonl` (pre-ROM-3) | v1 | 48 | 3 | **1** | 1 | **4/48** |
| `gate-2026-07-03T03-56-04-236Z-v1.jsonl` (pre-ROM-3) | v1 | 48 | 10 | **0** | 0 | **10/48** |
| `gate-2026-07-03T11-45-56-173Z-v1.jsonl` (post-ROM-3) | v1 | 48 | 9 | **7** | 5 | **14/48** |
| **Total** | | **192** | **31** | **8** | **6** | — |

Exact reproduction of CG-P1's own headline (`704857e`): the 11-45 file flags **7** state-grounded desyncs,
**5** of them on turns the v1 judge PASSED, moving that run's honest floor **9 → 14/48**. All four counts
above were re-derived independently in this pass, byte-for-byte matching CG-P1's committed numbers — no
detector drift.

## By class, all four runs combined

| Class | Detector | bridge | v1 (07-02) | v1 (07-03 03-56) | v1 (07-03 11-45) | Total |
|---|---|---|---|---|---|---|
| CG-1a | presence erasure | 0 | 0 | 0 | 0 | 0 |
| CG-1b | presence ghost-voice | 0 | 0 | 0 | 2 | 2 |
| CG-1c | presence omission | 0 | 1 | 0 | 0 | 1 |
| CG-2a | place-noun desync | 0 | 0 | 0 | 2 | 2 |
| CG-2c | unnarrated relocation | 0 | 0 | 0 | 1 | 1 |
| CG-3a | object phantom-commit | 0 | 0 | 0 | 1 | 1 |
| CG-4 | combat/health mirror | 0 | 0 | 0 | 0 | 0 |
| CG-5 | addressee desync | 0 | 0 | 0 | 1 | 1 |
| CG-7 | ungrounded quantity | 0 | 0 | 0 | 0 | 0 |
| CG-0 | §0 forbidden-token scan | 0 | 0 | 0 | 0 | 0 |
| **Total** | | **0** | **1** | **0** | **7** | **8** |

The three pre-ROM-3 files (bridge, both 07-02/07-03-03-56 v1 runs) carry **zero** `interior` /
`roomOccupants` / `material` fields (independently verified: `grep`-counted 0/48 turns with `interior` in
canon across all three) — every field-gated comparator (CG-1b, CG-2a, CG-2c) correctly went DORMANT rather
than false-flagging. This is the graceful-degradation behavior the design doc calls for and CG-P1's U389
locks in.

## Hand-review — every flag, confirmed or false-positive

**Method.** For each flag, the offending DM prose is placed beside the exact canon field/value the
checker's pointer names, and the full turn record (player line, DM line, mechanics line, canon bundle,
judge verdict) is read to confirm or refute the contradiction independently of the checker's own claim.

### v1 (07-02 20-59-10) — 1 flag

**CG-1c — presence omission — [rules-lawyer t4] — WARN**
Player: *"Who are these people milling about — anyone here got a name and a problem I can help with?"*
DM: *"Asha the guard is right here."*
Canon `npcsPresent`: `["Elske Nightherd","Dalla","Asha","Ashblade","the Lingerer"]` (5 names, outside —
`interior` absent from this pre-ROM-3 bundle).
**Verdict: CONFIRMED, but a WEAK/marginal one — correctly scoped to WARN, not FAIL.** The DM named only 1 of
5 present NPCs in reply to a direct "who's here" ask. Per the design doc's own taxonomy (§3, CG-1c), a real
DM needn't enumerate everyone — terse, one-NPC answers are common and often good DM craft (avoid the
"reads like an inventory dump" failure). This is a legitimate soft signal (something WAS omitted) but not a
hard contradiction the way CG-1b/2a are — the severity derivation correctly keeps it WARN. Judge (v1) passed
it with note "Asha the guard is present in canon" — the judge's RAG axis only checks the ONE name that WAS
used, so it has no reason to flag an omission; this is a genuine (if minor) axis-omission instance, just
below the bar of a hard incoherence.

### v1 (07-03 11-45-56) — 7 flags

**CG-1b — presence ghost-voice — [chaos t3] — FAIL**
Player: *"I set fire to the straw pallet and watch the cottage burn."*
DM: *"...as the Lingerer stumbles back with a sharp cry..."*
Canon: `interior.roomName = "Bedchamber"`, `roomOccupants = []`.
**Verdict: CONFIRMED.** "the Lingerer" is in `npcsPresent` (the node-level roster) and physically reacts
("stumbles back with a sharp cry") inside a room canon says has zero occupants. Judge (v1) passed with note
"Arson resolved in fiction with named present NPC" — the judge checked that the Lingerer exists SOMEWHERE
in canon (true) and never checked whether the Lingerer is in THIS room (the axis that doesn't exist).
Textbook axis-omission, not judge carelessness.

**CG-1b — presence ghost-voice — [rules-lawyer t8] — FAIL**
Player: *"So if Elske isn't here, who just said 'that's lost to me' when I asked about the chest?"*
DM: *"Elske Nightherd shrugs. 'Can't say. No record I've ever seen.'"*
Canon: `interior.roomName = "Bedchamber"`, `roomOccupants = []`.
**Verdict: CONFIRMED — the strongest flag in the corpus.** The player's own line calls out the exact
contradiction one turn in advance ("if Elske isn't here, who just said...") and the DM's very next turn has
Elske speak again anyway, with `roomOccupants` still empty. Judge (v1) passed with "Elske is present per
canon and responds in-voice with no fabricated fact" — same axis-omission pattern, made worse because the
player already flagged it in-fiction and the DM did not course-correct.

**CG-2a — place-noun desync — [newbie t8] — FAIL**
Player: *"I'll head through the doorway toward the front of the cottage."*
DM: *"...the front room opens before you."*
Canon: `interior.roomName = "Pantry"`.
**Verdict: CONFIRMED.** "front room" is a room-identity noun (not a spatial qualifier like "back room") and
it does not match "Pantry." Judge (v1) passed with `rag.checked:false` — the judge's RAG axis never
triggered because no proper name/count/date was asserted; a place-identity claim doesn't register as a
"factual claim" under the v1 rubric's own definition, so it was structurally invisible to the axis that
would have caught it.

**CG-2c — unnarrated relocation — [newbie t9] — FAIL (overlap-confirmation, not a false-PASS)**
Player: *"Oh good, it worked. What do I see in this front room?"*
DM: *"...front room of the cottage..."* while canon shows `interior.roomId` flipped from Pantry (t8) to
Bedchamber (t9) with zero movement intent in either the player or DM line this turn.
Canon: `interior.roomName = "Bedchamber"` at t9 (was "Pantry" at t8).
**Verdict: CONFIRMED, and this one the judge ALSO caught** — v1 verdict is `CANON_HALLUCINATION`, med
severity, note: *"Canon says the current interior room is 'Bedchamber', but the DM describes a 'front room'
of a cottage with materials... contradicting canon shell 'timber'."* This is the design doc's predicted
"overlap-confirmation" case: CG-2a+2c both fire independently on a turn the judge independently flagged,
which is evidence the checker's classes are pointing at real phenomena, not manufacturing structure — the
judge and the deterministic checker converge on the same ground truth here, from different mechanisms.

**CG-3a — object phantom-commit — [rules-lawyer t10] — FAIL**
Player: *"I reach out, grip the lid of the iron-bound chest, and lift. Does it open?"*
DM: *"It gives at last — but the wood splinters and the noise carries further than you'd like."*
Mechanics: `[info-check → no-record | nothing grounded to deliver, no roll]`.
**Verdict: CONFIRMED.** "gives at last" + "wood splinters" both assert an irreversible physical commit
(the chest opened, its wood is now broken) while the mechanics line is explicit that nothing was
rolled/recorded/delivered. Judge (v1) passed with "Chest opens with a noisy complication, consistent with
the mixed roll" — this note itself contains an error: the mechanics line for THIS turn shows no roll at all
(the `lastRoll: {roll:10, dc:12, outcome:"mixed"}` in the bundle is a STALE roll from t8/t9, not this turn's
resolution) — a second-order confirmation of the halo effect (fluent, confident prose read as
roll-consistent when it wasn't rolled this turn at all).

**CG-5 — addressee desync — [lore-hound t6] — FAIL**
Player: *"The Lingerer — what's your name, and how long have you lingered here at Wayfarers' Outpost?"*
Mechanics: `[dialogue enter | Asha]`. DM: *"'Asha. I watch the road so others don't have to.' Asha watches
to see what you make of that."*
Canon: `roomOccupants: [{"name":"Asha","role":"guard"}]` (only Asha, not the Lingerer, is bound this turn).
**Verdict: CONFIRMED.** The player explicitly addresses "The Lingerer" by name; the engine's dialogue-bind
and the DM's voiced reply are both Asha, a different NPC with a different role. Judge (v1) passed with
"Asha is a canon NPC; the name is grounded... makes no false specific claim" — RAG only checks that "Asha"
exists in canon (true), never that Asha is the WRONG answerer for who was asked. A real table would have
called this out immediately (the design doc's own framing, confirmed).

### Precision score

**7 of 7 FAIL-severity flags CONFIRMED as real incoherence on hand review (100% precision on the FAIL
tier).** The one WARN flag (CG-1c) is also a real, if minor, signal — no flag reviewed was judged a false
positive. **Precision across all 8 flags (FAIL + WARN): 8/8 = 100%**, comfortably clearing the ≥80% target.
No detector-guard follow-up is needed from this corpus — every fired class earned its flag. (This does not
mean the detectors are free of false-positive RISK in general — the inline guards documented in
`coherence-gate.mjs` remain load-bearing on future, unseen transcripts; it means THIS corpus produced zero
false positives.)

## The falsifiable predictions — scored

### P-A (headline) — **PASS**
**Threshold:** ≥2 new flags on judge-PASSED turns (falsified if <2), precision ≥80% (target; floor 60%
falsifies). **Point estimate named in the design doc: 5.**
**Result:** Tier D flags exactly **5** judge-PASSED turns on `gate-2026-07-03T11-45-56-173Z-v1.jsonl` —
rules-lawyer t8 (CG-1b), chaos t3 (CG-1b), lore-hound t6 (CG-5), newbie t8 (CG-2a), rules-lawyer t10 (CG-3a)
— **exactly** the five named in the design doc's point estimate, no more, no fewer. Plus the predicted
overlap-confirmation (newbie t9, CG-2a+2c, a turn the judge ALSO failed). Hand-review precision: **100%**
(7/7 FAIL flags confirmed). **PASS, hit the point estimate exactly, precision well above the 80% target.**

### P-B (negative control) — **PASS**
**Threshold:** the two 07-02 pre-ROM-3 files add ≤2 state-grounded flags beyond the committed transcript-tier
baseline; existing honest floors (v1: 3→8/48, bridge: 9→13/48 per `COHERENCE_BASELINE_2026-07-02.md`) stand
or rise slightly.
**Result:** the bridge file adds **0** new state-grounded flags. The 07-02 v1 file adds **1** (CG-1c, a
class that only needs `npcsPresent`, present since before ROM-3 — not gated on the ROM-3 fields at all).
Both are ≤2. **Independently re-verified the field-absence claim**: `grep`-counted 0/48 turns carrying an
`interior` key in canon across BOTH 07-02 files — the ROM-3-gated comparators (CG-1b/2a/2c) are provably
DORMANT, not silently under-triggering. Note: this baseline reports the Tier-D **state-grounded** honest
floors (9/48 bridge, 4/48 v1-07-02), which differ from the transcript-tier `coherence-audit.mjs` floors
cited in the design doc (13/48 bridge, 8/48 v1) — the two checkers are different instruments scoring
different classes (state-grounded vs. words-vs-words); CG-P6 is the packet that unifies them into one
number. **PASS** — the checker is not hallucinating structure into bundles that lack the state fields.
Also confirmed as a **third** pre-ROM-3-shaped file: `gate-2026-07-03T03-56-04-236Z-v1.jsonl` (0 `interior`
fields, 0 CG flags) — the design doc only names two files for P-B, but a third behaves identically, which
strengthens rather than weakens the negative control.

### P-C (the root test, PAID) — **RAN — PASS, with a nuance to report honestly**
**Threshold:** the same Opus judge, re-asked with one atomic per-class question on the 5 P-A false-PASS
turns, flips ≥80% to FAIL.
**Ran:** 5 calls to `claude-opus-4-8` (the exact model that produced the original v1 false-PASS verdicts —
confirmed via the JSONL's `run.judge` field: `"claude-opus-4-8 (v1 holistic)"`), using the byte-identical
`JUDGE_SYSTEM` prompt from `engine/ref/rubric.js` (copied by value into a throwaway scratchpad script — no
edit to `engine/ref/rubric.js` or `scripts/dm-playtest.mjs`) plus ONE added atomic per-class yes/no question
appended per turn (e.g. CG-1b: *"Does a named NPC speak or physically act in this DM turn while canon's
interior is set AND roomOccupants is EMPTY?"*).
**Result: 5/5 = 100%** answered the added atomic question **"yes"** (`atomic_flag: true`) — the judge, when
DIRECTED at the specific axis, sees the contradiction every single time. However, a nuance the design doc's
phrasing ("flips to FAIL") doesn't fully anticipate: only **1 of 5** (rules-lawyer t10, CG-3a) also flipped
its own **`bug_class`** away from `NONE` (to `CRUNCH_INCONSISTENCY`) — the other 4 answered the atomic
question correctly (`atomic_flag: true`) while the *holistic* `vibe`/`crunch`/`rag` verdict stayed passing,
because those three axes still don't ask the CG-1b/2a/2c/5 question even with the atomic add-on bolted onto
the SAME prompt. This is not a failure of the prediction — it is the prediction's OWN mechanism, made
visible with more precision than expected: the atomic question, answered in isolation, reliably surfaces the
contradiction (100%, exceeding the 80% bar); the holistic 3-axis verdict structure is what continues to
under-report unless the atomic answer is wired to actually GATE the verdict (exactly what `coherence-gate.mjs`
does deterministically, and what a v2-style `deriveVerdictFromAtoms` would do if CG's atoms were added to
its atom list). **Scored PASS against the letter of the prediction (≥80% flip on the added question) — the
holistic-bug_class-flip nuance is recorded here rather than silently rounded up.**
**Cost:** 5 calls, 10,628 input + 795 output tokens, **$0.073** (Opus 4.8 list rates: $5/M in, $25/M out).
`.budget.json` did not exist yet in this worktree (unset ledger, as the packet anticipated) — spend is
recorded here in the baseline doc instead of the ledger; not a stall condition.

### P-D (the payoff claim) — **PASS**
**Threshold:** the newest run's combined instrument moves 9/48 to ~14/48 (≈+⅓ under-reporting).
**Result:** `gate-2026-07-03T11-45-56-173Z-v1.jsonl` moves from **9/48** (judge alone) to **14/48** (honest
floor, judge ∪ coherence, de-duplicated) — **exactly** the design doc's point estimate. That is a
**55.6%** increase in the measured broken-turn count (9→14 = +5, or +5/9 ≈ +56% relative, ≈+⅓ of the new
total 14 is judge-invisible) — matching the "roughly one-third of the true broken count" framing (5 of 14
total broken turns, 35.7%, were invisible to the judge alone). **PASS, hit the point estimate exactly.**

## Scorecard summary

| Prediction | Threshold | Result | Verdict |
|---|---|---|---|
| P-A | ≥2 new flags, ≥80% precision (point est. 5) | 5 new flags, 100% precision | **PASS** |
| P-B | ≤2 new flags on pre-ROM-3 files (negative control) | 0 (bridge) + 1 (07-02 v1) + 0 (07-03-03-56 v1, bonus) | **PASS** |
| P-C | ≥80% flip to FAIL on atomic re-ask (PAID) | 5/5 = 100% flipped the atomic answer; 1/5 also flipped bug_class | **PASS** (nuance noted above) |
| P-D | 9/48 → ~14/48 honest floor | 9/48 → 14/48 (exact) | **PASS** |

**All four predictions PASS.** None were falsified in this corpus. This is reported plainly, not as a
suspiciously clean sweep to be embarrassed by — the design doc's point estimates were the product of the
SAME hand-scan (`gate-2026-07-03T11-45-56-173Z-v1.jsonl`) that CG-P1 then implemented against and this
baseline now re-verifies; a clean match confirms the implementation is faithful to the diagnosis, not that
the diagnosis was necessarily complete. The design doc's own §8 ("what this instrument is blind to") already
names the ceiling: this reports a LOWER BOUND on true incoherence, same doctrine as `coherence-audit.mjs`'s
own baseline.

## Detector method

See `scripts/coherence-gate.mjs` header comment for the full Tier-D comparator catalog (CG-1a/1b/1c,
CG-2a/2c, CG-3a, CG-4, CG-5, CG-7, §0). Full class taxonomy + false-PASS evidence: `docs/briefs/COHERENCE_GATE.md`
§3.

## CG-P1 follow-up notes (found during this hand-review, NOT fixed here — forbidden file)

- **CG-1c's severity floor may be worth revisiting, not urgently.** The one CG-1c flag reviewed here is a
  genuine but marginal signal (a DM naming 1-of-5 present NPCs in reply to a direct ask). It is correctly
  WARN, not FAIL, per the design doc's own taxonomy — no change needed. Flagging only because it's the one
  class in this corpus where "confirmed" and "borderline" nearly touch; future corpora may want a stronger
  omission threshold (e.g. WARN only when 0 named, not "fewer than roster"). Not acted on here — read-only
  packet, `scripts/coherence-gate.mjs` is a forbidden file for CG-P2.
- **CG-3a's mechanics-staleness risk (rules-lawyer t10).** The judge's own passing note incorrectly treated
  a STALE `lastRoll` (from 2 turns prior) as if it justified the current turn's chest-opening claim. The
  checker itself didn't make this mistake (it correctly reads THIS turn's `mechanics` string, which shows
  `info-check → no-record`), but it's worth flagging for CG-P4 (bundle enrichment): if `lastRoll` is not
  reset/cleared between turns, both judges and future extractors risk the same staleness confusion. Not a
  bug in `coherence-gate.mjs` — a bundle-content observation for the CG-P4 lane.
- **CG-P4's exits/topology view (CG-2b) and clock (CG-6) remain the two biggest coverage gaps**, exactly as
  scoped — no new evidence changes that priority.

## Known false-positive / false-negative risks (carried forward, not re-derived)

Same doctrine as `COHERENCE_BASELINE_2026-07-02.md` and `coherence-gate.mjs`'s own header: precision over
recall by design. Every comparator ships a documented false-positive guard; the counts above are a LOWER
BOUND on real incoherence, not a ceiling — a genuinely new phrasing of any class (an unlisted room noun, an
unlisted speech-verb, a differently-worded commit claim) will be silently missed, not falsely flagged. This
baseline hand-verified that the flags THIS corpus produced are real; it does not claim the corpus's absence
of flags (e.g. CG-4/CG-7 firing zero times, CG-1a/CG-1c firing near-zero) means those classes don't occur —
only that this checker, on these four runs, did not (yet) catch an instance.

## Test coverage

`tests/U389.coherenceGateBaselineRegression.test.js` (CG-P1's lock — exact flag counts + honest floors on
all four real JSONLs; a silent detector regression fails this test). No new test added by CG-P2 — the
packet is a hand-review + report, not a code change; U389 already locks the numbers this doc reproduces.

## Full suite status at baseline time

`node --test`: 9527/9528 passing. The one failure, `U381 — the confidence gate is gone (server.js
/api/move)`, is unrelated to this packet (touches `server.js` intent-gate wiring, which CG-P2 does not
touch) and passes in isolation (`node --test tests/U381*.test.js` → 1/1 green) — an existing intermittent
order/timing flake under full-suite load, not a regression introduced here. No code was edited by this
packet; this is a pre-existing condition noted for completeness, not a CG-P2 defect.
