// ─────────────────────────────────────────────────────────────────────────────
// engine/coherence/shadowObserver.js — the SHADOW-MODE coherence observer.
//
// WHAT THIS IS (CG-LIVE-1): the deterministic Coherence Gate comparators
// (engine/coherence/checks.js) run on the LIVE narration path as a passive
// OBSERVER. It computes what it WOULD flag as a desync — and LOGS it, changing
// NOTHING. This is the shadow-first step before ever letting the checker trigger
// an actual regenerate: we measure the LIVE false-positive rate on fresh play
// (the 100% precision from CG-P2 is on HISTORICAL transcripts) before flipping
// the switch. The INT-1 shadow-mode pattern.
//
// THE WHOLE POINT IS TO BE PROVABLY INERT:
//   1. GATED OFF BY DEFAULT. `observeCoherenceShadow` early-returns unless
//      `process.env.COHERENCE_SHADOW === '1'`. With the flag unset, this module
//      does NOTHING — not one byte of behavior changes anywhere (U395 asserts
//      byte-identity). The caller ignores the return value regardless.
//   2. RETURNS NOTHING THAT ALTERS NARRATION. The function is called purely for
//      its side-effect (appending to a shadow jsonl). Its return value is
//      undefined and the call-site (llmAdapter.js) discards it. reviewNarration's
//      return — the narration the player sees — is never touched by this file.
//   3. NEVER THROWS. The whole body is wrapped in try/catch. On ANY error it
//      logs nothing and returns — a shadow observer must never break a turn
//      (Ref Invariant 3). A shadow observer that changes behavior is worse than
//      none.
//   4. worldHash SACRED. It reads `world` (via buildCanonGroundTruth, the same
//      read-only façade the Ref already uses), never mutates it, never touches
//      RNG. The cross-turn prev-canon side-channel is a MODULE-LEVEL Map, NEVER
//      stored on `world` — determinism is untouched by construction.
//
// WHICH COMPARATORS RUN LIVE: the single-turn-capable bank (SINGLE_TURN_DETECTORS
// in checks.js) — CG-1a/1b/1c, CG-2a, CG-2b, CG-3a, CG-4, CG-5, CG-7, CG-6, CG-0.
// The one cross-turn comparator, CG-2c (unnarrated relocation), needs the PREVIOUS
// turn's canon; we supply it from the module-level `PREV_CANON` side-channel keyed
// by session, so CG-2c runs live too WITHOUT any prev-canon ever touching `world`.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCanonGroundTruth } from '../ref/rubric.js';
import { SINGLE_TURN_DETECTORS, detectPlaceDesync, runDetectors } from './checks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

// ── the flag (default OFF → byte-identical) ─────────────────────────────────
export function shadowEnabled() {
  return process.env.COHERENCE_SHADOW === '1';
}

// ── cross-turn prev-canon side-channel (NEVER on `world` — worldHash sacred) ──
// Keyed by a stable-ish session key so CG-2c compares this turn's roomId against
// the SAME session's previous turn, not some other seed's. A plain module-level
// Map: no engine state, no RNG, no persistence. Bounded so a long-running server
// can't grow it without bound.
const PREV_CANON = new Map();
const PREV_CANON_CAP = 512;

function sessionKeyOf(world) {
  try {
    const seed = String(world?.meta?.seed ?? '');
    const campaign = String(world?.meta?.campaignId ?? '');
    return `${seed}::${campaign}`;
  } catch { return 'default'; }
}

function turnCounterOf(world) {
  // A monotonic-ish live turn counter, best-effort. timeline length is the
  // engine's own event count; it advances roughly per turn. Purely for labeling
  // the log line — never load-bearing.
  try {
    if (Array.isArray(world?.timeline)) return world.timeline.length;
    if (Array.isArray(world?.canonLog?.events)) return world.canonLog.events.length;
  } catch { /* ignore */ }
  return null;
}

// ── log sink ────────────────────────────────────────────────────────────────
// Append-only jsonl at docs/playtests/coherence-shadow/<UTC-date>.jsonl. The dir
// is created on demand; the jsonl files themselves are git-ignored (run output).
// The path can be overridden with COHERENCE_SHADOW_LOG for tests / ad-hoc runs.
function shadowLogPath() {
  const override = process.env.COHERENCE_SHADOW_LOG;
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return path.join(ROOT, 'docs', 'playtests', 'coherence-shadow', `${date}.jsonl`);
}

function appendShadowRecord(record) {
  const file = shadowLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n');
}

// ── the observer ─────────────────────────────────────────────────────────────
/**
 * observeCoherenceShadow({ world, candidate, outcome }) -> undefined
 *
 * Side-effect ONLY. Gated OFF by default. Runs the deterministic single-turn
 * comparators (plus CG-2c via the prev-canon side-channel) against the SAME
 * canon bundle the Ref reads, and appends a shadow record to the jsonl. Returns
 * undefined; the caller must discard the return (it exists so the caller can
 * fire-and-forget). Never throws.
 *
 * Returns (for tests only) the array of would-be desync pointers it logged, or
 * `null` when disabled / on error — this return is NEVER used by the narration
 * path (llmAdapter discards it). It lets U394 assert the observer fired without
 * reading the log file.
 *
 * `_canonForTest` is a test-only seam: when supplied, it is used verbatim as the
 * canon bundle instead of buildCanonGroundTruth(world). The LIVE call-site
 * (llmAdapter.js) never passes it — the live path always derives canon from
 * `world`. It exists only so U394 can inject a crafted-desync bundle without
 * hand-building a full interior world.
 */
export function observeCoherenceShadow({ world, candidate, outcome = {}, _canonForTest } = {}) {
  try {
    if (!shadowEnabled()) return null; // flag off → do nothing, byte-identical

    const dm = String(candidate ?? '').trim();
    if (!dm) return null; // nothing to check

    // The exact ground truth the Ref/judge would hold this turn (CG-P4-enriched
    // with roomExits + clock). Read-only; try/catch matches rubric's posture.
    let canon;
    if (_canonForTest !== undefined) {
      canon = _canonForTest;
    } else {
      try { canon = buildCanonGroundTruth(world || {}); }
      catch { canon = {}; }
    }

    const sessionKey = sessionKeyOf(world);
    const turn = turnCounterOf(world);

    // A single live turn record in the exact shape the comparators expect.
    const record = {
      player: String(outcome?.input ?? ''),
      dm,
      mechanics: String(outcome?.mechanics ?? ''),
      mechanicsMeta: outcome?.mechanics && typeof outcome.mechanics === 'object' ? outcome.mechanics : undefined,
      canon,
      // provenance for the log/report
      seed: String(world?.meta?.seed ?? ''),
      persona: sessionKey,
      i: turn,
    };

    // Run the single-turn-capable bank on a one-element array.
    const flags = runDetectors([record], SINGLE_TURN_DETECTORS);

    // CG-2c (cross-turn): compare this turn's interior.roomId against the SAME
    // session's previous turn, supplied from the side-channel — never `world`.
    // We build a two-turn array [prev, this] and run detectPlaceDesync, then keep
    // ONLY the CG-2c flags (CG-2a already ran above on the single-turn call, so
    // we don't want it twice).
    const prev = PREV_CANON.get(sessionKey);
    if (prev && 'interior' in canon && 'interior' in prev.canon) {
      const twoTurn = [
        { player: '', dm: '', mechanics: '', canon: prev.canon, seed: record.seed, persona: sessionKey, i: (turn ?? 1) - 1 },
        record,
      ];
      const placeFlags = runDetectors(twoTurn, [detectPlaceDesync]);
      for (const f of placeFlags) {
        if (f.class === 'CG-2c') flags.push(f);
      }
    }
    // Remember this turn's canon for the next turn's CG-2c (bounded).
    if ('interior' in canon) {
      if (PREV_CANON.size >= PREV_CANON_CAP && !PREV_CANON.has(sessionKey)) {
        // evict an arbitrary oldest-ish entry to stay bounded
        const firstKey = PREV_CANON.keys().next().value;
        if (firstKey !== undefined) PREV_CANON.delete(firstKey);
      }
      PREV_CANON.set(sessionKey, { canon });
    }

    // LOG the shadow record (fired or not — the empty-pointers case keeps the
    // denominator honest for the FP-rate report). NOTHING about narration changes.
    appendShadowRecord({
      type: 'shadow',
      ts: new Date().toISOString(),
      seed: record.seed,
      persona: sessionKey,
      turn,
      input: record.player,
      pointers: flags,
    });

    return flags; // tests only — the narration path discards this
  } catch {
    // A shadow observer must NEVER break a turn (Ref Invariant 3).
    return null;
  }
}

// Test-only: reset the cross-turn side-channel between test cases.
export function __resetShadowState() {
  PREV_CANON.clear();
}
