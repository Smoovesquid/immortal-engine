// Room-scoped objects — which room of a building each node furniture piece lives in.
// Like roomOccupancy/roomWindows, this is DERIVED state: a pure, deterministic function
// of (seed + node + piece name + the node's structure topologies) — nothing stored, so
// no WORLD_VERSION bump and worldHash stays byte-identical (INTERIOR_OBJECT_MODEL P1).
//
// Furniture is generated per NODE (generateNodeFurniture), so every room of a multi-room
// interior used to list the SAME chest/pallet/lantern (WB-Q5). Here each piece is
// assigned to exactly ONE room, preferring rooms whose roomDetail loadout draws a
// kindred thing (the straw pallet goes where the map draws beds), so the prose and the
// drawn floor plan agree about where things are.
//
// Keys are piece NAMES, not indexes: names are unique per node (generateNodeFurniture
// picks distinct templates) and removeFurniture SPLICES node.furniture, so an
// index-keyed assignment would re-room the survivors after a removal.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';
import { roomDetail } from './roomDetail.js';

// generateFurniture template name -> kindred roomDetail furniture kinds.
const AFFINITY = {
  'wooden table': ['table', 'longtable'],
  'wooden chair': ['chair', 'bench'],
  'iron-bound chest': ['chest'],
  'oil lantern': ['lantern', 'candles'],
  'stone basin': ['basin', 'font'],
  'wooden crate': ['crate', 'barrel'],
  'iron brazier': ['brazier', 'firepit', 'hearth'],
  'straw pallet': ['bedding', 'bed'],
  'tool rack': ['rack', 'shelf'],
};

function nodeAt(world, nodeId) {
  return (world?.map?.nodes || []).find(n => n && String(n.id) === String(nodeId)) || null;
}

// All rooms across the node's structures that have a real topology, in a stable order
// (structures sorted by id; normalizeTopology already sorts rooms by id).
function roomsAtNode(world, nodeId) {
  const byId = world?.structures?.byId || {};
  const structures = Object.values(byId)
    .filter(s => s && String(s.nodeId || '') === String(nodeId))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const out = [];
  for (const st of structures) {
    const topo = normalizeTopology(st.topology);
    if (!topo || !topo.rooms.length) continue;
    for (const r of topo.rooms) {
      out.push({ structureId: String(st.id), roomId: String(r.id), room: r, buildingType: st.buildingType || null });
    }
  }
  return out;
}

/**
 * furnitureRoomAssignments(world, nodeId) -> Map<pieceName, { structureId, roomId }>
 * The one room each node furniture piece occupies. Empty when the node has no furniture
 * or no structure carries a topology. Pure + seeded; read-only over an ensured world.
 */
export function furnitureRoomAssignments(world, nodeId) {
  const nid = String(nodeId ?? world?.map?.currentNodeId ?? '');
  const furniture = Array.isArray(nodeAt(world, nid)?.furniture) ? nodeAt(world, nid).furniture : [];
  const assignments = new Map();
  if (!furniture.length) return assignments;
  const rooms = roomsAtNode(world, nid);
  if (!rooms.length) return assignments;

  const seed = String(world?.meta?.seed ?? '');
  const kindsByRoom = rooms.map(r => ({
    structureId: r.structureId,
    roomId: r.roomId,
    kinds: new Set(roomDetail(r.room, r.buildingType).furniture.map(f => String(f.kind)))
  }));

  for (const piece of furniture) {
    const name = String(piece?.name || '');
    if (!name || assignments.has(name)) continue;
    // FUNC-MINIS-1 — an authored piece KNOWS its room (the Builder drew it there).
    // Explicit provenance always beats the affinity guess; the seeded pick below
    // remains byte-identical for every generic piece.
    if (piece.authored === true && piece.structureId && piece.roomId) {
      const home = kindsByRoom.find(r =>
        String(r.structureId) === String(piece.structureId) && String(r.roomId) === String(piece.roomId));
      if (home) {
        assignments.set(name, { structureId: home.structureId, roomId: home.roomId });
        continue;
      }
    }
    const kindred = AFFINITY[name.toLowerCase()] || [];
    const preferred = kindsByRoom.filter(r => kindred.some(k => r.kinds.has(k)));
    const pool = preferred.length ? preferred : kindsByRoom;
    const rng = makeRng(seedFromString(`${seed}|${nid}|furn-room|${name}`));
    const pick = pool[rng.int(0, pool.length - 1)];
    assignments.set(name, { structureId: pick.structureId, roomId: pick.roomId });
  }
  return assignments;
}

/**
 * objectsHere(world) -> [{ piece, nodeIndex }]
 * The Model A furniture pieces present at the player's position — THE candidate list
 * every interaction gate and survey matches against. nodeIndex is the piece's index in
 * node.furniture, so modifyFurniture/removeFurniture deltas stay keyed exactly as before.
 *   - not inside a structure          -> the full node list (behavior unchanged)
 *   - inside, no topology / one room  -> the full node list (bare-fixture fallback,
 *                                        mirrors occupantsOfRoom's)
 *   - inside a multi-room interior    -> only the pieces assigned to THIS room
 */
export function objectsHere(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const furniture = Array.isArray(nodeAt(world, nid)?.furniture) ? nodeAt(world, nid).furniture : [];
  const all = furniture.map((piece, nodeIndex) => ({ piece, nodeIndex }));
  const interior = (world?.scene && typeof world.scene.interior === 'object' && world.scene.interior) ? world.scene.interior : null;
  if (!interior) return all;

  const structureKey = String(interior.structureKey || '');
  const roomId = String(interior.roomId || '');
  const topo = normalizeTopology(world?.structures?.byId?.[structureKey]?.topology);
  if (!topo || topo.rooms.length < 2) return all;

  const assignments = furnitureRoomAssignments(world, nid);
  return all.filter(({ piece }) => {
    const a = assignments.get(String(piece?.name || ''));
    return !!a && a.structureId === structureKey && a.roomId === roomId;
  });
}
