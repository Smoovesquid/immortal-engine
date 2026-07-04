// U402 — MAP-OCC-1b: the interior floor-plan map draws the engine's ACTUAL room occupants,
// never a seeded scatter of the whole settlement roster. Sibling of U398 (outdoor tokens).
// public/map/LocalMap.js §8 used to place every roster NPC into a random discovered room
// (seedStr('npcroom|…') % rooms) — the map inventing people in rooms the engine says are
// empty, live on-screen since the v0.28.8 interior-map switch. The fix routes §8 through
// public/map/interiorTokens.js interiorPeopleTokens(), whose only source is
// engine/structures/roomOccupancy.js occupantsOfRoom() — the same occupancy model the DM's
// presence logic uses. Hermetic — no network, no API key, no DOM.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { interiorPeopleTokens } from '../public/map/interiorTokens.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const begin = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS);

function wakeStructure(w) {
  const key = String(w?.scene?.interior?.structureKey || '');
  const topo = w?.structures?.byId?.[key]?.topology;
  const roomIds = Array.isArray(topo?.rooms) ? topo.rooms.map(r => String(r.id)) : [];
  return { key, roomIds };
}

test('U402: interior tokens equal the engine\'s per-room occupants exactly (tallow wake structure)', () => {
  const w = begin().world;
  const { key, roomIds } = wakeStructure(w);
  assert.ok(key, 'precondition: the tallow boot starts inside a structure');
  assert.ok(roomIds.length > 1, 'precondition: the wake structure has multiple rooms');

  const nodeId = w.map.currentNodeId;
  const node = w.map.nodes.find(n => n.id === nodeId);
  const roster = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  assert.ok(roster.length > 1, 'precondition: the settlement has more than one roster NPC');

  const toks = interiorPeopleTokens(w, key, roomIds);

  // Per-room equality: exactly as many tokens in each room as the engine placed there.
  let total = 0;
  for (const rid of roomIds) {
    const truth = occupantsOfRoom(w, key, rid) || [];
    const got = toks.filter(t => t.roomId === rid);
    assert.equal(got.length, truth.length, `room ${rid}: token count must equal engine occupant count`);
    total += truth.length;
  }
  assert.equal(toks.length, total, 'no token may exist outside the per-room truth');

  // The anti-scatter property: the old code painted the ENTIRE roster into this one
  // building's discovered rooms; the engine does not house the whole roster here.
  assert.ok(total < roster.length,
    `precondition/regression guard: the wake structure houses ${total} of ${roster.length} roster NPCs — the full-roster scatter class`);
});

test('U402: a room the engine says is empty draws no one', () => {
  const w = begin().world;
  const { key, roomIds } = wakeStructure(w);
  const empty = roomIds.find(rid => (occupantsOfRoom(w, key, rid) || []).length === 0);
  assert.ok(empty, 'precondition: at least one room in the wake structure is empty (the wake bedchamber class)');
  const toks = interiorPeopleTokens(w, key, roomIds);
  assert.equal(toks.filter(t => t.roomId === empty).length, 0, `empty room ${empty} must draw zero people-tokens`);
});

test('U402: undiscovered rooms keep their occupants off the sheet (knowledge rule)', () => {
  const w = begin().world;
  const { key, roomIds } = wakeStructure(w);
  const occupied = roomIds.filter(rid => (occupantsOfRoom(w, key, rid) || []).length > 0);
  const toksAll = interiorPeopleTokens(w, key, roomIds);
  const toksNone = interiorPeopleTokens(w, key, []);
  assert.equal(toksNone.length, 0, 'no discovered rooms → no tokens, whoever is inside');
  if (occupied.length) {
    const minusOne = roomIds.filter(r => r !== occupied[0]);
    const toksMinus = interiorPeopleTokens(w, key, minusOne);
    assert.ok(toksMinus.every(t => t.roomId !== occupied[0]), 'an undiscovered occupied room must not leak tokens');
    assert.ok(toksMinus.length < toksAll.length || toksAll.filter(t => t.roomId === occupied[0]).length === 0,
      'hiding an occupied room reduces the token set');
  }
});

test('U402: token derivation is deterministic across replays of the same seed', () => {
  const w1 = begin().world;
  const w2 = begin().world;
  const a = wakeStructure(w1);
  const b = wakeStructure(w2);
  assert.equal(a.key, b.key, 'same seed must wake in the same structure');
  assert.deepEqual(
    interiorPeopleTokens(w1, a.key, a.roomIds),
    interiorPeopleTokens(w2, b.key, b.roomIds),
    'identical seed → identical interior token set'
  );
});
