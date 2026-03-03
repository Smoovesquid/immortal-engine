import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('U34: UI v1 boot defaults to invoke (no auto-resume slot1)', () => {
  const p = path.join(process.cwd(), 'public', 'v1.js');
  const src = fs.readFileSync(p, 'utf8');

  assert.ok(!src.includes("if (hasSlot(localStorage, 'slot1'))"), 'boot() must not auto-resume slot1');
  assert.ok(src.includes("ui.screen = 'invoke'"), 'boot() must set invoke screen');
});
