# Vol 10 — LLM-as-Judge Reliability

**Biblioteca / Immortal reference volume.** Written for the agent's retrieval, not as a tutorial.
**Purpose:** know how much to trust (and how to harden) the **gate** — `scripts/dm-playtest.mjs` — which is the discovery signal's instrument. The gate runs **claude-opus-4-8 as BOTH the adversarial player AND the judge**, and its verdicts drive every convergence decision. This volume is the instrument's error bars.

---

## 0. When to reach for this (triggers)
- **Before trusting a gate verdict** or acting on a gate **%**.
- The gate % **bounces** run-to-run → *how much is real vs. judge variance?*
- *"Opus judging Opus / is the judge reliable / is this fair to the engine."*
- Designing or **recalibrating** the gate; a judge call that looks wrong (a defensible DM response marked fail, or vice versa).

## 1. The core risk
Opus is **player and judge**. Verdicts → bug-class tags → discovery signal → graduation priorities + the "closeable?" call. A biased/noisy judge poisons the whole loop. The **frozen corpus (deterministic, judge-FREE, $0) is the defense**; the paid gate's judge is the exposed surface. The strategic reframe (see §4) follows directly from this.

## 2. Known judge biases (watch for these)
- **Self-enhancement / self-preference** — a model rates its own family's outputs higher. We have Opus-judge + Opus-player; the engine narration is Sonnet-polished. Risk: leniency toward Opus-player framings, idiosyncratic harshness toward the engine's style. **Shared player+judge model also = SHARED BLIND SPOTS** (both miss the same failure class → false "pass" the loop never learns about).
- **Verbosity / length bias** — judges prefer longer, richer answers. The engine's **deterministic base narration is terse** → may be under-rated even when correct (acute since the convergence path is LLM-off-able).
- **Self-consistency / variance** — same transcript, different verdict across runs. A large chunk of the gate's **bouncing %** is judge variance, not engine change.
- **Position bias** (option order; matters for comparative grading), **sycophancy / authority / format bias** (swayed by confident tone, structure).

## 3. Mitigations (what to actually do)
- **Reference-guided / rubric judging (highest value):** give the judge explicit criteria + the **ground truth** to grade against, not open-ended "is this good." We already did this once — the **H-45 "judge-recal"** exposed `canonGroundTruth` so item answers were graded against real data. Vol 10 says **systematize it**: every capability's judge-check is reference-anchored (grade the response against canon + the C# obligation), never vibes.
- **Atomic / binary rubrics over holistic Likert:** judges are far more reliable on specific yes/no checks (*"answered all 3 parts? Y/N"*, *"rolled on a rules question? Y/N"*) than on 1–10 quality scores. The bug-class tagging is already atomic-ish; the **corpus already encodes per-capability binary obligations** — lean all the way in.
- **Decouple player and judge models:** use a **non-Opus judge** (or at least a different model than the player) to break self-preference + shared blind spots. A cheaper model doing reference-guided binary checks can be MORE reliable than Opus doing holistic scoring.
- **Low-temp judge + (budget permitting) a small panel / majority vote:** cuts verdict variance → less bouncing-% noise.
- **Length/format normalization:** instruct the judge to ignore verbosity; explicitly score **terse-but-correct as PASS** (our deterministic narration is terse by design).
- **Calibrate against a human-labeled gold set:** periodically hand-label a few transcripts → measure judge–human agreement → know the judge's error rate. Never treat verdicts as ground truth without knowing their reliability.

## 4. The key reframe for OUR framework
**The corpus (frozen, deterministic, judge-free, $0) is the PRIMARY signal; the gate-judge is the SECONDARY discovery instrument.** Trust the corpus for regression; treat each gate verdict as a **noisy pointer to a NEW capability**, to be **confirmed by encoding it as a deterministic corpus case** — which removes the judge from the loop for everything already discovered. *We are already doing this.* Vol 10 names **why it's correct**: it minimizes exposure to judge unreliability. The judge only needs to be good enough to *point at* a new failure class; the corpus then makes it judge-independent forever.

## 5. Decision rules
- **Never treat a single gate % as truth** — judge variance is large. Judge by **nature** (bug classes / C# tags), and confirm by re-deriving the failure deterministically.
- When a gate flags a capability, **confirm it deterministically** (a corpus target case) before acting — judge-independent.
- If a judge verdict looks wrong, it sometimes is — **spot-check against canon**; don't auto-trust.
- For the gate's judge config: prefer **reference-guided + atomic per-capability** checks over holistic scoring; consider a **non-Opus judge** to break self-preference.

## 6. Immortal hooks — apply in this order
- **NOW (free, already doing — this is the justification):** corpus = primary; gate verdicts = discovery pointers, each confirmed deterministically before action.
- **NEXT (cheap, high-value):** move the gate's judging from holistic toward **per-capability atomic binary checks anchored to the C# obligations + `canonGroundTruth`** (extends the H-45 recal). Cuts variance + bias at once.
- **NEXT:** try a **non-Opus judge** (or a second judge purely to flag disagreement) to quantify + break self-preference — even occasionally, to calibrate the Opus judge.
- **WATCH:** **verbosity bias against the terse deterministic narration** — if the gate systematically dings correct-but-terse responses, rubric-anchor or length-normalize before believing a low score.

## 7. Caveats
- Reference-guided judging is only as good as the reference — `canonGroundTruth` must be complete + correct (the H-45 recal had to expose the right data first; garbage reference → garbage verdict).
- A cheaper non-Opus judge may be biased in *other* ways — calibrate before trusting.
- **Don't over-engineer:** the corpus already removes the judge from most of the loop. Invest in judge-hardening only proportional to how much you still lean on the paid gate. If the corpus + Chao1 (Vol 9) carry the "done" call, the judge matters less.

## 8. References / precedent to mine
- **Zheng et al. (2023)** "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" — position / verbosity / self-enhancement bias, human agreement.
- Self-preference-bias and sycophancy studies; **G-Eval** (reference/criteria-guided scoring); panel-of-judges / ensemble work.
- *[Freshen: judge-eval moves fast — verify against current (2025+) work on judge calibration, debiasing, and small-model reference-guided judges.]*

## 9. Relation to the rest
Vol 8 builds the harness (incl. the gate). **Vol 9** says when you've tested enough (saturation) and whether the corpus is strong (mutation). **Vol 10** says how much to TRUST the gate's judge while doing so — its error bars — and why the judge-free corpus, not the judge, should carry the weight.
