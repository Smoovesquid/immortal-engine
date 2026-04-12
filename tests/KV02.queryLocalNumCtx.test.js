import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { queryLocal, _resetForTest } from '../server/localLlmProvider.js';

describe('KV02 — queryLocal passes num_ctx option', () => {
  it('includes options.num_ctx in the request body', async () => {
    _resetForTest();
    let capturedBody = null;

    const mockFetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ response: '{"test": true}' })
      };
    };

    await queryLocal({
      prompt: 'test prompt',
      schema: null,
      timeout: 5000,
      fetchImpl: mockFetch
    });

    assert.ok(capturedBody, 'fetch was called');
    assert.ok(capturedBody.options, 'options object present');
    assert.equal(capturedBody.options.num_ctx, 4096, 'default num_ctx is 4096');
  });
});
