// R09 — Loot determinism: same seed + same loot table = same results.
//
// Uses engine/rng.js seeded RNG to verify that rollLoot is fully
// deterministic and produces expected result distributions.

import test from 'node:test';
import assert from 'node:assert/strict';

import { seedFromString, makeRng } from '../engine/rng.js';
import { rollLoot } from '../engine/ruleset/core/loot/lootRoll.js';
import { getLootTable } from '../engine/ruleset/core/loot/index.js';

test('R09-01: same seed produces identical loot results', () => {
  const rng1 = makeRng(seedFromString('loot-test-seed'));
  const rng2 = makeRng(seedFromString('loot-test-seed'));

  const result1 = rollLoot('monstrous_common', rng1);
  const result2 = rollLoot('monstrous_common', rng2);

  assert.deepEqual(result1, result2);
});

test('R09-02: different seeds produce different results (statistical)', () => {
  // Roll 20 times with different seeds and check we get at least 2 distinct outcomes
  const outcomes = new Set();
  for (let i = 0; i < 20; i++) {
    const rng = makeRng(seedFromString(`loot-diff-${i}`));
    const result = rollLoot('monstrous_common', rng);
    outcomes.add(JSON.stringify(result));
  }
  assert.ok(outcomes.size >= 2, `expected at least 2 distinct outcomes, got ${outcomes.size}`);
});

test('R09-03: monstrous_common can yield null (empty result)', () => {
  // The table has 40% weight on null. Over 50 rolls, at least one should be empty.
  let foundEmpty = false;
  for (let i = 0; i < 50; i++) {
    const rng = makeRng(seedFromString(`loot-null-${i}`));
    const result = rollLoot('monstrous_common', rng);
    if (result.length === 0) { foundEmpty = true; break; }
  }
  assert.ok(foundEmpty, 'at least one roll should yield no loot (null entry)');
});

test('R09-04: monstrous_common can yield items', () => {
  let foundItem = false;
  for (let i = 0; i < 50; i++) {
    const rng = makeRng(seedFromString(`loot-item-${i}`));
    const result = rollLoot('monstrous_common', rng);
    if (result.some(r => r.kind === 'item')) { foundItem = true; break; }
  }
  assert.ok(foundItem, 'at least one roll should yield an item');
});

test('R09-05: humanoid_common can yield currency', () => {
  let foundCurrency = false;
  for (let i = 0; i < 50; i++) {
    const rng = makeRng(seedFromString(`loot-currency-${i}`));
    const result = rollLoot('humanoid_common', rng);
    if (result.some(r => r.kind === 'currency')) { foundCurrency = true; break; }
  }
  assert.ok(foundCurrency, 'at least one roll should yield currency');
});

test('R09-06: unknown table returns empty array', () => {
  const rng = makeRng(seedFromString('loot-unknown'));
  const result = rollLoot('nonexistent_table', rng);
  assert.deepEqual(result, []);
});

test('R09-07: getLootTable returns table by id', () => {
  const mc = getLootTable('monstrous_common');
  assert.ok(mc, 'monstrous_common table exists');
  assert.equal(mc.id, 'monstrous_common');
  assert.equal(mc.entries.length, 5);

  const hc = getLootTable('humanoid_common');
  assert.ok(hc, 'humanoid_common table exists');
  assert.equal(hc.id, 'humanoid_common');
});

test('R09-08: determinism across multiple sequential rolls', () => {
  // Roll 5 times from the same RNG stream, verify replay produces same sequence
  const rng1 = makeRng(seedFromString('loot-seq'));
  const rng2 = makeRng(seedFromString('loot-seq'));
  const seq1 = [];
  const seq2 = [];
  for (let i = 0; i < 5; i++) {
    seq1.push(rollLoot('humanoid_common', rng1));
    seq2.push(rollLoot('humanoid_common', rng2));
  }
  assert.deepEqual(seq1, seq2, 'sequential rolls must be identical under same seed');
});
