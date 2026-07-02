// ─────────────────────────────────────────────────────────────────────────────
// engine/ref/index.js — THE REF (Tier 2): the selective narration second-opinion.
//
// On a SOFT-source turn (narrationSource.js), the Ref sends (player input, the
// engine's mechanics, the proposed narration, canon ground-truth) to a JUDGE; on a
// flagged failure it REGENERATES the words (handing the judge/regen the engine's
// computed facts — "deliver THIS exact content"), or emits an in-voice kick-back.
// Most turns are hard sources → the Ref returns the candidate untouched, no cost.
//
// HARD INVARIANTS (docs/THE_REF.md — violate and you detonate the moat):
//   1. NARRATION ≠ CANON. The Ref returns a STRING (narration) ONLY. It reads
//      (world, outcome, candidate) and emits better WORDS for the SAME facts. It
//      NEVER mutates world, outcome, deltas, the Canon Log, or RNG. The return type
//      is the contract; reviewNarration treats its inputs as read-only.
//   2. DETERMINISM preserved — the Ref is downstream of state, in the (already
//      non-deterministic) narration layer. It touches no state, so worldHash/replay
//      are unaffected.
//   3. NEVER THROWS — silent fallback. Flag off / no judge / judge error / over
//      budget / bad output → return the engine's candidate (or base). The Ref is an
//      ENHANCEMENT, never a dependency.
//   4. The LLM authors WORDS, never canon. A kick-back is DM-VOICED (guardrail 2);
//      the default is to ANSWER (guardrail 1 — bias HARD toward PASS).
//
// The judge + regenerate are INJECTED (so the model — cross-family OpenAI vs
// same-family Anthropic, Open Decision A — is a config choice, and the whole
// orchestration is unit-testable with a stub). The live model adapters are wired
// separately, behind the flag.
// ─────────────────────────────────────────────────────────────────────────────

import { classifyNarrationSource } from './narrationSource.js';
import { detectNarrationArtifacts } from './detectors.js';
import { defaultRefBudget } from './budget.js';
import { buildCanonGroundTruth, REF_VERDICTS } from './rubric.js';

function canonOf(world) {
  try { return buildCanonGroundTruth(world || {}); }
  catch { return {}; }
}

/**
 * reviewNarration(opts) -> Promise<string>
 *
 *   world, outcome, candidate, baseNarration — the narrate layer's existing inputs.
 *   judge       — async ({input, mechanics, candidate, canon, source}) -> verdict|null
 *                 verdict: { verdict: 'PASS'|'REGENERATE'|'REDIRECT_UNANSWERABLE'|…,
 *                            failure_class?, dm_line? }
 *   regenerate  — async ({input, mechanics, base, candidate, canon, failureClass, source}) -> string|null
 *   budget      — a createRefBudget() instance (defaults to the process budget).
 *   enabled     — the flag (Open Decision B: OFF by default).
 *
 * Returns a narration STRING. ALWAYS resolves (never rejects) — Invariant 3.
 */
export async function reviewNarration({
  world,
  outcome = {},
  candidate,
  baseNarration = '',
  judge,
  regenerate,
  budget = defaultRefBudget,
  enabled = false,
} = {}) {
  // The safe fallback for every early-out: the candidate the validator already
  // accepted, or the grounded base if the candidate is empty.
  const safe = (String(candidate ?? '').trim() || String(baseNarration ?? '').trim());

  try {
    if (!enabled) return safe;                       // flag off → zero behavior change
    if (typeof judge !== 'function') return safe;    // no judge wired → fallback
    if (!safe) return safe;

    // Escalation policy (REF-D1 — the union; docs/briefs/THE_REF_CONTRACT.md §4.2):
    // judge a turn when its PROVENANCE is soft, OR when it is plain-hard and a
    // deterministic content-shape detector fires on the line itself (Family B —
    // stat-block runs, resolver grammar, list glue). Intentional epistemic
    // dialogue modes (lied/withheld/claim_recall/…) are NEVER escalated, not even
    // on a detector hit: "correcting" them would break the game's social physics.
    const { soft, source } = classifyNarrationSource(outcome);
    let escalationSource = source;
    if (!soft) {
      if (source !== 'hard') return safe;            // intentional mode → untouchable
      const det = detectNarrationArtifacts(safe);
      if (!det.fired) return safe;                   // clean hard turn → skip, no cost
      escalationSource = det.source;                 // e.g. 'detector:stat-block'
    }

    const t = budget.turn();
    if (!t.canJudge()) return safe;                  // over budget → fallback

    const input = String(outcome?.input || '');
    const mechanics = String(outcome?.mechanics || '');
    const canon = canonOf(world);

    t.useJudge();
    let verdict = null;
    try {
      verdict = await judge({ input, mechanics, candidate: safe, canon, source: escalationSource });
    } catch {
      return safe;                                   // judge error → fallback (Invariant 3)
    }
    if (!verdict || typeof verdict !== 'object') return safe;

    const v = String(verdict.verdict || '').toUpperCase();

    // PASS (or anything unrecognised) → ship the candidate. Bias HARD toward
    // answering (guardrail 1): an unknown verdict must NOT manufacture a bounce.
    if (!v || v === REF_VERDICTS.PASS) return safe;

    // REGENERATE — the judge flagged the candidate as bad (dodge / misroute /
    // fabrication). The safe fallback is therefore the engine's grounded BASE
    // narration (the honest decline / grounded fact), NOT the flagged candidate —
    // never ship a known-bad dodge when the honest base is in hand. Try to
    // regenerate better in-voice words first; fall back to base; candidate last.
    if (v === REF_VERDICTS.REGENERATE) {
      const baseClean = String(baseNarration ?? '').trim();
      const fallback = baseClean || safe;
      if (typeof regenerate !== 'function' || !t.canRegen()) return fallback;
      t.useRegen();
      let redo = null;
      try {
        redo = await regenerate({
          input, mechanics, base: baseNarration, candidate: safe, canon,
          failureClass: verdict.failure_class || 'NONE', source: escalationSource,
        });
      } catch {
        return fallback;                             // regen error → base (not the bad candidate)
      }
      const out = String(redo ?? '').trim();
      return out || fallback;                         // empty regen → base
    }

    // Kick-backs are the EXCEPTION and MUST be DM-VOICED (guardrail 2). We only
    // honor one if the judge supplied an in-character line; otherwise default to
    // answering (return the candidate) rather than emitting a system artifact.
    if (
      v === REF_VERDICTS.REDIRECT_UNANSWERABLE ||
      v === REF_VERDICTS.DECLINE_INAPPROPRIATE ||
      v === REF_VERDICTS.DECOMPOSE ||
      v === REF_VERDICTS.REPHRASE
    ) {
      const line = String(verdict.dm_line || '').trim();
      return line || safe;
    }

    return safe;
  } catch {
    return safe;                                     // belt-and-suspenders — never throw
  }
}

export { classifyNarrationSource } from './narrationSource.js';
export { detectNarrationArtifacts } from './detectors.js';
export { defaultRefBudget, createRefBudget } from './budget.js';
export {
  buildCanonGroundTruth, REF_VERDICTS, REF_VERDICT_LIST, REF_FAILURE_CLASSES,
  REF_JUDGE_SYSTEM, JUDGE_SYSTEM, buildRefJudgeUser,
} from './rubric.js';
