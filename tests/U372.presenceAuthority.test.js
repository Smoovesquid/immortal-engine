// U372 — presence authority (ROM-1). Occupancy is now LAW, not a display.
//
// Before ROM-1, grabbing/addressing/assaulting "someone" in an empty room grabbed the
// first NPC on the whole node roster — so people teleported in and the narrator retconned
// them as always-present (the C1 materialization break). Now a person-sink only reaches
// someone actually IN the player's room (walking the player next door if the named target
// is elsewhere in the same building), and an empty room honestly answers empty.
//
// This suite locks the three arms of the ROOM_OCCUPANCY_MODEL §2 rule that ROM-1 shipped
// with no coverage of its own:
//   A. empty room  -> a generic person-assault finds no target (no combat, no ghost)
//   B. co-present  -> the same assault engages the real occupant
//   C. same-struct -> a NAMED target elsewhere in the building is auto-sought (combat + move)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { coLocatePlayerWithNpc } from './support/presence.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = packs();
const boot = (seed = 'tallow') => beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const roomOccupants = (w) => {
  const i = w.scene?.interior;
  return i ? occupantsOfRoom(w, String(i.structureKey || ''), String(i.roomId || '')) : [];
};

test('U372-A: assaulting "someone" in an empty room finds no target — no combat, no materialized NPC', () => {
  const w = boot();
  assert.ok(w.scene?.interior, 'player starts indoors');
  assert.equal(roomOccupants(w).length, 0, 'precondition: the wake room is empty of NPCs');

  const { world: after, output } = playerMove(w, PACKS, 'I grab the carter by his collar and headbutt him in the face');
  assert.ok(!after.combat?.active, 'no combat can start against a person who is not in the room');
  const said = `${output?.narration || ''} ${output?.mechanics || ''}`.toLowerCase();
  assert.match(said, /no one|no-target|nobody/, `an empty room answers empty, not a ghost: ${said}`);
});

test('U372-B: the same assault, once an NPC is actually present, engages the real occupant', () => {
  const co = coLocatePlayerWithNpc(boot());
  assert.ok(co, 'tallow has a co-locatable NPC');
  assert.ok(roomOccupants(co.w).some(n => String(n.name) === String(co.npc.name)), 'the NPC is now in the player\'s room');

  const { world: after } = playerMove(co.w, PACKS, 'I grab a bucket and smash it over their head');
  assert.ok(after.combat?.active, 'a present target makes the generic-pronoun assault real');
});

test('U372-C: a NAMED target elsewhere in the same building is auto-sought — combat starts and the player moves', () => {
  const w = boot();
  const interior = w.scene.interior;
  const struct = String(interior.structureKey || '');
  const topo = normalizeTopology(w.structures?.byId?.[struct]?.topology);
  // Find an NPC in THIS building but a DIFFERENT room than the player's (the seek case).
  let target = null;
  for (const r of (topo?.rooms || [])) {
    if (String(r.id) === String(interior.roomId)) continue;
    const occ = occupantsOfRoom(w, struct, String(r.id));
    if (occ.length) { target = { npc: occ[0], roomId: String(r.id) }; break; }
  }
  assert.ok(target, 'tallow places an NPC in another room of the wake-room building (the auto-seek fixture)');
  assert.equal(roomOccupants(w).some(n => String(n.name) === String(target.npc.name)), false, 'the target is NOT in the player\'s starting room');

  const { world: after } = playerMove(w, PACKS, `I attack ${target.npc.name}`);
  assert.ok(after.combat?.active, 'the same-building target is reachable — combat starts');
  assert.equal(String(after.scene?.interior?.roomId || ''), target.roomId, 'the player was walked into the target\'s room (auto-seek moved the token)');
});
