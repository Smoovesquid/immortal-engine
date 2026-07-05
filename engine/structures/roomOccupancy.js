// Room Occupancy — where each settlement NPC actually is right now. Like roomWindows, this is
// DERIVED state: a pure, deterministic function of (seed + npc + place), not a stored field — so
// no WORLD_VERSION bump, and worldHash stays stable.
//
// Each NPC is placed in ONE spot: either OUTDOORS (out in the open at the node) or INSIDE one of
// the node's buildings, in one of its rooms (folk gather in the common / entry room). This is the
// "who is where" model that look-around reads as LINE OF SIGHT: outdoors you see the people out in
// the open (not the whole town — the rest are indoors); inside you see your room, and you can see
// OUT through windows (the open) and doorways (the next room). No place shows the entire roster.
//
// OCC-STORY-1: WHICH building an NPC occupies is no longer a blind hash-scatter over whatever
// happened to be materialized (which dumped everyone — the hostile bandit included — into the
// sleeping player's cottage, the one building materialized at dawn). It is a STORY ANCHOR derived
// from who the NPC is (engine/structures/storyAnchors.js): the smith is at the smithy, the innkeeper
// at the inn, folk move by time of day, hostiles keep to the edges, and the player's own home is
// never a stranger's anchor. Every returned occupant carries an additive `reason` (why they're
// there) — narration fuel. The line-of-sight model is UNCHANGED: only who-is-where moved, and the
// common/back room split within a building is still the seeded ~70% gather in the entry room.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';
import { placementFor } from './storyAnchors.js';

const COMMON_SHARE = 0.7;   // ~70% of a building's indoor folk are in its common / entry room

function entryRoomId(topo) {
  const tagged = topo.rooms.find(r => (Array.isArray(r.tags) ? r.tags : []).some(t => String(t).toLowerCase() === 'entry'));
  return String(tagged?.id || topo.rooms[0]?.id || '');
}

// The one ROOM (within its building) this NPC stands in. Folk gather in the common / entry room.
function assignedRoom(seed, structureKey, npc, entryId, others) {
  const id = String(npc?.id || npc?.name || '');
  const rng = makeRng(seedFromString(`${seed}|${structureKey}|${id}|occupancy`));
  const inCommon = others.length === 0 || rng.nextFloat() < COMMON_SHARE;
  return inCommon ? entryId : (others[rng.int(0, others.length - 1)] || entryId);
}

// Each placed NPC is returned as a shallow clone carrying its story `reason` (why they're here). We
// clone rather than mutate so the reason never leaks onto the stored roster record (which would
// dirty worldHash / persist across turns) — occupancy is a read, it writes nothing.
function withReason(npc, reason) {
  return { ...npc, reason: String(reason || '') };
}

// The player's home structure key — the first materialized structure at meta.homeNodeId, the cottage
// the player wakes in. No stranger is ever anchored here (that was the whole OCC-STORY-1 bug). Empty
// string when there is no home concept (bare fixtures, non-home nodes) — then nothing is excluded.
function homeStructureKey(world) {
  const homeNode = String(world?.meta?.homeNodeId ?? '');
  if (!homeNode) return '';
  const byId = world?.structures?.byId || {};
  const here = Object.values(byId)
    .filter(s => s && String(s.nodeId || '') === homeNode)
    .map(s => String(s.id))
    .sort((a, b) => a.localeCompare(b));
  return here[0] || '';
}

function placeInRooms(seed, structureKey, placed, topo, targetRoom) {
  // `placed` are { npc, reason } — already resolved to THIS building by their story anchor; here we
  // only split them across the building's rooms (folk gather in the common/entry room). The reason
  // rides along onto each returned occupant.
  const entryId = entryRoomId(topo);
  const others = topo.rooms.map(r => String(r.id)).filter(id => id !== entryId);
  return placed
    .filter(p => assignedRoom(seed, structureKey, p.npc, entryId, others) === targetRoom)
    .map(p => withReason(p.npc, p.reason));
}

function nodeRoster(world) {
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nodeId) || null;
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  return { nodeId, npcs, seed: world?.meta?.seed ?? '', wakeKey: homeStructureKey(world) };
}

/**
 * occupantsOfRoom(world, structureKey, roomId) -> NPC[]
 * The settlement NPCs whose STORY ANCHOR puts them in this BUILDING ROOM right now. Each NPC is
 * either outdoors or anchored to one building; this returns those anchored to `structureKey` and, of
 * those, the ones in the given room (folk gather in the common/entry room). A structure with no
 * interior topology falls back to "everyone here" (the bare test fixtures). Each returned occupant
 * carries an additive `reason`. Pure + seeded + deterministic.
 */
export function occupantsOfRoom(world, structureKey, roomId) {
  const { nodeId, npcs, seed, wakeKey } = nodeRoster(world);
  if (!npcs.length) return [];
  const target = String(structureKey);
  const topo = normalizeTopology(world?.structures?.byId?.[target]?.topology);
  if (!topo || !Array.isArray(topo.rooms) || !topo.rooms.length) {
    // Single-space fallback (unresolved / topology-less structure): everyone at the node is "here".
    return npcs.map(npc => withReason(npc, 'here'));
  }
  const placed = [];
  for (const npc of npcs) {
    const p = placementFor(world, npc, { nodeId, seed, wakeKey });
    if (p.where === 'building' && String(p.key) === target) placed.push({ npc, reason: p.reason });
  }
  return placeInRooms(seed, target, placed, topo, String(roomId));
}

/**
 * outdoorOccupants(world) -> NPC[]
 * The settlement NPCs who are OUT IN THE OPEN at the node right now — what you see when you look
 * around outdoors (line of sight), and what you glimpse through an unshuttered window from inside.
 * The rest of the roster is indoors (at their story anchors) and out of sight. Each returned occupant
 * carries an additive `reason` (on errands, up to something, a hostile keeping to the edges). Pure.
 */
export function outdoorOccupants(world) {
  const { nodeId, npcs, seed, wakeKey } = nodeRoster(world);
  if (!npcs.length) return [];
  const out = [];
  for (const npc of npcs) {
    const p = placementFor(world, npc, { nodeId, seed, wakeKey });
    if (p.where === 'outdoors') out.push(withReason(npc, p.reason));
  }
  return out;
}
