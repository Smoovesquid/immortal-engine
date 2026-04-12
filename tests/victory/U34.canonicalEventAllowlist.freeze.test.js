import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('canonical event allowlist freeze', () => {
  const file = path.resolve('engine/csl/canonLog.js');
  const src = fs.readFileSync(file, 'utf8');

  const match = src.match(/ALLOWED_CANON_EVENT_TYPES\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(match, 'ALLOWED_CANON_EVENT_TYPES not found');

  const stripped = match[1].replace(/\/\/[^\n]*/g, '');
  const types = stripped
    .split(',')
    .map(s => s.replace(/['"`\s]/g, ''))
    .filter(Boolean);

  const frozen = ['CANON_CREATE', 'rumor.minted', 'rumor.propagated', 'rumor.verified', 'rumor.forgotten'];

  assert.deepEqual(types, frozen, 'Canonical event allowlist changed');
});
