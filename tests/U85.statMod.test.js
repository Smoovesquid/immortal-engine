import test from 'node:test';
import assert from 'node:assert/strict';

import { statMod, maxWounds } from '../engine/ruleset/core/stats.js';
import { LEVEL_TABLE, levelEntry, profBonusFor, xpToReach } from '../engine/ruleset/core/levelTable.js';

// U85 — Pass T1 stat helpers + level table sanity.

test('U85-01: statMod matches 5e floor((score-10)/2)', () => {
  assert.equal(statMod(10), 0);
  assert.equal(statMod(15), 2);
  assert.equal(statMod(20), 5);
  assert.equal(statMod(8), -1);
  assert.equal(statMod(1), -5);
});

test('U85-02: statMod handles garbage input gracefully (returns 0)', () => {
  assert.equal(statMod(undefined), 0);
  assert.equal(statMod(NaN), 0);
  assert.equal(statMod('not a number'), 0);
});

test('U85-03: maxWounds baseline values', () => {
  assert.equal(maxWounds(1, 0), 6);   // 6 + 0*2 + 0
  assert.equal(maxWounds(5, 2), 16);  // 6 + 4*2 + 2
  assert.equal(maxWounds(10, 0), 24); // 6 + 9*2 + 0
});

test('U85-04: maxWounds clamps negative grit to 0', () => {
  assert.equal(maxWounds(1, -3), 6);
  assert.equal(maxWounds(5, -5), 14); // 6 + 4*2 + 0
});

test('U85-05: maxWounds clamps level to [1,20]', () => {
  assert.equal(maxWounds(0, 0), 6);   // treated as 1
  assert.equal(maxWounds(25, 0), 44); // treated as 20: 6 + 19*2 + 0
});

test('U85-06: LEVEL_TABLE has 20 entries with monotonic xpToReach', () => {
  assert.equal(LEVEL_TABLE.length, 20);
  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    assert.equal(LEVEL_TABLE[i].level, i + 1);
  }
  for (let i = 1; i < LEVEL_TABLE.length; i++) {
    assert.ok(
      LEVEL_TABLE[i].xpToReach > LEVEL_TABLE[i - 1].xpToReach,
      `xpToReach must strictly increase at level ${i + 1}`
    );
  }
});

test('U85-07: prof bonus follows +1 bands every 4 levels (2/3/4/5/6)', () => {
  assert.equal(profBonusFor(1), 2);
  assert.equal(profBonusFor(4), 2);
  assert.equal(profBonusFor(5), 3);
  assert.equal(profBonusFor(8), 3);
  assert.equal(profBonusFor(9), 4);
  assert.equal(profBonusFor(12), 4);
  assert.equal(profBonusFor(13), 5);
  assert.equal(profBonusFor(16), 5);
  assert.equal(profBonusFor(17), 6);
  assert.equal(profBonusFor(20), 6);
});

test('U85-08: level 1 xpToReach is 0', () => {
  assert.equal(xpToReach(1), 0);
});

test('U85-09: levelEntry clamps out-of-range levels', () => {
  assert.equal(levelEntry(0).level, 1);
  assert.equal(levelEntry(25).level, 20);
});
