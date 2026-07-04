# Fable brief — the failure META-diagnosis (a level above per-failure patching)

**Model:** `claude-fable-5`, effort `high`/`xhigh` (or `max`). One long, well-specified turn — this is a
whole-corpus reasoning task; take it slowly and get the root right.

---

You are doing a **meta-diagnosis**: a level *above* the per-failure loop. Do NOT fix the next failure. Find the
small set of **structural root-generators** that keep producing the surface failure classes, gate after gate.

## Why now (the treadmill signal)
Rung-1 has run ~47 Opus gates of Road-A whack-a-mole. The pattern that triggered this: we fix one *flavor* of a
class and another flavor of the **same class** surfaces. Concretely — the 2026-07-02 gate had DM_TEST_DEADEND ×4
(a rules question rolled instead of answered; an npc question answered with a nav prompt; a movement question
re-described the room; an unresolved action). We shipped deterministic fixes (DTD-A/B, IOM-P1..P5). The
**re-gate** (`opus-gate-2026-07-02-regate-postDTD.md`): the exact repros held (CANON_HALLUCINATION → 0, movement
held), **but DM_TEST_DEADEND persisted (×3) in a new flavor** — NPC dialogue *deflection*: "who are you? do you
live here?" → the NPC turns and waits, no answer; "who's it from?" → a `[clarify:referent]` loop; "were you born
here?" → a WITS info-roll that NAT1'd into a hedge. 6/48 → 5/48. **Suspicion to test:** a handful of deep roots
keep regenerating the surface classes across different routing paths, so patching one path just *relocates* the
failure.

## Ingest (the failure corpus — all on disk, NO new paid runs needed)
- **All 47 gate reports:** `docs/playtests/opus-gate-*.md` (the full run history — per-turn verdicts, bug
  classes, the `mech:` line, the judge's note). The newest two: `opus-gate-2026-07-02.md` (6/48) +
  `opus-gate-2026-07-02-regate-postDTD.md` (5/48).
- **`docs/RUNG1_QUEUE.md`** — the H-1…H-90 verdict trail. It *literally* reads "fixed class X → class Y
  emerged → fixed Y → Z". That trajectory is the meta-signal; read it as longitudinal data.
- `docs/AGENT_CHANGELOG.md` (every fix), `docs/CAPABILITY_LEDGER.md` (capability graduations),
  `docs/RUNG1_CONVERGENCE_PLAN.md`, `docs/THE_REF.md` (the narration-validator plan — the parked LLM-layer track),
  `tests/corpus/C*.corpus.mjs` (what's locked deterministically), and biblioteca **V14** (judge non-invariance),
  **V15** (LLM-GM: GM proposes / system commits), **V17** (DM narration craft) via `docs/biblioteca/README.md`.

## Deliver — a design doc `docs/briefs/FAILURE_META_DIAGNOSIS.md`
1. **Failure taxonomy.** Cluster every historical failure into a SMALL set of structural root-generators —
   each cited to specific gate reports + turns. For each root, mark **DISSOLVED** (fix held, class gone) vs
   **STILL GENERATING** (keeps resurfacing in new flavors).
2. **The deeper pattern.** Name the 1–3 root behaviors that generate the persistent classes. *Hypothesis to
   confirm or refute (don't assume it):* many DM_TEST_DEADEND instances are ONE root — "a direct player question
   receives a non-answer (hedge / clarify-loop / roll-then-fog / nav-prompt / silent deflection)" — spread across
   the meta, info-seek, dialogue, and clarify routing paths, so fixing one path relocates it to the next.
3. **Falsifiable predictions.** For each still-generating root, predict the failure shapes the *next* gate will
   show if the root is untouched — so the theory is testable, not narrative.
4. **Structural fixes.** For each still-generating root, propose the fix that dissolves the WHOLE family at once.
   **Prefer a single enforced contract over N patches** — e.g. the DTD-B lesson generalized: a "direct question →
   resolves to an answer or an honest in-fiction *I don't know*, never a roll/clarify/nav-bounce" gate that ALL
   callers pass through (DTD-B unified three drifted meta-prechecks behind one predicate — is there a bigger
   version of that?). Packetize each (bounded file-set + test plan + done-when) for a Sonnet/Codex worker.
5. **The Road-A vs THE_REF call.** Split the residual explicitly into **(a) structural/routing** — deterministic,
   dissolvable by a refactor — vs **(b) narration-quality** — right-content-wrong-words, irreducible, needs the
   THE_REF validator or prompt-craft. Say which failures are which, with evidence. (The DM_ARTIFACT_LEAK
   table-dump is the archetype of (b); the dialogue non-answers may be (a).)

## Guardrails (this is where a meta-analysis goes wrong)
- **Judge-bias — you are NOT a cross-family check (biblioteca V14).** The gates had Opus as *both* player and
  judge, and you are same-family. Do not treat the judge's class labels as ground truth. Weight **higher**:
  failures corroborated across MANY runs, and failures reproducible **LLM-off** (the `mech:` line shows a real
  roll/clarify/route — those are engine facts, not taste). Weight **lower / flag**: single-run VIBE calls that
  rest on the judge's taste. Lean on corroboration + determinism as your arbiter, not your own re-judgment.
- **Falsifiable + cited + bounded (SOBRIETY).** Every root cites ≥3 real failures or don't assert it. Every
  prediction is checkable at the next gate. The output ends in a **ranked, bounded packet list** (each
  implementable in one worker session) — NOT a grand manifesto. Kill any beautiful theory you can't ground.
- **Prefer structural Road-A > per-instance patch > LLM-validator.** A refactor that makes a whole family
  *impossible* beats a patch beats a THE_REF check. Reserve THE_REF for the irreducibly-narration tail.
- **Mine the free history — no new paid gates for the analysis.** A fresh full-transcript gate is a possible
  *follow-up* only if one class is genuinely un-adjudicable from the reports; flag it, don't run it.

## Working style
When you have enough to act, act; give a recommendation, not a survey. Ground every claim in a cited artifact —
if you can't point to it, don't assert it. No manifesto; bounded output. This is a **diagnosis + plan** pass —
don't touch engine code. (Optional: if ONE structural root is crisp, determinism-safe, and you're confident, you
MAY land its foundational packet behind a full green gate + `npm run convergence` + determinism — but the primary
deliverable is the diagnosis + ranked plan. Commit local, report the hash, do NOT push — Basecamp verifies.)

## Done-when
`docs/briefs/FAILURE_META_DIAGNOSIS.md` exists with: the cited taxonomy, the 1–3 roots (dissolved vs generating),
the falsifiable predictions, the ranked structural packets, and the explicit Road-A-vs-THE_REF split — concrete
enough that Basecamp can dispatch the top packet to a Sonnet/Codex worker without re-deriving the root.
