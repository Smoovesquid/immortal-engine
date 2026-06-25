// U278 — "Look around" obeys LINE OF SIGHT (the Law of Earned Knowledge).
// The location survey reports only what you can SEE from where you stand:
//   • a LANDMARK down a road (tower/shrine/bridge/ruin) pokes above the treeline,
//     so it's in view — NAMED if you've been there (discovered), else read by its
//     SILHOUETTE ("you can see a bridge") with no name;
//   • a settlement or open country down a road is over the horizon / behind trees —
//     you see the ROAD leaving by direction, never the place, even if you know it
//     (its name lives on the MAP, not in your eyes).
// Hermetic: buildLocationSurvey is pure. No network, no API key.

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
// Outdoors at the current node (clear the interior so the survey takes the exterior path).
const outside = (w) => ({ ...w, scene: { ...w.scene, interior: null } });
const allIds = (w) => (w.map?.nodes || []).map(n => String(n.id));
const withDiscovered = (w, ids) => ({ ...w, map: { ...w.map, discovered: ids } });
// Force every node you might travel TO (not where you stand) to a given type.
const neighborsAs = (w, nodeType) => ({
  ...w,
  map: {
    ...w.map,
    nodes: (w.map?.nodes || []).map(n =>
      String(n.id) === String(w.map?.currentNodeId) ? n : { ...n, nodeType })
  }
});

test('U278: precondition — the home node has compass exits to survey', () => {
  const survey = buildLocationSurvey(outside(boot()));
  assert.match(survey, /(a path leads|to the \w+|you can see)/, 'there are ways out to describe');
});

test('U278: a settlement/open road is OVER THE HORIZON — directional, never named (even discovered)', () => {
  const w = withDiscovered(neighborsAs(outside(boot()), 'settlement'), allIds(boot()));
  const survey = buildLocationSurvey(w);
  assert.match(survey, /a path leads (north|east|south|west)/, 'you see the road leaving');
  assert.doesNotMatch(survey, /lies [A-Z]/, 'a town over the horizon is not named by look-around');
  assert.doesNotMatch(survey, /you can see a/, 'a town does not poke above the treeline');
});

test('U278: a DISCOVERED landmark pokes into view and IS named', () => {
  const w = withDiscovered(neighborsAs(outside(boot()), 'landmark'), allIds(boot()));
  const survey = buildLocationSurvey(w);
  assert.match(survey, /to the (north|east|south|west) lies [A-Z]/, 'a known landmark in sight is named');
});

test('U278: an UNDISCOVERED landmark is read by SILHOUETTE, never named', () => {
  const w0 = outside(boot());
  const cur = String(w0.map?.currentNodeId ?? '');
  const w = withDiscovered(neighborsAs(w0, 'landmark'), [cur]); // only where you stand is known
  const survey = buildLocationSurvey(w);
  assert.match(survey, /you can see (a |an )?[a-z]/, 'you see its shape ("you can see a bridge")');
  assert.doesNotMatch(survey, /lies [A-Z]/, 'but you do not know its name yet');
});
