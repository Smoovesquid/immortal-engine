// ─────────────────────────────────────────────────────────────────────────────
// engine/ref/narrationSource.js — the gate that makes Tier 2 affordable.
//
// THE THESIS (docs/THE_REF.md §"The Thesis"): a judge over EVERY DM output is
// expensive; a DM that only escalates when it knows it's stuck is blind to its
// confident failures. Fuse them: tag each narration with the PATH that produced
// it and invoke the Ref ONLY on the "soft" sources — the known fallback/template/
// decision branches where the gate's failures cluster. Most turns are grounded
// answers → skip the Ref → no cost. You spend the judge exactly where failures live.
//
// The soft signal already exists in the engine's output: the dialogue-ask mode is
// carried in `outcome.mechanics` (playloop.js builds `[dialogue ask | <mode> | …]`).
// So this classifier DERIVES soft/hard from the mechanics tag — no tag needs to be
// scattered across playloop. An explicit `outcome.narrationSource` (if a future
// soft path sets one — e.g. the generic-resolve atmosphere bank) takes priority,
// so the soft-set can grow without changing this contract.
//
// READ-ONLY: classification never mutates anything (Invariant 1).
// ─────────────────────────────────────────────────────────────────────────────

// Dialogue-ask modes the Ref REVIEWS. These are the decisions whose RENDERING can
// fail the way the gate keeps catching:
//   deflected  — the NPC doesn't know → must honest-decline, not dodge with
//                atmosphere or fabricate (THE_REF targets #1 + #3).
//   place      — a place-topic answer that can recite the settlement instead of
//                answering the question actually asked (THE_REF target #2).
//   shared     — the NPC delivers a grounded fact → the polish can over-claim /
//                embellish beyond what canon holds.
//   continuity — an H-9 reconciliation → must reconcile honestly.
// EXCLUDED (intentional epistemic states the Ref must NOT "correct" — doing so
// would break the game's social physics): lied, withheld, claim_recall,
// vision_recognition, recruited, self (grounded identity, low risk).
const SOFT_DIALOGUE_MODES = new Set(['deflected', 'place', 'shared', 'continuity']);

// Explicit narrationSource labels a soft path may set on the outcome (extension
// point; none are wired yet — dialogue is detected from mechanics below).
const SOFT_EXPLICIT_SOURCES = new Set([
  'dialogue:deflected', 'dialogue:place', 'dialogue:shared', 'dialogue:continuity',
  'generic-resolve',       // the gen:s/m/f atmosphere bank (future)
  'observe-fallback',      // observe-only with no content (future)
]);

const DIALOGUE_ASK_MODE_RE = /\bdialogue ask \| ([a-z_]+)\b/i;

/**
 * classifyNarrationSource(outcome) -> { soft: boolean, source: string }
 *
 * `source` is a short label for telemetry/logging (e.g. 'dialogue:deflected',
 * 'hard'). `soft` decides whether the Ref runs the judge this turn.
 */
export function classifyNarrationSource(outcome = {}) {
  // 1) Explicit tag wins (forward-compatible with future soft paths).
  const explicit = typeof outcome?.narrationSource === 'string' ? outcome.narrationSource.trim() : '';
  if (explicit) {
    return { soft: SOFT_EXPLICIT_SOURCES.has(explicit), source: explicit };
  }

  // 2) Derive from the mechanics tag — the dialogue-ask mode is already there.
  const mech = String(outcome?.mechanics || '');
  const m = mech.match(DIALOGUE_ASK_MODE_RE);
  if (m) {
    const mode = m[1].toLowerCase();
    if (SOFT_DIALOGUE_MODES.has(mode)) return { soft: true, source: `dialogue:${mode}` };
    return { soft: false, source: `dialogue:${mode}` };  // intentional state — skip
  }

  // 3) Everything else (combat strikes, meta answers, exits, grounded action
  //    resolves, openers) is HARD — the Ref skips it, no cost.
  return { soft: false, source: 'hard' };
}

export const _internal = { SOFT_DIALOGUE_MODES, SOFT_EXPLICIT_SOURCES, DIALOGUE_ASK_MODE_RE };
