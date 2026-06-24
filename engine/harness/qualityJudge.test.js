// engine/harness/qualityJudge.test.js — hermetic test of the Tier-2 quality judge.
// FAKE callModel only — NO network, NO API key, zero cost. Proves: the transcript is
// rendered turn-correctly (meta beats skipped), each criterion is judged in its OWN
// focused call (the halo guard — one root flaw can't fail every criterion), a verdict
// maps to one finding per FAILED turn, junk output degrades to a no-op (never crashes),
// errors are contained, and quality findings are correctly NOT auto-fixable.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  QUALITY_CRITERIA, transcriptForJudge, buildCriterionPrompt, criterionSystem,
  parseCriterionVerdict, judgeSession, isAutoFixable,
} from './qualityJudge.js';

const transcript = () => ([
  { who: 'dm', text: 'You wake in a dim room.' },                 // opener (no preceding action) — not a scored turn
  { who: 'you', text: 'I look around' },
  { who: 'dm', text: 'You take in the room: a pallet, a lantern, a chest.' },
  { who: 'you', text: 'what are my stats?' },
  { who: 'dm', text: 'MIGHT 10, WITS 12.', meta: true },          // meta — skipped
  { who: 'you', text: 'I pry the lock' },
  { who: 'dm', text: 'It goes your way.' },                        // filler — the kind we must catch
]);

const resolved = QUALITY_CRITERIA.find(c => c.id === 'resolved');

// A fake that detects which criterion the focused call is asking about (the prompt
// embeds CRITERION "<id>"), then fails the listed turns ONLY for the named criteria.
// `fails` maps turn → set of criterion ids that should fail on that turn.
function criterionAwareModel(fails) {
  return async ({ user }) => {
    const id = (user.match(/CRITERION "([a-z]+)"/) || [])[1];
    const turns = transcriptForJudge(transcript());
    return JSON.stringify({
      turns: turns.map(t => {
        const fail = (fails[t.turn] || new Set()).has(id);
        return { turn: t.turn, pass: !fail, evidence: fail ? t.dm : '' };
      }),
    });
  };
}

test('transcriptForJudge pairs action→DM and skips the opener + meta beats', () => {
  const turns = transcriptForJudge(transcript());
  assert.equal(turns.length, 2, 'two scored DM adjudications (opener + meta excluded)');
  assert.deepEqual(turns.map(t => t.turn), [1, 2]);
  assert.equal(turns[0].action, 'I look around');
  assert.equal(turns[1].dm, 'It goes your way.');
});

test('buildCriterionPrompt is FOCUSED on one criterion, asks for strict JSON, embeds the turns', () => {
  const { system, user, turns } = buildCriterionPrompt(transcript(), resolved);
  assert.match(system, /TABLE TEST/);
  assert.match(system, /SINGLE criterion/);
  // Only the named criterion appears — NOT the other five (that isolation is the fix).
  assert.ok(user.includes(`CRITERION "${resolved.id}"`), 'names its own criterion');
  for (const c of QUALITY_CRITERIA) {
    if (c.id === resolved.id) continue;
    assert.ok(!user.includes(`CRITERION "${c.id}"`), `does NOT name other criterion ${c.id}`);
  }
  assert.match(user, /STRICT JSON/);
  assert.equal(turns.length, 2);
});

test('criterionSystem isolates the single criterion under judgement', () => {
  const sys = criterionSystem(resolved);
  assert.ok(sys.includes(`"${resolved.id}"`), 'embeds the criterion id');
  assert.match(sys, /Ignore every OTHER quality dimension/);
});

test('parseCriterionVerdict emits one finding per FAILED turn, tagged + evidence-anchored', () => {
  const { turns } = buildCriterionPrompt(transcript(), resolved);
  const raw = JSON.stringify({ turns: [
    { turn: 1, pass: true, evidence: '' },
    { turn: 2, pass: false, evidence: 'It goes your way.' },
  ] });
  const findings = parseCriterionVerdict(raw, resolved, turns);
  assert.equal(findings.length, 1, 'one failed turn for this criterion');
  assert.equal(findings[0].oracleId, 'quality-resolves-the-intent');
  assert.equal(findings[0].severity, 'quality');
  assert.equal(findings[0].turn, 2);
  assert.equal(findings[0].evidence, 'It goes your way.');
  assert.equal(findings[0].action, 'I pry the lock');
});

test('parseCriterionVerdict: an all-pass verdict yields zero findings (code fences tolerated)', () => {
  const { turns } = buildCriterionPrompt(transcript(), resolved);
  const raw = '```json\n' + JSON.stringify({ turns: [
    { turn: 1, pass: true, evidence: '' },
    { turn: 2, pass: true, evidence: '' },
  ] }) + '\n```';
  assert.equal(parseCriterionVerdict(raw, resolved, turns).length, 0, 'code fences tolerated, all-pass = clean');
});

test('parseCriterionVerdict: unparseable output degrades to a single low note, never throws', () => {
  const { turns } = buildCriterionPrompt(transcript(), resolved);
  const findings = parseCriterionVerdict('the model rambled with no json', resolved, turns);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'low');
  assert.match(findings[0].oracleId, /parse/);
});

test('judgeSession: each criterion judged independently → one finding per (failed turn × failed criterion)', async () => {
  // Turn 2 fails ONLY resolved + nomachine; everything else passes. The all-six halo
  // is impossible now — a finding appears only for the two criteria actually marked.
  const model = criterionAwareModel({ 2: new Set(['resolved', 'nomachine']) });
  const findings = await judgeSession({ transcript: transcript(), callModel: model });
  assert.equal(findings.length, 2, 'exactly the two failed criteria — NOT all six');
  assert.deepEqual(findings.map(f => f.oracleId).sort(), ['quality-no-machine-voice', 'quality-resolves-the-intent']);
  assert.ok(findings.every(f => f.severity === 'quality' && f.turn === 2));
});

test('judgeSession: makes one call PER criterion (fixed cost, independent of turn count)', async () => {
  let calls = 0;
  const counting = async ({ user }) => {
    calls += 1;
    const turns = transcriptForJudge(transcript());
    return JSON.stringify({ turns: turns.map(t => ({ turn: t.turn, pass: true, evidence: '' })) });
  };
  const findings = await judgeSession({ transcript: transcript(), callModel: counting });
  assert.equal(calls, QUALITY_CRITERIA.length, 'one focused call per criterion');
  assert.equal(findings.length, 0, 'all-pass → no findings');
});

test('judgeSession: empty transcript → no call, no findings', async () => {
  let called = false;
  const model = async () => { called = true; return '{}'; };
  const findings = await judgeSession({ transcript: [], callModel: model });
  assert.equal(findings.length, 0);
  assert.equal(called, false, 'no transcript → no model call');
});

test('judgeSession: a throwing callModel is contained per-criterion (low notes, no crash)', async () => {
  const boom = async () => { throw new Error('overloaded'); };
  const findings = await judgeSession({ transcript: transcript(), callModel: boom });
  // Each criterion's call fails independently → one contained low note each, no crash.
  assert.equal(findings.length, QUALITY_CRITERIA.length);
  assert.ok(findings.every(f => /error/.test(f.oracleId) && f.severity === 'low'));
});

test('isAutoFixable: quality findings are human-triage only; deterministic findings are auto-fixable', () => {
  assert.equal(isAutoFixable({ oracleId: 'quality-specific-not-filler', severity: 'quality' }), false);
  assert.equal(isAutoFixable({ oracleId: 'free-action', severity: 'med' }), true);
  assert.equal(isAutoFixable({ oracleId: 'state-desync', severity: 'high' }), true);
});
