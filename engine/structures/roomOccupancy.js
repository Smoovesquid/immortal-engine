// Room Occupancy — where each settlement NPC actually is right now. Like roomWindows, this is
// DERIVED state: a pure, deterministic function of (seed + npc + place), not a stored field — so
// no WORLD_VERSION bump, and worldHash stays stable.
//
// Each NPC is placed in ONE spot: either OUTDOORS (out in the open at the node) or INSIDE one of
// the node's buildings, in one of its rooms (folk gather in the common / entry room). This is the
// "who is where" model that look-around reads as LINE OF SIGHT: outdoors you see the people out in
// the open (not the whole town — the rest are indoors); inside you see your room, and you can see
// OUT through windows (the open) and doorways (the next room). No place shows the entire roster.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';

const OUTDOOR_SHARE = 0.35; // ~a third of a settlement's folk are out in the open at any moment
const COMMON_SHARE = 0.7;   // ~70% of a building's indoor folk are in its common / entry room

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

// The one PLACE this NPC occupies: 'outdoors' or a building id. Deterministic per (seed, npc).
function assignedPlace(seed, buildingIds, npc) {
  const id = String(npc?.id || npc?.name || '');
  const rng = makeRng(seedFromString(`${seed}|${id}|place`));
  if (!buildingIds.length || rng.nextFloat() < OUTDOOR_SHARE) return 'outdoors';
  return buildingIds[rng.int(0, buildingIds.length - 1)];
}

// The one ROOM (within its building) this NPC stands in. Folk gather in the common / entry room.
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

function nodeRoster(world) {
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nodeId) || null;
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  return { nodeId, npcs, seed: world?.meta?.seed ?? '' };
}

/**
 * occupantsOfRoom(world, structureKey, roomId) -> NPC[]
 * The settlement NPCs deterministically placed in this BUILDING ROOM. Each NPC is either outdoors
 * or in one building+room; this returns those in the given room. A structure with no interior
 * topology falls back to "everyone here" (the bare test fixtures). Pure + seeded.
 */
export function occupantsOfRoom(world, structureKey, roomId) {
  const { nodeId, npcs, seed } = nodeRoster(world);
  if (!npcs.length) return [];
  const target = String(structureKey);
  const topo = normalizeTopology(world?.structures?.byId?.[target]?.topology);
  if (!topo || !Array.isArray(topo.rooms) || !topo.rooms.length) return npcs.slice(); // single space
  const buildings = nodeBuildings(world, nodeId);
  const mine = npcs.filter(npc => assignedPlace(seed, buildings, npc) === target);
  return placeInRooms(seed, target, mine, topo, String(roomId));
}

/**
 * outdoorOccupants(world) -> NPC[]
 * The settlement NPCs who are OUT IN THE OPEN at the node right now — what you see when you look
 * around outdoors (line of sight), and what you glimpse through an unshuttered window from inside.
 * The rest of the roster is indoors and out of sight. Pure + seeded.
 */
export function outdoorOccupants(world) {
  const { nodeId, npcs, seed } = nodeRoster(world);
  if (!npcs.length) return [];
  const buildings = nodeBuildings(world, nodeId);
  return npcs.filter(npc => assignedPlace(seed, buildings, npc) === 'outdoors');
}
