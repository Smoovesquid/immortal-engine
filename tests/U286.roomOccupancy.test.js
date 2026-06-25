// U286 — per-room occupancy. NPCs are placed per BUILDING ROOM (derived, deterministic), not
// treated as "the whole settlement is here". Folk gather in the common/entry room; a private back
// room is usually empty — so "look around" names only who is in YOUR room (no roster dump in a
// bedroom), the outside peek names who is in the room it sees into, and climb-in stealth runs
// against the people who'd actually see you. A structure with no interior topology falls back to
// "everyone here" (backward compatible). Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../engine/structures/topology.js';
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
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];
const rooms = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => r.id);

test('U286: occupancy partitions the roster — every NPC is in exactly one room', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rids = rooms(w, sk);
  assert.ok(rids.length > 1, 'precondition: a multi-room building');
  let total = 0;
  for (const rid of rids) total += occupantsOfRoom(w, sk, rid).length;
  assert.equal(total, nodeNpcs(w).length, 'each NPC is placed in exactly one room');
});

test('U286: occupancy is deterministic', () => {
  const a = boot(), b = boot();
  const sk = a.scene.interior.structureKey;
  for (const rid of rooms(a, sk)) {
    assert.deepEqual(occupantsOfRoom(a, sk, rid).map(n => n.name), occupantsOfRoom(b, sk, rid).map(n => n.name));
  }
});

test('U286: a private (empty) room lists no people; an occupied room names its own', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const names = nodeNpcs(w).filter(n => !n.hostile).map(n => n.name);
  const occCount = (rid) => occupantsOfRoom(w, sk, rid).filter(n => !n.hostile).length;
  const empty = rooms(w, sk).find(rid => occCount(rid) === 0);
  const full = rooms(w, sk).find(rid => occCount(rid) > 0);
  const surveyIn = (rid) => buildLocationSurvey({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: rid } } });
  if (empty) {
    const s = surveyIn(empty);
    for (const nm of names) assert.ok(!s.includes(nm), `an empty room must not name ${nm}: ${s}`);
  }
  if (full) {
    const s = surveyIn(full);
    assert.ok(names.some(nm => s.includes(nm)), `an occupied room should name an occupant: ${s}`);
  }
});

test('U286: a multi-building node splits its roster BETWEEN buildings (partition holds)', () => {
  const mkTopo = (p) => ({ kind: 'rooms', rooms: [{ id: `${p}:entry`, tags: ['entry'] }, { id: `${p}:back` }], edges: [{ a: `${p}:entry`, b: `${p}:back` }] });
  const npcs = Array.from({ length: 8 }, (_, i) => ({ id: `npc${i}`, name: `NPC${i}` }));
  const w = {
    meta: { seed: 'multi' },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { npcs } }] },
    structures: { byId: {
      b1: { id: 'b1', nodeId: 'town', topology: mkTopo('b1') },
      b2: { id: 'b2', nodeId: 'town', topology: mkTopo('b2') }
    } }
  };
  const roomsOf = (b) => [`${b}:entry`, `${b}:back`];
  let total = 0; const seen = new Set();
  for (const b of ['b1', 'b2']) for (const r of roomsOf(b)) { const o = occupantsOfRoom(w, b, r); total += o.length; o.forEach(n => seen.add(n.name)); }
  assert.equal(total, 8, 'every NPC is placed exactly once across all buildings + rooms');
  assert.equal(seen.size, 8, 'no NPC is duplicated across buildings');
  const inB1 = roomsOf('b1').reduce((a, r) => a + occupantsOfRoom(w, 'b1', r).length, 0);
  assert.ok(inB1 > 0 && inB1 < 8, 'the roster is split between buildings, not all dumped in one');
});

test('U286: a structure with no interior topology puts everyone "here" (backward compatible)', () => {
  const w = boot();
  const occ = occupantsOfRoom(w, 'no-such-structure:0', 'r'); // unresolved → single-space fallback
  assert.equal(occ.length, nodeNpcs(w).length, 'no topology → everyone is here');
});

test('U286: the outside peek reports real room occupancy (not the old "cannot tell" hedge)', () => {
  const w = playerMove(boot(), PACKS, 'I step outside').world;
  const r = playerMove(w, PACKS, 'look in the window');
  if (!/\[window:peek\]/.test(r.output.mechanics || '')) return; // not at a windowed building — skip
  assert.doesNotMatch(r.output.narration, /cannot tell from here/i, 'peek now reports who is actually within');
  assert.match(r.output.narration, /within|still and empty|keeps to the shadows/i, r.output.narration);
});
