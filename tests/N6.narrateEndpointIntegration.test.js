/**
 * Gate N6 — Narration integrates into the server
 *
 * /api/narrate accepts { world, baseNarration, outcome }
 * Returns AI narration when key present, falls back silently when not.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../server.js';

let app;
let baseUrl;
let server;

// Start a test server before all tests.
test.before(async () => {
  app = createApp();
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

function minWorld(seed = 'n6-srv') {
  return {
    meta: { seed, fate: 0.5 },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Thornwall', nodeType: 'settlement', tags: [] }],
      edges: [], discovered: ['n0'], currentNodeId: 'n0'
    },
    scene: { location: 'Thornwall', objective: 'find the key', interior: null }
  };
}

test('N6: /api/narrate returns base narration when no key provided', async () => {
  const res = await fetch(`${baseUrl}/api/narrate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      world:         minWorld(),
      baseNarration: 'You stand at the crossroads.',
      outcome:       {},
      anthropicKey:  ''          // no key → fallback
    })
  });
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.narration, 'You stand at the crossroads.',
    'no-key request must return base narration unchanged');
});

test('N6: /api/narrate returns { ok: true, narration: string } shape', async () => {
  const res = await fetch(`${baseUrl}/api/narrate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      world:         minWorld(),
      baseNarration: 'The torchlight flickers.',
      outcome:       {}
    })
  });
  const data = await res.json();
  assert.equal(data.ok, true, 'response must have ok: true');
  assert.ok(typeof data.narration === 'string', 'narration must be a string');
  assert.ok(data.narration.length > 0, 'narration must be non-empty');
});

test('N6: /api/narrate never throws — malformed body returns base narration', async () => {
  const res = await fetch(`${baseUrl}/api/narrate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseNarration: 'Fallback text.' })  // no world
  });
  const data = await res.json();
  assert.equal(data.ok, true, 'malformed request must not return error');
  assert.equal(data.narration, 'Fallback text.', 'must fall back to provided base narration');
});

// Live API test — only runs if ANTHROPIC_API_KEY is set.
test('N6: /api/narrate returns AI narration when key is valid', async () => {
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  if (!key) {
    console.log('  [SKIP] ANTHROPIC_API_KEY not set — skipping live /api/narrate test');
    return;
  }

  const res = await fetch(`${baseUrl}/api/narrate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      world:         minWorld('n6-live'),
      baseNarration: 'You arrive at Thornwall.',
      outcome:       { input: 'look around' },
      anthropicKey:  key
    })
  });
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(typeof data.narration === 'string' && data.narration.length > 0,
    'live API must return non-empty narration');
  console.log(`  [N6 live] narration: "${data.narration}"`);
});
