// U325 — THE REF Family-B content-shape detectors (engine/ref/detectors.js).
// Deterministic escalators: fire ONLY on signatures real DM prose never carries
// (stat-block runs, resolver grammar, list glue), never throw, and stay silent on
// legitimate prose — a false fire costs a judge call, so the fire set is
// conservative by construction. See docs/briefs/THE_REF_CONTRACT.md §4.1.

import test from 'node:test';
import assert from 'node:assert/strict';

import { detectNarrationArtifacts } from '../engine/ref/detectors.js';

test('U325: a stat-block RUN (≥2 NAME dd (±d) pairs) fires as MACHINE_DUMP', () => {
  const d = detectNarrationArtifacts(
    "You're Sera, a gravedigger — your measures: MIGHT 6 (-2), AGILITY 6 (-2), WITS 6 (+0)."
  );
  assert.equal(d.fired, true);
  assert.equal(d.failureClass, 'MACHINE_DUMP');
  assert.equal(d.source, 'detector:stat-block');
});

test('U325: a SINGLE stat mention does not fire (a legitimate rules answer)', () => {
  const d = detectNarrationArtifacts('Your MIGHT 6 (-2) is the weak point here, truth be told.');
  assert.equal(d.fired, false);
});

test('U325: plain talk of might/wits never fires', () => {
  const d = detectNarrationArtifacts('You feel your might returning as your wits settle.');
  assert.equal(d.fired, false);
});

test('U325: resolver grammar in prose fires (vs DC / margin / arrow-outcome / tag fragment / node id / gen key)', () => {
  const CASES = [
    'The lock gives — 14 vs DC 13, a near thing.',
    'It lands, margin: 1, and no more.',
    'The attempt resolves → success, and the door opens.',
    'You press on. [roll:17 vs DC:12] The road bends north.',
    'The path runs down toward n3_1515674724 and the river.',
    'gen:s — you see it through.',
  ];
  for (const text of CASES) {
    const d = detectNarrationArtifacts(text);
    assert.equal(d.fired, true, `should fire: ${text}`);
    assert.equal(d.source, 'detector:mech-grammar', text);
  }
});

test('U325: ordinary prose with numbers/dice-words does not fire', () => {
  const CASES = [
    'The gate holds fast against you.',
    'Three riders passed at dusk, maybe four.',
    'She counts out six coins and slides them across.',
    'The margin of the page is scrawled with old tallies.', // "margin" without the grammar shape
  ];
  for (const text of CASES) {
    assert.equal(detectNarrationArtifacts(text).fired, false, `should NOT fire: ${text}`);
  }
});

test('U325: a repeated item in a comma-list fires as list glue', () => {
  const d = detectNarrationArtifacts(
    "You'll find well, workshop, well; folk worth knowing here."
  );
  assert.equal(d.fired, true);
  assert.equal(d.source, 'detector:list-glue');
});

test('U325: an honest list and clause-commas do not fire', () => {
  const CASES = [
    'You find a well, a workshop, and a forge here.',
    'She pauses, looks you over, and shrugs.',
    'Bread, salt, and rope — the pack holds the basics.',
    'He looked left, looked right, and looked back again.',
  ];
  for (const text of CASES) {
    assert.equal(detectNarrationArtifacts(text).fired, false, `should NOT fire: ${text}`);
  }
});

test('U325: never throws — null/undefined/number/empty/huge input', () => {
  for (const v of [null, undefined, 42, '', '   ', 'x'.repeat(50000)]) {
    const d = detectNarrationArtifacts(v);
    assert.equal(typeof d, 'object');
    assert.equal(typeof d.fired, 'boolean');
  }
});
