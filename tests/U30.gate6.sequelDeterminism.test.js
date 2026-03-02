import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld } from '../engine/save.js';
import { deriveSequelInvocation } from '../engine/sequel.js';

function runTranscript(seed) {
  let w = newWorld({
    seed,
    fate: 0.41,
    campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const transcript = [
    'look',
    'advance',
    'engage',
    'retreat',
    'search',
    'prepare',
    'observe',
    'descend'
  ];

  for (const text of transcript) {
    const out = playerMove(w, {}, text);
    w = out.world;
  }

  return w;
}

test('U30: Gate VI Sequel Continuity — chronicle-derived invocation is deterministic', () => {
  const baseSeed = 'gate6-base-seed';

  const worldA = runTranscript(baseSeed);
  const worldB = runTranscript(baseSeed);

  const chronA = exportWorld(worldA);
  const chronB = exportWorld(worldB);

  assert.equal(
    JSON.stringify(chronA),
    JSON.stringify(chronB),
    'Chronicle export mismatch for identical base run'
  );

  const invA = deriveSequelInvocation(chronA);
  const invB = deriveSequelInvocation(chronB);

  assert.deepEqual(invA, invB, 'Sequel invocation mismatch from identical chronicle');

  const sequelA = newWorld(invA);
  const sequelB = newWorld(invB);

  assert.equal(
    worldHash(sequelA),
    worldHash(sequelB),
    'Sequel worldHash mismatch for identical chronicle-derived invocation'
  );
});
