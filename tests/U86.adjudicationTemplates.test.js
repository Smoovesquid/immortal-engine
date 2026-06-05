import test from 'node:test';
import assert from 'node:assert/strict';

import { templates } from '../engine/adjudication/templates.js';
import { ruling } from '../engine/adjudication/ruling.js';

// ── U86 — Adjudication Templates & Ruling Core ────────────────────────────

test('U86-01: getTemplate returns wood break success template', () => {
  const tpl = templates.getTemplate('wood', 'break', 'success');
  assert.ok(typeof tpl === 'string');
  assert.ok(tpl.includes('wooden'));
  assert.ok(tpl.includes('Splinters'));
});

test('U86-02: getTemplate returns different outcomes for same action', () => {
  const success = templates.getTemplate('wood', 'break', 'success');
  const mixed = templates.getTemplate('wood', 'break', 'mixed');
  const failure = templates.getTemplate('wood', 'break', 'failure');
  assert.notEqual(success, mixed);
  assert.notEqual(mixed, failure);
});

test('U86-03: renderTemplate interpolates object name', () => {
  const tpl = templates.getTemplate('wood', 'break', 'success');
  const rendered = templates.renderTemplate(tpl, 'barrel');
  assert.ok(rendered.includes('barrel'));
});

test('U86-04: getTemplate fallback for unknown material', () => {
  const tpl = templates.getTemplate('unknown', 'break', 'success');
  assert.ok(typeof tpl === 'string');
  assert.ok(tpl.length > 0); // should fall back to wood
});

test('U86-05: proposeRuling returns basic structure', () => {
  const proposal = ruling.proposeRuling({}, 'smash the barrel');
  assert.equal(typeof proposal.plausible, 'boolean');
  assert.equal(typeof proposal.approach, 'string');
  assert.equal(typeof proposal.dcSuggestion, 'number');
});

test('U86-06: proposeRuling infers approach from intent keywords', () => {
  const force = ruling.proposeRuling({}, 'smash the barrel');
  assert.equal(force.approach, 'force');

  const finesse = ruling.proposeRuling({}, 'pick the lock');
  assert.equal(finesse.approach, 'finesse');

  const persuade = ruling.proposeRuling({}, 'convince the guard');
  assert.equal(persuade.approach, 'heart');
});

test('U86-07: proposeRuling DC is in valid range', () => {
  const proposal = ruling.proposeRuling({}, 'do something');
  assert.ok(proposal.dcSuggestion >= 5);
  assert.ok(proposal.dcSuggestion <= 20);
});

test('U86-08: validateRuling rejects missing approach', () => {
  const invalid = { dcSuggestion: 10 };
  const result = ruling.validateRuling({}, invalid, []);
  assert.equal(result.ok, false);
});

test('U86-09: validateRuling rejects DC out of range', () => {
  const invalid = { approach: 'force', dcSuggestion: 30 };
  const result = ruling.validateRuling({}, invalid, []);
  assert.equal(result.ok, false);
});

test('U86-10: computeOutcome returns success for roll >= DC', () => {
  const outcome = ruling.computeOutcome(15, 2, 10);
  assert.equal(outcome, 'success');
});

test('U86-11: computeOutcome returns mixed for roll in middle range', () => {
  const outcome = ruling.computeOutcome(7, 2, 10); // 7 + 2 = 9, which is < 10 but >= 5
  assert.equal(outcome, 'mixed');
});

test('U86-12: computeOutcome returns failure for roll < DC-5', () => {
  const outcome = ruling.computeOutcome(2, 2, 10); // 2 + 2 = 4, which is < 5
  assert.equal(outcome, 'failure');
});

test('U86-13: logRuling adds entry to timeline', () => {
  const w = { timeline: [] };
  const rulingData = {
    action: 'smash the barrel',
    approach: 'force',
    roll: 16,
    outcome: 'success',
    deltas: []
  };
  const w2 = ruling.logRuling(w, rulingData);
  assert.equal(w2.timeline.length, 1);
  assert.equal(w2.timeline[0].kind, 'ruling');
  assert.equal(w2.timeline[0].data.action, 'smash the barrel');
});

test('U86-14: logRuling preserves ruling data', () => {
  const w = { timeline: [] };
  const rulingData = {
    action: 'test action',
    approach: 'finesse',
    dcSuggestion: 12,
    roll: 18,
    outcome: 'success',
    deltas: []
  };
  const w2 = ruling.logRuling(w, rulingData);
  const logged = w2.timeline[0].data;
  assert.equal(logged.action, 'test action');
  assert.equal(logged.approach, 'finesse');
  assert.equal(logged.dcSuggestion, 12);
  assert.equal(logged.roll, 18);
  assert.equal(logged.outcome, 'success');
});

test('U86-15: getAllTemplates returns all materials and actions', () => {
  const all = templates.getAllTemplates();
  assert.ok(all.wood);
  assert.ok(all.stone);
  assert.ok(all.metal);
  assert.ok(all.glass);
  assert.ok(all.cloth);
  assert.ok(all.ceramic);
  assert.ok(all.organic);
});
