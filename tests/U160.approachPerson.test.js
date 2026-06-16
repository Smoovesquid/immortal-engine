import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16): "walk over to the stranger and ask…" / "go to the elder"
// bounced to "you know of no such place" — a person intent treated as travel. An
// approach to a present NPC (by role or generic descriptor) now opens dialogue;
// real place names still travel.

function world(seed = 'stonewatch-hollow') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U160: "walk over to the <role>" opens dialogue with a present NPC', () => {
  const { w, byId } = world();
  for (const t of ['I walk over to the elder', 'I go over to the scholar', 'I walk over to the stranger']) {
    const { world: w2 } = playerMove(w, byId, t);
    assert.ok(w2.scene?.dialogue?.npcId, `dialogue opened: ${t}`);
  }
});

test('U160: a real place name still travels, not hijacked into dialogue', () => {
  const { w, byId } = world();
  const { world: w2 } = playerMove(w, byId, 'I walk over to the well');
  assert.ok(!w2.scene?.dialogue?.npcId, 'no dialogue — "the well" is a place/structure');
});
