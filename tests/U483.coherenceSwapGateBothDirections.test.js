// U483 — CG-2b THE SWAP GATE, BOTH DIRECTIONS ("the cure must beat the
// disease"): before any candidate→fallback replacement, the SAME detector bank
// runs over the fallback against the SAME canon bundle, and the swap happens
// ONLY if the fallback's blocking-fail count is STRICTLY lower than the
// candidate's. Ties (equal counts, including both zero) do NOT swap.
//
// (a) synthetic hard-fail candidate + a CLEAN fallback → swap happens.
// (b) same candidate + a fallback that fails EQUAL-OR-WORSE → swap denied,
//     `swapDenied` logged, the base rung is refused (see the note on the
//     coherence-safe floor below for what "the candidate stands" means in
//     the two-rung ladder).
//
// Two levels are tested:
//   1. `fallbackIsBetter` directly (validator.js) — the pure comparison
//      function, in isolation, both directions. This is the load-bearing
//      proof of "strictly better, ties denied."
//   2. `augmentNarration` end-to-end in 'on' mode and 'shadow-compare' mode,
//      driving the REAL finalize()/runSwapLadder seam with a real booted
//      world and REAL LLM-accepted candidates (mocked fetch), so the
//      swap-gate WIRING (not just the helper) is proven, not just simulated.
//
// FIXTURE NOTE — why CG-2a (place-noun desync), not CG-1b (ghost-voice):
// this file's end-to-end candidates must survive Tier-1's
// validateNarrationCandidate BEFORE ever reaching the CG-2 coherence choke
// point (only Tier-1-accepted candidates get that far — see llmAdapter.js's
// `if (!ok) return finalize(base);`). Tier-1 already carries its OWN
// "NPC marked elsewhere but voiced" rule (llmAdapter.js ~line 1096, VOICE_RE)
// that overlaps CG-1b for interior scenes, so a CG-1b ghost-voice fixture gets
// caught a layer too early to exercise the swap gate specifically. CG-2a
// (a wrong room-type noun) has no Tier-1-native equivalent, so it cleanly
// isolates the CG-2b mechanism under test. Verified empirically against a
// real booted 'tallow'/'escape' world before being locked into fixtures below.
//
// A NOTE ON THE TWO-RUNG LADDER (base, then the coherence-safe floor): the
// floor is clean-by-construction (engine/coherence/validator.js
// coherenceSafeFloor strips any sentence that itself flags and falls to a
// static inert line if nothing survives), so whenever the candidate genuinely
// blocks (≥1 structural fail), the floor's 0 blockingFails will ALWAYS beat it
// at rung 2 — this is the PRE-EXISTING "never ship an unmitigated block" safety
// net (U470 already locks this), now expressed as an explicit swap-gate pass
// instead of an unconditional swap. So the end-to-end proof for "equal-or-worse
// fallback" is written at the RUNG-1 (base) level specifically — the base is
// refused as a fallback candidate, exactly mirroring the locket evidence record
// where the base (not a floor) was the worse replacement — while the SEPARATE,
// pre-existing floor rung still catches the case where nothing better exists.
// This is the correct, honest scope of what "the swap gate" governs.
//
// No LLM, no server, no network — pure comparators + augmentNarration's
// LLM-accepted path with a mocked fetch, which routes through the real
// finalize() choke point.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { augmentNarration } from '../engine/llmAdapter.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { coherenceRejects, fallbackIsBetter } from '../engine/coherence/validator.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

async function withEnv(env, fn) {
  const saved = {};
  for (const k of Object.keys(env)) saved[k] = process.env[k];
  Object.assign(process.env, env);
  try { return await fn(); }
  finally {
    for (const k of Object.keys(env)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

function tmpLog() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-2b-')), 'validate.jsonl');
}

function mockFetch(candidateText) {
  return async () => ({ ok: true, json: async () => ({ content: [{ text: candidateText }] }) });
}

// A real detector class: CG-1b (presence ghost-voice) for the direct
// (non-Tier-1) comparator-level tests below.
const ROSTER_CANON = {
  interior: { roomId: 'r1', roomName: 'Bedchamber' },
  roomOccupants: [], npcsPresent: [{ name: 'Elske Nightherd' }],
  enemies: [], inCombat: false,
};
const GHOST_LINE = 'Elske Nightherd shrugs. "Can\'t say."'; // CG-1b, 1 blockingFail
const CLEAN_LINE = 'The bedchamber is cold and still, its shutters drawn tight.'; // 0 blockingFails
const GHOST_LINE_2 = 'Elske Nightherd nods slowly. "I\'ve nothing more to add."'; // CG-1b, 1 blockingFail

// ── end-to-end fixtures (CG-2a — see the FIXTURE NOTE above) ────────────────
// Verified empirically: all three pass Tier-1's validateNarrationCandidate
// against a real booted 'tallow'/'escape' world (interior: Bedchamber); the
// candidate and equalBase both hard-fail with EQUAL blockingFail COUNTS, the
// cleanBase does not.
//
// MR-2b note (CG-ARCH): the candidate's "kitchen" and the equal-base's "cellar"
// each trip BOTH CG-2a (wrong current-room noun) AND CG-ARCH (a room the
// single-storey cottage does not contain — no kitchen, no cellar). Both are
// invented rooms, so both hard-fail with 2 blockingFails — still EQUAL, so the
// swap gate still denies the equal-base exactly as designed. (Before CG-ARCH the
// equal-base used "pantry", a REAL room of the cottage, which trips only CG-2a;
// once CG-ARCH landed that made the candidate a strictly-worse 2-vs-1, breaking
// the "equal" invariant — so the equal-base is now an invented room too, keeping
// the pair equal while both still hard-fail CG-2a as the precondition asserts.)
const E2E_CANDIDATE = 'At Wayfarers\' Outpost, the kitchen opens before you, pans hanging from iron hooks.'; // CG-2a + CG-ARCH (invented room)
const E2E_CLEAN_BASE = 'At Wayfarers\' Outpost, the bedchamber is quiet, dust drifting in the low light.'; // clean
const E2E_EQUAL_BASE = 'At Wayfarers\' Outpost, the cellar shelves stand bare in the dim light.'; // ALSO CG-2a + CG-ARCH (invented room) — equal count

// ─────────────────────────────────────────────────────────────────────────────
// 1. `fallbackIsBetter` directly — the pure comparison, both directions.
// ─────────────────────────────────────────────────────────────────────────────

test('U483: fallbackIsBetter — a CLEAN fallback (0 blockingFails) beats a hard-fail candidate (1 blockingFail)', () => {
  const candidateVerdict = coherenceRejects({ world: {}, candidate: GHOST_LINE, outcome: {}, _canonForTest: ROSTER_CANON });
  const fallbackVerdict = coherenceRejects({ world: {}, candidate: CLEAN_LINE, outcome: {}, _canonForTest: ROSTER_CANON });
  assert.equal(candidateVerdict.blockingFails.length, 1, 'precondition: candidate hard-fails CG-1b');
  assert.equal(fallbackVerdict.blockingFails.length, 0, 'precondition: fallback is clean');
  assert.equal(fallbackIsBetter(candidateVerdict, fallbackVerdict), true, 'a strictly lower fail count IS better — swap');
});

test('U483: fallbackIsBetter — a fallback that fails EQUALLY (same count, different text) is NOT better — swap denied', () => {
  const candidateVerdict = coherenceRejects({ world: {}, candidate: GHOST_LINE, outcome: {}, _canonForTest: ROSTER_CANON });
  const fallbackVerdict = coherenceRejects({ world: {}, candidate: GHOST_LINE_2, outcome: {}, _canonForTest: ROSTER_CANON });
  assert.equal(candidateVerdict.blockingFails.length, 1);
  assert.equal(fallbackVerdict.blockingFails.length, 1, 'the fallback ALSO hard-fails CG-1b — equal, not better');
  assert.equal(fallbackIsBetter(candidateVerdict, fallbackVerdict), false, 'a tie must NOT swap — conservative definition');
});

test('U483: fallbackIsBetter — a fallback that fails WORSE (more blockingFails) is denied', () => {
  // A candidate that hard-fails once (CG-1b) vs a fallback that hard-fails
  // TWICE (CG-1b ghost-voice AND CG-2a wrong room-noun in the same line).
  const worseFallback = 'Elske Nightherd shrugs in the kitchen doorway. "Can\'t say."'; // CG-1b + CG-2a vs Bedchamber
  const candidateVerdict = coherenceRejects({ world: {}, candidate: GHOST_LINE, outcome: {}, _canonForTest: ROSTER_CANON });
  const fallbackVerdict = coherenceRejects({ world: {}, candidate: worseFallback, outcome: {}, _canonForTest: ROSTER_CANON });
  assert.ok(fallbackVerdict.blockingFails.length > candidateVerdict.blockingFails.length,
    `precondition: fallback must fail worse; got candidate=${candidateVerdict.blockingFails.length} fallback=${fallbackVerdict.blockingFails.length}`);
  assert.equal(fallbackIsBetter(candidateVerdict, fallbackVerdict), false);
});

test('U483: fallbackIsBetter — both-zero (candidate already clean) is a tie, not "better"', () => {
  const cleanVerdict = coherenceRejects({ world: {}, candidate: CLEAN_LINE, outcome: {}, _canonForTest: ROSTER_CANON });
  assert.equal(cleanVerdict.blockingFails.length, 0);
  assert.equal(fallbackIsBetter(cleanVerdict, cleanVerdict), false, '0 < 0 is false — not better, even though both are clean');
});

test('U483: fallbackIsBetter — malformed input degrades to "not better" (never throws, conservative)', () => {
  assert.equal(fallbackIsBetter(null, null), false);
  assert.equal(fallbackIsBetter(undefined, { blockingFails: [1] }), false);
  assert.equal(fallbackIsBetter({ blockingFails: 'not-an-array' }, {}), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. End-to-end through augmentNarration's finalize()/runSwapLadder seam.
// ─────────────────────────────────────────────────────────────────────────────

test('U483: precondition — the E2E fixtures pass Tier-1 and carry the expected CG-2a blockingFails counts', async () => {
  const world = boot();
  const candVerdict = coherenceRejects({ world, candidate: E2E_CANDIDATE, outcome: { input: 'look around the room' } });
  const cleanVerdict = coherenceRejects({ world, candidate: E2E_CLEAN_BASE, outcome: { input: 'look around the room' } });
  const equalVerdict = coherenceRejects({ world, candidate: E2E_EQUAL_BASE, outcome: { input: 'look around the room' } });
  assert.ok(candVerdict.blockingFails.some(f => f.class === 'CG-2a'), 'the candidate hard-fails CG-2a (wrong room noun)');
  assert.equal(cleanVerdict.blockingFails.length, 0, 'the clean base carries the correct room noun');
  assert.ok(equalVerdict.blockingFails.some(f => f.class === 'CG-2a'), 'the equal-base ALSO hard-fails CG-2a (a different wrong noun)');
});

test('U483a: ON mode — hard-fail candidate + a CLEAN base → the swap gate approves, base is delivered', async () => {
  const world = boot();
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world, outcome: { input: 'look around the room', mechanics: '' },
      baseNarration: E2E_CLEAN_BASE, enabled: true, apiKey: 'test-key',
      fetchImpl: mockFetch(E2E_CANDIDATE),
    }),
  );
  assert.equal(out, E2E_CLEAN_BASE, 'the swap gate approves the clean base over the CG-2a-hard-failing candidate');
  assert.equal(coherenceRejects({ world, candidate: out, outcome: {} }).blocks, false);
});

test('U483b: ON mode — hard-fail candidate + a base that fails EQUALLY → the base rung is DENIED (the delivered line is never the equal-failing base)', async () => {
  const world = boot();
  const out = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world, outcome: { input: 'look around the room', mechanics: '' },
      baseNarration: E2E_EQUAL_BASE, enabled: true, apiKey: 'test-key',
      fetchImpl: mockFetch(E2E_CANDIDATE),
    }),
  );
  // The base rung is denied (equal CG-2a fails) — the delivered line must NOT
  // be the equal-failing base, proving the base-rung swap was genuinely
  // refused rather than silently taken anyway.
  assert.notEqual(out, E2E_EQUAL_BASE, 'a base that fails EQUALLY must never be swapped in — the base rung is denied');
  // Per the documented two-rung ladder, the floor rung (clean-by-construction)
  // still catches this, exactly as U470 already locks for the analogous
  // both-block case. Whatever ships must itself be coherence-clean.
  assert.equal(coherenceRejects({ world, candidate: out, outcome: {} }).blocks, false,
    'whatever is delivered (the floor, since neither blocking text may ship) must itself be coherence-clean');
});

test('U483b (direct comparator, isolates the base rung from the floor rung): the swap gate DENIES when the base fails equally-or-worse', () => {
  const world = boot();
  const candidateVerdict = coherenceRejects({ world, candidate: E2E_CANDIDATE, outcome: {} });
  const equalBaseVerdict = coherenceRejects({ world, candidate: E2E_EQUAL_BASE, outcome: {} });
  assert.equal(fallbackIsBetter(candidateVerdict, equalBaseVerdict), false,
    'swapDenied — the base fails just as hard as the candidate, so it is not "the cure"');
});

test('U483: SHADOW-COMPARE mode — a swap-approved turn logs fallbackKind:"base" + empty fallbackFails, swapDenied:null', async () => {
  const world = boot();
  const logFile = tmpLog();
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look around the room', mechanics: '', persona: 'rules-lawyer', turn: 7 },
      baseNarration: E2E_CLEAN_BASE, enabled: true, apiKey: 'test-key',
      fetchImpl: mockFetch(E2E_CANDIDATE),
    }),
  );
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.wouldBlock, true);
  assert.equal(rec.tier, 'structural');
  assert.equal(rec.persona, 'rules-lawyer', 'the real persona is threaded through, not the "campaign" default');
  assert.equal(rec.turn, 7, 'the real turn is threaded through, not null');
  assert.equal(rec.fallbackKind, 'base', 'the clean base wins the swap gate at rung 1');
  assert.ok(Array.isArray(rec.fallbackFails) && rec.fallbackFails.length === 0, 'a winning clean base logs an empty fallbackFails set');
  assert.equal(rec.swapDenied, null, 'a successful swap logs swapDenied:null');
});

test('U483: SHADOW-COMPARE mode — a swap-denied turn (equal-failing base) logs fallbackKind:"floor" (base rung denied, floor rung wins) with the base\'s own fails visible', async () => {
  const world = boot();
  const logFile = tmpLog();
  await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look around the room', mechanics: '' },
      baseNarration: E2E_EQUAL_BASE, enabled: true, apiKey: 'test-key',
      fetchImpl: mockFetch(E2E_CANDIDATE),
    }),
  );
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.wouldBlock, true);
  // Base rung denied (equal fails) → the ladder proceeds to the floor rung,
  // which (being clean-by-construction) wins — so fallbackKind reports
  // 'floor', not 'base'. The base-rung refusal itself is proven directly at
  // the comparator level above (U483b tests).
  assert.equal(rec.fallbackKind, 'floor', 'the base rung was denied (equal fails); the floor rung (always-clean) wins next');
  assert.ok(Array.isArray(rec.fallbackFails), 'fallbackFails is always an array shape');
  // The delivered narration (shadow-compare NEVER alters it) is still the
  // original candidate — proving shadow-compare truly never swaps live.
  assert.equal(rec.dm, E2E_CANDIDATE);
});

test('U483: shadow-compare NEVER alters delivery regardless of the swap-gate outcome (decide-but-don\'t-act holds)', async () => {
  const world = boot();
  const logFile = tmpLog();
  const out = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: 'look around the room', mechanics: '' },
      baseNarration: E2E_CLEAN_BASE, enabled: true, apiKey: 'test-key',
      fetchImpl: mockFetch(E2E_CANDIDATE),
    }),
  );
  assert.equal(out, E2E_CANDIDATE, 'shadow-compare delivers the candidate unchanged even though the swap gate would approve a real swap');
});
