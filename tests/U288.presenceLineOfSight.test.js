// U288 — PRESENCE is LINE OF SIGHT, never the whole-town roster (the hard rule, extended from the
// look-around rule in U287 to the presence query itself). "Who is in the room with me?" lists only
// the people actually in the player's current room; outdoors it lists the people out in the open.
// The rest of the settlement roster is elsewhere / out of sight and must NOT be named. A DIRECTED
// locate ("where is <named person>?") is the one exception — naming a specific person reaches the
// roster to report where they are. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { handleMetaQuestion, buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { occupantsOfRoom, outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];
const roomsOf = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => r.id);
const inRoom = (w, rid) => ({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: rid } } });

test('U288: "who is in the room with me?" in an EMPTY room names nobody — not the off-room town roster', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const roster = nodeNpcs(w);
  assert.ok(roster.length > 1, 'precondition: multiple NPCs in the settlement');
  // Find a room with no sociable occupants but where the rest of the roster is elsewhere.
  const empty = roomsOf(w, sk).find(rid => occupantsOfRoom(w, sk, rid).filter(n => !n.hostile).length === 0);
  assert.ok(empty, 'precondition: a private/empty room exists');
  const elsewhere = roster.filter(n => !occupantsOfRoom(w, sk, empty).some(o => o.name === n.name));
  assert.ok(elsewhere.length > 0, 'precondition: some roster NPCs are NOT in this room');

  const ans = handleMetaQuestion('who is in the room with me?', inRoom(w, empty));
  assert.match(ans, /no one|alone/i, `an empty room must say nobody's here, got: ${ans}`);
  for (const n of elsewhere) {
    assert.ok(!ans.includes(n.name), `must NOT name the off-room ${n.name}: ${ans}`);
  }
});

test('U288: in an OCCUPIED room, presence names that room\'s people and NOT outdoor/other-room folk', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const full = roomsOf(w, sk).find(rid => occupantsOfRoom(w, sk, rid).filter(n => !n.hostile).length > 0);
  assert.ok(full, 'precondition: an occupied room exists');
  const roomSociable = occupantsOfRoom(w, sk, full).filter(n => !n.hostile);
  const outdoors = outdoorOccupants(w).filter(n => !n.hostile);
  assert.ok(outdoors.length > 0, 'precondition: someone sociable is outdoors / out of sight');

  const ans = handleMetaQuestion('who is in the room with me?', inRoom(w, full));
  assert.ok(roomSociable.some(n => ans.includes(n.name)), `must name a room occupant: ${ans}`);
  for (const n of outdoors) {
    assert.ok(!ans.includes(n.name), `must NOT name the out-of-sight outdoor ${n.name}: ${ans}`);
  }
});

test('U288: a bare "look around" inside is line-of-sight — it never names off-room folk', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const empty = roomsOf(w, sk).find(rid => occupantsOfRoom(w, sk, rid).filter(n => !n.hostile).length === 0);
  assert.ok(empty, 'precondition: a private/empty room exists');
  const survey = buildLocationSurvey(inRoom(w, empty));
  const elsewhere = nodeNpcs(w).filter(n => !n.hostile && !occupantsOfRoom(w, sk, empty).some(o => o.name === n.name));
  for (const n of elsewhere) {
    assert.ok(!survey.includes(n.name), `look-around must not name the out-of-sight ${n.name}: ${survey}`);
  }
});

test('U288: a DIRECTED locate ("where is <named person>?") still reaches the roster for that person', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const empty = roomsOf(w, sk).find(rid => occupantsOfRoom(w, sk, rid).filter(n => !n.hostile).length === 0);
  // Pick a sociable person who is NOT in the player's (empty) room — out of line of sight.
  const target = nodeNpcs(w).find(n => !n.hostile && !occupantsOfRoom(w, sk, empty).some(o => o.name === n.name));
  assert.ok(target, 'precondition: an out-of-sight sociable NPC exists');
  const directed = buildLocationSurvey(inRoom(w, empty), { presence: true, queryText: `where is ${target.name}` });
  assert.ok(directed.includes(target.name), `a directed "where is X" should locate the named ${target.name}: ${directed}`);
});

test('U288: presence answer is deterministic for the same seed', () => {
  const a = handleMetaQuestion('who is in the room with me?', boot());
  const b = handleMetaQuestion('who is in the room with me?', boot());
  assert.equal(a, b, 'same seed → identical presence answer');
});
