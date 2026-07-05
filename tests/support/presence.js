// Shared test helper — relocate the player to be co-present with a settlement NPC.
//
// ROM-1 made presence LAW: you can only grab, address, or assault someone who is
// actually in your room (or the open space you stand in). Room occupancy is a pure
// DERIVED function of (seed + npc + place) — engine/structures/roomOccupancy.js — so
// a fixture can't just tag an NPC "present"; it has to put the PLAYER where an NPC
// already stands. Older fixtures assumed "an NPC exists at this node" == "reachable
// from the wake room", the exact node≠room conflation ROM-1 corrects.
//
// OCC-STORY-1 (2026-07-05) then made placement STORY-DRIVEN: NPCs stand where their
// personal story puts them (the smith at the smithy…), and — crucially — the sleeping
// player's own wake cottage is NEVER a stranger's anchor, so it is now empty of
// strangers by design. That removed the one interior these fixtures used to co-locate
// in. So when the natural world offers no INDOOR occupant, this helper CONSTRUCTS a
// deterministic indoor co-location: a single materialized building holding the first
// sociable roster NPC, with the player placed inside it. Same derived-occupancy law,
// just a purpose-built room so the "player indoors with a real settlement NPC" contract
// these fixtures were written for still holds.

import { occupantsOfRoom, outdoorOccupants } from '../../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../../engine/structures/topology.js';

const COLOC_KEY = 'coloc:test';
// A materialized two-room building for the same-building-different-room case (auto-seek).
const COLOC_TOPO = { kind: 'rooms', rooms: [{ id: 'coloc:entry', tags: ['entry'] }, { id: 'coloc:back' }], edges: [{ a: 'coloc:entry', b: 'coloc:back' }] };

// Build a world with ONE real multi-room building (COLOC_TOPO) at the player's node holding exactly
// ONE roster NPC (the first sociable one), placed INDOORS deterministically. OCC-STORY-1's placement
// has a probabilistic day-movement (an NPC may be out on errands or "up to something"), so we SCAN the
// clock hours 0..23 — occupancy is a pure function of the hour, so this is fully deterministic — and
// take the first hour at which the lone NPC lands in a room of the building. That gives a stable,
// seed-independent guarantee that the NPC is indoors, plus WHICH room they're in (so a caller can
// stand the player in that room, for co-presence, or a different one, for the auto-seek case).
// Returns { world, npc, key, npcRoom } or null (no sociable NPC / never placed indoors — unreachable
// in practice since night keeps folk home).
function constructIndoorColocation(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nid) || null;
  const roster = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  const npc = roster.find(n => n && !n.hostile);
  if (!npc) return null;
  const base = {
    ...world,
    meta: { ...(world.meta || {}), homeNodeId: '' },        // drop the wake-cottage exclusion for the fixture
    map: {
      ...world.map,
      nodes: (world.map?.nodes || []).map(n => String(n.id) === nid
        ? { ...n, settlement: { ...(n.settlement || {}), buildings: [], npcs: [npc] } }
        : n)
    },
    structures: { ...(world.structures || {}), byId: { [COLOC_KEY]: { id: COLOC_KEY, nodeId: nid, buildingType: 'cottage', topology: COLOC_TOPO } } }
  };
  const rooms = ['coloc:entry', 'coloc:back'];
  for (let hours = 0; hours < 24; hours++) {
    const w = { ...base, time: { ...(world.time || {}), hours } };
    const npcRoom = rooms.find(r => occupantsOfRoom(w, COLOC_KEY, r).length);
    if (npcRoom) return { world: w, npc, key: COLOC_KEY, npcRoom };
  }
  return null;
}

/**
 * coLocatePlayerWithNpc(world) -> { w, npc } | null
 * Returns a world where the player stands in the SAME room/space as an NPC. Prefers a natural indoor
 * occupant, then a natural outdoor one; failing both (the OCC-STORY-1 empty-wake-cottage case) it
 * CONSTRUCTS an indoor co-location so the historical "player indoors with a settlement NPC" contract
 * holds. Deterministic — occupancy is seeded, so the same NPC/room is chosen every run. null only if
 * the node's roster has no sociable NPC at all.
 */
export function coLocatePlayerWithNpc(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const byId = world?.structures?.byId || {};
  // 1. A natural indoor occupant (a materialized building's room that already holds someone).
  for (const st of Object.values(byId)) {
    if (String(st.nodeId || '') !== nid) continue;
    const topo = normalizeTopology(st.topology);
    const rooms = (topo?.rooms?.length ? topo.rooms : [{ id: '' }]);
    for (const r of rooms) {
      const occ = occupantsOfRoom(world, String(st.id), String(r.id));
      if (occ.length) {
        const w = { ...world, scene: { ...world.scene, interior: { ...(world.scene?.interior || {}), structureKey: String(st.id), roomId: String(r.id) } } };
        return { w, npc: occ[0] };
      }
    }
  }
  // 2. Construct an indoor co-location (the wake cottage is empty of strangers by OCC-STORY-1 design).
  //    A real multi-room building holding the lone NPC indoors; stand the player in the NPC's room —
  //    a genuine roomId (which the assault/pronoun resolution needs), with the NPC co-present.
  const built = constructIndoorColocation(world);
  if (built) {
    const occ = occupantsOfRoom(built.world, built.key, built.npcRoom);
    const w = { ...built.world, scene: { ...built.world.scene, interior: { ...(built.world.scene?.interior || {}), structureKey: built.key, roomId: built.npcRoom } } };
    return { w, npc: occ[0] };
  }
  // 3. Last resort: a natural outdoor occupant (the player stands out in the open with them).
  const out = outdoorOccupants(world);
  if (out.length) {
    const w = { ...world, scene: { ...world.scene, interior: null } };
    return { w, npc: out[0] };
  }
  return null;
}

/**
 * coLocatePlayerNearNpcInBuilding(world) -> { w, npc, targetRoomId } | null
 * The player stands in ONE room of a materialized building while an NPC stands in ANOTHER room of the
 * SAME building — the auto-seek fixture (a named target elsewhere under the same roof). Built on the
 * same deterministic constructed co-location; the player is placed in the back room, the NPC in the
 * entry room. null if the roster has no sociable NPC.
 */
export function coLocatePlayerNearNpcInBuilding(world) {
  const built = constructIndoorColocation(world);
  if (!built) return null;
  // The lone NPC landed in built.npcRoom; stand the player in the OTHER room of the same building —
  // the auto-seek "elsewhere under the same roof" case.
  const npc = occupantsOfRoom(built.world, built.key, built.npcRoom)[0];
  const playerRoom = ['coloc:entry', 'coloc:back'].find(r => r !== built.npcRoom);
  const w = { ...built.world, scene: { ...built.world.scene, interior: { ...(built.world.scene?.interior || {}), structureKey: built.key, roomId: playerRoom } } };
  return { w, npc, targetRoomId: built.npcRoom };
}
