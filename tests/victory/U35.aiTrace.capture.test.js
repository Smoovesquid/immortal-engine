import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { handleAiRequest } from '../../server/ai.js';

test('U35: Full Model Trace Capture — writes trace entry for accepted ADVISE', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-trace-'));
  const tracePath = path.join(dir, 'ai-trace.ndjson');
  process.env.AI_TRACE_PATH = tracePath;

  const client = {
    responses: {
      create: async (_req) => ({
        output_text: '{"suggestedIntent":"WAIT","askForRoll":null}',
        system_fingerprint: 'fp_test_1'
      })
    }
  };

  const resp = await handleAiRequest({
    client,
    body: {
      mode: 'ADVISE',
      seed: 123,
      composerLine: 'You stand in a cold hall.',
      worldSnapshot: { nouns: ['hall'], tags: ['cold'], motifs: ['iron'] },
      styleProfile: { voice: 'plain', verbosity: 0, fate: 0.2 }
    }
  });

  assert.equal(resp.ok, true);

  const lines = fs.readFileSync(tracePath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);

  const rec = JSON.parse(lines[0]);
  assert.equal(typeof rec.requestHash, 'string');
  assert.equal(rec.requestHash.length, 64);
  assert.equal(rec.model, process.env.OPENAI_MODEL || 'gpt-4.1-mini');
  assert.equal(rec.mode, 'ADVISE');
  assert.equal(rec.seed, 123);
  assert.equal(rec.system_fingerprint, 'fp_test_1');
  assert.equal(rec.validationResult, 'accepted');
  assert.equal(rec.rejectionReason, null);
  assert.equal(typeof rec.responseText, 'string');
  assert.equal(rec.parsedProposal.suggestedIntent, 'WAIT');
});
