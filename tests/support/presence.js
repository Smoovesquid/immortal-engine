// Shared test helper — relocate the player to be co-present with a settlement NPC.
//
// ROM-1 made presence LAW: you can only grab, address, or assault someone who is
// actually in your room (or the open space you stand in). Room occupancy is a pure
// DERIVED function of (seed + npc + place) — engine/structures/roomOccupancy.js — so
// a fixture can't just tag an NPC "present"; it has to put the PLAYER where an NPC
// already stands. Older fixtures assumed "an NPC exists at this node" == "reachable
// from the wake room", the exact node≠room conflation ROM-1 corrects.

import { occupantsOfRoom, outdoorOccupants } from '../../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../../engine/structures/topology.js';

/**
 * coLocatePlayerWithNpc(world) -> { w, npc } | null
 * Returns a world where the player stands in the same room/space as the first NPC
 * found (indoors preferred, then the outdoor pool), or null if the node's roster is
 * empty. Deterministic — occupancy is seeded, so the same NPC/room is chosen every run.
 */
export function coLocatePlayerWithNpc(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const byId = world?.structures?.byId || {};
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
  const out = outdoorOccupants(world);
  if (out.length) {
    const w = { ...world, scene: { ...world.scene, interior: null } };
    return { w, npc: out[0] };
  }
  return null;
}
