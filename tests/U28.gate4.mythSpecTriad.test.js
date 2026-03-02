import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';

import { buildMythSpec, mythSpecJson } from '../engine/mythSpec.js';
import { generateTriadFrames, deriveInvocationFromFrame } from '../engine/triad.js';

test('U28: Gate 4 MythSpec + Triad deterministic; frame selection => stable worldHash', () => {
  const base = {
    seed: 'gate4-seed',
    fate: 0.42,
    pack: { primaryId: 'fantasy', mixerId: null },
    mythInput: 'a bell under ash'
  };

  const s1 = buildMythSpec(base);
  const s2 = buildMythSpec(base);

  assert.equal(mythSpecJson(s1), mythSpecJson(s2), 'MythSpec JSON mismatch for identical inputs');

  const f1 = generateTriadFrames(s1);
  const f2 = generateTriadFrames(s2);

  assert.equal(f1.length, 3, 'Triad did not produce exactly 3 frames');
  assert.equal(f2.length, 3, 'Triad did not produce exactly 3 frames');
  assert.deepEqual(f1, f2, 'Triad frames mismatch for identical MythSpec');

  const invA = deriveInvocationFromFrame({ baseSeed: base.seed, pack: base.pack, fate: base.fate, mythSpec: s1, frameIndex: 1 });
  const invB = deriveInvocationFromFrame({ baseSeed: base.seed, pack: base.pack, fate: base.fate, mythSpec: s2, frameIndex: 1 });

  assert.deepEqual(invA, invB, 'Invocation mismatch for same base inputs + same frame');

  const wA = newWorld(invA);
  const wB = newWorld(invB);

  assert.equal(worldHash(wA), worldHash(wB), 'worldHash mismatch for identical derived invocation');
});
