import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { newWorld } from '../engine/state.js';
import { worldHash as worldHashNode } from '../engine/worldHash.js';
import { worldHash as worldHashBrowser } from '../engine/worldHash.browser.js';
import { projectPartyForHash } from '../engine/crunchHashProjection.js';

// ── U397 — MAP-OCC-2: pixel position exclusion holds for the browser
// worldHash variant AND for every party member, not just party[0]. ──

function baseWorld(seed) {
  return newWorld({
    seed,
    fate: 0.2,
    campaignId: 'c1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });
}

test('U397-01: browser worldHash variant is also unaffected by ux/uy writes', async () => {
  if (!globalThis.crypto?.subtle?.digest) {
    globalThis.crypto = crypto.webcrypto;
  }

  const w = baseWorld('u397-browser');
  w.party = [{
    id: 'p0',
    name: 'Test Hero',
    position: { zone: 'near', nodeId: 'n1', ux: 100, uy: 100 }
  }];

  const before = await worldHashBrowser(w);
  w.party[0].position.ux = 42;
  w.party[0].position.uy = 4242;
  const after = await worldHashBrowser(w);

  assert.equal(after, before, 'browser worldHash must be stable when only pixel ux/uy change');
});

test('U397-02: node and browser worldHash still agree byte-for-byte after the MAP-OCC-2 projection change', async () => {
  if (!globalThis.crypto?.subtle?.digest) {
    globalThis.crypto = crypto.webcrypto;
  }

  const w = baseWorld('u397-parity');
  w.party = [{
    id: 'p0',
    name: 'Test Hero',
    position: { zone: 'near', nodeId: 'n1', ux: 100, uy: 100 }
  }];

  const hNode = worldHashNode(w);
  const hBrowser = await worldHashBrowser(w);

  assert.equal(hBrowser, hNode, 'node/browser worldHash parity must survive the projection change');
});

test('U397-03: a companion/second party member\'s ux/uy is also excluded from the hash', () => {
  const w = baseWorld('u397-companion');
  w.party = [
    { id: 'p0', name: 'Lead', position: { zone: 'near', nodeId: 'n1', ux: 10, uy: 10 } },
    { id: 'p1', name: 'Companion', position: { zone: 'near', nodeId: 'n1', ux: 20, uy: 20 } }
  ];

  const before = worldHashNode(w);
  w.party[1].position.ux = 555;
  w.party[1].position.uy = 777;
  const after = worldHashNode(w);

  assert.equal(after, before, 'worldHash must be stable when a non-lead party member\'s pixel position changes');
});

test('U397-04: projectPartyForHash strips ux/uy from every member\'s position, keeps other fields', () => {
  const party = [
    {
      id: 'p0',
      position: { zone: 'engaged', nodeId: 'n1', ux: 10, uy: 20, interior: { structureId: 's1', roomId: 'r1' } }
    }
  ];

  const projected = projectPartyForHash(party);

  assert.equal(projected[0].position.ux, undefined, 'ux must be stripped from the projected position');
  assert.equal(projected[0].position.uy, undefined, 'uy must be stripped from the projected position');
  assert.equal(projected[0].position.zone, 'engaged', 'zone must survive projection');
  assert.equal(projected[0].position.nodeId, 'n1', 'nodeId must survive projection');
  assert.deepEqual(
    projected[0].position.interior,
    { structureId: 's1', roomId: 'r1' },
    'interior must survive projection unchanged'
  );
});

test('U397-05: projectPartyForHash tolerates a member with no position field', () => {
  const party = [{ id: 'p0', name: 'No Position' }];
  const projected = projectPartyForHash(party);
  assert.equal(projected[0].position, undefined);
});
