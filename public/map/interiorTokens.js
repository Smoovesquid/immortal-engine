// MAP-OCC-1b — the interior floor plan draws the engine's ACTUAL room occupants.
// Sibling of MAP-OCC-1 (placeFromNode.js outdoor tokens): LocalMap.js used to seed-scatter
// the whole settlement roster across whichever rooms you'd discovered — the map inventing
// people in rooms the engine says are empty (the same fiction break the CG-1b ghost-voice
// canon caught). This helper is the single truth source for interior people-tokens:
// one {roomId, nkey} per engine-placed occupant of a DISCOVERED room. Undiscovered rooms
// keep their occupants off the sheet (knowledge rule). Pure + read-only over world.
import { occupantsOfRoom } from '../../engine/structures/roomOccupancy.js';
// CORPSE-TRUTH-1b — the one canonical "what bodies lie here" read (deathFact.js).
import { remainsAtNode } from '../../engine/combat/deathFact.js';

export function interiorPeopleTokens(world, structureKey, discoveredRoomIds) {
  const out = [];
  const key = String(structureKey || '');
  if (!key) return out;
  const discovered = (discoveredRoomIds || []).map(String);
  const discoveredSet = new Set(discovered);
  // CORPSE-TRUTH-1 finish (2026-07-16) — a LOCATED body (post-feature fact,
  // r.loc present) draws in its DEATH room, pinned by canon, and leaves the
  // living-occupancy feed (a corpse has no story anchor to walk back to). A
  // LEGACY dead occupant (no loc — pre-feature kill) keeps the old behavior:
  // its token stays where occupancy anchors it, flagged dead — honest
  // node-level truth with no invented room.
  const remains = remainsAtNode(world, String(world?.map?.currentNodeId || ''));
  const locatedDeadIds = new Set(remains.filter(r => r.sourceNpcId && r.loc).map(r => String(r.sourceNpcId)));
  const legacyDeadIds = new Set(remains.filter(r => r.sourceNpcId && !r.loc).map(r => String(r.sourceNpcId)));
  for (const rid of discovered) {
    const occ = occupantsOfRoom(world, key, String(rid)) || [];
    for (let i = 0; i < occ.length; i++) {
      const n = occ[i] || {};
      const nid = String(n.id || '');
      if (locatedDeadIds.has(nid)) continue; // its body draws at the death room below
      out.push({ roomId: String(rid), nkey: String(n.id || n.name || ('npc' + i)), dead: legacyDeadIds.has(nid) ? 1 : 0 });
    }
  }
  // The death-room corpse tokens — NPC and monster alike, for THIS structure
  // only, in DISCOVERED rooms only (the knowledge rule holds for the dead too).
  for (const r of remains) {
    if (!r.loc || String(r.loc.structureId || '') !== key) continue;
    const rid = String(r.loc.roomId || '');
    if (!rid || !discoveredSet.has(rid)) continue;
    out.push({ roomId: rid, nkey: String(r.sourceNpcId || `remains:${r.t != null ? r.t : String(r.name || '')}`), dead: 1 });
  }
  return out;
}
