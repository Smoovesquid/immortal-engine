// F1 — the standing prose gate (Stage F).
//
// Two halves:
//  (1) PRECISION — the graders (scripts/lib/proseGraders.mjs) flag each regression
//      class and leave good DM prose alone (no false positives).
//  (2) ENFORCEMENT — running scripts/prose-playtest.mjs as a subprocess exits NONZERO
//      on any planted regression and exits ZERO on the clean live corpus. This is
//      Stage F's "intentionally regress a handler and confirm the gate catches it."

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

import {
  gradeAll, gradeNarration,
  gradeCrash, gradeInvisible, gradeValueLeak, gradeFloor, gradeDeadEnd, gradeFormatting,
} from '../scripts/lib/proseGraders.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const GATE = path.join(__dirname, '..', 'scripts', 'prose-playtest.mjs');

const has = (issues, frag) => issues.some(i => i.includes(frag));

describe('F1-A: graders flag each regression class', () => {
  it('CRASH — a thrown handler', () => {
    assert.ok(has(gradeCrash('x', { route: 'action', error: 'Error: boom' }), 'CRASH'));
  });
  it('INVISIBLE — empty / placeholder prose on a prose route', () => {
    assert.ok(has(gradeInvisible('x', { route: 'action', narration: 'Wizard:   ' }), 'INVISIBLE'));
    assert.ok(has(gradeInvisible('x', { route: 'meta', narration: '...' }), 'INVISIBLE'));
  });
  it('VALUE_LEAK — undefined/null/NaN, [object Object], templates, raw node id', () => {
    assert.ok(has(gradeValueLeak('x', { route: 'action', narration: 'You see undefined.' }), 'VALUE_LEAK'));
    assert.ok(has(gradeValueLeak('x', { route: 'action', narration: 'It is [object Object].' }), 'VALUE_LEAK'));
    assert.ok(has(gradeValueLeak('x', { route: 'action', narration: 'Go to ${dest} now.' }), 'VALUE_LEAK'));
    assert.ok(has(gradeValueLeak('x', { route: 'action', narration: 'You enter n3_2068938136 here.' }), 'VALUE_LEAK'));
  });
  it('FLOOR — abstract filler on a resolved action (only on action route)', () => {
    assert.ok(has(gradeFloor('x', { route: 'action', narration: 'A low hum threads through the walls.' }), 'FLOOR'));
    // Not flagged on meta/other routes (ambient description is allowed there).
    assert.equal(gradeFloor('x', { route: 'meta', narration: 'A low hum threads through the walls.' }).length, 0);
  });
  it('DEAD_END — intent bounced back as a mechanical prompt (THE_DM_TEST)', () => {
    const cases = [
      'Which way do you want to go?',
      'You can only travel one tile at a time.',
      "That's not a valid command.",
      'I don\'t understand that.',
      'Please choose a direction.',
      'Type a command to continue.',
      'North, South, East, West?',
    ];
    for (const n of cases) assert.ok(has(gradeDeadEnd('x', { route: 'action', narration: n }), 'DEAD_END'), `should flag: ${n}`);
  });
  it('FORMATTING — the the / X the X / spacing / punctuation / case', () => {
    assert.ok(has(gradeFormatting('x', { route: 'action', narration: 'You open the the door.' }), 'the the'));
    assert.ok(has(gradeFormatting('x', { route: 'action', narration: 'You see the wizard the wizard.' }), 'X the X'));
    assert.ok(has(gradeFormatting('x', { route: 'action', narration: 'You  wait.' }), 'double space'));
    assert.ok(has(gradeFormatting('x', { route: 'action', narration: 'You wait .' }), 'space before punctuation'));
    assert.ok(has(gradeFormatting('x', { route: 'action', narration: 'you wait.' }), 'lowercase start'));
    assert.ok(has(gradeFormatting('x', { route: 'action', narration: 'You wait' }), 'no end punctuation'));
  });
});

describe('F1-B: graders leave good DM prose alone (no false positives)', () => {
  const good = [
    'You take the torch and stow it.',
    'The weathered door rattles in its frame but refuses to yield.',
    'Aldric warms despite themselves, a smile breaking through.',
    "You're inside Wayfarers' Outpost. The way out leads back to the road.",
    'You wait, watchful, and let the moment run on.',
    'You read it through, and the meaning comes clear.',
    'You shape the working, and it answers — power moving the way you intend.',
  ];
  for (const n of good) {
    it(`clean: "${n.slice(0, 42)}…"`, () => {
      assert.deepEqual(gradeNarration(n), [], `false positive: ${gradeNarration(n).join('; ')}`);
    });
  }
  it('non-prose routes (cardinal/empty) are never graded', () => {
    assert.deepEqual(gradeAll('n', { route: 'cardinal', narration: '(local walk — UI only)' }), []);
    assert.deepEqual(gradeAll('', { route: 'empty', narration: '(no input)' }), []);
  });
});

describe('F1-C: the gate enforces (subprocess exit codes)', () => {
  const run = (env) => spawnSync(process.execPath, [GATE], { env: { ...process.env, ...env }, encoding: 'utf8' });

  it('clean live corpus → exit 0 (PASS)', () => {
    const r = run({});
    assert.equal(r.status, 0, `expected PASS, got ${r.status}\n${r.stdout?.slice(-400)}`);
    assert.match(r.stdout, /PROSE GATE: PASS/);
  });

  for (const cls of ['crash', 'invisible', 'value_leak', 'floor', 'dead_end', 'formatting']) {
    it(`planted ${cls} regression → exit 1 (FAIL)`, () => {
      const r = run({ PROSE_GATE_SELFTEST: cls });
      assert.equal(r.status, 1, `expected FAIL for ${cls}, got ${r.status}`);
      assert.match(r.stdout, /PROSE GATE: FAIL/);
    });
  }

  it('selftest=all → exit 1 and reports every class', () => {
    const r = run({ PROSE_GATE_SELFTEST: 'all' });
    assert.equal(r.status, 1);
    for (const tag of ['CRASH', 'INVISIBLE', 'VALUE_LEAK', 'FLOOR', 'DEAD_END', 'FORMAT']) {
      assert.match(r.stdout, new RegExp(tag), `gate should report ${tag}`);
    }
  });
});
