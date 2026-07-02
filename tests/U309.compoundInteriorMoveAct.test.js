// U309 — IOM-P5: compound interior move + action redispatch.
//
// A t19-shaped command ("I head back to my room and open that iron-bound chest")
// used to classify only the move clause, stop after moving, and never run the
// container action in the newly reached room. The split must stay narrow: idioms like
// "press through the crowd" and impossible reaches like "reach for the sun" are not
// interior moves.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { furnitureRoomAssignments } from '../engine/structures/roomObjects.js';
import { normalizeTopology, adjacentRooms } from '../engine/structures/topology.js';
import { reachableRooms } from '../engine/movement/interiorMovement.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const ROLL_RE = /\broll:\s*\d+\s*vs\s*DC/i;
const roomOf = (w) => String(w.scene?.interior?.roomId || '');

function standInRoom(w, roomId) {
  const cur = w.scene?.interior || {};
  const visited = [...new Set([...(cur.visited || []).map(String), String(roomId)])];
  return {
    ...w,
    party: (w.party || []).map(p => ({ ...p, position: { ...(p.position || {}), interior: { structureId: String(cur.structureKey || ''), roomId: String(roomId) } } })),
    scene: { ...w.scene, interior: { ...cur, roomId: String(roomId), visited } }
  };
}

function startOneRoomDeeperThanPiece(w, pieceName) {
  const a = furnitureRoomAssignments(w, w.map.currentNodeId).get(pieceName);
  assert.ok(a, `${pieceName} assigned to a room`);
  const st = w.structures?.byId?.[String(a.structureId)];
  const topo = normalizeTopology(st?.topology);
  const entryRoom = topo.rooms.find(r => (Array.isArray(r.tags) ? r.tags : []).some(tag => String(tag).toLowerCase() === 'entry'));
  const entryId = String(entryRoom?.id || topo.rooms[0]?.id || '');
  const { dist } = reachableRooms(topo, entryId);
  const targetDist = dist.get(String(a.roomId));
  const deeper = adjacentRooms(topo, String(a.roomId)).find(id => (dist.get(id) ?? -1) > targetDist);
  assert.ok(deeper, 'fixture has a deeper sibling room so "back" returns to the object room');
  return { world: standInRoom(w, deeper), targetRoomId: String(a.roomId), startRoomId: String(deeper) };
}

function furnitureByName(w, name) {
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  return (node?.furniture || []).find(f => String(f.name) === String(name));
}

test('U309-A: "head back to my room and open that iron-bound chest" moves, then opens the chest with no roll', () => {
  const { world, targetRoomId, startRoomId } = startOneRoomDeeperThanPiece(boot(), 'iron-bound chest');
  const r = playerMove(world, PACKS, 'I head back to my room and open that iron-bound chest');

  assert.notEqual(roomOf(r.world), startRoomId, 'the first clause moved rooms');
  assert.equal(roomOf(r.world), targetRoomId, 'the action redispatched in the chest room');
  assert.match(String(r.output.mechanics || ''), /container|trivial action/i, `container/free-open path should fire: ${r.output.mechanics}`);
  assert.doesNotMatch(String(r.output.mechanics || ''), ROLL_RE, `no raw d20: ${r.output.mechanics}`);
  assert.match(String(r.output.narration || ''), /iron-bound chest/i, r.output.narration);
  assert.match(String(r.output.narration || ''), /Inside|empty/i, r.output.narration);
  assert.equal(furnitureByName(r.world, 'iron-bound chest')?.state, 'open', 'opening persists after the redispatched action');
});

test('U309-B: non-room "through" and impossible-reach idioms do not split into move-then-act', () => {
  for (const phrase of [
    'I press through the crowd and open that iron-bound chest',
    'I reach for the sun and then open that iron-bound chest',
  ]) {
    const { world, startRoomId } = startOneRoomDeeperThanPiece(boot(), 'iron-bound chest');
    const r = playerMove(world, PACKS, phrase);
    assert.equal(roomOf(r.world), startRoomId, `[${phrase}] must not move rooms`);
    assert.doesNotMatch(String(r.output.mechanics || ''), /container|trivial action/i, `[${phrase}] must not redispatch to the chest action`);
  }
});
