// U394 — CG-LIVE-1 shadow observer: it RUNS the Tier-D comparators on the live
// narration path and LOGS what it would flag, while the returned narration is
// UNCHANGED. This proves the observer does its job (fires the checks + writes a
// desync pointer) AND that it is provably inert on the narration the player sees.
//
// No LLM, no server, no network — deterministic. The observer is exercised with
// COHERENCE_SHADOW=1 against a crafted-desync canon bundle (a candidate voicing
// an NPC canon says isn't in the room → CG-1b ghost-voice), and via
// augmentNarration end-to-end to prove the DM line comes back byte-identical.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { observeCoherenceShadow, __resetShadowState, shadowEnabled } from '../engine/coherence/shadowObserver.js';
import { augmentNarration } from '../engine/llmAdapter.js';

// A crafted canon bundle where NPC "Dalla" is on the settlement roster
// (npcsPresent) but the room she's supposedly in is EMPTY (roomOccupants: []),
// with the PC inside a room — the exact CG-1b ghost-voice shape.
const GHOST_VOICE_CANON = {
  interior: { roomId: 'r1', roomName: 'Pantry' },
  roomOccupants: [],
  npcsPresent: [{ name: 'Dalla', role: 'innkeeper' }],
  enemies: [],
  inCombat: false,
};

function withShadow(env, fn) {
  const prevFlag = process.env.COHERENCE_SHADOW;
  const prevLog = process.env.COHERENCE_SHADOW_LOG;
  Object.assign(process.env, env);
  try { return fn(); }
  finally {
    if (prevFlag === undefined) delete process.env.COHERENCE_SHADOW; else process.env.COHERENCE_SHADOW = prevFlag;
    if (prevLog === undefined) delete process.env.COHERENCE_SHADOW_LOG; else process.env.COHERENCE_SHADOW_LOG = prevLog;
  }
}

function tmpLog() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-shadow-')), 'shadow.jsonl');
}

test('U394a: with COHERENCE_SHADOW=1, the observer fires CG-1b on a crafted ghost-voice desync and logs the pointer', () => {
  __resetShadowState();
  const logFile = tmpLog();
  const flags = withShadow({ COHERENCE_SHADOW: '1', COHERENCE_SHADOW_LOG: logFile }, () =>
    observeCoherenceShadow({
      world: { meta: { seed: 'crafted', campaignId: 'u394' } },
      candidate: 'Dalla nods and says the ale is on the house.',
      outcome: { input: 'talk to Dalla', mechanics: '' },
      _canonForTest: GHOST_VOICE_CANON,
    }),
  );

  // The observer returned the would-be pointers (test-only return).
  assert.ok(Array.isArray(flags), 'observer returns a flags array when enabled');
  const cg1b = flags.find(f => f.class === 'CG-1b');
  assert.ok(cg1b, 'CG-1b ghost-voice pointer fired');
  assert.equal(cg1b.canonField, 'roomOccupants');
  assert.match(cg1b.narrated, /Dalla/);

  // The log file got exactly one shadow record carrying that pointer.
  const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'one shadow record appended');
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.type, 'shadow');
  assert.equal(rec.input, 'talk to Dalla');
  assert.ok(Array.isArray(rec.pointers) && rec.pointers.some(p => p.class === 'CG-1b'), 'record carries the CG-1b pointer');
});

test('U394b: a clean candidate (no desync) still logs a shadow record, with EMPTY pointers (honest denominator)', () => {
  __resetShadowState();
  const logFile = tmpLog();
  const flags = withShadow({ COHERENCE_SHADOW: '1', COHERENCE_SHADOW_LOG: logFile }, () =>
    observeCoherenceShadow({
      world: { meta: { seed: 'crafted', campaignId: 'u394b' } },
      candidate: 'The pantry is quiet. Sacks of flour lean against the wall.',
      outcome: { input: 'look around', mechanics: '' },
      _canonForTest: { interior: { roomId: 'r1', roomName: 'Pantry' }, roomOccupants: [], npcsPresent: [], enemies: [], inCombat: false },
    }),
  );
  assert.deepEqual(flags, [], 'no desync flags on a clean, truthful line');
  const rec = JSON.parse(fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean)[0]);
  assert.equal(rec.type, 'shadow');
  assert.deepEqual(rec.pointers, [], 'record logged with empty pointers so the FP-rate denominator stays honest');
});

test('U394c: augmentNarration returns the SAME narration whether the shadow observer fires or not', async () => {
  __resetShadowState();
  // augmentNarration returns base when disabled/no-key (the offline path) — the
  // returned STRING must be identical whether or not the shadow observer ran.
  const world = { meta: { seed: 'crafted', campaignId: 'u394c' } };
  const outcome = { input: 'talk to Dalla', mechanics: '' };
  const baseNarration = 'The room is still.';

  // Shadow OFF
  const off = await augmentNarration({ world, outcome, baseNarration, enabled: false });
  // Shadow ON (observer runs, logs, returns nothing to narration)
  const logFile = tmpLog();
  const on = await withShadow({ COHERENCE_SHADOW: '1', COHERENCE_SHADOW_LOG: logFile }, () =>
    augmentNarration({ world, outcome, baseNarration, enabled: false }),
  );
  assert.equal(on, off, 'narration is byte-identical shadow-on vs shadow-off');
  assert.equal(on, baseNarration, 'and it is exactly the engine base narration (offline path)');
});

test('U394d: the observer NEVER throws — a malformed world/canon is swallowed and returns null', () => {
  __resetShadowState();
  const logFile = tmpLog();
  const r = withShadow({ COHERENCE_SHADOW: '1', COHERENCE_SHADOW_LOG: logFile }, () =>
    observeCoherenceShadow({
      world: null,
      candidate: 'anything',
      outcome: { get input() { throw new Error('boom'); } },
    }),
  );
  // Either it logs an empty-pointer record or bails to null; the contract is: no throw.
  assert.ok(r === null || Array.isArray(r), 'observer swallowed the error (no throw)');
});

test('U394e: shadowEnabled() reflects the flag', () => {
  const wasOn = shadowEnabled();
  withShadow({ COHERENCE_SHADOW: '1' }, () => assert.equal(shadowEnabled(), true));
  withShadow({ COHERENCE_SHADOW: '0' }, () => assert.equal(shadowEnabled(), false));
  // restored to whatever it was
  assert.equal(shadowEnabled(), wasOn);
});
