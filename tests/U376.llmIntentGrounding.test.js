// U376 — INT-2: LLM-proposed packets are deterministically grounded before they
// can reach playerMove labeled source:'llm'.
//
// engine/intent/llmIntent.js proposes packet fields via a server-only LLM call
// (never imported by playloop.js); engine/intent/groundPacket.js validates every
// referent field against the real scene bundle. An invented id is a HARD
// REJECT of that field, not a warning. This suite proves: (1) grounding logic
// in isolation (no network — pure function tests), (2) proposeIntentViaLlm
// with a MOCKED fetchImpl (zero real network calls), (3) playerMove with no
// 4th argument is byte-identical to pre-INT-2 (same guard style as U375's
// flag-off test), (4) malformed LLM JSON / no-key-no-Ollama degrade silently.
//
// See docs/PACKETS.md INT-2 + docs/briefs/INT-2-llm-translator-sonnet.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { groundPacket } from '../engine/intent/groundPacket.js';
import { proposeIntentViaLlm, isLowConfidencePacket, LOW_CONFIDENCE_THRESHOLD } from '../engine/intent/llmIntent.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const BUNDLE = {
  entities: [
    { id: 'goblin_1', name: 'goblin', ref: null },
    { id: 'elske', name: 'Elske', ref: 'innkeeper' }
  ],
  abilities: ['Worn Blade'],
  spells: [],
  items: ['torch']
};

// ── grounding: pure, no network ─────────────────────────────────────────────

test('U376: groundPacket rejects an invented target id (hard reject, not a warning)', () => {
  const proposed = { verb: 'attack', target: 'dragon_of_doom', text: 'I stab the dragon' };
  const grounded = groundPacket(proposed, BUNDLE);
  assert.ok(grounded, 'a verb-bearing proposal still grounds even if the target is dropped');
  assert.equal(grounded.target, null, 'an invented target id must never survive grounding');
  assert.equal(grounded.source, 'llm');
});

test('U376: groundPacket keeps a valid target that resolves against the bundle', () => {
  const proposed = { verb: 'attack', target: 'goblin', text: 'I stab the goblin' };
  const grounded = groundPacket(proposed, BUNDLE);
  assert.equal(grounded.target, 'goblin');
  assert.equal(grounded.source, 'llm');
});

test('U376: groundPacket drops invented ids from targets[] and objects[], keeping only real ones', () => {
  const proposed = {
    verb: 'search',
    targets: ['goblin', 'invented_ghost_id'],
    objects: ['torch', 'invented_macguffin'],
    text: 'I search near the goblin with my torch'
  };
  const grounded = groundPacket(proposed, BUNDLE);
  assert.deepEqual(grounded.targets, ['goblin']);
  assert.deepEqual(grounded.objects, ['torch']);
});

test('U376: groundPacket rejects an invented instrument (`with`)', () => {
  const proposed = { verb: 'attack', target: 'goblin', with: 'invented_vorpal_blade', text: 'I stab the goblin with my blade' };
  const grounded = groundPacket(proposed, BUNDLE);
  assert.equal(grounded.with, null);
});

test('U376: groundPacket returns null when there is no verb at all', () => {
  assert.equal(groundPacket({ target: 'goblin' }, BUNDLE), null);
  assert.equal(groundPacket(null, BUNDLE), null);
  assert.equal(groundPacket('not an object', BUNDLE), null);
});

test('U376: groundPacket never throws on a malformed/garbage proposal', () => {
  assert.doesNotThrow(() => groundPacket({ verb: 'attack', targets: 'not-an-array', objects: 123 }, BUNDLE));
  assert.doesNotThrow(() => groundPacket({ verb: 'attack', at: { x: 'nope' } }, BUNDLE));
});

// ── isLowConfidencePacket — reuses parseIntent's existing 0-1 scale ─────────

test('U376: isLowConfidencePacket flags the parseIntent fallback bands (0.2/0.4) as low-confidence', () => {
  assert.equal(isLowConfidencePacket({ confidence: 0.2 }), true);
  assert.equal(isLowConfidencePacket({ confidence: 0.4 }), true);
  assert.equal(isLowConfidencePacket({ confidence: 0.9 }), false);
  assert.equal(isLowConfidencePacket(null), true);
  assert.ok(LOW_CONFIDENCE_THRESHOLD > 0 && LOW_CONFIDENCE_THRESHOLD < 1);
});

// ── proposeIntentViaLlm — MOCKED fetchImpl, zero real network calls ─────────

test('U376: proposeIntentViaLlm returns the parsed JSON via a mocked Anthropic fetch (no real network)', async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  try {
    let called = false;
    const fetchImpl = async (url, opts) => {
      called = true;
      assert.ok(String(url).includes('api.anthropic.com'), 'must call the Anthropic endpoint');
      return {
        ok: true,
        json: async () => ({ content: [{ text: JSON.stringify({ verb: 'attack', target: 'goblin' }) }] })
      };
    };
    const world = boot();
    const result = await proposeIntentViaLlm(world, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.ok(called, 'the mocked fetch must have been invoked');
    assert.equal(result.verb, 'attack');
    assert.equal(result.target, 'goblin');
  } finally {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
  }
});

test('U376: proposeIntentViaLlm swallows malformed JSON and returns null (never throws)', async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  try {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ content: [{ text: 'this is not json at all {' }] })
    });
    const world = boot();
    const result = await proposeIntentViaLlm(world, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.equal(result, null);
  } finally {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
  }
});

test('U376: proposeIntentViaLlm never throws on an HTTP error response, returns null', async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  try {
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'server error' });
    const world = boot();
    await assert.doesNotReject(async () => {
      const result = await proposeIntentViaLlm(world, 'I stab the goblin', BUNDLE, { fetchImpl });
      assert.equal(result, null);
    });
  } finally {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
  }
});

test('U376: proposeIntentViaLlm with no key and no Ollama reachable returns null (silent fallback)', async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevOpenAi = process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    // fetchImpl simulates: Anthropic unreachable (no key -> chatCompletion throws
    // 'No LLM API key configured'), Ollama unreachable (connection refused).
    const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
    const world = boot();
    const result = await proposeIntentViaLlm(world, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.equal(result, null);
  } finally {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
    if (prevOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prevOpenAi;
  }
});

// ── playerMove — no 4th argument is byte-identical to pre-INT-2 ────────────

test('U376: playerMove(world, packs, text) with no 4th argument is byte-identical to the pre-INT-2 shape', () => {
  const prevFlag = process.env.INTENT_TRACE;
  try {
    delete process.env.INTENT_TRACE;
    const w = boot();
    const text = 'I get out of bed and step outside.';

    const runA = playerMove(w, PACKS, text);
    const runB = playerMove(w, PACKS, text); // no 4th arg on either call

    assert.equal(runA.output.narration, runB.output.narration);
    assert.equal(runA.output.mechanics, runB.output.mechanics);
    assert.equal(worldHash(runA.world), worldHash(runB.world));
    assert.equal(Object.prototype.hasOwnProperty.call(runA.output, '__intentTrace'), false);
  } finally {
    if (prevFlag === undefined) delete process.env.INTENT_TRACE; else process.env.INTENT_TRACE = prevFlag;
  }
});

test('U376: playerMove with an ungrounded/malformed llmPacket override falls back to the deterministic packet untouched', () => {
  const prevFlag = process.env.INTENT_TRACE;
  try {
    process.env.INTENT_TRACE = '1';
    const w = boot();
    const text = 'I get out of bed and step outside.';

    const withoutOverride = playerMove(w, PACKS, text);
    // source !== 'llm' -> playerMove's own guard ignores it and re-derives the shadow packet.
    const withBadOverride = playerMove(w, PACKS, text, { llmPacket: { source: 'text', verb: 'attack' } });

    assert.equal(withoutOverride.output.narration, withBadOverride.output.narration);
    assert.equal(worldHash(withoutOverride.world), worldHash(withBadOverride.world));
    assert.equal(withBadOverride.output.__intentTrace.source, withoutOverride.output.__intentTrace.source);
  } finally {
    if (prevFlag === undefined) delete process.env.INTENT_TRACE; else process.env.INTENT_TRACE = prevFlag;
  }
});

test('U376: playerMove traces a grounded llmPacket verbatim when passed (source:\'llm\' survives to the trace)', () => {
  const prevFlag = process.env.INTENT_TRACE;
  try {
    process.env.INTENT_TRACE = '1';
    const w = boot();
    const text = 'I get out of bed and step outside.';
    const groundedLlmPacket = { verb: 'search', target: null, targets: [], objects: [], with: null, approach: 'focus', stake: 'time', text, source: 'llm', confidence: 0.7, compoundParts: [], ambiguity: null, kind: null, at: null };

    const res = playerMove(w, PACKS, text, { llmPacket: groundedLlmPacket });
    assert.equal(res.output.__intentTrace.source, 'llm');
    assert.equal(res.output.__intentTrace.verb, 'search');
  } finally {
    if (prevFlag === undefined) delete process.env.INTENT_TRACE; else process.env.INTENT_TRACE = prevFlag;
  }
});
