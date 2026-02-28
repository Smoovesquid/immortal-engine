import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { createCharacter } from '../engine/chargen/genesis.js';
import { readFile } from 'node:fs/promises';

async function loadGear(relPath) {
  const raw = await readFile(new URL(relPath, import.meta.url), 'utf8');
  return JSON.parse(raw);
}

test('save roundtrip preserves chargen inventory/stats', async () => {
  const fantasyGear = await loadGear('../packs/fantasy/gear.json');
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const pc = createCharacter({ seed: 'seed', packId: 'fantasy', fate: 0.2, packGear: fantasyGear });
  w = { ...w, party: [pc] };

  const s = exportWorld(w);
  const w2 = importWorld(s);
  assert.deepEqual(w2.party[0].stats, pc.stats);
  assert.deepEqual(w2.party[0].inventory, pc.inventory);
});
