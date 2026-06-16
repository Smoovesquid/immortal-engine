import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (#2, MVP blocker): the starting Sellsword spawned with an EMPTY
// weapon/armor loadout and a signature item literally named "Thing" (gear.json
// existed but was never wired into beginAdventure) — which is why the DM kept
// inventing a weapon. beginAdventure now passes the bundled fantasy starter gear.

function startPc(seed) {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return w.party[0];
}

test('U154: a fantasy PC starts with a real weapon and armor', () => {
  for (const seed of ['glass-harbor', 'ashfen-reach', 'stonewatch-hollow']) {
    const pc = startPc(seed);
    assert.ok((pc.inventory.weapons || []).length > 0, `${seed}: has a weapon`);
    assert.ok((pc.inventory.armor || []).length > 0, `${seed}: has armor`);
  }
});

test('U154: the signature item is real, not the "Thing" placeholder', () => {
  for (const seed of ['glass-harbor', 'ashfen-reach']) {
    const pc = startPc(seed);
    assert.notEqual(String(pc.signature?.itemName || '').toLowerCase(), 'thing', `${seed}: signature not "Thing"`);
    assert.ok(String(pc.signature?.itemName || '').trim().length > 0);
  }
});

test('U154: the loadout is deterministic by seed (replay-stable)', () => {
  const a = startPc('glass-harbor');
  const b = startPc('glass-harbor');
  assert.deepEqual(
    (a.inventory.weapons || []).map(w => w.name),
    (b.inventory.weapons || []).map(w => w.name),
    'same seed → same weapons'
  );
});
