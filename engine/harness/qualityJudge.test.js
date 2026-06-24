// engine/harness/qualityJudge.test.js — hermetic test of the Tier-2 quality judge.
// FAKE callModel only — NO network, NO API key, zero cost. Proves: the transcript is
// rendered turn-correctly (meta beats skipped), a verdict maps to one finding per
// FAILED criterion, junk output degrades to a no-op (never crashes), errors are
// contained, and quality findings are correctly NOT auto-fixable.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  QUALITY_CRITERIA, transcriptForJudge, buildJudgePrompt, parseJudgeVerdict, judgeSession, isAutoFixable,
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

test('transcriptForJudge pairs action→DM and skips the opener + meta beats', () => {
  const turns = transcriptForJudge(transcript());
  assert.equal(turns.length, 2, 'two scored DM adjudications (opener + meta excluded)');
  assert.deepEqual(turns.map(t => t.turn), [1, 2]);
  assert.equal(turns[0].action, 'I look around');
  assert.equal(turns[1].dm, 'It goes your way.');
});

test('buildJudgePrompt asks for strict JSON, lists every criterion, embeds the turns', () => {
  const { system, user, turns } = buildJudgePrompt(transcript());
  assert.match(system, /TABLE TEST/);
  for (const c of QUALITY_CRITERIA) assert.ok(user.includes(`"${c.id}"`), `criterion ${c.id} present`);
  assert.match(user, /STRICT JSON/);
  assert.equal(turns.length, 2);
});

test('parseJudgeVerdict emits one finding per FAILED criterion, tagged + evidence-anchored', () => {
  const { turns } = buildJudgePrompt(transcript());
  const raw = JSON.stringify({ turns: [
    { turn: 1, resolved: true, agency: true, nomachine: true, concise: true, grounded: true, voice: true, evidence: '' },
    { turn: 2, resolved: false, agency: true, nomachine: false, concise: true, grounded: true, voice: true, evidence: 'It goes your way.' },
  ] });
  const findings = parseJudgeVerdict(raw, turns);
  assert.equal(findings.length, 2, 'two failed criteria on turn 2');
  assert.deepEqual(findings.map(f => f.oracleId).sort(), ['quality-no-machine-voice', 'quality-resolves-the-intent']);
  assert.ok(findings.every(f => f.severity === 'quality' && f.turn === 2));
  assert.equal(findings[0].evidence, 'It goes your way.');
  assert.equal(findings[0].action, 'I pry the lock');
});

test('parseJudgeVerdict: a clean verdict yields zero findings', () => {
  const { turns } = buildJudgePrompt(transcript());
  const raw = '```json\n' + JSON.stringify({ turns: [
    { turn: 1, resolved: true, agency: true, nomachine: true, concise: true, grounded: true, voice: true, evidence: '' },
    { turn: 2, resolved: true, agency: true, nomachine: true, concise: true, grounded: true, voice: true, evidence: '' },
  ] }) + '\n```';
  assert.equal(parseJudgeVerdict(raw, turns).length, 0, 'code fences tolerated, all-pass = clean');
});

test('parseJudgeVerdict: unparseable output degrades to a single low note, never throws', () => {
  const { turns } = buildJudgePrompt(transcript());
  const findings = parseJudgeVerdict('the model rambled with no json', turns);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'low');
  assert.match(findings[0].oracleId, /parse/);
});

test('judgeSession: fake callModel → findings; empty transcript → no call, no findings', async () => {
  const fakeModel = async () => JSON.stringify({ turns: [{ turn: 2, resolved: false, agency: false, nomachine: false, concise: false, grounded: false, voice: false, evidence: 'It goes your way.' }] });
  const findings = await judgeSession({ transcript: transcript(), callModel: fakeModel });
  assert.equal(findings.length, 6, 'all six criteria failed on the filler turn');
  assert.equal(await (await judgeSession({ transcript: [], callModel: fakeModel })).length, 0);
});

test('judgeSession: a throwing callModel is contained (low note, no crash)', async () => {
  const boom = async () => { throw new Error('overloaded'); };
  const findings = await judgeSession({ transcript: transcript(), callModel: boom });
  assert.equal(findings.length, 1);
  assert.match(findings[0].oracleId, /error/);
});

test('isAutoFixable: quality findings are human-triage only; deterministic findings are auto-fixable', () => {
  assert.equal(isAutoFixable({ oracleId: 'quality-specific-not-filler', severity: 'quality' }), false);
  assert.equal(isAutoFixable({ oracleId: 'free-action', severity: 'med' }), true);
  assert.equal(isAutoFixable({ oracleId: 'state-desync', severity: 'high' }), true);
});
