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

test('U287: a DIRECTED locate names the person out of sight; a BARE presence ask stays line-of-sight', () => {
  // Corrected contract (was "a presence query consults the whole roster"): per THE_DM_TEST,
  // "who is here / who's in the room with me" is line of sight — it must NOT dump the off-sight
  // roster. The one roster-reaching exception is a DIRECTED "where is <named person>?", because
  // naming a specific person you're after lets the DM tell you where they are. (See U288.)
  const w = playerMove(begin().world, PACKS, 'I step outside').world;
  const outdoors = new Set(outdoorOccupants(w).map(n => n.name));
  const indoorsSociable = nodeNpcs(w).filter(n => n && !n.hostile && !outdoors.has(n.name));
  assert.ok(indoorsSociable.length > 0, 'precondition: someone sociable is indoors / out of sight');
  const target = indoorsSociable[0];
  // Directed: the named person is located even though they're out of line of sight.
  const directed = buildLocationSurvey(w, { presence: true, queryText: `where is ${target.name}` });
  assert.ok(directed.includes(target.name), `a directed "where is X" should locate the named ${target.name}: ${directed}`);
  // Bare presence ask: line of sight only — never the out-of-sight indoor folk.
  const bare = buildLocationSurvey(w, { presence: true, queryText: 'who is here with me' });
  for (const n of indoorsSociable) {
    assert.ok(!bare.includes(n.name), `a bare presence ask must not name out-of-sight ${n.name}: ${bare}`);
  }
});

test('U287: the opening DM line is a longer, multi-sentence scene-set', () => {
  const op = String(begin().output?.narration || '');
  const sentences = (op.match(/[.!?]/g) || []).length;
  assert.ok(sentences >= 3, `the opener should be a multi-sentence description, got: ${op}`);
  assert.ok(op.length > 140, `the opener should be substantial, got ${op.length} chars`);
});
