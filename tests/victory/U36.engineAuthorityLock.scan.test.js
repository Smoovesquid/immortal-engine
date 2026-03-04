import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function listJsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsFiles(p));
    else if (ent.isFile() && (p.endsWith('.js') || p.endsWith('.mjs'))) out.push(p);
  }
  return out;
}

test('U36: Engine Authority Lock — AI modules must not mutate engine state directly', () => {
  const roots = ['engine/ai', 'server'];
  const needles = [
    'appendCanonEvent(',
    'applyEvent(',
    '.canonLog.events.push(',
    'world.canonLog',
    'world.state =',
    'world.scene =',
    'world.ledger =',
    'world.meta ='
  ];

  const offenders = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const f of listJsFiles(root)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const n of needles) {
        if (src.includes(n)) offenders.push({ file: f, needle: n });
      }
    }
  }

  // server/ai.js is allowed to *read* world snapshots passed in, but must not import engine mutators.
  const filtered = offenders.filter(o => !o.file.endsWith('server/ai.js'));

  assert.deepEqual(filtered, [], `Found forbidden engine mutation references: ${JSON.stringify(filtered, null, 2)}`);
});
