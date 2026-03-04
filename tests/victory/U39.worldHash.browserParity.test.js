import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { newWorld } from '../../engine/state.js';
import { worldHash as worldHashNode } from '../../engine/worldHash.js';
import { worldHash as worldHashBrowser } from '../../engine/worldHash.browser.js';

test('U39: worldHash browser parity — same world => same sha256 as node implementation', async () => {
  // Ensure WebCrypto exists in Node test env.
  if (!globalThis.crypto?.subtle?.digest) {
    globalThis.crypto = crypto.webcrypto;
  }

  const w = newWorld({
    seed: 'u39-browser-parity',
    fate: 0.2,
    campaignId: 'c1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const hNode = worldHashNode(w);
  const hBrowser = await worldHashBrowser(w);

  assert.equal(hBrowser, hNode, 'browser worldHash must equal node worldHash for identical world');
});
