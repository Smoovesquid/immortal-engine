import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryLocal, checkHealth, _resetForTest } from '../server/localLlmProvider.js';

// Mock fetch that always rejects (simulates no Ollama)
function unreachableFetch() {
  return Promise.reject(new Error('ECONNREFUSED'));
}

describe('O01 — local LLM fallback when unreachable', () => {
  it('checkHealth returns false when endpoint unreachable', async () => {
    _resetForTest();
    const result = await checkHealth(unreachableFetch);
    assert.equal(result, false);
  });

  it('checkHealth returns false when endpoint returns non-ok', async () => {
    _resetForTest();
    const result = await checkHealth(() => Promise.resolve({ ok: false }));
    assert.equal(result, false);
  });

  it('checkHealth returns false when no models available', async () => {
    _resetForTest();
    const result = await checkHealth(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ models: [] })
    }));
    assert.equal(result, false);
  });

  it('checkHealth returns true when models available', async () => {
    _resetForTest();
    const result = await checkHealth(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        models: [{ name: 'llama3.1:8b', size: 4_000_000_000 }]
      })
    }));
    assert.equal(result, true);
  });

  it('queryLocal returns {ok: false, reason: unavailable} after failed health check', async () => {
    _resetForTest();
    await checkHealth(unreachableFetch);
    const result = await queryLocal({
      prompt: 'test',
      fetchImpl: unreachableFetch
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unavailable');
  });

  it('queryLocal returns {ok: false, reason: unavailable} when fetch throws', async () => {
    _resetForTest();
    // _available is null so it won't short-circuit, but fetch throws
    const result = await queryLocal({
      prompt: 'test',
      fetchImpl: () => { throw new Error('kaboom'); }
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unavailable');
  });

  it('queryLocal never throws', async () => {
    _resetForTest();
    const result = await queryLocal({
      prompt: 'test',
      fetchImpl: () => { throw new Error('kaboom'); }
    });
    assert.equal(result.ok, false);
  });

  it('isAvailable reflects health check result', async () => {
    const { isAvailable } = await import('../server/localLlmProvider.js');
    _resetForTest();
    assert.equal(isAvailable(), false); // null !== true → false
    await checkHealth(unreachableFetch);
    assert.equal(isAvailable(), false);
  });
});
