// U282 — windows are a perceivable feature of above-ground building rooms (the down-payment
// for the windows feature; the look/climb/shoot-out verbs are a separate worker packet). The
// room survey — which "look around" AND "are there windows?" both route through — now mentions
// a window when you're inside an above-ground building, and never in a dungeon / underground
// room. Deterministic (seeded). Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U282: an above-ground building room has a window in look-around', () => {
  const w = boot();
  assert.equal(Boolean(w.scene?.interior?.structureKey), true, 'precondition: starts inside a building');
  assert.match(buildLocationSurvey(w), /window/i, 'a real room should have a window');
});

test('U282: a dungeon / underground interior has NO window', () => {
  const w = boot();
  // Inside a dungeon: a dungeon-keyed interior with no building structure behind it.
  const inDungeon = { ...w, scene: { ...w.scene, interior: { ...w.scene.interior, structureKey: 'dungeon:n1:0' } } };
  assert.doesNotMatch(buildLocationSurvey(inDungeon), /window/i, 'underground rooms have no window');
});

test('U282: windows are deterministic — same seed/turn → identical survey', () => {
  assert.equal(buildLocationSurvey(boot()), buildLocationSurvey(boot()));
});
