// U266 — contract guard for the cross-lane rumor read-API (Homebase-owned interface).
// W1·3 (P-83) fills the body; this pins the SHAPE + determinism so W2·3 (reputation-travels)
// can build against it safely. Passes now (empty stub) and keeps guarding when filled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';

function assertRumorShape(r) {
  assert.equal(typeof r.subject, 'string', 'subject:string');
  assert.equal(typeof r.body, 'string', 'body:string');
  assert.equal(typeof r.tier, 'number', 'tier:number');
  assert.ok(r.tier >= 0 && r.tier <= 4, 'tier in 0..4');
  assert.equal(typeof r.distortion, 'number', 'distortion:number');
  assert.ok(r.distortion >= 0 && r.distortion <= 1, 'distortion in [0,1]');
  assert.ok(Array.isArray(r.provenance), 'provenance:array');
  assert.ok(r.eventRef === null || typeof r.eventRef === 'string', 'eventRef:string|null');
  assert.ok(r.deedRef === null || typeof r.deedRef === 'string' || r.deedRef === undefined, 'deedRef:string|null');
}

const world = { meta: { seed: 'contract' }, map: { nodes: [{ id: 'n1', nodeType: 'settlement' }] } };

test('U266 — rumorsReaching returns a typed array (cross-lane contract)', () => {
  const out = rumorsReaching(world, 'n1');
  assert.ok(Array.isArray(out), 'returns an array');
  out.forEach(assertRumorShape);
});

test('U266 — rumorsReaching is deterministic + pure (same input → same output)', () => {
  const a = JSON.stringify(rumorsReaching(world, 'n1'));
  const b = JSON.stringify(rumorsReaching(world, 'n1'));
  assert.equal(a, b);
});
