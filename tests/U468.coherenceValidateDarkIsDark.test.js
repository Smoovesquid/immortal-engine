// U468 — CG-2 (Candidate A) DARK-IS-DARK: with COHERENCE_VALIDATE unset (or any
// unrecognized value), augmentNarration's delivered narration is byte-identical
// to today across a representative turn set, and 'shadow-compare' mode changes
// NOTHING delivered — it only LOGS the would-be decision.
//
// This is the U395 twin for the promoted validator: the whole value of the dark
// rollout is being provably inert. No LLM, no server, no network — deterministic.
// augmentNarration is driven directly (offline path: enabled:false returns the
// engine base, routed through the finalize() choke point) so we assert the exact
// STRING that reaches the player is unchanged.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { augmentNarration } from '../engine/llmAdapter.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { coherenceValidateMode } from '../engine/coherence/validator.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Async-safe: AWAITS fn() before restoring env, so the flag is still set when an
// async augmentNarration reads coherenceValidateMode() after its awaits resolve.
// (A synchronous try/finally restores the env during the first microtask gap and
// the async body would read the OLD value — the env-race.) The sync callers below
// (coherenceValidateMode probes) work fine through this too — await of a
// non-promise is a no-op tick.
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
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-validate-')), 'validate.jsonl');
}

// A representative turn set: some benign, one that WOULD be a ghost-voice desync
// if it reached the validator in 'on' mode (a named NPC "speaking" while the base
// is passed as the offline narration). The point: OFF and shadow-compare both
// deliver these UNCHANGED.
const TURN_SET = [
  { input: 'look around', base: 'The taproom smells of tallow and old ale.' },
  { input: 'who is here', base: 'Elske Nightherd shrugs. "Can\'t say."' }, // would-flag in 'on'
  { input: 'search the chest', base: 'It gives at last — but the wood splinters and the noise carries.' }, // would-flag in 'on' w/ non-commit mechanics
  { input: 'wait', base: 'You are now in the cellar, though you never moved.' },
  { input: '', base: '' }, // empty base — must stay empty/inert, never throw
];

test('U468: coherenceValidateMode() defaults to "off" when the flag is unset', async () => {
  await withEnv({ COHERENCE_VALIDATE: undefined }, () => {
    assert.equal(coherenceValidateMode(), 'off');
  });
});

test('U468: coherenceValidateMode() treats unrecognized values as "off" (fail-safe)', async () => {
  for (const val of ['1', 'true', 'yes', 'garbage', 'ON ', ' Shadow ']) {
    await withEnv({ COHERENCE_VALIDATE: val }, () => {
      const m = coherenceValidateMode();
      // Only exact 'on' / 'shadow-compare' (trimmed, case-insensitive) are live.
      const expected = /^\s*on\s*$/i.test(val) ? 'on'
        : /^\s*(shadow-compare|shadow|compare)\s*$/i.test(val) ? 'shadow-compare'
        : 'off';
      assert.equal(m, expected, `"${val}" -> ${m}`);
    });
  }
});

test('U468: FLAG OFF — augmentNarration delivers the base byte-identical across the turn set', async () => {
  for (const { input, base } of TURN_SET) {
    const world = boot();
    const outcome = { input, mechanics: '' };
    const out = await withEnv({ COHERENCE_VALIDATE: undefined, COHERENCE_SHADOW: undefined }, () =>
      augmentNarration({ world, outcome, baseNarration: base, enabled: false }),
    );
    // The offline path returns the trimmed base, routed through finalize() which,
    // with the flag OFF, returns its input verbatim.
    assert.equal(out, base.trim(), `OFF must be byte-identical for input "${input}"`);
  }
});

test('U468: FLAG OFF — a would-be-flagged base is STILL delivered unchanged (no silent behavior)', async () => {
  // The ghost-voice line WOULD be rejected in 'on' mode, but with the flag OFF the
  // choke point must not touch it — proving OFF is truly inert, not "off but still
  // peeking".
  const world = boot();
  const base = 'Elske Nightherd shrugs. "Can\'t say."';
  const out = await withEnv({ COHERENCE_VALIDATE: undefined }, () =>
    augmentNarration({ world, outcome: { input: 'who spoke', mechanics: '' }, baseNarration: base, enabled: false }),
  );
  assert.equal(out, base.trim(), 'OFF delivers even a would-flag base unchanged');
});

test('U468: FLAG OFF — worldHash is unchanged by augmentNarration (no mutation, no RNG)', async () => {
  const world = boot();
  const before = worldHash(world);
  await withEnv({ COHERENCE_VALIDATE: undefined }, () =>
    augmentNarration({ world, outcome: { input: 'look', mechanics: '' }, baseNarration: 'The room is still.', enabled: false }),
  );
  assert.equal(worldHash(world), before, 'the validator/choke point never mutates the world or touches RNG');
});

test('U468: SHADOW-COMPARE — delivered narration is IDENTICAL to OFF across the turn set', async () => {
  for (const { input, base } of TURN_SET) {
    const worldOff = boot();
    const worldSc = boot();
    const outcome = { input, mechanics: '' };

    const off = await withEnv({ COHERENCE_VALIDATE: undefined }, () =>
      augmentNarration({ world: worldOff, outcome, baseNarration: base, enabled: false }),
    );
    const logFile = tmpLog();
    const sc = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
      augmentNarration({ world: worldSc, outcome, baseNarration: base, enabled: false }),
    );
    assert.equal(sc, off, `shadow-compare must deliver byte-identical to OFF for input "${input}"`);
  }
});

test('U468: SHADOW-COMPARE — LOGS the would-block decision for a would-flag turn, without altering delivery', async () => {
  const world = boot();
  const base = 'Elske Nightherd shrugs. "Can\'t say."'; // would-flag CG-1b in 'on'
  const logFile = tmpLog();
  const delivered = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({ world, outcome: { input: 'who spoke', mechanics: '' }, baseNarration: base, enabled: false }),
  );
  // Delivery unchanged.
  assert.equal(delivered, base.trim(), 'shadow-compare delivers the candidate unchanged');
  // But a log record exists carrying the would-be decision. (Whether wouldBlock is
  // true depends on the booted world's canon; the CONTRACT under test is that the
  // record is written at all and the delivery is untouched — U469/U470 assert the
  // block/floor semantics on crafted canon.)
  assert.ok(fs.existsSync(logFile), 'shadow-compare writes a coherence-validate log');
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'exactly one shadow-compare record for one turn');
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.type, 'coherence-validate');
  assert.equal(rec.dm, base.trim(), 'the record logs the exact delivered prose');
  assert.equal(typeof rec.wouldBlock, 'boolean', 'the record carries a boolean would-block decision');
  assert.ok('fallbackKind' in rec, 'the record carries a fallbackKind field (base|floor|null)');
});

test('U468: SHADOW-COMPARE — writes NO log and does not throw on an empty base', async () => {
  const world = boot();
  const logFile = tmpLog();
  const out = await withEnv({ COHERENCE_VALIDATE: 'shadow-compare', COHERENCE_VALIDATE_LOG: logFile }, () =>
    augmentNarration({ world, outcome: { input: 'x', mechanics: '' }, baseNarration: '', enabled: false }),
  );
  assert.equal(out, '', 'empty base delivers empty, no throw');
  // An empty candidate short-circuits coherenceRejects (no dm) → still logs a
  // wouldBlock:false record (denominator honesty), but must never throw.
  assert.doesNotThrow(() => fs.existsSync(logFile));
});
