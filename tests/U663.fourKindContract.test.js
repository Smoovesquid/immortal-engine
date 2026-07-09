// U663 — FUNC-MINIS-1: bed, barrel, cooking pot, dresser are their ACTUAL kinds.
//
// Tim's acceptance #5 (2026-07-09): "Bed, dresser, and cooking pot are recognized
// as their actual object kinds, not generic props." Before this packet the engine
// catalog had no cookpot and no dresser AT ALL — a drawn cooking pot could only
// ever be someone else's furniture. This file locks the four-kind contract at
// every layer: the FURN catalog identity, the loader carry (multi-room), the
// roomDetail read stack per room, the Model A physics pieces, seeding
// (uniqueness + idempotence), and room assignment via explicit provenance in a
// MULTI-room house (where affinity guessing could actually misplace).
//
// Siblings: U659–U662. The interaction lane itself (smash/search through
// playerMove) is proven kind-agnostically by U661 — detection is name-based over
// objectsHere and physics reads material/hardness off the piece, so no
// kind-specific code exists to test per kind.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { roomDetail, FURN } from '../engine/structures/roomDetail.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import {
  authoredNodePieces, seedAuthoredNodeFurniture, authoredIntactBedAt,
} from '../engine/structures/authoredFurniture.js';
import { furnitureRoomAssignments } from '../engine/structures/roomObjects.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// Two rooms: a bedroom (bed + dresser) and a pantry (barrel + cooking pot),
// joined by a door; front door on the bedroom's west wall.
const fourKindHouse = {
  kind: 'authored-structure',
  schema: 'house-builder/v6',
  name: 'Keeper\'s Cottage',
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'bedroom', name: 'Bedroom', role: 'quarters', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 5 },
    { id: 'pantry',  name: 'Pantry',  role: 'pantry',   shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 5 },
  ],
  walls: [],
  openings: [
    { kind: 'door', x: 10, y: 12.5, angle: 90, orient: 'v', len: 1, room: 'bedroom' },
    { kind: 'door', x: 16, y: 12.5, angle: 90, orient: 'v', len: 1 },
  ],
  tunnels: [],
  corridors: [],
  furniture: [
    { type: 'bed',     x: 11, y: 11, w: 2, h: 3, rot: 0, room: 'bedroom', ux: 0.3333, uy: 0.5 },
    { type: 'dresser', x: 14, y: 11, w: 2, h: 1, rot: 0, room: 'bedroom', ux: 0.8333, uy: 0.3 },
    { type: 'barrel',  x: 17, y: 13, w: 1, h: 1, rot: 0, room: 'pantry',  ux: 0.3,    uy: 0.7 },
    { type: 'cookpot', x: 19, y: 11, w: 1, h: 1, rot: 0, room: 'pantry',  ux: 0.7,    uy: 0.3 },
  ],
  secrets: []
};

const NODE = 'n_test_keeper';

test('U663: the engine catalog knows all four kinds with honest identities', () => {
  assert.equal(FURN.bed?.label, 'bed');
  assert.equal(FURN.barrel?.label, 'barrel');
  assert.equal(FURN.cookpot?.label, 'cooking pot', 'a cooking pot is a cooking pot, not a mesh');
  assert.equal(FURN.cookpot?.material, 'iron', 'cast iron — it dents, it never splinters');
  assert.equal(FURN.dresser?.label, 'dresser');
  assert.equal(FURN.dresser?.material, 'wood');
  assert.equal(FURN.dresser?.loot, 1, 'a dresser is searchable — it can hold things');
  assert.equal(FURN.dresser?.cover, 'half', 'a dresser is bulky enough to duck behind');
});

test('U663: a multi-room house carries each drawn piece into ITS room with its kind', () => {
  const st = loadAuthoredStructure(fourKindHouse, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  const byRoom = new Map(topo.rooms.map(r => [String(r.id), roomDetail(r, st.buildingType).furniture.map(f => f.kind).sort()]));

  const rooms = [...byRoom.values()];
  assert.deepEqual(rooms.find(k => k.includes('bed')), ['bed', 'dresser'], 'the bedroom holds exactly the bed and the dresser');
  assert.deepEqual(rooms.find(k => k.includes('barrel')), ['barrel', 'cookpot'], 'the pantry holds exactly the barrel and the cooking pot');
});

test('U663: Model A pieces carry the right physics for each kind', () => {
  const st = loadAuthoredStructure(fourKindHouse, { nodeId: NODE });
  const pieces = authoredNodePieces(st);
  const byName = new Map(pieces.map(p => [p.name, p]));

  assert.equal(pieces.length, 4, 'four drawn pieces, four world objects');

  const bed = byName.get('bed');
  assert.equal(bed.material, 'wood', 'a blow lands on the frame — wood, not cloth');
  assert.equal(bed.category, 'furniture');

  const pot = byName.get('cooking pot');
  assert.equal(pot.material, 'iron');
  assert.equal(pot.hardness, 4, 'iron hardness — smashing dents, never shatters');
  assert.equal(pot.category, 'container');

  const dresser = byName.get('dresser');
  assert.equal(dresser.material, 'wood');
  assert.equal(dresser.category, 'container', 'search/open affordance comes from the container class');

  const barrel = byName.get('barrel');
  assert.equal(barrel.material, 'wood');
  assert.equal(barrel.category, 'container');

  for (const p of pieces) {
    assert.ok(p.authored === true && p.pieceId && p.roomId, `${p.name} carries full provenance`);
    assert.ok(Array.isArray(p.parts) && p.parts.length === 3, `${p.name} has parts to tear off (salvage progression)`);
  }
});

test('U663: seeding is unique-named, idempotent, and assignment uses explicit provenance in a multi-room house', () => {
  const st = loadAuthoredStructure(fourKindHouse, { nodeId: NODE });
  const stub = {
    meta: { seed: 'u663' },
    map: { currentNodeId: NODE, nodes: [{ id: NODE, furniture: [] }] },
    structures: { byId: { [st.id]: st } },
  };

  const w1 = seedAuthoredNodeFurniture(stub, NODE);
  const node1 = w1.map.nodes[0];
  assert.equal(node1.furniture.length, 4, 'all four pieces seeded');
  assert.equal(new Set(node1.furniture.map(p => p.name)).size, 4, 'names unique per node (ROM-4)');
  assert.deepEqual(node1.furnitureSeeded, [st.id], 'the structure is marked seeded');

  const w2 = seedAuthoredNodeFurniture(w1, NODE);
  assert.equal(w2.map.nodes[0].furniture.length, 4, 'a second pass seeds nothing (idempotent — no resurrection)');

  // Explicit provenance beats affinity: the dresser stays in the drawn bedroom,
  // the cooking pot in the drawn pantry — even though affinity could have sent
  // kindred pieces elsewhere in a multi-room pool.
  const assignments = furnitureRoomAssignments(w1, NODE);
  const topo = normalizeTopology(st.topology);
  const roomIdOf = (kinds) => topo.rooms.find(r => roomDetail(r, st.buildingType).furniture.some(f => kinds.includes(f.kind)))?.id;
  const bedroomId = roomIdOf(['bed']);
  const pantryId = roomIdOf(['barrel']);

  assert.equal(String(assignments.get('dresser')?.roomId), String(bedroomId), 'the dresser is in the bedroom it was drawn in');
  assert.equal(String(assignments.get('cooking pot')?.roomId), String(pantryId), 'the cooking pot is in the pantry it was drawn in');
  assert.equal(String(assignments.get('bed')?.roomId), String(bedroomId));
  assert.equal(String(assignments.get('barrel')?.roomId), String(pantryId));
});

test('U663: sleeping at a placed bed is the PLACED bed\'s night — and a wrecked bed honestly stops being one', () => {
  // The demo hut has a placed bed at the boot (settlement) node. The placed-bed
  // branch outranks the generic town-bed branch — sleeping in the specific bed
  // you placed is more truthful narration; identical long-rest mechanics.
  const w0 = beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const nid = String(w0.map.currentNodeId);

  assert.ok(authoredIntactBedAt(w0, nid), 'the placed bed is present and intact');
  const rested = playerMove(w0, PACKS, 'we sleep for the night');
  assert.equal(String(rested.output?.mechanics || ''), '[rest:long]', 'a placed bed buys a full night');
  assert.match(String(rested.output?.narration || ''), /takes you the way only a real bed can/i,
    'the narration is the PLACED bed\'s — you sleep in the bed the builder drew, not a generic town bed');

  // Wreck the bed (parts exhausted) — the placed-bed affordance dies with the
  // object; the ladder falls through honestly (here, to the settlement's inn bed).
  const bedIdx = (w0.map.nodes.find(n => String(n.id) === nid).furniture || [])
    .findIndex(f => f && f.authored === true && String(f.kind) === 'bed');
  const wrecked = applyDeltas(w0, [{ op: 'modifyFurniture', nodeId: nid, furnitureId: bedIdx, changes: { state: 'damaged', parts: [], notes: 'frame smashed' } }]);
  assert.equal(authoredIntactBedAt(wrecked, nid), null, 'a wrecked bed is no bed');
  const fallback = playerMove(wrecked, PACKS, 'we sleep for the night');
  assert.doesNotMatch(String(fallback.output?.narration || ''), /takes you the way only a real bed can/i,
    'a wrecked placed bed is never narrated as slept-in — the generic ladder resumes');
});
