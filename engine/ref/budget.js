// ─────────────────────────────────────────────────────────────────────────────
// engine/ref/budget.js — THE REF's spend/rate guard.
//
// The Ref costs API calls (one judge call, and at most one regeneration call) on a
// soft-source turn. This bounds that spend so the Ref can never run away:
//   • per TURN (one augmentNarration invocation): ≤1 judge call, ≤1 regen call.
//   • per SESSION (the server process): an optional hard cap on total judge calls
//     (REF_MAX_JUDGE_CALLS), so a long-lived dev server can't quietly rack up cost.
// Over budget → the Ref skips and the game keeps the engine's base narration
// (Invariant 3: silent fallback; the Ref is an enhancement, never a dependency).
//
// Deterministic + side-effect-free except its own counters — never touches world
// state (Invariant 1/2).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createRefBudget(opts) -> budget
 *   maxJudgePerTurn   (default 1) — judge calls allowed in one turn.
 *   maxRegenPerTurn   (default 1) — regeneration calls allowed in one turn.
 *   maxJudgePerSession(default ∞) — total judge calls for the process lifetime.
 *
 * Usage (per augmentNarration invocation):
 *   const t = budget.turn();
 *   if (t.canJudge()) { t.useJudge(); ...judge... }
 *   if (verdict === REGENERATE && t.canRegen()) { t.useRegen(); ...regen... }
 */
export function createRefBudget({
  maxJudgePerTurn = 1,
  maxRegenPerTurn = 1,
  maxJudgePerSession = Infinity,
} = {}) {
  let sessionJudge = 0;

  return {
    turn() {
      let judge = 0;
      let regen = 0;
      return {
        canJudge: () => judge < maxJudgePerTurn && sessionJudge < maxJudgePerSession,
        useJudge: () => { judge += 1; sessionJudge += 1; },
        canRegen: () => regen < maxRegenPerTurn,
        useRegen: () => { regen += 1; },
        counts: () => ({ judge, regen }),
      };
    },
    stats: () => ({ sessionJudge, maxJudgePerSession }),
    // test-only: reset the session counter
    _reset: () => { sessionJudge = 0; },
  };
}

function envSessionCap() {
  // Browser-safe: `process` doesn't exist in the browser (see instrument.js).
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const raw = Number(env.REF_MAX_JUDGE_CALLS);
  return Number.isFinite(raw) && raw > 0 ? raw : Infinity;
}

// The process-wide budget the live Ref consults. Per-turn caps are fixed at 1/1
// (the Ref does at most one judge + one regen per turn by construction); the
// session cap is env-tunable to bound a long-lived server's total spend.
export const defaultRefBudget = createRefBudget({ maxJudgePerSession: envSessionCap() });
