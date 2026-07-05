// ─────────────────────────────────────────────────────────────────────────────
// engine/coherence/validator.js — CG-2 (Candidate A): promote the shadow's
// SINGLE_TURN_DETECTORS from a fire-and-forget OBSERVER into a pre-delivery
// VALIDATOR, behind the COHERENCE_VALIDATE flag.
//
// WHAT THIS IS (docs/briefs/CG-LIVE-2-regeneration-design.md §3 Candidate A):
// the same pure, LLM-free, deterministic comparators the shadow observer runs
// (engine/coherence/checks.js), asked in the VALIDATOR position — i.e. as a
// boolean "does this candidate contradict canon?" gate, exactly like
// llmAdapter.js's validateNarrationCandidate already asks ~21 other deterministic
// questions (RL-1 table-leak, location-lock, U245 fled-foe kill-claim, PERC-1
// un-hedge, INFO-HONESTY, …). A fail-severity coherence pointer REJECTS the
// candidate; the existing reject-at-sink fallback machinery ships the base.
//
// WHY A SEPARATE MODULE (not inline in llmAdapter): keeps the adapter diff tiny
// and mirrors how the shadow observer lives in its own pure module. This file has
// NO engine state, NO RNG, NO mutation path — it reads only `world` (via the
// read-only buildCanonGroundTruth façade the shadow already uses) and a candidate
// string. Determinism is untouched by construction.
//
// THE HOUSE LAWS THIS OBEYS (IMMORTAL_INVARIANTS #6, THE_DM_TEST, THE_REF §1-3):
//   - narration ≠ canon; this layer touches WORDS ONLY (it rejects a word-choice,
//     it never writes canon, never a delta, never RNG).
//   - NO new LLM calls in ANY mode — the comparators are pure code (Tim's ruling:
//     "engine authoritative; fewer governing LLMs"). This is REJECT-AT-SINK, not
//     a second author.
//   - NEVER throws, NEVER blocks a turn: every entry point is wrapped so a
//     comparator throwing degrades to "don't block" (ship the candidate) — the
//     LLM/observer layer's silent-fallback contract (Invariant 3).
//   - Deterministic given the same inputs (no wall-clock in the decision; the
//     shadow-compare LOG carries a ts, but the log is a side-effect that never
//     touches the returned narration).
//
// THREE MODES (COHERENCE_VALIDATE):
//   unset / anything-else  → OFF. Byte-identical to today. coherenceRejects is
//                            never consulted by the adapter; not one byte changes.
//   'shadow-compare'       → DECIDE-BUT-DON'T-ACT. Compute the would-be block +
//                            the fallback text, LOG both (wouldBlock + fallbackKind),
//                            but deliver the candidate UNCHANGED. Mirrors the
//                            COHERENCE_SHADOW posture: measure before acting, so a
//                            human eyeballs every would-be swap first.
//   'on'                   → LIVE. A structural-tier fail-severity pointer rejects
//                            the candidate; the adapter falls back to base ONLY IF
//                            the swap gate below says the base is strictly better;
//                            and if base ALSO fails worse-or-equal → coherence-safe floor.
//
// CG-2b — TWO ADDITIONS ON TOP OF THE ABOVE (docs/briefs/CG-2b-cure-beats-disease.md),
// both provoked by the GATE 2026-07-05 locket evidence record (a TRUE CG-6 clock
// miss whose "fix" was a WORSE ghost-voice dodge — proof the old rule trusted the
// fallback blindly):
//   1. SEVERITY TIERING (checks.js CLASS_TIERS/tierOf) — a 'cosmetic'-tier class
//      (CG-6 temporal desync at minimum) NEVER blocks in any mode, regardless of
//      FAIL severity. `coherenceRejects` still surfaces the pointer in `fails`
//      (visibility preserved) but excludes it from `blockingFails`, which is what
//      actually drives `blocks`.
//   2. THE SWAP GATE (`fallbackIsBetter`, below) — even for a genuine
//      structural-tier block, the fallback is no longer trusted unconditionally.
//      Before delivering it, the SAME detector bank runs over the fallback text
//      against the SAME canon bundle, and the swap happens ONLY if the fallback's
//      blockingFails count is STRICTLY lower than the candidate's. A tie (equal
//      counts, including both zero) does NOT swap — the candidate stands, and the
//      caller logs `swapDenied: 'fallback-not-better'` alongside the fallback's
//      own failure set for the record.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCanonGroundTruth } from '../ref/rubric.js';
import { SINGLE_TURN_DETECTORS, runDetectors, SEVERITY, tierOf, TIER } from './checks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

// ── the flag (default OFF → byte-identical) ─────────────────────────────────
// Three positions: 'off' (unset or unrecognized), 'shadow-compare', 'on'.
export function coherenceValidateMode() {
  const raw = String(process.env.COHERENCE_VALIDATE ?? '').trim().toLowerCase();
  if (raw === 'on') return 'on';
  if (raw === 'shadow-compare' || raw === 'shadow' || raw === 'compare') return 'shadow-compare';
  return 'off';
}

// ── the core gate: does this candidate contradict canon? ────────────────────
/**
 * coherenceRejects({ world, candidate, outcome, _canonForTest }) ->
 *   { blocks: boolean, pointers: Array, fails: Array, blockingFails: Array }
 *
 * Runs the SINGLE_TURN_DETECTORS bank over a one-turn record built the SAME way
 * the shadow observer builds it, against the SAME read-only canon bundle.
 * FAIL-severity pointers land in `fails`; WARN-severity classes (CG-1c omission,
 * CG-7 quantity, the escape-combat CG-4 case) are the soft classes a real DM
 * needn't be literal about, so they are surfaced in `pointers` but NEVER
 * contribute to `fails`/blocking (blocking them would fight the DM Test).
 *
 * CG-2b tiering (docs/briefs/CG-2b-cure-beats-disease.md): `blocks` is driven
 * by `blockingFails` — the subset of `fails` whose class tier (checks.js
 * `tierOf`) is 'structural'. A 'cosmetic'-tier FAIL (CG-6 temporal desync at
 * minimum) still lands in `fails` (so a caller can log/inspect it — the pointer
 * is never hidden) but NEVER sets `blocks`. This is the house ruling: a true
 * but atmospheric canon miss (the locket turn: DM said "midday", canon said
 * "morning") must never trigger a fallback swap on its own.
 *
 * Pure single-turn: CG-2c (unnarrated relocation, cross-turn) is deliberately
 * NOT part of this validator — it needs a prev-canon side-channel, which the
 * validator position has no honest access to. CG-2c stays with the shadow
 * observer, which keeps its module-level PREV_CANON map. On a one-element array,
 * detectPlaceDesync runs CG-2a only (prevRoomId stays null), so no phantom CG-2c
 * can fire here.
 *
 * NEVER throws: any error → { blocks:false } (don't block a turn; Invariant 3).
 * `_canonForTest` is a test-only seam mirroring observeCoherenceShadow's — the
 * live adapter never passes it (canon is always derived from `world`).
 */
export function coherenceRejects({ world, candidate, outcome = {}, _canonForTest } = {}) {
  try {
    const dm = String(candidate ?? '').trim();
    if (!dm) return { blocks: false, pointers: [], fails: [], blockingFails: [] };

    let canon;
    if (_canonForTest !== undefined) {
      canon = _canonForTest;
    } else {
      try { canon = buildCanonGroundTruth(world || {}); }
      catch { canon = {}; }
    }

    const record = {
      player: String(outcome?.input ?? ''),
      dm,
      mechanics: String(outcome?.mechanics ?? ''),
      canon,
      seed: String(world?.meta?.seed ?? ''),
      persona: String(world?.meta?.campaignId ?? ''),
      i: null,
    };

    const pointers = runDetectors([record], SINGLE_TURN_DETECTORS);
    const fails = pointers.filter(p => p && p.severity === SEVERITY.FAIL);
    const blockingFails = fails.filter(p => tierOf(p.class) !== TIER.COSMETIC);
    return { blocks: blockingFails.length > 0, pointers, fails, blockingFails };
  } catch {
    // A validator must never break a turn — degrade to "don't block".
    return { blocks: false, pointers: [], fails: [], blockingFails: [] };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CG-2b — the swap gate ("the cure must beat the disease")
//
// PROVENANCE: the GATE 2026-07-05 locket evidence record. The candidate flagged
// CG-6 (cosmetic — never blocks after the tiering above, so this specific record
// no longer even reaches the swap gate). But the record proved a SECOND, more
// general defect the swap gate exists to close: the old rule swapped to the
// fallback unconditionally whenever `blocks` was true, WITHOUT checking whether
// the fallback itself was any good. On that turn the fallback was an Elske
// "no record" dodge — the exact ghost-voice/non-answer pattern INFO-HONESTY
// bans. A structural-tier hard-fail candidate could just as easily lose to an
// even-worse fallback. This function is the fix: before any swap, the SAME
// detector bank runs over the fallback against the SAME canon bundle, and the
// swap happens ONLY if the fallback is STRICTLY better.
//
// "Strictly better" is defined CONSERVATIVELY (ties do NOT swap):
//   fallback's blockingFails.length < candidate's blockingFails.length
// Only blocking (structural-tier, FAIL-severity) counts are compared — a
// cosmetic-tier pointer never blocks either side, so it can't move this needle.
// A fallback with the SAME count (including both zero) is "equal", not
// "better", so the candidate stands — precision over cleverness: a tie is not
// proof the swap helps, and the candidate is what the player already has in
// hand (no swap = no new risk introduced).
//
// Pure comparison over two already-computed verdicts; no I/O, no RNG, no world
// read. Never throws by construction (plain number compare); wrapped anyway so
// a malformed verdict shape degrades to "not better" (the conservative/safe
// answer — when in doubt, don't swap).
/**
 * fallbackIsBetter(candidateVerdict, fallbackVerdict) -> boolean
 * Both args are `coherenceRejects()`-shaped ({ blockingFails, ... }).
 */
export function fallbackIsBetter(candidateVerdict, fallbackVerdict) {
  try {
    const candidateCount = Array.isArray(candidateVerdict?.blockingFails) ? candidateVerdict.blockingFails.length : 0;
    const fallbackCount = Array.isArray(fallbackVerdict?.blockingFails) ? fallbackVerdict.blockingFails.length : 0;
    return fallbackCount < candidateCount;
  } catch {
    return false; // malformed input → conservative "not better" (don't swap)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// The coherence-safe floor (design §2 — the load-bearing nuance)
//
// The base is NOT guaranteed coherent (CG-LIVE-1b: the validator-rejected turns
// produced terse base lines like "Elske shrugs" that themselves ghost-voice an
// absent NPC). So when the BASE flags in 'on' mode, we must not ship it silently
// — we degrade to a guaranteed-inert deterministic floor: the base with any
// sentence carrying a canon-contradicting CLAIM (a ghost-voiced speaker, a
// wrong room-noun, an invented exit, an ungrounded headcount, a phantom commit)
// stripped out, keeping only the pure-description sentences. If nothing grounded
// survives, a minimal sensory line ("The room is quiet.") — never empty, never a
// claim. Pure, deterministic string work; no LLM, no world read beyond canon.
//
// This mirrors PERC-1/U245's discipline: the base carries the correct SHAPE, the
// guard only prevents polish from breaking it — here extended to "and if the base
// breaks it too, strip to the description-only floor."
// ═════════════════════════════════════════════════════════════════════════════

// Split into sentence-ish spans, KEEPING the terminal punctuation (and any
// trailing closing quote/bracket) with each span so the rejoined floor still
// reads as prose and a quoted fragment ('… say."') is never sheared into a bare
// dangling quote. We consume a run of non-terminators, then the terminator(s),
// then any immediately-following closing quotes/brackets. Deliberately simple and
// deterministic; the trailing tail (no terminator) is captured as its own span.
function splitSentences(text) {
  const out = [];
  const re = /[^.!?]+[.!?]+["'”’)\]]*|[^.!?]+$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s) out.push(s);
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width match loop
  }
  return out.length ? out : (text.trim() ? [text.trim()] : []);
}

// A surviving span must be deliverable DESCRIPTION, not an orphaned scrap. It is
// rejected (→ contributes nothing to the floor) when it:
//   - has fewer than two real words (a stranded quote mark, a lone dash), or
//   - is ENTIRELY a quoted string (dialogue) — once the speaker's attribution
//     clause was stripped as a ghost-voice, the bare quote it introduced is
//     orphaned dialogue with no in-room speaker, which is exactly what we must
//     not deliver. The description-only floor carries no speech at all.
function isDeliverableDescription(s) {
  const str = String(s || '').trim();
  const words = str.match(/[A-Za-z]{2,}/g);
  if (!Array.isArray(words) || words.length < 2) return false;
  // Strip surrounding quotes; if what's left is empty, the whole span was a quote.
  const unquoted = str.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (!unquoted) return false;
  // A span whose non-whitespace content is ONLY inside quotes (i.e. removing the
  // outer quotes leaves the same run with no surrounding prose) is dialogue.
  if (/^["'“‘]/.test(str) && /["'”’][.!?]*$/.test(str)) return false;
  return true;
}

// A minimal, always-inert grounded fallback when no description-only sentence
// survives the strip. Names nothing, asserts no roster/exit/headcount/commit —
// pure sensory register, the composer's "you're in the room; it's quiet" floor.
const INERT_FLOOR = 'The room is quiet.';

/**
 * coherenceSafeFloor(baseText, { world, outcome, _canonForTest }) -> string
 *
 * Deterministic. Returns the description-only remainder of `baseText`: every
 * sentence that the fail-severity comparators flag (against this turn's canon)
 * is dropped; the survivors are rejoined. If nothing survives, INERT_FLOOR. The
 * result is re-verified to itself NOT flag (a survivor that still trips a
 * detector is dropped on the second pass); the ultimate floor is INERT_FLOOR,
 * which carries no claim and cannot flag.
 *
 * NEVER throws: any error → INERT_FLOOR (a guaranteed-shippable grounded string).
 */
export function coherenceSafeFloor(baseText, { world, outcome = {}, _canonForTest } = {}) {
  try {
    const base = String(baseText ?? '').trim();
    if (!base) return INERT_FLOOR;

    const canonOpts = { world, outcome, _canonForTest };
    const check = (text) => coherenceRejects({ ...canonOpts, candidate: text }).blocks;

    // Fast path: if the whole base is already clean, return it unchanged.
    if (!check(base)) return base;

    // Drop any sentence that, on its own, trips a fail-severity comparator OR is
    // not deliverable description (a stranded quote/dash, or orphaned dialogue
    // left after a ghost-voice attribution was stripped). What survives is the
    // pure-description remainder.
    const kept = splitSentences(base).filter(s => !check(s) && isDeliverableDescription(s));
    const floor = kept.join(' ').trim();

    // Second pass: the surviving set as a whole must still read as description AND
    // not flag (a cross-sentence combination shouldn't reintroduce a claim, but
    // re-verify — precision over cleverness). If it is empty, degenerate, or
    // still flags, fall to the inert floor.
    if (!floor || !isDeliverableDescription(floor) || check(floor)) return INERT_FLOOR;
    return floor;
  } catch {
    return INERT_FLOOR;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// shadow-compare logging (design §4 rollout step 2)
//
// In 'shadow-compare' mode the adapter DELIVERS THE CANDIDATE UNCHANGED but logs
// what it WOULD have done: the would-block decision, the fallback KIND (base vs
// floor) and the fallback TEXT, so a human reads every would-be swap before any
// player sees one (the architecture-by-principle rule: don't silently swap prose
// you haven't eyeballed). Append-only jsonl, git-ignored run output, overridable
// with COHERENCE_VALIDATE_LOG for tests. Side-effect only; never throws; never
// touches the returned narration.
// ═════════════════════════════════════════════════════════════════════════════
function validateLogPath() {
  const override = process.env.COHERENCE_VALIDATE_LOG;
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return path.join(ROOT, 'docs', 'playtests', 'coherence-validate', `${date}.jsonl`);
}

/**
 * logShadowCompare(record) -> void. Best-effort append; swallows all errors.
 * `record` carries { seed, persona, input, dm, wouldBlock, fallbackKind,
 * fallbackText, pointers }.
 */
export function logShadowCompare(record) {
  try {
    const file = validateLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ type: 'coherence-validate', ts: new Date().toISOString(), ...record }) + '\n');
  } catch { /* logging must never break a turn */ }
}
