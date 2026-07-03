// U382 — INT-2R: POST /api/intent-packet, the browser-safe HTTP door onto the
// server-only LLM-intent seat (engine/intent/llmIntent.js). This is the route
// public/v1.js's doSubmitMove calls before every single-text playerMove turn
// (via tryLlmIntentPacket) — it must:
//   (1) return a grounded, source:'llm' packet on a healthy provider reply;
//   (2) NEVER 500 — any provider failure degrades to { ok:true, packet:null };
//   (3) respect INTENT_LLM=off (no provider consulted, packet:null);
//   (4) never leak an invented id (grounding runs server-side before return).
// No real network — fetch is spied/mocked exactly like U377/U381.

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../server.js';
import { _resetForTest as resetOllamaAvailability } from '../server/localLlmProvider.js';

const BUNDLE = {
  entities: [{ id: 'goblin_1', name: 'goblin', ref: null }],
  abilities: ['Worn Blade'],
  spells: [],
  items: ['torch']
};

describe('U382 — POST /api/intent-packet', () => {
  let app, server, baseUrl;
  let realFetch;

  before(async () => {
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
    realFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = realFetch;
    if (server) server.close();
  });

  beforeEach(() => {
    resetOllamaAvailability();
  });

  it('a healthy Ollama reply returns a grounded, source:"llm" packet', async () => {
    const prevFlag = process.env.INTENT_LLM;
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.INTENT_LLM = 'ollama'; // deterministic: no Anthropic fallback muddying this assertion
    // The route's availability precondition is `hasLlmKey() || hasLocalLlmAvailable()`
    // — hasLocalLlmAvailable() only flips true after a real checkHealth() call,
    // which this test never runs. A present key satisfies the precondition
    // (matches U377/U381's own pattern); INTENT_LLM=ollama still forces the
    // actual provider consulted below to be Ollama, not this key.
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434')) {
        return { ok: true, json: async () => ({ response: JSON.stringify({ verb: 'attack', target: 'goblin' }) }) };
      }
      return realFetch(url, opts);
    };
    try {
      const res = await fetch(`${baseUrl}/api/intent-packet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'I stab the goblin', bundle: BUNDLE })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.ok);
      assert.ok(data.packet, 'a healthy grounded proposal must return a non-null packet');
      assert.equal(data.packet.source, 'llm');
      assert.equal(data.packet.verb, 'attack');
      assert.equal(data.packet.target, 'goblin');
    } finally {
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('an invented target id is dropped by server-side grounding before the client ever sees it', async () => {
    const prevFlag = process.env.INTENT_LLM;
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.INTENT_LLM = 'ollama';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434')) {
        return { ok: true, json: async () => ({ response: JSON.stringify({ verb: 'attack', target: 'dragon_of_doom' }) }) };
      }
      return realFetch(url, opts);
    };
    try {
      const res = await fetch(`${baseUrl}/api/intent-packet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'I stab the dragon', bundle: BUNDLE })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.ok);
      assert.ok(data.packet, 'the verb survives even though the target does not');
      assert.equal(data.packet.target, null, 'an invented target must never reach the client');
    } finally {
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('a provider HTTP failure never 500s — degrades to { ok:true, packet:null }', async () => {
    const prevFlag = process.env.INTENT_LLM;
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.INTENT_LLM = 'ollama';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434')) return { ok: false, status: 500, text: async () => 'ollama down' };
      return realFetch(url, opts);
    };
    try {
      const res = await fetch(`${baseUrl}/api/intent-packet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'I stab the goblin', bundle: BUNDLE })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { ok: true, packet: null });
    } finally {
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('a network-level throw never 500s — degrades to { ok:true, packet:null }', async () => {
    const prevFlag = process.env.INTENT_LLM;
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.INTENT_LLM = 'ollama';
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    // Scoped to the provider URL only — an unconditional throw here would also
    // break this test's OWN request to baseUrl (same globalThis.fetch).
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434')) throw new Error('ECONNREFUSED');
      return realFetch(url, opts);
    };
    try {
      const res = await fetch(`${baseUrl}/api/intent-packet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'I stab the goblin', bundle: BUNDLE })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { ok: true, packet: null });
    } finally {
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('INTENT_LLM=off short-circuits before any provider call — zero outbound calls', async () => {
    const prevFlag = process.env.INTENT_LLM;
    process.env.INTENT_LLM = 'off';
    let called = false;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434') || u.includes('api.anthropic.com')) {
        called = true;
        throw new Error('U382 spy: outbound provider call should not have happened with INTENT_LLM=off');
      }
      return realFetch(url, opts);
    };
    try {
      const res = await fetch(`${baseUrl}/api/intent-packet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'I stab the goblin', bundle: BUNDLE })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { ok: true, packet: null });
      assert.equal(called, false);
    } finally {
      if (prevFlag === undefined) delete process.env.INTENT_LLM; else process.env.INTENT_LLM = prevFlag;
    }
  });

  it('empty text short-circuits without a provider call', async () => {
    let called = false;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes(':11434') || u.includes('api.anthropic.com')) { called = true; }
      return realFetch(url, opts);
    };
    const res = await fetch(`${baseUrl}/api/intent-packet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '', bundle: BUNDLE })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, { ok: true, packet: null });
    assert.equal(called, false);
  });

  it('malformed body (no bundle, no text) never 500s', async () => {
    const res = await fetch(`${baseUrl}/api/intent-packet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, { ok: true, packet: null });
  });
});
