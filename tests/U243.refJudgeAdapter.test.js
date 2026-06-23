// U243 — THE REF live adapter (server/refJudge.js): the Haiku-atomic judge + the
// Sonnet regenerate, proven deterministically with a stubbed fetch (no real API).
// Covers: the atomic-verdict parser (incl. atom-derived verdict + garbage→PASS),
// the regen system/user prompts, the judge wiring, and the SAFETY GATE — a regen
// that fails the Tier-1 validator (brackets / multi-sentence / empty) returns null
// so the orchestration falls back to the engine's honest base.
//
// Deterministic, LLM-off (fetch is stubbed). See docs/THE_REF.md P3.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRefAdapter, parseRefVerdict, buildRegenSystem, buildRegenUser,
} from '../server/refJudge.js';
import { REF_VERDICTS } from '../engine/ref/rubric.js';

// chatCompletion checks for an env key before it calls fetch — give it a fake one
// (this file runs in its own test process, restored after).
let savedKey;
before(() => { savedKey = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = 'test-ref-key'; });
after(() => { if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedKey; });

// A fetch stub shaped like the Anthropic Messages response callAnthropic expects.
const anthropicReply = (text) => async () => ({ ok: true, json: async () => ({ content: [{ text }] }) });

// ── parseRefVerdict ───────────────────────────────────────────────────────────
test('U243: parseRefVerdict reads an explicit PASS', () => {
  const v = parseRefVerdict('{"answers_the_question":true,"grounded":true,"honest_on_unknown":true,"in_voice":true,"verdict":"PASS","failure_class":"NONE"}');
  assert.equal(v.verdict, REF_VERDICTS.PASS);
});

test('U243: parseRefVerdict reads an explicit REGENERATE + failure_class', () => {
  const v = parseRefVerdict('{"answers_the_question":false,"grounded":true,"honest_on_unknown":false,"in_voice":true,"verdict":"REGENERATE","failure_class":"ATMOSPHERE_DODGE"}');
  assert.equal(v.verdict, REF_VERDICTS.REGENERATE);
  assert.equal(v.failure_class, 'ATMOSPHERE_DODGE');
});

test('U243: parseRefVerdict derives REGENERATE from a failed atom when verdict is missing', () => {
  const v = parseRefVerdict('{"answers_the_question":false,"grounded":true,"honest_on_unknown":true,"in_voice":true}');
  assert.equal(v.verdict, REF_VERDICTS.REGENERATE);
});

test('U243: parseRefVerdict derives PASS from all-true atoms when verdict is missing', () => {
  const v = parseRefVerdict('{"answers_the_question":true,"grounded":true,"honest_on_unknown":true,"in_voice":true}');
  assert.equal(v.verdict, REF_VERDICTS.PASS);
});

test('U243: parseRefVerdict on garbage/empty → PASS (bias toward answering)', () => {
  assert.equal(parseRefVerdict('not json at all').verdict, REF_VERDICTS.PASS);
  assert.equal(parseRefVerdict('').verdict, REF_VERDICTS.PASS);
  assert.equal(parseRefVerdict('{"verdict":"NONSENSE"}').verdict, REF_VERDICTS.PASS);
});

test('U243: parseRefVerdict tolerates prose around the JSON', () => {
  const v = parseRefVerdict('Here is my call: {"verdict":"REGENERATE","failure_class":"FABRICATION"} done.');
  assert.equal(v.verdict, REF_VERDICTS.REGENERATE);
  assert.equal(v.failure_class, 'FABRICATION');
});

// ── regen prompts ───────────────────────────────────────────────────────────
test('U243: buildRegenSystem names the failure and forbids invention', () => {
  const sys = buildRegenSystem('FABRICATION');
  assert.match(sys, /canon does not support/i);
  assert.match(sys, /invent NOTHING/i);
  assert.match(sys, /ONE sentence/i);
});

test('U243: buildRegenUser hands over the grounded content + canon', () => {
  const u = buildRegenUser({ input: 'how long here?', mechanics: '[dialogue ask | deflected]', base: "Couldn't say.", canon: { npcsPresent: [] } });
  assert.match(u, /how long here\?/);
  assert.match(u, /Couldn't say\./);
  assert.match(u, /CANON/);
});

// ── judge wiring (stubbed fetch) ──────────────────────────────────────────────
test('U243: judge calls chatCompletion and returns the parsed verdict', async () => {
  const { judge } = buildRefAdapter({ world: null, fetchImpl: anthropicReply('{"verdict":"REGENERATE","failure_class":"ATMOSPHERE_DODGE","answers_the_question":false,"grounded":true,"honest_on_unknown":false,"in_voice":true}') });
  const v = await judge({ input: 'how long have you been here?', mechanics: '[dialogue ask | deflected]', candidate: 'It keeps its own tally of years.', canon: {} });
  assert.equal(v.verdict, REF_VERDICTS.REGENERATE);
  assert.equal(v.failure_class, 'ATMOSPHERE_DODGE');
});

test('U243: judge on a PASS reply returns PASS', async () => {
  const { judge } = buildRefAdapter({ world: null, fetchImpl: anthropicReply('{"verdict":"PASS"}') });
  const v = await judge({ input: 'hi', mechanics: '[dialogue ask | shared]', candidate: 'She nods.', canon: {} });
  assert.equal(v.verdict, REF_VERDICTS.PASS);
});

// ── regenerate wiring + the validation safety gate ───────────────────────────
test('U243: a clean regen line survives the Tier-1 validator and is returned', async () => {
  const clean = "Couldn't tell you, friend — you'd have to ask someone older.";
  const { regenerate } = buildRefAdapter({ world: null, fetchImpl: anthropicReply(clean) });
  const out = await regenerate({ input: 'how long here?', mechanics: '[dialogue ask | deflected]', base: "Couldn't say.", canon: {}, failureClass: 'ATMOSPHERE_DODGE' });
  assert.equal(out, clean);
});

test('U243: a regen with brackets is REJECTED by the validator → null (→ base)', async () => {
  const { regenerate } = buildRefAdapter({ world: null, fetchImpl: anthropicReply('He nods. [dialogue system note]') });
  const out = await regenerate({ input: 'how long here?', mechanics: '[dialogue ask | deflected]', base: "Couldn't say.", canon: {}, failureClass: 'ATMOSPHERE_DODGE' });
  assert.equal(out, null);
});

test('U243: a multi-sentence regen is REJECTED → null', async () => {
  const { regenerate } = buildRefAdapter({ world: null, fetchImpl: anthropicReply('He nods. He smiles. He leaves.') });
  const out = await regenerate({ input: 'x', mechanics: '[dialogue ask | deflected]', base: 'y', canon: {}, failureClass: 'NONE' });
  assert.equal(out, null);
});

test('U243: an empty regen reply → null', async () => {
  const { regenerate } = buildRefAdapter({ world: null, fetchImpl: anthropicReply('   ') });
  const out = await regenerate({ input: 'x', mechanics: '[dialogue ask | deflected]', base: 'y', canon: {}, failureClass: 'NONE' });
  assert.equal(out, null);
});

test('U243: regenerate takes only the first line and strips surrounding quotes', async () => {
  const { regenerate } = buildRefAdapter({ world: null, fetchImpl: anthropicReply('"Couldn\'t say, honestly."\nMira shrugs.') });
  const out = await regenerate({ input: 'x', mechanics: '[dialogue ask | deflected]', base: 'y', canon: {}, failureClass: 'NONE' });
  assert.equal(out, "Couldn't say, honestly.");
});
