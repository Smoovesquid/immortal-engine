// U288 — locks follow the clock. Seen from OUTSIDE, a door or window is LOCKED at night (10pm–6am)
// and open by day; from INSIDE the building it is ALWAYS open (a lock keeps people out, not in). A
// deliberate lock event still wins at any hour. At night, getting IN needs a PICK (d20 + AGILITY +
// Thieves'-Tools proficiency vs the DC) or a FORCE (d20 + MIGHT vs a higher DC). Lock state is
// derived + event-sourced (no schema bump), worldHash-stable. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { enterStructureInterior } from '../engine/structures/interiors.js';
import { lockState, lockOpenEventData, lockCloseEventData } from '../engine/structures/locks.js';
import { isNight, hourOfDay } from '../engine/dayNight.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const outside = (seed = 'corvid') => playerMove(beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world, PACKS, 'I step outside').world;
const atNight = (w) => ({ ...w, time: { ...(w.time || {}), hours: 15 } }); // elapsed 15h → 10pm
const buildingKey = (w) => enterStructureInterior(w, '').scene?.interior?.structureKey;
const withEvent = (w, data) => ({ ...w, timeline: [...(w.timeline || []), { id: `e${(w.timeline || []).length}`, t: (w.timeline || []).length, kind: 'resolution', data }] });

test('U288: the world opens by day and reads as night at 10pm', () => {
  const w = outside('corvid');
  assert.equal(isNight(w), false, 'the adventure opens in daylight');
  assert.equal(isNight(atNight(w)), true, '15 elapsed hours → 10pm → night');
  assert.equal(hourOfDay(atNight(w)), 22);
});

test('U288: from OUTSIDE a door/window is open by day, locked at night', () => {
  const w = outside('corvid');
  const sk = buildingKey(w);
  assert.equal(lockState(w, 'door', sk).locked, false, 'day → door open');
  assert.equal(lockState(atNight(w), 'door', sk).locked, true, 'night → door locked');
  assert.equal(lockState(atNight(w), 'window', `${sk}:r`).locked, true, 'night → window latched too');
});

test('U288: from INSIDE the building a lock is ALWAYS open (even at night)', () => {
  const w = atNight(outside('corvid'));
  const sk = buildingKey(w);
  const inside = { ...w, scene: { ...w.scene, interior: { structureKey: sk, roomId: 'r' } } };
  assert.equal(lockState(inside, 'door', sk).locked, false, 'inside → door open at night');
  assert.equal(lockState(inside, 'window', `${sk}:r`).locked, false, 'inside → window open at night');
});

test('U288: a lock-close event locks it even by day; a later lock-open opens it (latest wins)', () => {
  const w = outside('corvid');
  const sk = buildingKey(w);
  assert.equal(lockState(withEvent(w, lockCloseEventData('door', sk)), 'door', sk).locked, true, 'a bolted door is locked by day');
  const opened = withEvent(withEvent(w, lockCloseEventData('door', sk)), lockOpenEventData('door', sk, 'picked'));
  assert.equal(lockState(opened, 'door', sk).locked, false, 'picked → open');
});

test('U288: at night a locked door blocks entry; the pick is a real check; an opened door lets you in', () => {
  const w = atNight(outside('corvid'));
  const sk = buildingKey(w);
  assert.match(playerMove(w, PACKS, 'enter the building').output.mechanics || '', /\[lock:door\|locked/, 'night → a locked door blocks entry');
  const picked = playerMove(w, PACKS, 'pick the lock');
  assert.match(picked.output.mechanics || '', /\[lock:door\|(picked|fail)/, picked.output.mechanics);
  assert.match(picked.output.mechanics || '', /AGI:.* vs DC\d+/, 'a real d20 + AGILITY vs DC check is recorded');
  const opened = withEvent(w, lockOpenEventData('door', sk, 'picked'));
  assert.match(playerMove(opened, PACKS, 'enter the building').output.narration, /enter the structure/i, 'an opened door lets you in');
});

test('U288: at night a latched window blocks climbing IN', () => {
  assert.match(playerMove(atNight(outside('corvid')), PACKS, 'climb in the window').output.mechanics || '', /\[lock:window\|locked/, 'night → latched window blocks climbing in');
});

test('U288: pick / force verbs route to the lock mechanic on a night-locked door + window', () => {
  const w = atNight(outside('corvid'));
  assert.match(playerMove(w, PACKS, 'pick the window').output.mechanics || '', /\[lock:window/, 'pick the window → lock mechanic');
  assert.match(playerMove(w, PACKS, 'force the door').output.mechanics || '', /\[lock:door/, 'force the door → lock mechanic');
});

test('U288: "smash the window" is still smashing the glass, NOT a lock-force', () => {
  const inside = beginAdventure(newWorld({ seed: 'corvid', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  assert.doesNotMatch(playerMove(inside, PACKS, 'smash the window').output.mechanics || '', /\[lock:/, 'smashing glass is not a lock action');
});
