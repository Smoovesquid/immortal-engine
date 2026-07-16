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
  // CORPSE-TRUTH-1b — a dead occupant keeps its token (the body is in the room)
  // but carries the dead flag so the sheet draws a fallen mark, never a living ring.
  const deadIds = new Set(remainsAtNode(world, String(world?.map?.currentNodeId || '')).filter(r => r.sourceNpcId).map(r => String(r.sourceNpcId)));
  for (const rid of (discoveredRoomIds || [])) {
    const occ = occupantsOfRoom(world, key, String(rid)) || [];
    for (let i = 0; i < occ.length; i++) {
      const n = occ[i] || {};
      out.push({ roomId: String(rid), nkey: String(n.id || n.name || ('npc' + i)), dead: deadIds.has(String(n.id || '')) ? 1 : 0 });
    }
  }
  return out;
}
