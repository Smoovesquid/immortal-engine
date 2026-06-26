// U287 — "look around" is LINE OF SIGHT, never the whole-town roster (the hard rule). Outdoors you
// see only the people out in the open near you; the rest are indoors and out of sight. A presence
// query ("who is here / where is X") is different — it consults the whole roster on purpose. And the
// opening DM line is a longer, multi-sentence scene-set. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { outdoorOccupants } from '../engine/structures/roomOccupancy.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const begin = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS);
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];

test('U287: outdoor look-around is line-of-sight — it never names the indoor folk', () => {
  const w = playerMove(begin().world, PACKS, 'I step outside').world;
  const survey = buildLocationSurvey(w); // a plain look-around — no presence flag
  const outdoors = new Set(outdoorOccupants(w).map(n => n.name));
  const indoors = nodeNpcs(w).filter(n => n && !n.hostile && !outdoors.has(n.name));
  assert.ok(indoors.length > 0, 'precondition: some of the roster is indoors / out of sight');
  for (const n of indoors) {
    assert.ok(!survey.includes(n.name), `look-around must not name the out-of-sight ${n.name}: ${survey}`);
  }
});

test('U287: a presence query DOES consult the whole roster (who is here / where is X)', () => {
  const w = playerMove(begin().world, PACKS, 'I step outside').world;
  const presence = buildLocationSurvey(w, { presence: true });
  const outdoors = new Set(outdoorOccupants(w).map(n => n.name));
  const indoorsSociable = nodeNpcs(w).filter(n => n && !n.hostile && !outdoors.has(n.name));
  // someone out of line of sight is still answered for a "who's here" — proving the two paths differ.
  assert.ok(indoorsSociable.some(n => presence.includes(n.name)), `a presence query should reach the full roster: ${presence}`);
});

test('U287: the opening DM line is a longer, multi-sentence scene-set', () => {
  const op = String(begin().output?.narration || '');
  const sentences = (op.match(/[.!?]/g) || []).length;
  assert.ok(sentences >= 3, `the opener should be a multi-sentence description, got: ${op}`);
  assert.ok(op.length > 140, `the opener should be substantial, got ${op.length} chars`);
});
