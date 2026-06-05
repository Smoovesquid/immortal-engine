import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveStealthMove, riskLevel } from '../engine/movement/stealthMove.js';

test('U93: deterministic — same inputs produce same result', () => {
  const a = resolveStealthMove({ seed: 's', nonce: 4, distance: 3, mode: 'bold', dangerRooms: 1, agilityMod: 2 });
  const b = resolveStealthMove({ seed: 's', nonce: 4, distance: 3, mode: 'bold', dangerRooms: 1, agilityMod: 2 });
  assert.deepEqual(a, b);
});

test('U93: careful step carries far less risk than a bold dash', () => {
  const careful = resolveStealthMove({ seed: 's', nonce: 1, distance: 1, mode: 'careful', dangerRooms: 0, agilityMod: 0 });
  const dash = resolveStealthMove({ seed: 's', nonce: 1, distance: 3, mode: 'bold', dangerRooms: 0, agilityMod: 0 });
  assert.ok(careful.riskPct < dash.riskPct, `careful ${careful.riskPct} should be < dash ${dash.riskPct}`);
  assert.equal(careful.mode, 'careful');
  assert.equal(dash.mode, 'bold');
});

test('U93: danger rooms raise risk, stealth lowers it', () => {
  const calm = resolveStealthMove({ seed: 's', nonce: 2, distance: 3, mode: 'bold', dangerRooms: 0, agilityMod: 0 });
  const dangerous = resolveStealthMove({ seed: 's', nonce: 2, distance: 3, mode: 'bold', dangerRooms: 2, agilityMod: 0 });
  assert.ok(dangerous.riskPct > calm.riskPct, 'more danger => more risk');
  const sneaky = resolveStealthMove({ seed: 's', nonce: 2, distance: 3, mode: 'bold', dangerRooms: 2, agilityMod: 5 });
  assert.ok(sneaky.riskPct < dangerous.riskPct, 'stealth => less risk');
});

test('U93: ambushed flag matches roll+stealth vs DC', () => {
  const r = resolveStealthMove({ seed: 's', nonce: 9, distance: 4, mode: 'bold', dangerRooms: 1, agilityMod: 1 });
  assert.equal(r.ambushed, r.total < r.dc);
  assert.ok(r.roll >= 1 && r.roll <= 20);
});

test('U93: a single-room move is always careful, even if asked for bold', () => {
  const r = resolveStealthMove({ seed: 's', nonce: 0, distance: 1, mode: 'bold', dangerRooms: 0 });
  assert.equal(r.mode, 'careful');
});

test('U93: riskLevel buckets', () => {
  assert.equal(riskLevel(0), 'none');
  assert.equal(riskLevel(20), 'Low');
  assert.equal(riskLevel(45), 'Medium');
  assert.equal(riskLevel(70), 'High');
});
