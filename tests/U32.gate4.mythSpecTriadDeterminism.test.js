import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMythSpec, mythSpecHash } from '../engine/mythSpec.js';
import { generateTriadFrames, deriveInvocationFromFrame } from '../engine/triad.js';
import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';

function runGate4({ seed, fate, pack, mythInput, frameIndex }) {
  const spec = buildMythSpec({ seed, fate, pack, mythInput });
  const frames = generateTriadFrames(spec);
  const inv = deriveInvocationFromFrame({ baseSeed: seed, fate, pack, mythSpec: spec, frameIndex });

  const w = newWorld(inv);

  return {
    mythHash: mythSpecHash(spec),
    framesJson: JSON.stringify(frames),
    invocationJson: JSON.stringify(inv),
    worldHash: worldHash(w)
  };
}

test('U32: Gate IV MythSpec + Deterministic Triad — same myth input => identical MythSpec/frames/invocation/worldHash', () => {
  const base = {
    seed: 'gate4-seed',
    fate: 0.42,
    pack: { primaryId: 'fantasy', mixerId: null },
    mythInput: 'a bell under ash'
  };

  const A = runGate4({ ...base, frameIndex: 0 });
  const B = runGate4({ ...base, frameIndex: 0 });

  assert.equal(A.mythHash, B.mythHash, 'mythSpecHash mismatch');
  assert.equal(A.framesJson, B.framesJson, 'triad frames mismatch');
  assert.equal(A.invocationJson, B.invocationJson, 'derived invocation mismatch');
  assert.equal(A.worldHash, B.worldHash, 'worldHash mismatch');
});

test('U32: Gate IV MythSpec + Deterministic Triad — different frameIndex => deterministic divergence of worldHash', () => {
  const base = {
    seed: 'gate4-seed',
    fate: 0.42,
    pack: { primaryId: 'fantasy', mixerId: null },
    mythInput: 'a bell under ash'
  };

  const F0 = runGate4({ ...base, frameIndex: 0 });
  const F1 = runGate4({ ...base, frameIndex: 1 });

  assert.notEqual(F0.invocationJson, F1.invocationJson, 'invocation should differ across frames');
  assert.notEqual(F0.worldHash, F1.worldHash, 'worldHash should differ across frames');
});
