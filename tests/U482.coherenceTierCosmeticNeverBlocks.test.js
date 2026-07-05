// U482 — CG-2b THE LOCKET FIXTURE: severity tiering (rule 1). CG-6 (temporal
// desync) is 'cosmetic'-tier, so it must NEVER block a turn in any validator
// mode, even though it is a genuine FAIL-severity pointer.
//
// PROVENANCE — the evidence record is VERBATIM from docs/briefs/CG-2b-cure-
// beats-disease.md (the raw log is gitignored by design; the brief pastes it as
// the fixture). This is a REAL turn from the GATE 2026-07-05 shadow-compare run
// (seed 'tallow', persona 'campaign'): the DM candidate said "midday light"
// while canon `clock.segment` was "morning" — a true but cosmetic canon miss —
// and the old rule's fallback was WORSE (a ghost-voiced "no record" dodge).
// This test proves the fix's first rule: cosmetic tiering makes this candidate
// un-rejectable in the first place, so the swap gate (U483) never even needs to
// run for this specific turn.
//
// The end-to-end tests use a REAL booted 'tallow' world (the U468/U469/U470
// `boot()` convention) rather than a hand-mocked canon bundle: a freshly booted
// world has `time.hours:0`, which `timeOfDayGroundTruth` (engine/ref/rubric.js)
// buckets to `clock.segment:'morning'` — exactly the evidence record's canon —
// so the locket candidate's "midday light" genuinely reproduces CG-6 against
// live ground truth, not a mocked stand-in.
//
// No LLM, no server, no network — pure comparators + augmentNarration's offline
// path (enabled:false), which still routes through the finalize() choke point.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { augmentNarration } from '../engine/llmAdapter.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { coherenceRejects } from '../engine/coherence/validator.js';
import { tierOf, TIER } from '../engine/coherence/checks.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Async-safe env helper (matches U468/U469/U470's pattern — awaits fn() before
// restoring env so an async augmentNarration reading the flag post-await sees
// the value that was live when it actually read it).
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

// ── the evidence record's prose, replayed verbatim ──────────────────────────
const LOCKET_INPUT = 'The broken locket — I open it. Is there a portrait or anything inside?';
const LOCKET_DM = 'The locket clicks open at Wayfarers\' Outpost\'s midday light, revealing nothing inside — the hinge is intact, but both chambers are bare and empty.';
const LOCKET_FALLBACK_DODGE = 'Wizard: Elske Nightherd shrugs. "Can\'t say. No record I\'ve ever seen."';

test('U482: precondition — a freshly booted world\'s clock IS the evidence record\'s canon (segment: morning)', () => {
  const world = boot();
  const verdict = coherenceRejects({ world, candidate: LOCKET_DM, outcome: { input: LOCKET_INPUT } });
  assert.ok(verdict.fails.some(f => f.class === 'CG-6'), 'the locket turn must trip CG-6 against a fresh boot\'s real clock');
  const cg6 = verdict.fails.find(f => f.class === 'CG-6');
  assert.equal(cg6.canonField, 'clock.segment');
  assert.equal(cg6.expected, 'morning');
  assert.equal(cg6.narrated, 'afternoon', 'the lexicon buckets "midday" into the afternoon segment');
});

test('U482: CG-6 is tier "cosmetic" in the class-tier map', () => {
  assert.equal(tierOf('CG-6'), TIER.COSMETIC);
});

test('U482: coherenceRejects — the cosmetic CG-6 pointer is surfaced in `fails` but NEVER contributes to `blocks`', () => {
  const world = boot();
  const verdict = coherenceRejects({ world, candidate: LOCKET_DM, outcome: { input: LOCKET_INPUT } });
  assert.equal(verdict.blocks, false, 'a cosmetic-only fail must never block');
  assert.equal(verdict.blockingFails.length, 0, 'the CG-6 pointer must be excluded from blockingFails');
  assert.ok(verdict.fails.some(f => f.class === 'CG-6'), 'the pointer stays visible in `fails` for logging/inspection');
});

test('U482: SHADOW-COMPARE mode — the locket turn logs wouldBlock:false, tier:"cosmetic", and keeps the CG-6 pointer', async () => {
  const world = boot();
  const logFile = tmpLog();
  const delivered = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({
      world, outcome: { input: LOCKET_INPUT, mechanics: '', persona: 'campaign' },
      baseNarration: LOCKET_DM, enabled: false,
    }),
  );
  assert.equal(delivered, LOCKET_DM.trim(), 'shadow-compare delivers the candidate UNCHANGED');
  assert.ok(fs.existsSync(logFile), 'a shadow-compare record was written');
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'exactly one record for one turn');
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.dm, LOCKET_DM.trim());
  assert.equal(rec.wouldBlock, false, 'done-when: wouldBlock:false for the cosmetic-only locket turn');
  assert.equal(rec.tier, 'cosmetic', 'done-when: tier:"cosmetic"');
  assert.ok(Array.isArray(rec.pointers) && rec.pointers.some(p => p.class === 'CG-6'),
    'the CG-6 pointer is KEPT in the record even though it never blocks');
  assert.equal(rec.fallbackKind, null, 'no fallback is attempted for a non-blocking verdict');
});

test('U482: ON mode — the locket turn delivers the candidate UNCHANGED (cosmetic tier short-circuits before any swap attempt)', async () => {
  const world = boot();
  const delivered = await withEnv({ COHERENCE_VALIDATE: 'on' }, () =>
    augmentNarration({
      world, outcome: { input: LOCKET_INPUT, mechanics: '' },
      baseNarration: LOCKET_DM, enabled: false,
    }),
  );
  assert.equal(delivered, LOCKET_DM.trim(), 'ON mode delivers the candidate unchanged for a cosmetic-only turn');
  // And, concretely, it is NOT the worse fallback dodge the evidence record
  // proved the old rule would have swapped in — the whole point of this fix.
  assert.notEqual(delivered, LOCKET_FALLBACK_DODGE, 'the worse fallback must never ship for a cosmetic-only miss');
});

test('U482: sanity on the evidence — the fallback dodge text WOULD itself ghost-voice an absent NPC if it were ever delivered', () => {
  // Confirms the fixture's premise is real, not hypothetical: the fallback the
  // OLD rule swapped in is exactly the ghost-voice/non-answer pattern
  // INFO-HONESTY bans, against the SAME booted world's real roster.
  const world = boot();
  const verdict = coherenceRejects({ world, candidate: LOCKET_FALLBACK_DODGE, outcome: { input: LOCKET_INPUT } });
  assert.ok(verdict.blocks, 'the fallback dodge ghost-voices an absent NPC — a genuine structural fail');
  assert.ok(verdict.blockingFails.some(f => f.class === 'CG-1b'), 'specifically CG-1b, presence ghost-voice');
});
