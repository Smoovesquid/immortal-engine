import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter } from '../engine/chargen/genesis.js';
import { readFile } from 'node:fs/promises';

async function loadGear(relPath) {
  const raw = await readFile(new URL(relPath, import.meta.url), 'utf8');
  return JSON.parse(raw);
}

test('chargen determinism: same seed => same character core', async () => {
  const fantasyGear = await loadGear('../packs/fantasy/gear.json');
  const a = createCharacter({ seed: 'seed', packId: 'fantasy', fate: 0.5, packGear: fantasyGear, statMethod: '2d6+2', darkFate: true });
  const b = createCharacter({ seed: 'seed', packId: 'fantasy', fate: 0.5, packGear: fantasyGear, statMethod: '2d6+2', darkFate: true });
  assert.deepEqual(a.stats, b.stats);
  assert.deepEqual(a.inventory, b.inventory);
  assert.deepEqual(a.background, b.background);
  assert.deepEqual(a.signature, b.signature);
});

test('chargen determinism: different seed => differs', async () => {
  const fantasyGear = await loadGear('../packs/fantasy/gear.json');
  const a = createCharacter({ seed: 'seedA', packId: 'fantasy', fate: 0.5, packGear: fantasyGear });
  const b = createCharacter({ seed: 'seedB', packId: 'fantasy', fate: 0.5, packGear: fantasyGear });
  assert.notDeepEqual(a.stats, b.stats);
});
