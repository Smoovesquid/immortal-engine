import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { buildAiHashTrace } from '../engine/ai/aiHashTrace.js';
import { callDM } from '../engine/llmAdapter.js';

function w0() {
  return newWorld({ seed: 'u91', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
}

test('U91: buildAiHashTrace — non-mutating call shows hash_changed false', () => {
  const w = w0();
  const t = buildAiHashTrace({ worldBefore: w, worldAfter: w, mode: 'DM', model: 'm', accepted: true });
  assert.equal(t.pre_hash, worldHash(w));
  assert.equal(t.post_hash, worldHash(w));
  assert.equal(t.hash_changed, false);
  assert.equal(t.accepted, true);
  assert.equal(t.mode, 'DM');
});

test('U91: buildAiHashTrace — a real state change shows hash_changed true', () => {
  const before = w0();
  const after = { ...before, timeline: [...before.timeline, { t: 999, kind: 'test', data: {} }] };
  const t = buildAiHashTrace({ worldBefore: before, worldAfter: after });
  assert.notEqual(t.pre_hash, t.post_hash);
  assert.equal(t.hash_changed, true);
});

test('U91: buildAiHashTrace — propose-only (no after) leaves post null, hash_changed null', () => {
  const w = w0();
  const t = buildAiHashTrace({ worldBefore: w, mode: 'DM', accepted: true, applied: ['ROLL', 'TRUST_DELTA'] });
  assert.equal(typeof t.pre_hash, 'string');
  assert.equal(t.post_hash, null);
  assert.equal(t.hash_changed, null);
  assert.deepEqual(t.applied, ['ROLL', 'TRUST_DELTA']);
});

test('U91: buildAiHashTrace — deterministic', () => {
  const w = w0();
  assert.deepEqual(
    buildAiHashTrace({ worldBefore: w, worldAfter: w, mode: 'DM', model: 'm', accepted: true }),
    buildAiHashTrace({ worldBefore: w, worldAfter: w, mode: 'DM', model: 'm', accepted: true })
  );
});

test('U91: callDM emits a trace with the pre-state hash on success', async () => {
  const w = w0();
  const traces = [];
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ content: [{ text: 'You step into the hall. [perception]' }] })
  });
  const res = await callDM({
    world: w, playerText: 'go in', apiKey: 'test-key',
    fetchImpl: fakeFetch, onTrace: r => traces.push(r)
  });
  assert.ok(res && typeof res.narration === 'string');
  assert.equal(traces.length, 1);
  assert.equal(traces[0].mode, 'DM');
  assert.equal(traces[0].accepted, true);
  assert.equal(traces[0].pre_hash, worldHash(w));
  assert.equal(traces[0].post_hash, null); // callDM proposes; apply site records after-hash
});

test('U91: callDM emits a rejected trace when the API keeps failing', async () => {
  const w = w0();
  const traces = [];
  const fakeFetch = async () => { throw new Error('network down'); };
  const res = await callDM({
    world: w, playerText: 'go in', apiKey: 'test-key',
    fetchImpl: fakeFetch, onTrace: r => traces.push(r)
  });
  assert.equal(res, null);
  assert.equal(traces.length, 1);
  assert.equal(traces[0].accepted, false);
  assert.equal(traces[0].reason, 'request_failed');
  assert.equal(traces[0].pre_hash, worldHash(w));
});
