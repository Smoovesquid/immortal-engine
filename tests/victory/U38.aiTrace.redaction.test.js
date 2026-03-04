import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { handleAiRequest } from '../../server/ai.js';

test('U38: AI Trace Redaction — trace file must not contain API keys', async () => {
  const tracePath = '.artifacts/ai-trace.ndjson';
  process.env.AI_TRACE_PATH = tracePath;

  // Put a fake key in env; the server must never write it to trace.
  process.env.OPENAI_API_KEY = 'sk-THIS_SHOULD_NEVER_APPEAR_IN_TRACE';

  // Stub OpenAI client that returns deterministic content.
  const client = {
    responses: {
      create: async () => ({
        output_text: '{"suggestedIntent":"WAIT","askForRoll":null}',
        system_fingerprint: 'fp_test_redact'
      })
    }
  };

  if (fs.existsSync(tracePath)) fs.unlinkSync(tracePath);

  const resp = await handleAiRequest({
    client,
    body: {
      mode: 'ADVISE',
      seed: 999,
      composerLine: 'You wait.',
      worldSnapshot: { nouns: ['hall'], tags: ['cold'], motifs: ['iron'] },
      styleProfile: { voice: 'plain', verbosity: 0, fate: 0.2 }
    }
  });

  assert.equal(resp.ok, true);
  assert.ok(fs.existsSync(tracePath), 'trace file missing');

  const raw = fs.readFileSync(tracePath, 'utf8');
  assert.ok(raw.length > 0, 'trace file empty');

  // Hard ban: no API key substrings in trace output.
  assert.equal(raw.includes('sk-THIS_SHOULD_NEVER_APPEAR_IN_TRACE'), false, 'API key leaked into trace');
  assert.equal(raw.includes('OPENAI_API_KEY'), false, 'env var name leaked into trace');

  // Soft sanity: trace contains expected structural fields.
  const firstLine = raw.trim().split('\n')[0] || '';
  const rec = JSON.parse(firstLine);
  assert.equal(rec.mode, 'ADVISE');
  assert.equal(rec.seed, 999);
});
