// U395 — CG-LIVE-1 shadow observer: DEFAULT OFF is byte-identical, and running
// the observer never touches worldHash. Shadow mode's entire value is being
// provably inert; these are the tripwires that keep it that way.
//
//   1. With COHERENCE_SHADOW unset, observeCoherenceShadow does NOTHING: returns
//      null, writes no log file, and augmentNarration's output is unchanged.
//   2. Even with the flag ON, the observer reads `world` (via buildCanonGroundTruth)
//      but never mutates it — worldHash is identical before and after.
//   3. The prev-canon side-channel lives in the module, NEVER on `world` — so a
//      second turn's CG-2c compare cannot perturb the world's hash.
//
// Boots a real tallow escape-mode world (same fixture U392 uses) so the hash is
// a real engine hash, not a toy object.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { augmentNarration } from '../engine/llmAdapter.js';
import { observeCoherenceShadow, __resetShadowState } from '../engine/coherence/shadowObserver.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

function withEnv(env, fn) {
  const saved = {};
  for (const k of Object.keys(env)) saved[k] = process.env[k];
  Object.assign(process.env, env);
  try { return fn(); }
  finally {
    for (const k of Object.keys(env)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

function tmpLog() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-shadow-')), 'shadow.jsonl');
}

test('U395a: DEFAULT OFF — observer is a no-op: returns null and writes no log', () => {
  __resetShadowState();
  const logFile = tmpLog();
  // Flag unset (delete it), point the log override at a path that must NOT exist.
  const r = withEnv({ COHERENCE_SHADOW: undefined, COHERENCE_SHADOW_LOG: logFile }, () =>
    observeCoherenceShadow({
      world: boot(),
      candidate: 'Dalla says something while the room is empty.',
      outcome: { input: 'talk', mechanics: '' },
    }),
  );
  assert.equal(r, null, 'observer returns null when the flag is off');
  assert.equal(fs.existsSync(logFile), false, 'no shadow log written when the flag is off');
});

test('U395b: DEFAULT OFF — augmentNarration output is byte-identical to a no-observer world', async () => {
  __resetShadowState();
  const world = boot();
  const outcome = { input: 'look around', mechanics: '' };
  const baseNarration = 'The taproom smells of tallow and old ale.';
  // With the flag explicitly unset, the observer must not alter the returned line.
  const out = await withEnv({ COHERENCE_SHADOW: undefined }, () =>
    augmentNarration({ world, outcome, baseNarration, enabled: false }),
  );
  assert.equal(out, baseNarration, 'offline narration path returns base, unchanged by the (disabled) observer');
});

test('U395c: worldHash is IDENTICAL before and after running the observer (flag ON — no mutation)', () => {
  __resetShadowState();
  const world = boot();
  const before = worldHash(world);
  const logFile = tmpLog();
  withEnv({ COHERENCE_SHADOW: '1', COHERENCE_SHADOW_LOG: logFile }, () => {
    observeCoherenceShadow({
      world,
      candidate: 'You step into the pantry. A door lies to the north.',
      outcome: { input: 'look', mechanics: '' },
    });
    // Run a SECOND turn on the same world to exercise the cross-turn CG-2c path
    // (which reads the module-level prev-canon side-channel, never `world`).
    observeCoherenceShadow({
      world,
      candidate: 'You are now in the cellar, though you never moved.',
      outcome: { input: 'wait', mechanics: '' },
    });
  });
  const after = worldHash(world);
  assert.equal(after, before, 'worldHash unchanged — the observer never mutates the world or touches RNG');
});

test('U395d: prev-canon side-channel is NOT stored on `world` (worldHash unaffected by having run before)', () => {
  __resetShadowState();
  // Two freshly-booted identical worlds must hash identically even after one of
  // them has been through the observer — proving no prev-canon leaked onto world.
  const a = boot();
  const b = boot();
  assert.equal(worldHash(a), worldHash(b), 'precondition: two fresh boots hash identically');
  const logFile = tmpLog();
  withEnv({ COHERENCE_SHADOW: '1', COHERENCE_SHADOW_LOG: logFile }, () => {
    observeCoherenceShadow({ world: a, candidate: 'A quiet room.', outcome: { input: 'look', mechanics: '' } });
  });
  assert.equal(worldHash(a), worldHash(b), 'world a still hashes identically to untouched world b after the observer ran');
});
