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
//
// MR-2d (docs/briefs/MR-2-FUNCTIONAL-INK.md §2d): a window is a real APERTURE — sight
// passes through the glass it FACES, never through a wall. visibleThroughWindows() makes
// good on this header's own promise ("you can see OUT through windows"): from inside a
// windowed room you see the slice of outdoor folk on the sides the room's windows look
// onto (each with their OCC-STORY reason and a side label), and NOT the folk standing on
// a side no window faces. Still a PURE derived read — a function of (seed + who's outdoors
// + the room's window facings) — so no stored field, no WORLD_VERSION bump, worldHash
// untouched.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';
import { placementFor } from './storyAnchors.js';
import { roomWindows, roomWindowFacings } from './roomWindows.js';

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

// ── MR-2d: line of sight THROUGH a window ────────────────────────────────────
// A window is an aperture with a FACING, not an x-ray. Sight through it reaches only
// the outdoor folk standing on the side the glass looks onto. Outdoor occupants carry
// no region-cell position in v1 (they're "at the node, in the open"), so the simplest
// CORRECT geometry is a deterministic 4-sector bearing: each outdoor person is assigned
// one fixed COMPASS BEARING for this world (a stable side of the settlement they're on),
// and a room's windows see a person iff that person's bearing sector matches one of the
// window facings. This respects facing (a north window can't see the south side), is
// pure/seeded (same world → same view), and can never see through a wall (a windowless
// or wrong-facing room returns nobody). No ray-casting — this is v1, PINNED below.

// The four 90° compass sectors, N centred on 0°/360°. A bearing lands in exactly one.
// PINNED: N=[315,45), E=[45,135), S=[135,225), W=[225,315). Changing these boundaries
// changes who a window sees, so they are constants, not magic numbers inline.
const SECTOR_N_LO = 315, SECTOR_E_LO = 45, SECTOR_S_LO = 135, SECTOR_W_LO = 225;
function sectorOfBearing(deg) {
  const d = ((Number(deg) % 360) + 360) % 360;
  if (d >= SECTOR_N_LO || d < SECTOR_E_LO) return 'north';
  if (d < SECTOR_S_LO) return 'east';
  if (d < SECTOR_W_LO) return 'south';
  return 'west';
}

// The fixed side of the settlement this outdoor NPC stands on, for this world. Seeded per
// (seed, npc) so it's stable across turns and identical under replay — the same person is
// always on the same side, exactly as their story anchor is always their story anchor.
function outdoorBearing(seed, npc) {
  return makeRng(seedFromString(`${seed}|${String(npc?.id || npc?.name || '')}|window-bearing`)).int(0, 359);
}

// Which SIDE a window looks onto, as a short narratable label — derived from the room's
// window outlook (roomWindows), falling back to a compass side. Never a place-name (line
// of sight is honored elsewhere): "the road side", "the yard side", "the street side",
// "the open ground", or "the north side". A FIXED map so the label can't drift.
const OUTLOOK_SIDE = Object.freeze({
  'onto the road': 'the road side',
  'onto the yard': 'the yard side',
  'onto the street below': 'the street side',
  'onto the open ground beyond': 'the open ground',
});
function windowSide(outlook, facing) {
  const byOutlook = OUTLOOK_SIDE[String(outlook || '')];
  if (byOutlook) return byOutlook;
  return facing ? `the ${facing} side` : 'the open';
}

/**
 * visibleThroughWindows(world, structureKey, roomId) -> NPC[]
 * The outdoor settlement folk you can SEE from inside this room through its windows —
 * only those on a side one of the room's windows FACES (never through a wall). Each
 * returned occupant is a shallow clone carrying its OCC-STORY `reason` AND an additive
 * `side` label (which side the glass looks onto, e.g. "the road side"). Empty when the
 * room has no windows, its windows are shuttered, or no outdoor person is within the arc.
 * Hostiles are excluded — a lurker keeping to the edges is not a face at your window.
 * Pure + seeded + deterministic; writes nothing.
 */
export function visibleThroughWindows(world, structureKey, roomId) {
  const interior = { structureKey: String(structureKey), roomId: String(roomId) };
  const win = roomWindows(world, interior);
  if (!win.count || win.shuttered) return [];        // no glass, or the shutters are drawn
  const facings = roomWindowFacings(world, interior);
  if (!facings.length) return [];                    // no facing arc → sees nothing outdoors
  const arc = new Set(facings.map(String));
  const side = windowSide(win.outlook, facings[0]);  // the room's near outlook / first facing

  const seed = String(world?.meta?.seed ?? '');
  const out = [];
  for (const npc of outdoorOccupants(world)) {
    if (!npc || npc.hostile) continue;               // lurkers don't wave through the glass
    if (arc.has(sectorOfBearing(outdoorBearing(seed, npc)))) {
      out.push({ ...npc, side });                    // reason already rode along from outdoorOccupants
    }
  }
  return out;
}

/**
 * occupiedWindowsFromOutside(world) -> boolean
 * The MIRROR of visibleThroughWindows for the outdoor look-around: is there at least one
 * building at the current node whose UNSHUTTERED, EXTERIOR-facing room is occupied — so a
 * window "reads" from the street (a shape moving within, a lit room)? This is line of
 * sight, NOT x-ray: it reports only THAT a room reads through its glass, never a roster
 * (the caller renders one capped texture line, no names — you catch movement from the
 * open, not identities). Skips the player's OWN home (you're outside it) and any building
 * with no occupied lit window. Pure + deterministic; writes nothing.
 */
export function occupiedWindowsFromOutside(world) {
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const wakeKey = homeStructureKey(world);
  const byId = world?.structures?.byId || {};
  for (const st of Object.values(byId)) {
    if (!st || String(st.nodeId || '') !== nodeId) continue;
    const key = String(st.id);
    if (key === wakeKey) continue;                    // you're standing outside your own home
    const topo = normalizeTopology(st.topology);
    if (!topo || !Array.isArray(topo.rooms) || !topo.rooms.length) continue;
    for (const room of topo.rooms) {
      const rid = String(room.id);
      const win = roomWindows(world, { structureKey: key, roomId: rid });
      if (!win.count || win.shuttered) continue;      // no glass to read through
      if (occupantsOfRoom(world, key, rid).some(n => n && !n.hostile)) return true;
    }
  }
  return false;
}
