import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter } from '../engine/chargen/genesis.js';
import { readFile } from 'node:fs/promises';

async function loadGear(relPath) {
  const raw = await readFile(new URL(relPath, import.meta.url), 'utf8');
  return JSON.parse(raw);
}

test('fantasy archetype tags select fantasy gear only (no tech bleed)', async () => {
  const fantasyGear = await loadGear('../packs/fantasy/gear.json');
  const c = createCharacter({ seed: 'seed', packId: 'fantasy', fate: 0.5, packGear: fantasyGear });
  const tech = c.inventory.tech || [];
  assert.equal(tech.length, 0);
});

test('space-rift pack can generate tech', async () => {
  const spaceGear = await loadGear('../packs/space-rift/gear.json');
  const c = createCharacter({ seed: 'seed', packId: 'space-rift', fate: 0.5, packGear: spaceGear });
  assert.ok(Array.isArray(c.inventory.tech));
});
