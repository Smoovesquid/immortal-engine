// scripts/auto-playtest.test.js — hermetic test of the Phase-3 CONTROL logic
// (group / triage / the fix loop) with FAKE fixer + gate + vcs. NO model calls, NO
// git, NO subprocess, NO repo mutation. Proves the safety-critical claim: a GOOD
// patch lands (commit, no revert) and a BAD patch AUTO-REVERTS and never commits —
// the deterministic gate is what makes "press go, walk away" safe.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  seamSignature, groupFindings, triageSeams, makeRegressionTest, commitMessage, runFixLoop,
} from './auto-playtest.mjs';

// ── Fakes (in-memory; record every call so the test can assert the control flow) ──
function fakeVcs() {
  const calls = { applied: [], writes: [], reverted: [], commits: [] };
  return {
    calls,
    async applyEdits(edits) { calls.applied.push(edits); return { files: edits.map(e => e.file) }; },
    async writeFile(file, content) { calls.writes.push({ file, content }); },
    async revert(mod, created) { calls.reverted.push({ mod, created }); },
    async commit(message, files) { const c = { hash: `fake${calls.commits.length}`, message, files }; calls.commits.push(c); return c; },
  };
}
// `pass(n)` decides the verdict on the n-th evaluate() call (1-indexed).
function fakeGate({ reproduces = true, pass = () => true } = {}) {
  const state = { reproCalls: 0, evalCalls: 0 };
  return {
    state,
    async reproduces() { state.reproCalls++; return reproduces; },
    async evaluate() { state.evalCalls++; const ok = pass(state.evalCalls); return { pass: ok, reason: ok ? 'replay clean + suite green' : 'gate failed', suite: { pass: 9999, fail: ok ? 0 : 1 } }; },
  };
}
function fakeFixer({ edits, rationale = 'minimal fix', returnNullFrom = Infinity, throwFrom = Infinity } = {}) {
  const state = { calls: 0 };
  const def = [{ file: 'engine/playloop.js', oldString: 'OLD', newString: 'NEW' }];
  return {
    state,
    async proposeFix() {
      state.calls++;
      if (state.calls >= throwFrom) throw new Error('fixer boom');
      if (state.calls >= returnNullFrom) return null;
      return { edits: edits || def, rationale };
    },
  };
}
function seamFixture(over = {}) {
  return {
    seamKey: 'free-action::rolled-a-free-action', oracleId: 'free-action', signature: 'rolled-a-free-action',
    note: 'rolled-a-free-action (intent-routing seam)', severity: 'med', count: 1,
    findings: [{ action: 'I step inside the building.', claim: 'c', expected: 'e', committed: 'k' }],
    seed: 'tallow', actions: ['I get up', 'I step inside the building.'], goalId: 'reach-first-concern', turns: 25,
    locus: { file: 'engine/playloop.js', symbol: 'inferInteriorAction' }, kind: 'intent-routing',
    ...over,
  };
}

// ── GROUP ──────────────────────────────────────────────────────────────────────
test('seamSignature extracts the stable kebab slug leading the note', () => {
  assert.equal(seamSignature('rolled-a-free-action (intent-routing seam)'), 'rolled-a-free-action');
  assert.equal(seamSignature('dead-progress — the player cannot make headway'), 'dead-progress');
  assert.equal(seamSignature('said-outside-still-inside — the DM lied about where you are'), 'said-outside-still-inside');
});

test('groupFindings collapses same-signature findings (across turns) into one seam', () => {
  const findings = [
    { oracleId: 'free-action', severity: 'med', note: 'rolled-a-free-action (intent-routing seam)', turn: 5, seed: 'tallow', actions: ['a'] },
    { oracleId: 'free-action', severity: 'med', note: 'rolled-a-free-action (intent-routing seam)', turn: 8, seed: 'tallow', actions: ['a'] },
    { oracleId: 'soft-lock', severity: 'med', note: 'dead-progress — the player cannot make headway', turn: 9, seed: 'tallow', actions: ['a'] },
  ];
  const seams = groupFindings(findings);
  assert.equal(seams.length, 2);
  const fa = seams.find(s => s.oracleId === 'free-action');
  assert.equal(fa.count, 2);
  assert.equal(fa.seamKey, 'free-action::rolled-a-free-action');
});

test('groupFindings takes the max severity across a seam\'s findings', () => {
  const seams = groupFindings([
    { oracleId: 'state-desync', severity: 'med', note: 'said-outside-still-inside — x', seed: 's', actions: ['a'] },
    { oracleId: 'state-desync', severity: 'high', note: 'said-outside-still-inside — x', seed: 's', actions: ['a'] },
  ]);
  assert.equal(seams.length, 1);
  assert.equal(seams[0].severity, 'high');
});

// ── TRIAGE ─────────────────────────────────────────────────────────────────────
test('triageSeams: free-action → auto-fixable (with locus); others → needs-human', () => {
  const seams = [
    seamFixture(),
    { seamKey: 'soft-lock::dead-progress', oracleId: 'soft-lock', signature: 'dead-progress', note: 'dead-progress — n', seed: 'tallow', actions: ['a'], count: 1, severity: 'med', findings: [] },
    { seamKey: 'state-desync::x', oracleId: 'state-desync', signature: 'x', note: 'n', seed: 'tallow', actions: ['a'], count: 1, severity: 'high', findings: [] },
    { seamKey: 'mystery::foo', oracleId: 'mystery', signature: 'foo', note: 'n', seed: 'tallow', actions: ['a'], count: 1, severity: 'low', findings: [] },
  ];
  const { autoFixable, needsHuman } = triageSeams(seams);
  assert.deepEqual(autoFixable.map(s => s.oracleId), ['free-action']);
  assert.equal(autoFixable[0].locus.symbol, 'inferInteriorAction');
  assert.equal(needsHuman.length, 3);
  // an unclassified oracle is explicitly explained, not silently dropped
  assert.match(needsHuman.find(s => s.oracleId === 'mystery').reason, /no registry entry/);
});

test('triageSeams: a free-action seam with NO replay is returned for human (can\'t gate)', () => {
  const { autoFixable, needsHuman } = triageSeams([seamFixture({ actions: [] })]);
  assert.equal(autoFixable.length, 0);
  assert.equal(needsHuman.length, 1);
  assert.match(needsHuman[0].reason, /no deterministic replay/);
});

// ── THE FIX LOOP — the safety-critical control flow ──────────────────────────────
test('fix loop: a GOOD patch lands — committed once, never reverted, regression written', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ pass: () => true }), fixer = fakeFixer();
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 3 });
  assert.equal(results[0].status, 'fixed');
  assert.equal(results[0].fixed.attempt, 1);
  assert.equal(vcs.calls.commits.length, 1, 'exactly one commit');
  assert.equal(vcs.calls.reverted.length, 0, 'no reverts on a clean fix');
  assert.equal(vcs.calls.writes.length, 1, 'regression test written once');
  assert.equal(fixer.state.calls, 1, 'stopped after the first success');
});

test('fix loop: a BAD patch CANNOT survive — every attempt auto-reverts, zero commits', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ pass: () => false }), fixer = fakeFixer();
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 3 });
  assert.equal(results[0].status, 'couldnt-fix');
  assert.equal(vcs.calls.applied.length, 3, 'tried up to max-attempts');
  assert.equal(vcs.calls.reverted.length, 3, 'reverted every failed attempt');
  assert.equal(vcs.calls.commits.length, 0, 'a bad patch is NEVER committed');
});

test('fix loop: bad-then-good — reverts the bad attempt, commits the good one', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ pass: (n) => n >= 2 }), fixer = fakeFixer();
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 3 });
  assert.equal(results[0].status, 'fixed');
  assert.equal(results[0].fixed.attempt, 2);
  assert.equal(vcs.calls.applied.length, 2);
  assert.equal(vcs.calls.reverted.length, 1);
  assert.equal(vcs.calls.commits.length, 1);
});

test('fix loop: a seam that does NOT reproduce is skipped — fixer never called', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ reproduces: false }), fixer = fakeFixer();
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 3 });
  assert.equal(results[0].status, 'no-repro');
  assert.equal(fixer.state.calls, 0, 'no fix attempted for a non-reproducing seam');
  assert.equal(vcs.calls.applied.length, 0);
  assert.equal(vcs.calls.commits.length, 0);
});

test('fix loop: a fixer that gives up (null patch) yields couldnt-fix, no mutation', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ pass: () => true }), fixer = fakeFixer({ returnNullFrom: 1 });
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 3 });
  assert.equal(results[0].status, 'couldnt-fix');
  assert.equal(vcs.calls.applied.length, 0);
  assert.equal(vcs.calls.commits.length, 0);
});

test('fix loop: a thrown fixer error is contained — the attempt is recorded, no commit', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ pass: () => true }), fixer = fakeFixer({ throwFrom: 1 });
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 2 });
  assert.equal(results[0].status, 'couldnt-fix');
  assert.equal(results[0].attempts.every(a => a.status === 'fixer-error'), true);
  assert.equal(vcs.calls.commits.length, 0);
});

test('fix loop: the time budget defers unprocessed seams instead of running them', async () => {
  const vcs = fakeVcs(), gate = fakeGate({ pass: () => true }), fixer = fakeFixer();
  const results = await runFixLoop({ seams: [seamFixture()], fixer, gate, vcs, maxAttempts: 3, deadline: Date.now() - 1 });
  assert.equal(results[0].status, 'deferred');
  assert.equal(fixer.state.calls, 0);
});

// ── The committed artifacts (regression test + commit message) ───────────────────
test('makeRegressionTest emits a discoverable *.test.js that pins the seam', () => {
  const rt = makeRegressionTest(seamFixture());
  assert.match(rt.file, /engine\/harness\/regr\..*\.test\.js$/);
  assert.match(rt.content, /oracleId === "free-action"/);
  assert.match(rt.content, /bootWorld\("tallow"/);
  assert.ok(rt.content.includes(JSON.stringify(seamFixture().actions)), 'replays the exact action log');
});

test('commitMessage carries the seam, rationale, and the Co-Authored-By trailer', () => {
  const msg = commitMessage(seamFixture(), { rationale: 'strip trailing punctuation' });
  assert.match(msg, /^fix\(engine\): free-action — rolled-a-free-action \(auto-fix\)/);
  assert.match(msg, /strip trailing punctuation/);
  assert.match(msg, /Co-Authored-By: Claude Opus 4\.8/);
});
