// U610 — PW-3: the worldHash rumor-projection seam (RUMOR_LAYER.md:144 vs worldHash.js:37).
//
// The seam the PW-3 brief calls out to fix: RUMOR_LAYER.md line 144 CLAIMED the hash projection
// includes `world.rumors` fields "(id, tier, age, verified)", but the shipped code — both
// engine/worldHash.js AND engine/worldHash.browser.js — projects exactly `{id, tier, age}` (body and
// verified excluded). Left unpinned, the doc and the code drift silently.
//
// The seam decision (2026-07-06): align the DOC to the CODE. `verified` is a display-only marker set
// once by the reveal path and read by NO canon decision; adding it to the projection would MOVE the
// hash on any world that reached a seed, for zero behavioral gain — so excluding it is the honest,
// hash-preserving choice (no living-anchor re-pin needed). This test pins the projection SHAPE so
// neither side can drift again: `tier`/`age` are hashed (changing them moves the hash), `body` and
// `verified` are NOT (changing them cannot), and the node + browser projections are byte-identical
// for the same rumor set. Hermetic — pure hashing, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// A minimal world carrying one rumor with EVERY optional field set, so we can toggle each and watch
// the hash. ensureWorld normalizes; we set rumors after so the exact shape survives.
function worldWithRumor(overrides = {}) {
  const base = ensureWorld(newWorld({ seed: 'u610', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } }));
  const rumor = {
    id: 'rumor:seam:test:0', sourceSeedId: 'seam:test', carrierNpcId: 'npc_x',
    hopCount: 2, tier: 2, age: 4, mintedAt: 0,
    body: 'the original body', verified: 'partial', tags: ['seam'],
    ...overrides
  };
  return { ...base, rumors: [rumor] };
}

test('U610-01: tier IS in the projection — changing it moves the hash', () => {
  const h0 = worldHash(worldWithRumor({ tier: 2 }));
  const h1 = worldHash(worldWithRumor({ tier: 3 }));
  assert.notEqual(h0, h1, 'tier is hash-relevant (fidelity is canon-identity)');
});

test('U610-02: age IS in the projection — changing it moves the hash', () => {
  const h0 = worldHash(worldWithRumor({ age: 4 }));
  const h1 = worldHash(worldWithRumor({ age: 5 }));
  assert.notEqual(h0, h1, 'age is hash-relevant (propagation clock is canon-identity)');
});

test('U610-03: body is NOT in the projection — changing it does NOT move the hash (S3 upgrades are hash-silent)', () => {
  const h0 = worldHash(worldWithRumor({ body: 'the original body' }));
  const h1 = worldHash(worldWithRumor({ body: 'a completely different, LLM-upgraded body' }));
  assert.equal(h0, h1, 'body is hash-excluded — an S3 prose upgrade never moves the hash');
});

test('U610-04: verified is NOT in the projection — the seam decision — changing it does NOT move the hash', () => {
  // This is the crux the doc got wrong. If a future edit ADDS `verified` to the projection, this
  // assertion fails loudly (the hash would move when a rumor is verified) — forcing the doc/code
  // realignment to be deliberate, never silent.
  const h0 = worldHash(worldWithRumor({ verified: 'partial' }));
  const h1 = worldHash(worldWithRumor({ verified: 'false' }));
  const h2 = worldHash(worldWithRumor({ verified: undefined }));
  assert.equal(h0, h1, 'verified is hash-excluded (display-only comparison marker)');
  assert.equal(h0, h2, 'presence/absence of verified is hash-irrelevant');
});

test('U610-05: id IS in the projection — a different rumor id moves the hash', () => {
  const h0 = worldHash(worldWithRumor({ id: 'rumor:seam:test:0' }));
  const h1 = worldHash(worldWithRumor({ id: 'rumor:seam:test:1' }));
  assert.notEqual(h0, h1, 'id is hash-relevant (identity)');
});

test('U610-06: the node and browser projections use the IDENTICAL rumor mapping (they cannot diverge)', () => {
  // Both files must project rumors as exactly `{ id: r.id, tier: r.tier, age: r.age }`. Pin the
  // literal so a change to one that is not mirrored in the other is caught here (the two hashes are
  // the desync oracle in production; this guards the source of that oracle).
  const node = fs.readFileSync(path.join(__dirname, '..', 'engine', 'worldHash.js'), 'utf8');
  const browser = fs.readFileSync(path.join(__dirname, '..', 'engine', 'worldHash.browser.js'), 'utf8');
  const RUMOR_PROJECTION = 'rumors: (w.rumors || []).map(r => ({ id: r.id, tier: r.tier, age: r.age })),';
  assert.ok(node.includes(RUMOR_PROJECTION), 'engine/worldHash.js projects rumors as {id, tier, age}');
  assert.ok(browser.includes(RUMOR_PROJECTION), 'engine/worldHash.browser.js projects rumors as {id, tier, age}');
  // Neither projection may smuggle body or verified into the rumor map.
  const rumorLine = (src) => (src.split('\n').find(l => l.includes('rumors:') && l.includes('.map(r =>')) || '');
  assert.ok(!/verified/.test(rumorLine(node)),    'node projection excludes verified');
  assert.ok(!/verified/.test(rumorLine(browser)), 'browser projection excludes verified');
  assert.ok(!/\bbody\b/.test(rumorLine(node)),    'node projection excludes body');
  assert.ok(!/\bbody\b/.test(rumorLine(browser)), 'browser projection excludes body');
});

test('U610-07: the doc and the code agree — RUMOR_LAYER.md no longer claims verified is in the projection', () => {
  // The doc fix: line 144 must state the projection is {id, tier, age} and NOT list verified as
  // projected. Guards against a doc regression re-introducing the drift.
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'RUMOR_LAYER.md'), 'utf8');
  // The projection statement spans several lines under the Determinism contract; take the bullet
  // that opens with "- `worldHash` projection" through the end of that bullet block.
  const lines = doc.split('\n');
  const start = lines.findIndex(l => /^-\s+`worldHash` projection/.test(l));
  assert.ok(start >= 0, 'the doc has a `worldHash` projection bullet');
  let end = start + 1;
  while (end < lines.length && lines[end].trim() && !/^-\s/.test(lines[end]) && !/^#/.test(lines[end])) end++;
  const projBlock = lines.slice(start, end).join(' ');
  assert.ok(/\{id, tier, age\}/.test(projBlock), 'the doc states the projection is {id, tier, age}');
  assert.ok(/NOT\s+.{0,4}verified/i.test(projBlock), 'the doc explicitly says verified is NOT projected');
});
