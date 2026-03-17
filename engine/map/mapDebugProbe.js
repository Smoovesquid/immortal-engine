import { worldHash } from '../util/worldHash.js';

function numberOr(v, fallback = 0) {
  return Number.isFinite(v) ? Number(v) : fallback;
}

export function buildMapDebugProbe(world, options = {}) {
  const actorIndex = Number.isInteger(options.actorIndex) ? options.actorIndex : 0;
  const actor = Array.isArray(world?.party) ? world.party[actorIndex] || null : null;

  const canonicalPosition = actor && actor.position && typeof actor.position === 'object'
    ? {
      localFtX: numberOr(actor.position.localFtX, 0),
      localFtY: numberOr(actor.position.localFtY, 0),
      raw: actor.position
    }
    : { localFtX: 0, localFtY: 0, raw: null };

  const isInterior = Boolean(world?.scene?.interior);

  // Matches LocalMap renderer conversion parameters.
  const feetPerSquare = 5;
  const exterior = { size: 61, cellPx: 14 };
  const interior = { pixelsPerFiveFt: 12 };

  const projectionCoordinates = isInterior
    ? {
      mode: 'interior',
      roomId: String(world?.scene?.interior?.roomId || ''),
      structureKey: String(world?.scene?.interior?.structureKey || ''),
      offsetPxX: (canonicalPosition.localFtX / feetPerSquare) * interior.pixelsPerFiveFt,
      offsetPxY: (canonicalPosition.localFtY / feetPerSquare) * interior.pixelsPerFiveFt
    }
    : {
      mode: 'exterior',
      nodeId: String(world?.map?.currentNodeId || ''),
      offsetPxX: (canonicalPosition.localFtX / feetPerSquare) * exterior.cellPx,
      offsetPxY: (canonicalPosition.localFtY / feetPerSquare) * exterior.cellPx,
      markerPxX: Math.floor(exterior.size / 2) * exterior.cellPx + (exterior.cellPx / 2) + ((canonicalPosition.localFtX / feetPerSquare) * exterior.cellPx),
      markerPxY: Math.floor(exterior.size / 2) * exterior.cellPx + (exterior.cellPx / 2) + ((canonicalPosition.localFtY / feetPerSquare) * exterior.cellPx)
    };

  let stateHash = null;
  try {
    stateHash = worldHash(world);
  } catch (_) {
    stateHash = null;
  }

  return {
    world_state_hash: stateHash,
    primary_actor_id: actor ? String(actor.id || actor.actorId || actor.name || 'unknown') : 'unknown',
    canonical_actor_position: canonicalPosition,
    current_scene_node: {
      scene: world?.scene || null,
      currentNodeId: String(world?.map?.currentNodeId || '')
    },
    map_projection_coordinates: projectionCoordinates,
    spatial_scale_parameters: {
      feetPerSquare,
      exterior,
      interior
    }
  };
}

export function runMapDebugProbe(world, options = {}) {
  const snapshot = buildMapDebugProbe(world, options);
  const printer = typeof options.print === 'function' ? options.print : console.log;
  printer(JSON.stringify(snapshot, null, 2));
  return snapshot;
}
