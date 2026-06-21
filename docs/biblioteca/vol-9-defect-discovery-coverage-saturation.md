# Vol 9 — Defect Discovery & Coverage Saturation

**Biblioteca / Immortal reference volume.** Written for the agent's retrieval, not as a tutorial.
**Purpose:** turn the convergence framework's open questions — *"is the loop closeable? how close to done? how many capabilities remain undiscovered? is a green corpus actually meaningful?"* — from eyeballed hand-waving into **estimates with error bars**. Backs the DISCOVERY signal and validates the strength of the REGRESSION signal.

---

## 0. When to reach for this (triggers)
- **After any gate run** — to update "how many capabilities remain undiscovered."
- Asked: *"is the loop closeable / how close to done / are we converging / when do we stop."*
- A passing corpus feels too easy → *"are the locked assertions actually protective, or do they pass trivially?"*
- Deciding whether another **paid gate** is worth it (marginal discovery value).
- Whenever about to assert "discovery rate ≈ 1 → finite" — that claim is this volume's job to quantify.

## 1. The gap this fills
The convergence framework (`RUNG1_CONVERGENCE_PLAN.md` + `CAPABILITY_LEDGER.md`) runs two signals: **regression** (frozen corpus, must stay green) and **discovery** (new capability-categories per gate). The done-bar leans on *"discovery rate → 0 = finite, closeable."* Today that's eyeballed ("≈1 new this gate"). This volume makes it a number, and separately checks the regression corpus isn't hollow.

## 2. Capture–recapture → residual-capability estimation (the headline)
Estimate how many capabilities you **haven't found yet** from how often gate runs **re-find the same ones**.
- Origin: ecology mark-recapture (Lincoln–Petersen); ported to software defect estimation (Eick, Loader, Long, Votta 1992, capture-recapture for inspections).
- **Two independent samplers** of failures = two gate runs with different seeds / persona-mixes (or gate + a human pass). Run A finds nₐ capability-failures, B finds n_b, **m** found by both → point estimate **N̂ = nₐ·n_b / m**; residual undiscovered ≈ N̂ − |A ∪ B|.
- **Heterogeneity caveat (important):** capabilities are NOT equally catchable (some surface every run, some rarely), and player+judge share a model → Lincoln–Petersen *under-estimates*. Prefer **Chao1** (lower-bound, heterogeneity-robust): **N̂₍Chao1₎ = S_obs + f₁²/(2·f₂)**, where f₁ = capabilities seen in exactly one run, f₂ = in exactly two. Report it as *"at least N remain,"* never *"exactly N."*
- **Immortal use:** treat each gate's per-capability tag set (the C# tags the discovery signal already produces) as a sample. With ≥2 tagged gates, compute Chao1 → log "≈N capabilities likely remain, CI […]" in the ledger discovery log. Prerequisite: **consistent C# tagging across runs** — garbage tags → garbage estimate.

## 3. Discovery / accumulation curves
Plot **cumulative distinct capabilities** vs. gate-runs (or turns). Flattening = saturation; the slope **is** the discovery rate. Rarefaction/extrapolation (Chao & Jost 2012) extrapolates to the asymptote (estimated total) + CI. This is the discovery signal drawn as a curve — track it across gates so "flat" is visible, not asserted.

## 4. Mutation testing → proves the REGRESSION corpus isn't hollow
A green corpus is worthless if the locked assertions pass trivially (too loose). I currently check "are assertions substantive?" by hand (invariant #19 squint). Mutation testing automates it.
- **Method:** inject small faults (mutants) into the engine — flip a grace branch, invert a guard, drop a field from a compound answer — run the corpus, ask *did a LOCKED case go red (kill the mutant)?* **Mutation score** = % killed. Low score = weak corpus.
- **Immortal use:** a handful of *targeted, hand-rolled* mutants per graduated capability (cheaper + more relevant than a full mutation framework). E.g. C1: make `handleMetaQuestion` drop the HP field → C1 corpus MUST go red; if it stays green, C1's locked asserts are too loose. This is the rigorous replacement for my manual "are the promotions genuine?" check.
- Precedent: DeMillo–Lipton–Sayward (1978); PIT (Java), Stryker (JS) — but hand-rolled project-specific mutants are right for us.

## 5. Coverage-guided exploration (the gate as a fuzzer) — later/optional
The adversarial gate (Opus personas exploring freely) **is** a black-box fuzzer. Coverage-guided fuzzing (AFL lineage) maximizes code-path coverage to find new bug-classes faster.
- **Immortal use (later):** instrument which engine routing branches the gate exercises (playloop/grace gates), steer personas toward UNEXERCISED paths → surface capabilities faster + measure coverage saturation as a second "done" signal.
- **Caution:** branch coverage ≠ capability coverage (hitting a branch ≠ testing its correctness). Use as a discovery accelerant, never a done-criterion alone.

## 6. The composite "done" decision (the rule to apply)
A capability — or the whole loop — is **done** when ALL hold:
1. **Regression corpus green** (no backward motion).
2. **Mutation score high** on the graduated capabilities (locked assertions are protective).
3. **Discovery saturated**: N consecutive gates open zero new categories AND Chao1 residual CI lower-bound ≈ 0.
4. **Residual gate failures are phrasing-tail / forgivable SOFT**, not real defects.
This is the rigorous restatement of the convergence plan's done-when.

## 7. Immortal hooks — apply in this order
- **NOW (cheap):** after each gate, compute **Chao1** from ≥2 runs' C# tag sets → log "~N remain, CI […]" in the ledger discovery log. Replaces "≈1 new → finite."
- **NOW (cheap):** hand-roll 2–3 **mutants** per graduated capability → confirm the corpus kills them. Replaces my manual invariant-#19 squint; do it as part of §7 verification of a graduation.
- **LATER:** accumulation curve tracked across gates; coverage-guided persona steering.

## 8. Failure modes / caveats
- Independence + equal-catchability are violated → use Chao1 (lower bound), report "at least N."
- Capture-recapture is only as good as the **C# tagging discipline** — the capability ledger is the prerequisite.
- Don't mutate the whole engine; target graduated capabilities' code paths only (cost control).
- Saturation can be a false floor if the personas/seeds are too narrow to ever reach a class — pair with §5 coverage to know exploration is broad, not just repetitive.

## 9. References / precedent to mine
- Lincoln–Petersen mark-recapture; **Chao (1987)**, **Chao & Jost (2012)** — heterogeneity-robust richness estimators (Chao1, rarefaction/extrapolation).
- **Eick, Loader, Long, Votta (1992)** "Estimating software fault content before coding" — capture-recapture for inspection.
- **DeMillo, Lipton, Sayward (1978)** — mutation testing foundations; PIT, Stryker (modern).
- Coverage-guided fuzzing (AFL lineage, Zalewski).
- *[Freshen: post-2024 ML-eval coverage + LLM-driven test-generation work.]*

## 10. Relation to the rest
Vol 8 says **how** to test (harness, layers, paraphrase-invariance). **Vol 9 says when you've tested ENOUGH (saturation) and whether the tests are STRONG (mutation).** Vol 8 is the instrument; Vol 9 is the stopping rule + the instrument's calibration. Pairs with **Vol 10** (how much to trust the judge that produces the discovery signal).
