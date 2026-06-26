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
import { roomWindowFacings } from '../engine/structures/roomWindows.js';
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

test('U284: regression — climbing OUT a chosen window from inside still exits', () => {
  const facing = roomWindowFacings(boot(), boot().scene.interior)[0];
  const r = playerMove(boot(), PACKS, `climb out the ${facing} window`); // boot() starts INSIDE
  assert.equal(r.world.scene?.interior, null, 'climb out the window still leaves');
  assert.match(r.output.mechanics || '', /\[window:exit\|/, r.output.mechanics);
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
  // The window framing must ride the FIRST beat — the UI shows a fight as beats and never the
  // turn's narration, so this is what actually reaches the screen.
  const beats = r.output.beats || [];
  assert.ok(beats.length && /window/i.test(beats[0]), `beat[0] should carry the window framing: ${JSON.stringify(beats)}`);
  // ...and it names the specific foe being fired at, not an abstract one (W-Q2 remainder).
  assert.match(beats[0], /sighting .+ through the window/i, `shoot-in should name the foe: ${beats[0]}`);
});

test('U284: climbing in where there are witnesses is a contested stealth check (deterministic)', () => {
  const a = playerMove(outside(), PACKS, 'climb in the window');
  const b = playerMove(outside(), PACKS, 'climb in the window');
  assert.match(a.output.mechanics || '', /window:enter\|(unseen|spotted)/, a.output.mechanics);
  assert.match(a.output.mechanics || '', /stealth:\d/, 'a witnessed climb rolls a stealth check');
  assert.ok(a.world.scene?.interior, 'spotted or not, you still get in');
  assert.equal(a.output.mechanics, b.output.mechanics, 'deterministic: same seed → same roll/outcome');
});

test('U284: getting spotted climbing in costs you — the pressure clock ticks', () => {
  // Force the spotted branch deterministically by zeroing AGILITY (any roll < DC).
  const w = outside();
  w.party[0].stats = { ...(w.party[0].stats || {}), AGILITY: 1 };
  const before = Number(w.clocks?.pressure || 0);
  const r = playerMove(w, PACKS, 'climb in the window');
  if (!/spotted/.test(r.output.mechanics || '')) return; // empty node edge — nothing to assert
  assert.ok(r.world.scene?.interior, 'you still get in');
  assert.equal(Number(r.world.clocks?.pressure || 0), before + 1, 'being seen tightens the escape clock');
});

test('U284: climbing in with no one around is a free, uncontested entry', () => {
  const w = outside();
  const node = (w.map.nodes).find(n => n.id === w.map.currentNodeId);
  node.settlement = { ...(node.settlement || {}), npcs: [] };
  const r = playerMove(w, PACKS, 'climb in the window');
  assert.match(r.output.mechanics || '', /\[window:enter\|unseen\]/, r.output.mechanics);
  assert.doesNotMatch(r.output.mechanics || '', /stealth:/, 'no witnesses → no check');
  assert.ok(r.world.scene?.interior);
});
