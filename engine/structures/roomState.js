// Room State — the shared, DERIVED façade over "what/who is in THIS room right now."
// A thin composition of the existing room-grained derivers (P1 objectsHere, roomOccupancy,
// describeInteriorLayout, roomDetail, roomWindows) into one answer, so every narration/
// dialogue sink reads the SAME room instead of each assembling its own partial view
// (INTERIOR_OBJECT_MODEL §2). Pure + seeded: nothing stored, no WORLD_VERSION bump,
// worldHash untouched — same purity contract as roomObjects.js.

import { describeInteriorLayout } from './interiors.js';
import { normalizeTopology } from './topology.js';
import { roomDetail } from './roomDetail.js';
import { roomWindows } from './roomWindows.js';
import { occupantsOfRoom, outdoorOccupants } from './roomOccupancy.js';
import { objectsHere } from './roomObjects.js';

const OBJECT_CAP = 6;

/**
 * getRoomState(world[, nodeId]) -> {
 *   inside, structureId, roomId,
 *   building: { type, roomCount, singleStorey } | null,
 *   room:     { name, role, dark } | null,
 *   atEntry, doorways,
 *   objects:   [{ name, state, category, notes, nodeIndex }]  (cap 6),
 *   occupants: NPC[],
 *   windows:   { count, shuttered } | null,
 * }
 *
 * nodeId is accepted for forward compatibility with future consumers (P3/P4); the
 * underlying derivers (objectsHere, occupantsOfRoom, roomOccupancy) are keyed off the
 * player's CURRENT position, so a nodeId that doesn't match world.map.currentNodeId
 * degrades to the current-position view rather than throwing.
 */
export function getRoomState(world, nodeId) {
  const currentNodeId = String(world?.map?.currentNodeId ?? '');
  const nid = nodeId != null ? String(nodeId) : currentNodeId;
  const interior = (world?.scene && typeof world.scene.interior === 'object' && world.scene.interior)
    ? world.scene.interior
    : null;
  const inside = Boolean(interior) && nid === currentNodeId;

  const objects = objectsHere(world)
    .slice(0, OBJECT_CAP)
    .map(({ piece, nodeIndex }) => ({
      name: String(piece?.name || ''),
      state: piece?.state != null ? String(piece.state) : null,
      category: piece?.category != null ? String(piece.category) : null,
      notes: piece?.notes != null ? String(piece.notes) : null,
      nodeIndex
    }));

  if (!inside) {
    return {
      inside: false,
      structureId: null,
      roomId: null,
      building: null,
      room: null,
      atEntry: null,
      doorways: [],
      objects,
      occupants: outdoorOccupants(world),
      windows: null
    };
  }

  const structureId = String(interior.structureKey || '');
  const roomId = String(interior.roomId || '');
  const layout = describeInteriorLayout(world);
  const st = world?.structures?.byId?.[structureId];
  const topo = normalizeTopology(st?.topology);
  const room = topo?.rooms?.find(r => String(r.id) === roomId) || null;
  const detail = room ? roomDetail(room, st?.buildingType || null) : null;

  return {
    inside: true,
    structureId,
    roomId,
    building: layout ? { type: layout.buildingType, roomCount: layout.roomCount, singleStorey: true } : null,
    room: detail ? { name: detail.name, role: detail.role, dark: Boolean(detail.dark) } : null,
    atEntry: layout ? layout.atEntry : null,
    doorways: layout ? layout.doorways : [],
    objects,
    occupants: occupantsOfRoom(world, structureId, roomId),
    windows: roomWindows(world, interior)
  };
}
