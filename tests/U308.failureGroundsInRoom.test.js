// U308 — IOM-P4: failure-floor prose names the acted-on object and the room truth.
//
// The generic failure floor used to say "the it" when no take target was parsed, and
// a compound sentence could lose the actual object behind the move clause. With
// room-scoped furniture (U307), a named object may also be real at this node but in a
// sibling room; the fallback should say that, not blame the whole place.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, genericGroundedOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { furnitureRoomAssignments } from '../engine/structures/roomObjects.js';
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

function standInRoom(w, roomId) {
  const cur = w.scene?.interior || {};
  const visited = [...new Set([...(cur.visited || []).map(String), String(roomId)])];
  return {
    ...w,
    party: (w.party || []).map(p => ({ ...p, position: { ...(p.position || {}), interior: { structureId: String(cur.structureKey || ''), roomId: String(roomId) } } })),
    scene: { ...w.scene, interior: { ...cur, roomId: String(roomId), visited } }
  };
}

function siblingRoomAwayFromPiece(w, pieceName) {
  const a = furnitureRoomAssignments(w, w.map.currentNodeId).get(pieceName);
  assert.ok(a, `${pieceName} assigned to a room`);
  const st = w.structures?.byId?.[String(a.structureId)];
  const topo = normalizeTopology(st?.topology);
  const away = topo.rooms.find(r => String(r.id) !== String(a.roomId));
  assert.ok(away, 'fixture has a sibling room');
  return standInRoom(w, away.id);
}

test('U308-A: take fallback is article-safe — never "the it"', () => {
  const line = genericGroundedOutcome(boot(), 'I take', 'failure');
  assert.doesNotMatch(line, /\bthe it\b/i, line);
  assert.match(line, /\b(?:reach for it|it won't budge)\b/i, line);
});

test('U308-B: compound action clauses still name the acted-on object', () => {
  const line = genericGroundedOutcome(boot(), 'I head back to my room and pry the iron-bound chest', 'failure');
  assert.match(line, /iron-bound chest/i, line);
  assert.doesNotMatch(line, /doesn't give it to you|falls short here/i, line);
});

test('U308-C: sibling-room objects get concrete room-true failure prose', () => {
  const away = siblingRoomAwayFromPiece(boot(), 'iron-bound chest');
  const line = genericGroundedOutcome(away, 'I pry the iron-bound chest', 'failure');
  assert.match(line, /iron-bound chest is back in the bedchamber/i, line);
  assert.match(line, /nothing like it here/i, line);
});
