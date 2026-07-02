# THE REF — the runtime contract (diagnosis + the detector-escalation design)

*Fable-5 architectural lane · 2026-07-02 · worktree `worktree-agent-a6815a31b4ae9c6ad` (fast-forwarded to `v2-polish` @ `f9c6092` v0.22.0). Companion to `docs/THE_REF.md` (the 2026-06-21 handover spec — the intent); this doc is the **as-built audit + the next mechanism**.*

---

## 0. The one-paragraph verdict

THE REF is **not** greenfield and **not** dark scaffolding — the full validate→regenerate loop is **wired and default-ON on the live DM path** (`server.js:171` — an unset `REF_ENABLED` means enabled). What is actually missing is narrower and cheaper than the plan doc assumed: **the escalation gate is provenance-only and its soft-set is too small.** Today's two gate runs (2026-07-02, 4/48 and 10/48) failed almost exclusively on turns whose mechanics tags (`[read:revealed-item]`, `[info-check → no-record]`, `[clarify:referent]`, `(none)` meta) the Ref classifies as *hard* — the judge never saw the very turns that failed, while running live the whole time. The fix is a **deterministic detector layer**: extend the mechanics-derived soft-set (zero playloop changes — the tags already ride out on `outcome.mechanics`) and add conservative content-shape detectors that can escalate a hard-source turn to the existing judge. No new LLM machinery; the expensive parts are already built, measured, and safe.

---

## 1. What is LIVE vs DARK today (cited to call sites)

### 1.1 LIVE — the full loop runs per-narration, default-ON

The chain, end to end:

| Stage | Where | What |
|---|---|---|
| Client | `public/v1.js:204-223` (`tryAiNarration`) | POST `/api/narrate` with `{world, baseNarration, outcome}`. Runs only when AI narration is toggled on or a session key is set — the whole LLM lane (polish *and* Ref) is opt-in at the UI; with it off the player gets the deterministic base and the Ref never exists. |
| Route | `server.js:133-190` | `/api/narrate`. `server.js:171`: `REF_ENABLED` **defaults ON** (only `0/false/off/no` disables). `server.js:172-174` builds `{enabled, budget: defaultRefBudget, judge, regenerate}` via `buildRefAdapter({world})`. `server.js:187-189`: any route error → base narration (never throws). |
| Polish + Tier 1 | `engine/llmAdapter.js:1203-1243` (`augmentNarration`) | Sonnet polish → **Tier-1 deterministic validator** `validateNarrationCandidate` (`llmAdapter.js:1231`; body `:540-981`) → reject = ship base. ~25 rejection rules: brackets/multi-sentence (`:554-557`), location lock (`:563`), invented proper noun (`:607` via `collectGroundedNouns`/`findInventedProperNoun` `:359-412`), misattributed role (`:608`, H-52), fled→kill claim (`:618-619`), 4 combat-contradiction axes (`:626-683`), wrong-scene/exit/entry desync (`:697-751`), defeated-enemy revival (`:824-849`), mixed-smoothed-to-clean (`:790-799`), invented bio/age/role-noun/quote/presence-denial/purse-receipt (`:801-950`), deliver-or-decline R5a/R5b (`:958-978`). |
| Tier 2 | `engine/llmAdapter.js:1242` → `engine/ref/index.js:52` (`reviewNarration`) | Runs **after** Tier-1 accepts. `classifyNarrationSource(outcome)` gates to soft sources; `budget.turn()` caps ≤1 judge + ≤1 regen per turn (`engine/ref/budget.js:27-60`; `REF_MAX_JUDGE_CALLS` session cap); PASS→ship, REGENERATE→regen→fallback chain **regen → base → candidate** (`index.js:101-117`); every layer try/caught (`index.js:66,83,107,133`). |
| Live adapter | `server/refJudge.js:102-144` | judge = `claude-haiku-4-5`, **atomic yes/no + no-CoT** (`REF_JUDGE_SYSTEM`, `engine/ref/rubric.js:183`); regen = `claude-sonnet-4-6` (`buildRegenSystem` `refJudge.js:70-82`), and the regen line is **re-run through Tier-1** before shipping (`refJudge.js:136`). Garbage verdict → PASS (`refJudge.js:40-52` — guardrail 1, bias to answer). |

The soft-set that is live (`engine/ref/narrationSource.js`):
- dialogue-ask modes `deflected | place | shared | continuity`, **derived from the mechanics tag** (`narrationSource.js:33,43`; tag built at `playloop.js:1132`) — no playloop tagging needed;
- explicit `narrationSource:'generic-resolve'` — set at `playloop.js:7488` (the content-free gen-bank last resort), riding out at `playloop.js:3325`.

Liveness evidence (not inference): `docs/playtests/opus-gate-2026-06-23-REF-flagon.md` — first flag-ON gate, zero Ref-caused regressions, the 3 named dodge/misroute/fabrication targets caught 5/5 with 2 PASS controls; `scripts/ref-falsepos-sweep.mjs` 12/12 good lines PASS → default flipped ON (`server.js:165-167`). Unit coverage U241–U244 (budget, orchestration incl. words-only snapshot equality, live-adapter parsing, generic-resolve source). Commit trail: `4f44e2c` (P1 rubric) → `2f9f7d2` (P2 source+budget) → `71d1bfc`/`2a6fae4` (P3 orchestration + live adapter) → `c16dd15`, `2f0c272`.

Sibling Tier-1 on the NPC-voice lane: ML-1 `validateNpcVoiceCandidate` (`llmAdapter.js:428-483`) gates `/api/npc-voice` (`server.js:339`).

### 1.2 DARK / the real gaps

1. **The soft-set misses today's failure carriers.** All of these mechanics tags classify *hard* → Ref skips: `[clarify:referent]` (`playloop.js:1321,1836,2951,4953,6778`), `[read:revealed-item | …]` (`playloop.js:6302,6309`), `[info-check → no-record | …]` (`playloop.js:6955`), `[egress:repair]` (`playloop.js:605`), and every meta answer with mechanics `(none)`. Cross-check §2: nearly every wrong-words failure in the 2026-07-02 gates rode one of these.
2. **`observe-fallback` is declared, never set** (`narrationSource.js:40` lists it in `SOFT_EXPLICIT_SOURCES`; grep: only `generic-resolve` is ever assigned).
3. **Half the verdict space is unreachable live.** `REF_VERDICTS` defines four kick-backs (`rubric.js:154-161`), but `REF_JUDGE_SYSTEM` only offers PASS/REGENERATE/REDIRECT_UNANSWERABLE (`rubric.js:205-210`) and never requests `dm_line` — and `index.js:122-129` only honors a kick-back **with** a `dm_line`, else ships the candidate. So DECOMPOSE/REPHRASE/DECLINE_INAPPROPRIATE, and effectively REDIRECT too, are dark. (Directionally consistent with guardrail 1; recorded here so nobody "discovers" it as a bug.)
4. **No content-shape detectors as escalators.** Tier-1's rules are *rejectors of the polish* (fall back to base — they assume the base is good). None of them can *summon the judge*, and none target machine-shape (stat-block runs, broken list glue, mechanics grammar in prose) because those artifacts usually arrive **in the base itself** — the assumption Tier-1 rests on is exactly what today's residual breaks.
5. **`/api/npc-voice` has no Tier-2.** Deflected-mode tone was explicitly deferred "belongs to THE_REF" (`llmAdapter.js:427` comment) and never picked up.
6. **No runtime telemetry.** Verdict/class/spend are not logged, so a gate transcript cannot distinguish "judge PASSed a bad line" from "regen fell back to an equally bad base" (see the death-sense case, §2.2).

---

## 2. The evidence — what the 2026-07-02 gates actually failed on

Two runs today (main repo, untracked): `opus-gate-2026-07-02-P10-AG3.md` (4/48) and `opus-gate-2026-07-02-postfamily.md` (10/48). Both ran **through the live, default-ON Ref** (the harness posts to the dev server: `scripts/dm-playtest.mjs:155`). Classified against the Ref:

| Failure (gate) | Mechanics tag | Ref saw it? | Why it shipped | Right home |
|---|---|---|---|---|
| Letter read answered with mood ("some names are kept closer…") | `[read:revealed-item \| …]` | **No — hard** | Soft-set gap; Tier-1's R5 deliver-or-decline (`llmAdapter.js:958`) only fires on `infoSeeking`+roll, and reads have no roll | **REF-D1** (soft-set) |
| "You'll find well, workshop, well; folk worth knowing: Dalla, Asha… — given hedged" (broken glue) | `[info-check → no-record \| …]` | **No — hard** | Soft-set gap + no shape detector | **REF-D1** (soft-set + detector) |
| Stat-block readout as prose on a sheet ask ("MIGHT 6 (-2), AGILITY 6 (-2)…") | `(none)` | **No — hard** | Meta path; no shape detector | **REF-D1** (detector) + Tier-0 prose render |
| Gravedigger-class ask misread as a person; hesitation-mood shipped | `[clarify:referent]` | **No — hard** | Upstream intent misroute; the words then dodge | intent lane; **REF-D5** guards the words |
| "Who's in the next room?" → "You step through into the next room." | `(none)` | No — hard | Movement swallowed the question — AG-3 egress-door class | intent/egress lane |
| Death-sense NAT-20 → "You manage the death-sense… it goes your way" (×3) | `[roll… → success]`, gen bank | **YES — soft** (`generic-resolve`) | **The Ref cannot fix an empty base**: judge may flag EMPTY_SUCCESS, but regen's contract is "convey EXACTLY the base, invent NOTHING" (`refJudge.js:75-78`) — re-voiced emptiness is still empty; fallback = the same empty base | **Tier-0** (REF-T0: compute sense content; DS-1a extension) |
| Egress names "Old Shrine/Sooted Bridge" flagged as hallucination | `[egress:repair]` | No — hard | **Judge-oracle bug, already fixed** — real map neighbors were missing from the oracle; `nearbyPlaces` added in `2f0c272` (`rubric.js:51-61`) | done |
| Burning-window clarify loop, no damage roll | `[window:exit\|which]` | No — hard | Engine resolution gap, not words | combat/hazard lane |

Two structural lessons fall out:

**(a) The frontier is the escalation gate, not the judge.** The judge+regen machinery is proven (5/5 targets, 12/12 false-pos sweep) and was *running* during every failure above. It was never invoked on the failing turns.

**(b) Tier-2 has a hard floor: it cannot add content.** The words-only contract (V11 — never let the model set the fact) means an EMPTY_SUCCESS whose *base* is empty is structurally beyond the Ref. Those failures belong to Tier-0 (the engine must compute what the success revealed — the DS-1a "definite negative" pattern extended to sense-type actions). Any design that asks the Ref to "fix" these would have it inventing canon — the IG-8 cataclysm. The doc says this loudly so the next gate isn't read as a Ref failure.

---

## 3. The hypothesis, confirmed with a refinement

> *Hypothesis: many artifacts are objectively detectable without an LLM → detector-first, escalate to the LLM Ref only when a detector fires, regenerate words-only, silent-fallback.*

**Confirmed** — with one refinement and one refutation:

- **Confirmed:** the artifacts are overwhelmingly deterministically detectable, and the live system already *is* detector-first in the strongest sense: **provenance detection** (which code path produced the base) is free, exact, and already carried by `outcome.mechanics` — the engine self-reports which branch it took. This beats content-sniffing wherever it applies: `generic-resolve` *is* the empty-success detector; `[read:revealed-item]` *is* the read-turn detector. Extending this set requires **zero playloop edits** (the classifier derives from the tag — the design `narrationSource.js` anticipated at `:12-16`).
- **Refinement:** content-shape detectors (stat-block runs, mechanics grammar, broken list glue) are the *second* detector family, needed only where provenance is silent (meta `(none)` turns, template glue bugs). They belong as **escalators to the existing judge**, not as rejectors — rejecting to base is wrong when the base itself carries the artifact.
- **Refuted as a replacement policy:** "escalate ONLY on detector fire" would drop the judge from the dialogue soft-set, where the real fuzzy classes live (ATMOSPHERE_DODGE, QUESTION_MISROUTE — no reliable regex exists; that is *why* Road-A plateaued). The correct policy is the **union**:

```
escalate to judge  ⇔  soft(provenance)  ∨  (source == 'hard' ∧ contentDetector(candidate) fired)
never escalate      —  intentional epistemic dialogue modes (lied/withheld/claim_recall/…)
                        — the Ref must not "correct" social physics (narrationSource.js:30-33)
```

**Atomic vs holistic (V17/V14) — already decided correctly, keep it:** the offline gate keeps the holistic CoT `JUDGE_SYSTEM` (discovery; eval lane's file, `rubric.js:103`); the runtime keeps the atomic no-CoT `REF_JUDGE_SYSTEM` (`rubric.js:183`) — atomic yes/no atoms, no reasoning trace, garbage→PASS. The detector layer extends the same principle one step further: **any atom computable in code moves out of the model entirely.** V10 stays honored: the locked corpus is the primary regression signal; the gate (and now Ref telemetry) is the noisy discovery pointer.

---

## 4. The architecture — detector-escalation (the design)

### 4.1 The deterministic detector set

**Family A — provenance (mechanics-tag derivation; extend `classifyNarrationSource`):**

Every candidate tag was put through the repo's false-positive ritual **before inclusion** (`scripts/ref-falsepos-sweep.mjs`, extended with 6 GOOD rows for the new shapes and run live — the data decided):

| Soft source | Mechanics prefix | Sweep | Shipped? |
|---|---|---|---|
| `egress:repair` | `[egress:repair]` (`playloop.js:605`) | PASS (oracle carries `nearbyPlaces`) | **yes** |
| `info-check:no-record` | `[info-check` (`playloop.js:6955`) | PASS (honest hedge) | **yes** |
| `clarify:referent` | `[clarify:referent` (`playloop.js:1321,1836,2951,4953,6778`) | PASS ×2 (unknown-name ask-back + ambiguity narrow) | **yes** |
| `read:revealed-item` | `[read:revealed-item` (`playloop.js:6302/6309`) | illegible-decline PASS; **legible delivery FLAGGED `REGENERATE/FABRICATION`** | **HELD OUT** |

The read flag is the predicted oracle seam confirmed empirically: a *good* letter delivery looks like invention because `buildCanonGroundTruth` cannot see revealed-item text. Including it would systematically demote good read polish to base (content survives — the fallback chain is base-anchored — but spend is wasted and flourish lost). It ships only after the oracle learns revealed/read object text (**REF-D5**; the oracle is shared with the offline gate → coordinate with the eval lane before touching `buildCanonGroundTruth`). Also excluded: `(none)`-meta as a blanket source (too broad; the Family-B content detectors cover its artifact shapes instead).

Contract update note: U244's final case previously asserted the info-decline turn is *skipped* ("no cost"); that documented the old soft-set. It now asserts the new contract (soft by tag, `info-check:no-record`) with the rationale inline, plus a new case pinning "a physical grounded resolve stays HARD" so the zero-cost property is still owned by a test.

**Family B — content shape (new `engine/ref/detectors.js`; pure, never-throws, escalate-only):**

| Detector | Fires on | Class |
|---|---|---|
| `stat-block` | ≥2 stat tokens in `NAME dd (±d)` shape (`MIGHT 6 (-2), AGILITY 6 (-2)…`) — the sheet leaking as prose | MACHINE_DUMP |
| `mechanics-grammar` | raw resolver grammar in prose: `vs DC 12`, `margin:-9`, `→ success/mixed/failure`, `[roll:`-style tag fragments, `gen:s/m/f` bank keys, `n<digits>_<digits>` node ids, `stgen:v` | MACHINE_DUMP |
| `repeated-list-item` | a comma-list of ≥3 items containing a duplicate item ("well, workshop, well") — template glue, never legitimate prose | MACHINE_DUMP |

Design rules for this family (the Road-A discipline transplanted): **conservative by construction** (only signatures real prose never carries), **escalate ≠ reject** (a false fire costs one Haiku call and a biased-to-PASS judge look, not a lost line), **never on intentional dialogue modes**, and every detector is a pure function unit-tested fire/no-fire.

### 4.2 The escalation policy + the loop (as wired)

```
augmentNarration (llmAdapter.js:1203)
  └─ polish → Tier-1 validate (reject → base)          [live, unchanged]
  └─ reviewNarration (engine/ref/index.js)              [live; this packet extends the gate]
       ├─ enabled? judge wired? budget?                  → else ship candidate (silent)
       ├─ source ← classifyNarrationSource(outcome)      [Family A extended]
       ├─ if !soft:
       │    ├─ source ≠ 'hard' (intentional mode) → ship candidate  (social physics)
       │    └─ Family-B detectors on the candidate → no fire → ship candidate (zero cost)
       ├─ judge (Haiku atomic, ≤1/turn) ── PASS → ship candidate
       ├─ REGENERATE → regen (Sonnet, ≤1/turn, re-validated by Tier-1)
       │        → regen ∥ base ∥ candidate   (fallback chain, index.js:101-117)
       └─ any throw/timeout/garbage anywhere → ship candidate/base   (never throws)
```

Unchanged and load-bearing: the budget object (≤1 judge + ≤1 regen per turn; `REF_MAX_JUDGE_CALLS` session cap), the regen re-validation through Tier-1 (`refJudge.js:136`), the words-only return type (a string), and the bias-to-PASS parsing (`refJudge.js:40-52`).

Cost analysis: the three Family-A tags are rare paths (a read, a failed info-check, an egress repair — a handful per session); Family B fires only on shapes that are already bugs. Judge = Haiku at ~160 max tokens. Expected added spend per session: cents. The session cap still bounds the worst case.

### 4.3 What the Ref explicitly does NOT do (the moat restated)

- It returns a **string**. It never mutates `world`, `outcome`, deltas, Canon Log, or RNG (`index.js:11-17`; asserted by U242 snapshot-equality and new U329 deep-freeze + `worldHash`).
- It never throws (`index.js` full-body try/catch; route-level catch `server.js:187`).
- It never adds a fact. Regen conveys the engine's computed base content, invents nothing (`refJudge.js:75-78`). Corollary (§2b): empty base ⇒ the Ref is the wrong tool; the fix is Tier-0.

---

## 5. TASTE BOUNDARY — flagged loudly

**Mechanism (this lane's, designed here, shippable by a worker):** the detector functions and their fire conditions, the soft-set derivation, the union escalation policy, the intentional-mode exclusion, budget/fallback plumbing, tests, telemetry, the falsepos-sweep extension.

**Tim's (proposed here, NOT finalized — nothing below is changed by the foundational packet):**
1. **Regeneration voice** — `buildRegenSystem` wording (`server/refJudge.js:70-82`) is the DM's mouth. It shipped default-ON via the earlier lane, so the current wording has de-facto approval; any *change* (including the REF-D2 content-payload extension below) is Tim's call.
2. **Judge wording/threshold** — `REF_JUDGE_SYSTEM` (`rubric.js:183`) edits, including ever asking for `dm_line` (activates kick-backs = the DM's bounce voice — doubly taste).
3. **Detector-definitive skip-the-judge** — a cost optimization (a certain detector could go straight to regen, saving the Haiku call). Proposed OFF: every new path should pass the calibrated judge until Tim says otherwise.
4. **Stat-blocks on an explicit sheet-ask** — DND_XCOM law is narrate-the-read-never-the-number, but a Rules-Lawyer *asking for the numbers* may be the legitimate exception. The detector escalates; the judge (and ultimately Tim's rubric wording) decides. Where the line sits is taste.
5. **Sweep-gated tag inclusion as the standing rule** — `clarify:referent` was included only after two GOOD-clarify sweep rows PASSed; `read:revealed-item` was held when its GOOD row flagged. Any future tag follows the same ritual; Tim owns any override of a sweep verdict.

---

## 6. Packetized plan (foundational first)

| # | Packet | Contents | Lane |
|---|---|---|---|
| **REF-D1** | **Detector-escalation (foundational — LANDED on this branch)** | `engine/ref/detectors.js` (Family B, 3 detectors) + Family-A soft-set extension in `narrationSource.js` (egress/info-check/clarify — each sweep-cleared) + union-policy wiring in `index.js` + tests U325–U329 + U244 contract update + falsepos-sweep rows. **No prompt-wording changes, no playloop/composer edits, no dm-playtest/`JUDGE_SYSTEM` edits.** | this lane (done) |
| REF-D2 | Content-payload regen | Detector/classifier hands the *computed* missing content (e.g. `canon.npcsPresent` on a who-ask) to regen as "deliver THIS"; unlocks the who-question-roster-silent class. Mechanism is simple; **requires a `buildRegenSystem` wording change → Tim gate**. | worker + Tim |
| REF-D3 | Ref telemetry | One structured log line per reviewed turn `{source, verdict, failure_class, regen_used, shipped}` + surface counts in the gate report. Dissolves the §1.2(6) blindness; feeds the narration corpus (V10: corpus primary). | worker (tiny) |
| REF-D4 | NPC-voice Tier-2 | Run `reviewNarration` (or a voice-shaped sibling) over `/api/npc-voice` deflected-mode lines — the seam ML-1 explicitly deferred (`llmAdapter.js:427`). | worker |
| REF-D5 | `read:revealed-item` inclusion | Extend `buildCanonGroundTruth` with revealed/read object text (**shared with the gate → coordinate with the eval lane**), re-run the sweep's read rows, include the tag iff PASS. | worker (cross-lane, data-gated) |
| REF-D6 | Kick-back activation | `dm_line` in the judge contract + DECOMPOSE/REPHRASE live. **Taste-heavy** (when to bounce + the bounce's voice). | Tim first |
| REF-T0 | Sense-success content (NOT a Ref packet — named so it isn't lost) | Death-sense-class EMPTY_SUCCESS: the engine must compute what a successful sense reveals (extend DS-1a's definite-negative past `sense` verbs to custom-ability framings). `playloop.js` hot file → **Codex lane**, serial. | Codex queue |

---

## 7. Determinism / corpus analysis (why everything stays green)

- **worldHash/replay:** the Ref is downstream of state in the already-non-deterministic narration layer; `reviewNarration` reads the world only through `buildCanonGroundTruth` (a read-only view — `rubric.js:10-12`) and returns a string. U242 asserts input snapshot-equality; new **U329** deep-freezes `world`/`outcome` and asserts `worldHash` byte-equality across a full escalate→regen cycle.
- **Corpus (`npm run convergence`):** `scripts/convergence/runCorpus.mjs` imports no `llmAdapter`/narrate surface (verified by grep) — the 123-case corpus runs the deterministic layer only; detectors cannot perturb it. Verified green post-change (§8).
- **Suite (`node --test`):** all Ref tests run LLM-off with stub judges (U242 pattern); no network. Verified green post-change (§8).
- **Live-path safety:** flag semantics unchanged (`REF_ENABLED`, key-gated); every new branch is inside the existing master try/catch; a throwing detector is caught (U327 asserts); fallback is always the already-validated candidate or the grounded base.

## 8. Verification (this branch, post-packet)

- `node --test`: **9232/9232 pass** (901 suites) — includes the new U325–U329 and the updated U244.
- `npm run convergence`: **123/123 locked (100%)** — the deterministic corpus is untouched by the change (as designed: the Ref layer is downstream of every corpus assertion).
- False-positive sweep (live Haiku judge, .env key, ~$0.03): **17/18 PASS** — all 12 original rows still PASS, plus egress / info-check / illegible-read / clarify ×2. The single flag is the **legible-read delivery**, which is the *predicted* oracle seam (§4.1) — a diagnostic catch, acted on by holding the tag out, not an over-flagging regression.
- Never-throws + words-only: asserted mechanically (U327 judge/regen-throw paths; U329 write-recording proxy + `worldHash` byte-equality across a full escalated judge→regen cycle).

## 9. Falsifiable next-gate predictions

1. **The clarify-smear class dissolves** — postfamily's Gravedigger/last-traveler shape (`[clarify:referent]` rendered as mood that resolves nothing): the judge flags `answers_the_question=false`, and the chain ships the regen or the honest base ask-back. Recurrence with the tag present falsifies the judge's calibration on clarifies (then: corpus row + Tim review).
2. **MACHINE_DUMP glue on `[info-check → no-record]` dissolves** — "well, workshop, well… — given hedged" gets flagged (in_voice=false / detector) and re-voiced from grounded names; recurrence falsifies the regen chain.
3. **Stat-block-shape prose drops** — escalated + re-voiced; a *legitimate* numeric sheet answer surviving the judge is fine (see taste item 4).
4. **Egress fabrication stops being flagged for real neighbors** (oracle fix `2f0c272`) and a genuinely invented neighbor is now caught at runtime (soft tag).
5. **ATMOSPHERE_DODGE on reads PERSISTS until REF-D5** — the newbie-letter class stays deliberately unreviewed (the sweep proved reviewing it today mis-flags good deliveries). Its recurrence at the next gate is *expected* and is REF-D5's evidence, not a REF-D1 miss.
6. **EMPTY_SUCCESS on empty-base sense turns PERSISTS** — predicted NOT dissolved (§2b). If the next gate still shows death-sense filler, that is REF-T0's evidence, not a Ref regression. This is the honest seam.
7. **Zero new false-bounce classes** — the sweep rows + guardrail-1 bias hold; any good line demoted to base at a visible rate falsifies the detector set (they are escalators, so the blast radius is a wasted Haiku call, not a lost line).
