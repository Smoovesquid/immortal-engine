import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('canonical event allowlist freeze', () => {
  const file = path.resolve('engine/csl/canonLog.js');
  const src = fs.readFileSync(file, 'utf8');

  const match = src.match(/ALLOWED_CANON_EVENT_TYPES\s*=\s*\[([^\]]*)\]/);
  assert.ok(match, 'ALLOWED_CANON_EVENT_TYPES not found');

  const types = match[1]
    .split(',')
    .map(s => s.replace(/['"`\s]/g, ''))
    .filter(Boolean);

  const frozen = ['CANON_CREATE'];

  assert.deepEqual(types, frozen, 'Canonical event allowlist changed');
});
