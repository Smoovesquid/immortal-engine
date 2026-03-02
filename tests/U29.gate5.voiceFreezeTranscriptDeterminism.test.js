import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';

function runTranscript({ seed, fate, pack, transcript }) {
  let w = newWorld({
    seed,
    fate,
    campaignId: `campaign-${seed}`,
    pack
  });

  for (const text of transcript) {
    const out = playerMove(w, {}, String(text));
    w = out.world;
  }

  return {
    hash: worldHash(w),
    canon: JSON.stringify(w.canonLog?.events ?? [])
  };
}

test('U29: Gate V Voice Contract Freeze — same seed + same transcript => same canon + same worldHash', () => {
  const base = {
    seed: 'gate5-seed',
    fate: 0.33,
    pack: { primaryId: 'fantasy', mixerId: null }
  };

  const transcript = [
    'look around',
    'move north',
    'inspect altar',
    'take relic',
    'wait',
    'listen',
    'move south',
    'rest',
    'observe sky',
    'advance',
    'prepare',
    'engage',
    'retreat',
    'hide',
    'search',
    'signal',
    'descend',
    'climb',
    'reflect',
    'end turn'
  ];

  const A = runTranscript({ ...base, transcript });
  const B = runTranscript({ ...base, transcript });

  assert.equal(A.hash, B.hash, 'worldHash mismatch under identical transcript replay');
  assert.equal(A.canon, B.canon, 'canonLog.events mismatch under identical transcript replay');
});
