// U288 — a D&D-style lockpick mechanic for locked doors and windows. Windows LATCH by default (a
// minority); doors aren't auto-locked (every building is an ordinary dwelling — auto-locking them
// would gate routine entry) but CAN be locked deliberately (a 'lock-close' event). A locked door
// blocks entering; a latched window blocks climbing IN. You PICK it (d20 + AGILITY + Thieves'-Tools
// proficiency vs the lock DC) or FORCE it (d20 + MIGHT vs a higher DC, loud). Lock state is derived
// + event-sourced (no schema bump), worldHash-stable. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { enterStructureInterior } from '../engine/structures/interiors.js';
import { lockState, lockOpenEventData, lockCloseEventData } from '../engine/structures/locks.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootOutside = (seed = 'corvid') => playerMove(beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world, PACKS, 'I step outside').world;
const withEvent = (w, data) => ({ ...w, timeline: [...(w.timeline || []), { id: `e${(w.timeline || []).length}`, t: (w.timeline || []).length, kind: 'resolution', data }] });

test('U288: windows latch by default (some); a door is not auto-locked but lock events toggle it', () => {
  const w = { meta: { seed: 'lk' }, timeline: [] };
  let latched = 0;
  for (let i = 0; i < 40; i++) if (lockState(w, 'window', `b${i}:r`).locked) latched++;
  assert.ok(latched > 0 && latched < 40, `some but not all windows latched, got ${latched}/40`);
  assert.equal(lockState(w, 'door', 'd1').locked, false, 'doors are not auto-locked');
  const closed = withEvent(w, lockCloseEventData('door', 'd1'));
  assert.equal(lockState(closed, 'door', 'd1').locked, true, 'a lock-close event locks a door');
  const opened = withEvent(closed, lockOpenEventData('door', 'd1', 'picked'));
  assert.equal(lockState(opened, 'door', 'd1').locked, false, 'a later lock-open opens it (latest wins)');
});

test('U288: a locked door blocks entry; the pick is a real d20 check; an opened door lets you in', () => {
  let w = bootOutside('corvid');
  const sk = enterStructureInterior(w, '').scene?.interior?.structureKey;
  assert.ok(sk, 'precondition: a building to lock');
  w = withEvent(w, lockCloseEventData('door', sk)); // a wary householder bolted the door
  assert.match(playerMove(w, PACKS, 'enter the building').output.mechanics || '', /\[lock:door\|locked/, 'a locked door blocks entry');
  // picking it runs a real d20 + AGILITY vs DC check (success or failure both record the math)
  const picked = playerMove(w, PACKS, 'pick the lock');
  assert.match(picked.output.mechanics || '', /\[lock:door\|(picked|fail)/, picked.output.mechanics);
  assert.match(picked.output.mechanics || '', /AGI:.* vs DC\d+/, 'a real AGILITY vs DC check is recorded');
  // however it gets opened (here, directly), an unlocked door lets you walk in
  const opened = withEvent(w, lockOpenEventData('door', sk, 'picked'));
  assert.match(playerMove(opened, PACKS, 'enter the building').output.narration, /enter the structure/i, 'an opened door lets you enter');
});

test('U288: a latched window blocks climbing IN until it is opened', () => {
  let w = bootOutside('corvid');
  const probe = enterStructureInterior(w, '');
  const wk = `${probe.scene.interior.structureKey}:${probe.scene.interior.roomId}`;
  w = withEvent(w, lockCloseEventData('window', wk)); // latched fast
  assert.match(playerMove(w, PACKS, 'climb in the window').output.mechanics || '', /\[lock:window\|locked/, 'a latched window blocks climbing in');
});

test('U288: pick / force verbs route to the lock mechanic on a LOCKED door + window', () => {
  let w = bootOutside('corvid');
  const probe = enterStructureInterior(w, '');
  const sk = probe.scene.interior.structureKey;
  const wk = `${sk}:${probe.scene.interior.roomId}`;
  w = withEvent(withEvent(w, lockCloseEventData('door', sk)), lockCloseEventData('window', wk));
  assert.match(playerMove(w, PACKS, 'pick the window').output.mechanics || '', /\[lock:window/, 'pick a locked window → lock mechanic');
  assert.match(playerMove(w, PACKS, 'force the door').output.mechanics || '', /\[lock:door/, 'force a locked door → lock mechanic');
});

test('U288: "smash the window" is still smashing the glass, NOT a lock-force', () => {
  const inside = beginAdventure(newWorld({ seed: 'corvid', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  assert.doesNotMatch(playerMove(inside, PACKS, 'smash the window').output.mechanics || '', /\[lock:/, 'smashing glass is not a lock action');
});
