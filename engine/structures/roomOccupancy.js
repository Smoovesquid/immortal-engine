// Room Occupancy — which settlement NPCs are in a given building room right now. Like roomWindows,
// this is DERIVED state: a pure, deterministic function of (seed + building + npc), not a stored
// field — so no WORLD_VERSION bump, and worldHash stays stable.
//
// Two levels: each NPC belongs to ONE building at the node (a town's people split BETWEEN its
// several buildings), then to ONE room within it. Folk gather in the building's COMMON / entry
// room; a private back room is usually empty. This is what lets "look around" name only who is in
// YOUR room, the outside peek name who is in the room it sees into, and climb-in stealth run
// against the people who would actually see you — per building, not the whole node roster.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';

const COMMON_SHARE = 0.7; // ~70% of a building's folk are in its common / entry room

function entryRoomId(topo) {
  const tagged = topo.rooms.find(r => (Array.isArray(r.tags) ? r.tags : []).some(t => String(t).toLowerCase() === 'entry'));
  return String(tagged?.id || topo.rooms[0]?.id || '');
}

// Buildings at a node, sorted for stable indexing. Mirrors interiors.sortedStructuresAtNode without
// pulling in ensureWorld — occupancy is a read-only derivation over an already-ensured world.
function nodeBuildings(world, nodeId) {
  const byId = world?.structures?.byId || {};
  return Object.values(byId)
    .filter(s => s && String(s.nodeId || '') === String(nodeId))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(s => String(s.id));
}

// The one BUILDING this NPC belongs to (a town's people split between its buildings).
function assignedBuilding(seed, buildingIds, npc) {
  const id = String(npc?.id || npc?.name || '');
  const rng = makeRng(seedFromString(`${seed}|${id}|building`));
  return buildingIds[rng.int(0, buildingIds.length - 1)];
}

// The one ROOM (within its building) this NPC is placed in. Same NPC + seed + building → same room.
function assignedRoom(seed, structureKey, npc, entryId, others) {
  const id = String(npc?.id || npc?.name || '');
  const rng = makeRng(seedFromString(`${seed}|${structureKey}|${id}|occupancy`));
  const inCommon = others.length === 0 || rng.nextFloat() < COMMON_SHARE;
  return inCommon ? entryId : (others[rng.int(0, others.length - 1)] || entryId);
}

function placeInRooms(seed, structureKey, npcs, topo, targetRoom) {
  const entryId = entryRoomId(topo);
  const others = topo.rooms.map(r => String(r.id)).filter(id => id !== entryId);
  return npcs.filter(npc => assignedRoom(seed, structureKey, npc, entryId, others) === targetRoom);
}

/**
 * occupantsOfRoom(world, structureKey, roomId) -> NPC[]
 * The settlement NPCs deterministically placed in this BUILDING ROOM. Each NPC belongs to one
 * building at the node (multi-building towns split their roster between buildings), then one room
 * within it. A structure with no interior topology falls back to "everyone here". Pure + seeded.
 */
export function occupantsOfRoom(world, structureKey, roomId) {
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nodeId) || null;
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  if (!npcs.length) return [];
  const target = String(structureKey);
  const topo = normalizeTopology(world?.structures?.byId?.[target]?.topology);
  if (!topo || !Array.isArray(topo.rooms) || !topo.rooms.length) return npcs.slice(); // single space
  const seed = world?.meta?.seed ?? '';
  const buildings = nodeBuildings(world, nodeId);
  // One building (or only one resolved) → all the node's people belong here. Several buildings →
  // keep only those this NPC was assigned to, so the roster is split BETWEEN buildings.
  const mine = buildings.length <= 1
    ? npcs
    : npcs.filter(npc => assignedBuilding(seed, buildings, npc) === target);
  return placeInRooms(seed, target, mine, topo, String(roomId));
}
