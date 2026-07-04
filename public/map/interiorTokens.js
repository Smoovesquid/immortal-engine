// MAP-OCC-1b — the interior floor plan draws the engine's ACTUAL room occupants.
// Sibling of MAP-OCC-1 (placeFromNode.js outdoor tokens): LocalMap.js used to seed-scatter
// the whole settlement roster across whichever rooms you'd discovered — the map inventing
// people in rooms the engine says are empty (the same fiction break the CG-1b ghost-voice
// canon caught). This helper is the single truth source for interior people-tokens:
// one {roomId, nkey} per engine-placed occupant of a DISCOVERED room. Undiscovered rooms
// keep their occupants off the sheet (knowledge rule). Pure + read-only over world.
import { occupantsOfRoom } from '../../engine/structures/roomOccupancy.js';

export function interiorPeopleTokens(world, structureKey, discoveredRoomIds) {
  const out = [];
  const key = String(structureKey || '');
  if (!key) return out;
  for (const rid of (discoveredRoomIds || [])) {
    const occ = occupantsOfRoom(world, key, String(rid)) || [];
    for (let i = 0; i < occ.length; i++) {
      const n = occ[i] || {};
      out.push({ roomId: String(rid), nkey: String(n.id || n.name || ('npc' + i)) });
    }
  }
  return out;
}
