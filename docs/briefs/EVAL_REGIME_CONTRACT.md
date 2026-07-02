# EVAL_REGIME_CONTRACT — a debiased, trustworthy Opus gate

*Author: Fable-5 eval-methodology lane (worktree `worktree-agent-a4b7c38493301159d`), 2026-07-02.
Scope: `scripts/dm-playtest.mjs` + judging methodology only. `engine/ref/rubric.js` is READ, never
edited (the Ref/narration lane owns `REF_JUDGE_SYSTEM`); the shared `JUDGE_SYSTEM` stays byte-identical.
Corpus (`npm run convergence`) untouched and PRIMARY. No paid gate was run for this work.*

---

## 0. Verdict in three sentences

The gate's instrument error is real but **mis-shaped relative to the folklore**: the dominant, *measurable*
failure is not "Opus flatters Opus" leniency — it is **over-flagging driven by oracle gaps, plus verdict-label
instability that poisons mode-counting**, on top of structural defects in the harness itself (silent
pass-on-parse-failure, mis-attributed issue text, no per-turn audit trail, a 3× wrong cost model).
A cross-family (Fable) re-judge of 40 real flagged turns disagrees outright with ~10% of the Opus judge's
FAIL verdicts (2 of those confirmed mechanically), calls another ~12% borderline, and would re-label ~16%
of the agreed failures into a different bug class — and the ledger itself has already *deterministically
disproved* two more gate-flagged combat failures (H-93: "judge misread, not an engine miss").
The fix is a **regime**: (R1) persist an auditable per-turn record, (R2) atomic no-CoT verdicts with the
bug class derived deterministically from atoms, (R3) a cross-family judge with one dual-judged bridge run
for series continuity, (R4) mode-counting + Chao1 saturation (the estimator already exists in
`scripts/playtest-harness.mjs`), (R5) an explicit regime marker so the ~58-gate v1 series is never silently
mixed with v2.

---

## 1. Diagnosis — what is actually wrong with the current instrument

### 1.1 Wiring defects (verified in code)

| # | Defect | Evidence |
|---|---|---|
| W1 | **Player and judge are the same model** (`claude-opus-4-8`) | `scripts/dm-playtest.mjs:58-59`. Vol 14 §3.3 (*Who Judges the Judge?*, HEALING 2026): judges are **not generator-invariant**; §6.3: same-family setups ⇒ family-specific preferences + shared blind spots. Vol 10 §2 names the same risk for this exact harness. The ledger already carries the mandate: gate-11 methodology note — *"the Vol-14 Opus×Opus self-preference caveat stands; a cross-family re-judge is the future hardening"* (`docs/CAPABILITY_LEDGER.md:415`). |
| W2 | **One holistic call scores all three gates + class + severity** | `judgeTurn`, `dm-playtest.mjs:245-253`, using `JUDGE_SYSTEM` (`rubric.js:103-147`). Vol 14 §4: prefer *atomic/decomposed criteria… not one giant holistic score*; §3.2 (*Judgment Distribution*, EMNLP-F 2025): CoT-style "think harder" prompting can make judges more confident, not more correct. Vol 17: single-call multi-criterion judging has a **halo effect** (one bad axis contaminates the others). The runtime Ref already moved to atomic no-CoT (`REF_JUDGE_SYSTEM`, `rubric.js:176-215`); the gate never did — comment at `rubric.js:98-102` says the holistic prompt was kept byte-identical *specifically* to protect the bouncing-ruler series. |
| W3 | **Judge parse failure silently scores as ALL-PASS** | `dm-playtest.mjs:252` — `parseJson(out) \|\| { vibe:{pass:true}, crunch:{pass:true}, … note:'[judge parse failed]' }`. A degraded judge (refusal, malformed JSON, truncation) *lowers* the failure count. Invisible in reports. |
| W4 | **Report prints the wrong axis's issue text** | `dm-playtest.mjs:320` — `f.crunch?.issue \|\| f.vibe?.issue \|\| …` picks the first *non-empty* string, which is frequently a PASSING axis's explanation. Real examples: P10-AG3 lists a `DM_TEST_DEADEND` whose printed "issue" is *"No roll needed; reading a legible letter is consistent"* (a crunch **pass** note); `opus-gate-2026-07-02-postfamily.md` turns 3/4/8 same. Humans reading gate reports literally cannot see why a turn failed. |
| W5 | **No per-turn audit trail** — passes, canon bundles, and full DM text are discarded; the report keeps only ≤8 failures/class with the DM line truncated at 220 chars | `writeReport`, `dm-playtest.mjs:292-334`. Consequence: verdicts cannot be re-judged offline, false *negatives* are unmeasurable, and ~10% of my pilot sample was unverifiable from the report alone. H-93's meta note asks for exactly this: *"a cross-family re-judge / per-turn state-dump would cut these false combat fails"* (`CAPABILITY_LEDGER.md:427`). |
| W6 | **Report header hard-codes `player & judge = ${MODEL_PLAYER}`** | `dm-playtest.mjs:301` — the header would silently lie the moment `--judge-model` diverges. |
| W7 | **Cost model is ~3× off** | `dm-playtest.mjs:63-64` bills Opus at $15/$75 per MTok; current Opus 4.8 pricing is **$5/$25** (claude-api reference, cached 2026-06-24). The "~$2.6–2.8/run" figures in every report and the ledger's budget arithmetic are ~3× overstated — a real 96-call gate run costs **≈ $0.90**. This matters for regime design: dual-judged bridge runs are cheap. |

### 1.2 The cross-family pilot (Fable re-judging the Opus judge's recorded verdicts)

Method: I (Claude Fable 5 — cross-family to the Opus player *and* to the Sonnet-polished DM under test)
re-judged **all 40 flagged failing turns** in six on-disk gate reports, applying `JUDGE_SYSTEM`'s own
standards (incl. its NOT-a-hallucination / roll-recall / items carve-outs). No API calls; on-disk
transcripts only. Reports: `opus-gate-2026-06-21-gate9.md`, `-06-23-gate19.md`, `-07-02.md`,
`-07-02-P10-AG3.md`, `-07-02-postfamily.md`, `-07-02-regate-postDTD.md`.

| Fable verdict on the Opus FAIL flag | n / 40 | % |
|---|---|---|
| **Agree** — the turn genuinely fails | 31 | 77.5% |
| **Borderline** — defensible either way (table-realistic NPC withholding, challenge-vs-attack boundary, decline-shape-right-content-wrong) | 5 | 12.5% |
| **Disagree** — judge false positive | 4 | **10%** |

Of the 4 outright disagreements, **2 are confirmed mechanically**, not merely my opinion:

- **"Old Shrine / Sooted Bridge" flagged CANON_HALLUCINATION** (P10-AG3, Lore t8) — they are real
  tallow neighbor nodes; the oracle simply didn't expose map edges. Confirmed by the *post-hoc fix*
  now sitting in `rubric.js:51-61` ("the judge saw only the current node and false-flagged real
  neighbors as fabrication").
- **PC gear list flagged CANON_HALLUCINATION** (`opus-gate-2026-07-02.md`, RL t1: "Canon consumables
  are two Holy water; DM claims Mirror shard, Wooden staff, Worn Blade, Travel helm") —
  `buildCanonGroundTruth` exposes **consumables only** (`rubric.js:79`); weapons/armor/trinkets are
  invisible to the judge. The same seed's *other* report independently shows "Wooden staff and Worn
  Blade" as the PC's real weapons (postfamily RL t5). The oracle is blind, so the judge convicts.

Secondary disagreement channels inside the 31 agreed failures:

- **Class-label instability ≈ 16%** (5/31): e.g. postfamily's "canon has 5 NPCs but DM said 'little of
  note'" is labeled CANON_HALLUCINATION though nothing was *invented* (it's a canon-omission deadend);
  empty-success-on-a-NAT20 oscillates between DM_TEST_DEADEND and CRUNCH_INCONSISTENCY across runs;
  a rolled-on-a-rules-question C5 miss is filed as generic DEADEND. This is the killer for coverage
  math: **Vol 9 §2's explicit prerequisite for capture–recapture is consistent tagging — "garbage tags
  → garbage estimate."** The current instrument cannot feed R4.
- **Severity noise ≈ 10%** (high/med/low assigned inconsistently for same-shaped defects).
- **Duplication inflation**: postfamily's 10/48 contains **three samples of one mode** (empty success on
  consecutive death-sense rolls, turns 2–4). Same-day runs read 4/48 vs 10/48 largely on mode
  duplication + persona luck — count **modes, not turns** (Vol 14 §5.4).
- **Unverifiable ≈ 10%**: 4/40 could not be conclusively re-judged from the report alone (220-char DM
  truncation, missing canon bundle) — the W5 auditability gap, measured.

**External (Basecamp-verified) false positives beyond my sample** — the strongest evidence, because they
were disproved *deterministically*, not by another LLM: gate-12's "4 dmg vs 4 HP yet `defeated:false`"
and "hazard damage not applied" were both reproduced LLM-off and found to be **judge misreads** ("the
second time this gate's combat tags have read worse than the mechanics actually are" — H-93,
`CAPABILITY_LEDGER.md:427`); gate-10's RL-t9 roll-echo flag was logged as "borderline/soft, arguably not
a real fail" (`:407`).

**Direction of the bias.** The measurable error is **over-flagging + label noise**, not leniency. This is
consistent with the setup: the judge is primed adversarial ("Default to FAIL when uncertain",
`rubric.js:107`), it shares a model with the *player* whose framing it over-credits, and its reference
oracle has gaps it treats as fabrications (Vol 10 §7: "reference-guided judging is only as good as the
reference"). The *leniency* half of Vol 14 §6.3 (shared blind spots → under-detection) is **currently
unmeasurable — passes are never recorded** (W5). Weak historical hint that it's real: ATMOSPHERE_DODGE —
the failure class most flattered by pretty prose — went un-named until gate 19 (`rubric.js:170`,
"gate-19 #1") despite the shape existing since gate 5. Only R1+R3 can turn that hint into a number.

**Rubric scar tissue as evidence (RIFT, Vol 14 §3.5: "test the rubric, not just the judge").** The
holistic prompt has needed **four** carve-out patches, each after a false-positive family shipped bad
verdicts: hyperbole/attitude (`rubric.js:123-128`), roll-recall (`:130-134`, "gate-hardening"), item
effects (`:136-141`, H-45), nearbyPlaces oracle (`:51-61`, P10). The rubric fails in production and gets
patched reactively; a regime should make rubric defects *diagnosable* (atoms make each criterion
individually falsifiable) rather than discovered by mis-steering a work-week.

### 1.3 The bouncing ruler, quantified

Raw fail-count series on a monotonically improving engine: gates 7→8→9 = 12→5→10
(`docs/PROMPT_ARCHITECTURE.md` §3 documents this as the bouncing-ruler rule), gates 10→11→12 = 4→12→7,
and **2026-07-02 alone: 4 → 10 → 5 → 6 out of 48** across four same-day runs. The repo's own doctrine
already demotes the % ("trust convergence + the discovery rate, NOT the raw %"); the regime finishes the
job by giving the gate a headline that *can* asymptote: modes discovered + saturation estimate, not turns
failed.

### 1.4 What is NOT wrong

- The **three-signal architecture** (corpus=regression / gate=discovery / human=taste) is correct and
  SOTA-convergent (Vol 10 §4 derives it independently). Nothing here touches it.
- The **shared canon oracle** idea (reference-guided judging) is the highest-value mitigation per
  Vol 10 §3 and stays; its *completeness* is the weak spot (two confirmed FP families above).
- The **personas** are doing their job (stochastic exploration = discovery). Variance in *sampling* is a
  feature; variance in *verdicts* on the same evidence is the defect. The regime targets the latter only.

---

## 2. The regime

Ordered by what the evidence says matters most. R1 is foundational — R2–R4 are unbuildable without it.

### R1 — The audit trail (persist everything, attribute correctly, stop lying)

Every gate run writes, alongside the human report, a JSONL record
`docs/playtests/gate-runs/gate-<date>-<regime>[-<n>].jsonl`: one header line (date, regime, models,
seeds, personas, engine version) + one line per judged turn `{seed, persona, i, player, dm, mechanics,
route, canon, verdict(s), judgeError}` — **including passes and the exact canon bundle the judge saw**.
Report fixes: header states player *and* judge models truthfully (W6); the printed issue comes from the
**failing** axis (W4); judge parse-failures are marked `judgeError` and *counted, never silently passed*
(W3); the cost tally uses per-model current prices (W7).

What this buys, immediately: any historical claim ("the judge misread combat") becomes checkable offline;
a cross-family or human re-judge of ANY run — including its passes, so false negatives finally become
measurable — costs only judge tokens, never a replay; and H-93-style "disprove the flag deterministically"
starts from the recorded canon bundle instead of a reconstruction.

### R2 — Atomic, no-CoT verdicts; the bug class is computed, not narrated

Regime v2 replaces the holistic call with **one call returning eight booleans and nothing else** (no
rationale field, no "think step by step", verdict-only output — the same no-elicited-CoT discipline the
runtime Ref already uses at `rubric.js:176-186`, and the Vol 14 §3.2 lever):

```
intent_addressed · resolved_in_fiction · no_machine_leak            → vibe
dice_fiction_match · state_change_reflected                         → crunch
attack_declared_unresolved                                          → COMBAT_NOT_STARTED
factual_claim_made · claims_grounded                                → rag
```

`bug_class` and `severity` are then **derived deterministically in harness code**
(`deriveVerdictFromAtoms`, exported + unit-tested): fixed priority CRASH > CANON_HALLUCINATION >
COMBAT_NOT_STARTED > CRUNCH_INCONSISTENCY > DM_ARTIFACT_LEAK > DM_TEST_DEADEND > NONE; severity from the
count/kind of failed axes. This removes the judge's freedom to narrate a class (the §1.2 16% label noise
goes to zero *by construction* — label variance can now only come from atom variance, which is the thing
atomic binary checks are demonstrably better at: Vol 10 §3, Vol 14 §4). A short *evidence* call (one terse
sentence for the report) fires **only on derived failures** — so the human report keeps its readability at
~10% of the judging cost, and the evidence text can never change the verdict.

The v2 judge sees byte-identical input to v1 (player/DM/mech/canon) — the A/B isolates prompt+model+output
shape. The atoms' carve-outs (hyperbole, roll-recall, items, nearbyPlaces) are inherited verbatim in the
new prompt, and U330 asserts the mapping is total and the prompt carries no reasoning elicitation
(a cheap RIFT-style rubric lint).

*Honesty note on "no-CoT":* Fable-5 has always-on internal adaptive thinking that cannot be disabled.
The lever we actually control — and the one the Vol 14 evidence is about — is **no elicited reasoning in
the output channel and no reasoning-before-verdict field ordering**. Stated so nobody later "discovers"
the judge still thinks.

### R3 — Cross-family judge, bridged once

In regime v2 the judge defaults to **`claude-fable-5`** ($10/$50 per MTok; judge-leg cost roughly doubles
vs Opus while the total run still lands ≈ $1.3 — cheaper than what we *believed* v1 cost). Player stays
Opus 4.8 (its adversarial-player quality is the gate's asset). This breaks judge≡player identity and
judge/generator family alignment (DM prose is Sonnet-polished; Anthropic-internal families differ, but
the residual same-vendor blind-spot risk is real and stated — the full escape is a second-vendor panel
member, parked as P-EV5 with the repo's existing `openai` dep as the natural vehicle; Vol 14 §3.6/§8.2
panel guidance, Vol 10 §7 "a cheaper non-Opus judge may be biased in other ways — calibrate first").

**Continuity protocol (the historical-comparability decision):** the ~58-report v1 series is preserved,
not retro-fitted. Default regime stays `v1` (byte-identical behavior + R1 fixes, which change *reporting*
truthfulness, never verdicts). The first v2 outing is **one `bridge` run**: every turn judged by BOTH
v1-holistic-Opus and v2-atomic-Fable, agreement printed per-turn, headline still v1 (the series' last
point), v2 series born on the same transcripts (marginal cost of the second judge ≈ +$0.5). After the
bridge: v2 becomes the standing regime; every report and JSONL carries `REGIME v2 — not comparable with
the v1 fail-count series`; the v1 path stays invocable (`--judge-regime v1`) for archaeology. Per the
bouncing-ruler doctrine the raw % was never the trusted signal, so the discontinuity costs little — the
durable series (corpus count, capability ledger, mode ledger) is unbroken.

### R4 — Coverage: count modes, estimate what's left (Chao1)

Each failing turn gets a **mode signature** — v2: `bug_class:<sorted failing atoms>`; v1 fallback:
`bug_class` alone (coarse, noted). The harness appends per-run mode sets to
`docs/playtests/gate-modes.json` and the report grows a **Coverage** section: modes this run, modes
new-vs-ledger, and **Chao1** over cross-run incidence — imported from `scripts/playtest-harness.mjs`
(`chao1`, already Chao-1987-correct with CI and hermetically tested in `scripts/saturation.test.js` —
assemble-not-invent, Vol 16's own headline).

**Worked demonstration on real history** (ledger hand-tags, gates 10–12, incidence per mode:
C5:2 NARR:3 C2:1 C4:1 C8:2 C9:1 C10:2 C12:1 C15:2 TRADE:1):

```
chao1 → S_obs 10 · f1 5 · f2 4 · estimate 13.1 · remaining ≈ 3.1 · CI [11, 29]
```

At gate 12 the human read was "7th consecutive 0-discovery gate → Road-A closed." The estimator, on the
same data, says **≈3 modes (CI ≥1) remained unseen** — and history vindicated it: gates 13–19 surfaced the
narration-mode split now codified as `ATMOSPHERE_DODGE` / `QUESTION_MISROUTE` (`rubric.js:170-171`, "gate-19
#1/#2"). "Zero new capabilities" and "coverage saturated" are different claims; Chao1 tells them apart
(Vol 9 §2–3, §6). Caveats carried over from Vol 9 §8: the estimate is a **lower bound** ("at least N
remain"), it saturates over what the *instrument can express* (personas/seeds too narrow → false floor —
pair with the persona set, don't replace it), and it is only as good as tagging discipline — which is
exactly what R2's deterministic signatures supply.

### R5 — What the gate is FOR stays fixed

Corpus (123 locked, free, deterministic) remains the **only** regression authority; the gate remains a
**discovery pointer** whose every flag is confirmed deterministically (LLM-off repro or corpus target
case) before engine action — v2 does not change that contract, it just makes the pointer less noisy and
its noise auditable (Vol 10 §4 reframe, `PROMPT_ARCHITECTURE.md` §3). Tim stays the taste authority.
The judge never gains write access to anything.

---

## 3. Packetized plan

| # | Packet | Contents | Cost | Status |
|---|---|---|---|---|
| **P-EV1** | **Audit trail + truthful reporting** *(foundational)* | JSONL per-turn persistence incl. canon + passes; failing-axis issue attribution; truthful player/judge header; judgeError counted; per-model price table; `--out-dir`; `--dry-run` (LLM-off structural path) | $0 (free tests only) | **Implemented here** |
| **P-EV2** | **Atomic no-CoT judge (regime v2)** | `--judge-regime v1\|v2\|bridge`; harness-level `GATE_JUDGE_SYSTEM_V2` (rubric.js untouched); `deriveVerdictFromAtoms` + severity derivation; conditional evidence call; v2 judge defaults `claude-fable-5` | $0 to build | **Implemented here** |
| **P-EV3** | **The bridge run** | ONE paid `--judge-regime bridge` run on the current engine: v1 headline + v2 series born + measured v1↔v2 per-turn agreement + first false-negative probe (Fable re-judge of v1 passes, offline from the JSONL) | ≈ $1.4–1.9, **Basecamp+Tim's call** | Planned |
| **P-EV4** | **Coverage/saturation section** | mode signatures; `docs/playtests/gate-modes.json` accumulator; Chao1 + new-mode count in report (import from `playtest-harness.mjs`) | $0 | **Implemented here** |
| **P-EV5** | **Panel + calibration** (later, evidence-gated) | second-vendor or Haiku-4.5 panel member on unstable dims; balanced-accuracy judge metric (Vol 14 §3.6) against a small human-labeled slice from the JSONL; oracle-completeness pass (expose full inventory to `buildCanonGroundTruth` — **Ref-lane coordination required**, it edits rubric.js) | small | Parked until bridge data exists |
| P-EV6 | Visual-gate alignment | port regime knobs to `scripts/dm-playtest-visual.mjs` (own inline judge, same both-Opus defaults at `:53-54`) | $0 | Parked |

Deliberately NOT in scope: ProbeLLM-style search-driven probing (Vol 14 §5.1 — attractive, but the mode
ledger must exist first so search has a target function), persona redesign, any `engine/` or corpus edit.

## 4. Falsifiable predictions (what the bridge run should show)

1. **Agreement**: v1↔v2 pass/fail agreement lands in 80–92%. Below that means one instrument is broken;
   above ~95% means the debiasing bought little and P-EV5 should be re-prioritized downward.
2. **Direction**: v2 flags *fewer* turns than v1 on the same transcripts, with the reduction concentrated
   in (a) oracle-gap hallucination flags and (b) combat-truth misreads (the two confirmed v1 FP families).
   If v2 flags *more*, the self-preference story was backwards and the doc's §1.2 direction claim is wrong.
3. **Label stability**: re-judging the same JSONL twice with v2 flips <5% of derived bug classes
   (only via atom flips), vs the observed ~16% narrative-label noise in v1.
4. **False negatives exist**: the Fable re-judge of v1 *passes* (free, offline, from the bridge JSONL)
   surfaces ≥1 real missed failure per 48 turns, most likely an atmosphere-dodge-shaped one. If zero,
   the shared-blind-spot concern (Vol 14 §6.3) is empirically down-weighted for this pipeline.
5. **Coverage**: the first three v2 runs' Chao1 stays finite with `remaining` trending down; a new mode
   discovered after a "0 new capabilities" human read (the gate-12 pattern) should be *predicted* by a
   nonzero `remaining` beforehand.

Each prediction failing has a named consequence — this contract is falsifiable, not decorative.

## 5. Cost note (corrected)

Measured real usage per 4×12 run ≈ 140k in / 8.5k out. At **current** prices: v1 all-Opus ≈ **$0.90**
(not $2.6–2.8 — W7); v2 (Fable judge) ≈ **$1.3**; bridge (both judges) ≈ **$1.4–1.9** depending on
evidence-call volume. The regime's entire migration costs roughly one *believed* v1 run.

---

*Biblioteca grounding: Vol 9 §§2-3,6-8 (Chao1, tagging prerequisite, composite done-rule) · Vol 10 §§2-4,7
(self-preference, atomic reference-guided checks, corpus-primary reframe, oracle caveat) · Vol 14 §§3.2-3.6,
4, 5.4, 6 (CoT harms judging, generator non-invariance, rubric diagnostics, balanced accuracy, modes-not-counts,
same-family mitigations) · Vol 16 (assemble-not-invent) · Vol 17 (halo effect). Repo grounding:
`PROMPT_ARCHITECTURE.md` §3 (bouncing ruler, three signals) · `CAPABILITY_LEDGER.md:407,415,419,427`
(gate-10/11/12 + H-93) · `rubric.js:51-61,98-147,170-171,176-215` · the six gate reports named in §1.2.*
