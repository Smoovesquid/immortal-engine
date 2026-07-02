// U326 — THE REF Family-A soft-set extension (engine/ref/narrationSource.js).
// The three data-cleared mechanics tags (egress:repair, info-check → no-record,
// clarify:referent — each false-positive-swept PASS before inclusion) classify
// soft; read:revealed-item is deliberately HELD OUT (its good deliveries flag
// FABRICATION until the oracle carries revealed-item text — REF-D2b). Existing
// behavior (dialogue modes, explicit tags, hard default) is unchanged.
// See docs/briefs/THE_REF_CONTRACT.md §4.1.

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyNarrationSource } from '../engine/ref/narrationSource.js';

test('U326: the three swept mechanics tags classify SOFT with their labels', () => {
  const CASES = [
    ['[egress:repair]', 'egress:repair'],
    ['[info-check → no-record | nothing grounded to deliver, no roll]', 'info-check:no-record'],
    ['[clarify:referent]', 'clarify:referent'],
  ];
  for (const [mechanics, label] of CASES) {
    const r = classifyNarrationSource({ mechanics });
    assert.equal(r.soft, true, mechanics);
    assert.equal(r.source, label, mechanics);
  }
});

test('U326: read:revealed-item stays HARD (held out pending the oracle extension)', () => {
  for (const mechanics of [
    '[read:revealed-item | grounded object, legible text, no roll]',
    '[read:revealed-item | grounded object, no legible text, no roll]',
  ]) {
    assert.equal(classifyNarrationSource({ mechanics }).soft, false, mechanics);
  }
});

test('U326: dialogue-ask behavior is unchanged — soft modes soft, intentional modes skipped', () => {
  assert.deepEqual(
    classifyNarrationSource({ mechanics: '[dialogue ask | deflected | trust:5]' }),
    { soft: true, source: 'dialogue:deflected' }
  );
  assert.deepEqual(
    classifyNarrationSource({ mechanics: '[dialogue ask | lied | trust:2]' }),
    { soft: false, source: 'dialogue:lied' }
  );
});

test('U326: explicit narrationSource still wins over the mechanics derivation', () => {
  const r = classifyNarrationSource({ narrationSource: 'generic-resolve', mechanics: '[strike:Worn Blade | atk:21 vs AC:10 → hit | 6 dmg]' });
  assert.deepEqual(r, { soft: true, source: 'generic-resolve' });
  // An unknown explicit tag stays not-soft (existing contract).
  assert.equal(classifyNarrationSource({ narrationSource: 'weird-tag', mechanics: '[egress:repair]' }).soft, false);
});

test('U326: everything else is still HARD', () => {
  for (const mechanics of [
    '[strike:Worn Blade | atk:21 vs AC:10 → hit | 6 dmg]',
    '[rest:long]',
    '[window:exit|which]',
    '',
  ]) {
    assert.deepEqual(classifyNarrationSource({ mechanics }), { soft: false, source: 'hard' }, mechanics);
  }
});
