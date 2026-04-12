import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryLocal, _resetForTest } from '../server/localLlmProvider.js';

describe('O02 — local LLM timeout', () => {
  it('returns timeout when request exceeds timeout', async () => {
    _resetForTest();
    // Mock fetch that respects AbortSignal like real fetch does
    const result = await queryLocal({
      prompt: 'test',
      timeout: 1, // 1ms timeout
      fetchImpl: (_url, opts) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ response: '{}' }) }), 5000);
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new DOMException('The operation was aborted', 'AbortError');
            reject(err);
          });
        }
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'timeout');
  });

  it('succeeds when response arrives within timeout', async () => {
    _resetForTest();
    const result = await queryLocal({
      prompt: 'test',
      timeout: 5000,
      fetchImpl: () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: '{"answer": 42}' })
      })
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.result, { answer: 42 });
  });

  it('returns parse_error when response is not valid JSON', async () => {
    _resetForTest();
    const result = await queryLocal({
      prompt: 'test',
      timeout: 5000,
      fetchImpl: () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: 'not json at all' })
      })
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'parse_error');
  });

  it('returns unavailable when HTTP response is not ok', async () => {
    _resetForTest();
    const result = await queryLocal({
      prompt: 'test',
      timeout: 5000,
      fetchImpl: () => Promise.resolve({ ok: false, status: 500 })
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unavailable');
  });

  it('appends schema hint to prompt when schema provided', async () => {
    _resetForTest();
    let capturedBody;
    const result = await queryLocal({
      prompt: 'Decide action',
      schema: { action: 'string', confidence: 'number' },
      timeout: 5000,
      fetchImpl: (_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: '{"action":"flee","confidence":0.8}' })
        });
      }
    });
    assert.equal(result.ok, true);
    assert.ok(capturedBody.prompt.includes('schema'));
    assert.equal(capturedBody.format, 'json');
    assert.equal(capturedBody.stream, false);
  });
});
