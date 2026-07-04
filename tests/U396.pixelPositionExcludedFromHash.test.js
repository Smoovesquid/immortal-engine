import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';

// ── U396 — MAP-OCC-2: pixel position out of the determinism fingerprint ──
//
// The map must never affect the world. Renderer-owned pixel coordinates
// (party[0].position.ux/uy) are written by public/v1.js as the player's
// on-screen avatar walks around a scene — they are NOT authored by the
// engine and carry no canon meaning. A world replayed from the same seed
// must hash identically regardless of where the renderer last drew the
// walking token.

function baseWorld(seed) {
  return newWorld({
    seed,
    fate: 0.2,
    campaignId: 'c1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
}

test('U396-01: writing party[0].position.ux/uy does NOT change worldHash', () => {
  const w = baseWorld('u396-ux-uy');
  w.party = [{
    id: 'p0',
    name: 'Test Hero',
    position: { zone: 'near', nodeId: 'n1', ux: 100, uy: 100 }
  }];

  const before = worldHash(w);

  // Simulate the renderer moving the on-screen token — exactly the
  // mutation applyMove() in public/v1.js performs on every walk step.
  w.party[0].position.ux = 9999.5;
  w.party[0].position.uy = -4321.25;

  const after = worldHash(w);

  assert.equal(after, before, 'worldHash must be stable when only pixel ux/uy change');
});

test('U396-02: writing party[0].position.zone/nodeId DOES change worldHash (canon fields still tracked)', () => {
  const w = baseWorld('u396-canon-fields');
  w.party = [{
    id: 'p0',
    name: 'Test Hero',
    position: { zone: 'near', nodeId: 'n1', ux: 100, uy: 100 }
  }];

  const before = worldHash(w);

  w.party[0].position.zone = 'engaged';

  const afterZone = worldHash(w);
  assert.notEqual(afterZone, before, 'worldHash must change when combat zone (canon) changes');

  w.party[0].position.zone = 'near';
  w.party[0].position.nodeId = 'n2';
  const afterNode = worldHash(w);
  assert.notEqual(afterNode, before, 'worldHash must change when nodeId (canon) changes');
});

test('U396-03: position.interior (structureId/roomId) still participates in the hash', () => {
  const w = baseWorld('u396-interior');
  w.party = [{
    id: 'p0',
    name: 'Test Hero',
    position: {
      zone: 'near',
      nodeId: 'n1',
      ux: 100,
      uy: 100,
      interior: { structureId: 's1', roomId: 'r1' }
    }
  }];

  const before = worldHash(w);

  w.party[0].position.interior.roomId = 'r2';
  const after = worldHash(w);

  assert.notEqual(after, before, 'worldHash must change when interior roomId (canon) changes');
});

test('U396-04: a world with no position field at all still hashes (no crash on absent position)', () => {
  const w = baseWorld('u396-no-position');
  w.party = [{ id: 'p0', name: 'Test Hero' }];

  assert.doesNotThrow(() => worldHash(w));
});
