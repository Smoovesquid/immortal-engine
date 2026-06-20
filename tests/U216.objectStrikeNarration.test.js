// U216 — H-53 out-of-combat object-strike narration.
//
// A deliberate weapon/force strike at a named scene object should narrate the
// target being hit/missed, not fall through to the generic obstacle-success bank.

import test from 'node:test';
import assert from 'node:assert/strict';

import { genericGroundedOutcome } from '../engine/playloop.js';

function makeWorld(overrides = {}) {
  return {
    meta: { seed: 'u216-object-strike' },
    map: {
      currentNodeId: 'glass-harbor',
      nodes: [{ id: 'glass-harbor', name: 'Glass Harbor', nodeType: 'settlement' }],
      edges: []
    },
    timeline: [],
    ...overrides
  };
}

const GENERIC_SUCCESS = [
  'You see it through, and it goes your way.',
  'It comes off cleanly; the moment turns toward you.',
  'You manage it, and the way ahead opens a little.'
];

function body(narration) {
  return String(narration || '').replace(/^Wizard:\s*/, '');
}

function assertNames(narration, word) {
  assert.match(narration, new RegExp(`\\b${word}\\b`, 'i'));
}

function assertGenericSuccess(narration) {
  assert.ok(GENERIC_SUCCESS.includes(body(narration)), `must stay generic success: ${narration}`);
}

test('U216-01: REJECT old generic success for verbatim bread-basket strike', () => {
  const narr = genericGroundedOutcome(
    makeWorld(),
    'I draw the Worn Blade and swing it at the bread basket on the table',
    'success'
  );
  assertNames(narr, 'basket');
  assert.ok(!GENERIC_SUCCESS.includes(body(narr)), `must not use generic success line: ${narr}`);
});

test('U216-02: strike preposition variants name the target', () => {
  const world = makeWorld();
  assertNames(genericGroundedOutcome(world, 'I swing the blade into the hanging curtain', 'success'), 'curtain');
  assertNames(genericGroundedOutcome(world, 'I slash through the rope above the crate', 'success'), 'rope');
});

test('U216-03: bare direct-object strike verbs name the target', () => {
  const world = makeWorld();
  assertNames(genericGroundedOutcome(world, 'strike the lantern', 'success'), 'lantern');
  assertNames(genericGroundedOutcome(world, 'hack the crate', 'success'), 'crate');
});

test('U216-04: mixed and failure outcomes name the target and match outcome', () => {
  const mixed = genericGroundedOutcome(makeWorld(), 'bash the clay jug', 'mixed');
  assertNames(mixed, 'jug');
  assert.match(mixed, /\b(glancing|tips|spills|holds together|cracks|wobbles)\b/i);

  const failure = genericGroundedOutcome(makeWorld(), 'cut across the tablecloth', 'failure');
  assertNames(failure, 'tablecloth');
  assert.match(failure, /\b(wide|untouched|miss|fails|never reaches)\b/i);
});

test('U216-05: object-strike narration is deterministic for the same world/text/outcome', () => {
  const world = makeWorld();
  const text = 'I draw the Worn Blade and swing it at the bread basket on the table';
  assert.equal(
    genericGroundedOutcome(world, text, 'success'),
    genericGroundedOutcome(world, text, 'success')
  );
});

test('U216-06: movement swing phrasings and unrelated actions do not trigger strike branch', () => {
  const by = body(genericGroundedOutcome(makeWorld(), 'swing by the tavern', 'success'));
  const around = body(genericGroundedOutcome(makeWorld(), 'swing around to the gate', 'success'));
  const wait = genericGroundedOutcome(makeWorld(), 'I wait a moment', 'success');

  assert.ok(GENERIC_SUCCESS.includes(by), `swing by must stay generic: ${by}`);
  assert.ok(GENERIC_SUCCESS.includes(around), `swing around must stay generic: ${around}`);
  assert.match(wait, /\b(wait|bide|hold)\b/i);
});

test('U216-07: cut across/through place and crowd targets do not trigger strike branch', () => {
  assertGenericSuccess(genericGroundedOutcome(makeWorld(), 'I cut across the courtyard', 'success'));

  const crowd = genericGroundedOutcome(makeWorld(), 'I cut through the crowd', 'success');
  assertGenericSuccess(crowd);
  assert.doesNotMatch(crowd, /\b(hit|breaks under the strike|strike catches)\b.*\bcrowd\b/i);

  const guards = genericGroundedOutcome(makeWorld(), 'I hack through the throng of guards', 'success');
  assertGenericSuccess(guards);
  assert.doesNotMatch(guards, /\b(hit|breaks under the strike|strike catches)\b.*\b(throng|guards)\b/i);
});

test('U216-08: adjective-led non-strikable final target word is denied', () => {
  assertGenericSuccess(genericGroundedOutcome(makeWorld(), 'I cut across the inner courtyard', 'success'));
});

test('U216-09: H-53 object strikes still fire after non-strikable denylist', () => {
  assertNames(genericGroundedOutcome(makeWorld(), 'cut across the tablecloth', 'success'), 'tablecloth');
  assertNames(genericGroundedOutcome(makeWorld(), 'I draw the Worn Blade and swing it at the bread basket on the table', 'success'), 'basket');
  assertNames(genericGroundedOutcome(makeWorld(), 'strike the lantern', 'success'), 'lantern');
});
