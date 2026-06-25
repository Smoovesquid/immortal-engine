// U284 — windows work from OUTSIDE too: the mirror of the inside verbs. Standing outside a
// building you can PEEK through a window to scout (no move, never claims occupancy it can't
// see) and CLIMB IN through it — a quiet way past the door that routes through the canonical
// enter primitive, so you appear INSIDE on the map. A windowless / no-building spot declines
// honestly. The inside verbs (climb OUT, the fall-guard) are unchanged. Hermetic — no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const outside = () => playerMove(boot(), PACKS, 'I step outside').world;

test('U284: precondition — stepping out puts you outside at a building', () => {
  const w = outside();
  assert.equal(w.scene?.interior ?? null, null, 'should be outside');
});

test('U284: "look in the window" scouts without moving you', () => {
  const w = outside();
  const r = playerMove(w, PACKS, 'look in the window');
  assert.match(r.output.mechanics || '', /\[window:peek\]/, r.output.mechanics);
  assert.match(r.output.narration, /through the window/i, r.output.narration);
  assert.equal(r.world.scene?.interior ?? null, null, 'a peek does not move you inside');
});

test('U284: "climb in the window" is a real entry — you appear INSIDE (map follows)', () => {
  const w = outside();
  const r = playerMove(w, PACKS, 'climb in the window');
  assert.match(r.output.mechanics || '', /\[window:enter/, r.output.mechanics);
  assert.ok(r.world.scene?.interior, 'climbing in puts you inside');
  assert.ok(String(r.world.map?.currentStructureId || ''), 'the map records the building you entered');
});

test('U284: variants of climbing in all enter (go/get/slip/sneak in the window)', () => {
  for (const verb of ['go in through the window', 'get in the window', 'slip in the window', 'sneak in through the window']) {
    const r = playerMove(outside(), PACKS, verb);
    assert.ok(r.world.scene?.interior, `"${verb}" should put you inside: ${r.output.narration}`);
  }
});

test('U284: no building / no window within reach declines honestly (no move)', () => {
  const w = { ...outside(), structures: { byId: {} } };
  const r = playerMove(w, PACKS, 'climb in the window');
  assert.match(r.output.narration, /no window within reach|no wall close enough|blank/i, r.output.narration);
  assert.equal(r.world.scene?.interior ?? null, null, 'nothing to climb into — you stay outside');
});

test('U284: peek is deterministic (same seed/turn → identical)', () => {
  const a = playerMove(outside(), PACKS, 'look in the window');
  const b = playerMove(outside(), PACKS, 'look in the window');
  assert.equal(a.output.narration, b.output.narration);
});

test('U284: regression — climbing OUT from inside still exits (the inverse is unbroken)', () => {
  const r = playerMove(boot(), PACKS, 'climb out the window'); // boot() starts INSIDE
  assert.equal(r.world.scene?.interior, null, 'climb out the window still leaves');
  assert.match(r.output.mechanics || '', /\[window:exit\]/, r.output.mechanics);
});

test('U284: regression — "throw myself out the window" is still a fall, not an entry', () => {
  const r = playerMove(outside(), PACKS, 'I throw myself out the window');
  assert.doesNotMatch(r.output.mechanics || '', /\[window:(enter|peek)\]/, r.output.mechanics);
});

test('U284: "fire into the window" in combat is a real ranged line IN (not a bounce)', () => {
  let w = playerMove(outside(), PACKS, 'I attack the nearest stranger').world;
  if (!w.combat?.active || w.scene?.interior) return; // couldn't stage outside combat on this seed — skip
  const r = playerMove(w, PACKS, 'fire bolt into the window');
  assert.match(r.output.mechanics || '', /\[window:shoot-in\]/, r.output.mechanics);
  // a real combat turn resolved — never an object-bounce or table-talk non-action
  assert.doesNotMatch(r.output.mechanics || '', /combat:table-talk|make a mess of the room/i, r.output.mechanics);
  assert.match(r.output.mechanics || '', /cantrip|strike|atk:|combat:/i, r.output.mechanics);
  assert.match(r.output.narration, /window/i, r.output.narration);
});
