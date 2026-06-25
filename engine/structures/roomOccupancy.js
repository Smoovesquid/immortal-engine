// Room Occupancy — which settlement NPCs are in a given building room right now. Like roomWindows,
// this is DERIVED state: a pure, deterministic function of (seed + building + npc), not a stored
// field — so no WORLD_VERSION bump, and worldHash stays stable. People gather in a building's
// COMMON / entry room; a seeded minority are off in back rooms, so a private room is usually empty.
//
// This is what lets "look around" name only who is in YOUR room (not the whole settlement), the
// outside peek name who is in the room it sees into, and the climb-in stealth check run against the
// people who would actually see you — instead of treating the entire node roster as "here".

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';

const COMMON_SHARE = 0.7; // ~70% of a building's folk are in its common / entry room

function entryRoomId(topo) {
  const tagged = topo.rooms.find(r => (Array.isArray(r.tags) ? r.tags : []).some(t => String(t).toLowerCase() === 'entry'));
  return String(tagged?.id || topo.rooms[0]?.id || '');
}

// The one room this NPC is deterministically placed in. Same NPC + seed + building → same room.
function assignedRoom(seed, structureKey, npc, entryId, others) {
  const id = String(npc?.id || npc?.name || '');
  const rng = makeRng(seedFromString(`${seed}|${structureKey}|${id}|occupancy`));
  const inCommon = others.length === 0 || rng.nextFloat() < COMMON_SHARE;
  return inCommon ? entryId : (others[rng.int(0, others.length - 1)] || entryId);
}

/**
 * occupantsOfRoom(world, structureKey, roomId) -> NPC[]
 * The settlement NPCs deterministically placed in this building room. A single-space structure
 * (no topology) puts everyone "here". Pure + seeded; the same NPC always lands in the same room.
 */
export function occupantsOfRoom(world, structureKey, roomId) {
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nodeId) || null;
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  if (!npcs.length) return [];
  const st = world?.structures?.byId?.[String(structureKey)];
  const topo = normalizeTopology(st?.topology);
  if (!topo || !Array.isArray(topo.rooms) || !topo.rooms.length) return npcs.slice(); // single space
  const entryId = entryRoomId(topo);
  const others = topo.rooms.map(r => String(r.id)).filter(id => id !== entryId);
  const target = String(roomId);
  const seed = world?.meta?.seed ?? '';
  return npcs.filter(npc => assignedRoom(seed, structureKey, npc, entryId, others) === target);
}
