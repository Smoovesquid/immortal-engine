import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../server.js';

test('with no OPENAI_API_KEY, /api/ai returns ok:false and /api/ai-status says offline', async () => {
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;

  const status = await fetch(`http://127.0.0.1:${port}/api/ai-status`).then(r => r.json());
  assert.equal(status.ok, true);
  assert.equal(status.online, false);

  const resp = await fetch(`http://127.0.0.1:${port}/api/ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'POLISH', seed: 1, composerLine: 'A door creaks in the dark.', worldSnapshot: { nouns: [], tags: [], motifs: [] } })
  }).then(r => r.json());

  assert.equal(resp.ok, false);

  server.close();
  if (prev) process.env.OPENAI_API_KEY = prev;
});
