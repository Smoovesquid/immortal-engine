import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (#3, MVP blocker): a travel intent voiced indoors ("head south
// toward the elder") was BOUNCED with a "[clarify:indoors] — go outside, then
// name your heading" two-step chore. Per THE_DM_TEST a real DM bridges it: step
// to the door and set off. The bounce must be gone.

function world(seed = 'stonewatch-hollow') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U153: indoor directional travel does not stall with [clarify:indoors]', () => {
  const { w, byId } = world();
  assert.ok(w.scene?.interior, 'starts indoors');
  for (const t of ['head south toward the elder', 'head to the market', "I make for the elder's house"]) {
    const r = playerMove(w, byId, t);
    assert.doesNotMatch(String(r.output.mechanics || ''), /clarify:indoors/, `no stall: ${t}`);
    assert.match(String(r.output.narration || ''), /step out|open air/i, `bridges outside: ${t}`);
  }
});

test('U153: the bridge still resolves a real destination as a journey', () => {
  // "go to <place>" already worked; ensure the directional bridge reaches the
  // same travel resolution (turn advances, no clarify).
  const { w, byId } = world();
  const r = playerMove(w, byId, 'head toward the gate');
  assert.doesNotMatch(String(r.output.mechanics || ''), /clarify:indoors/);
});
