// ============================================================================
// ⚠️  DEAD PROTOTYPE — DO NOT BUILD ON THIS FILE.  (quarantined by PW-6, 2026-07-06)
// ----------------------------------------------------------------------------
// The abandoned CANON_CREATE proof-of-concept: it "collapses" a latent surface
// on the MINIMAL-WORLD prototype shape (`world.nodes[].surfaces`, see
// engine/world/minimalWorld.js) — NOT the live world (`world.map.nodes`). It also
// mutates the world DIRECTLY (spread copies below) instead of routing through
// engine/effectsCore.applyDeltas, which is why it is a sandbox toy, not a seam.
// Superseded by the LANDED prose-to-world arc (PW-1..PW-5); the real design and
// the reasons this file is dark are in docs/briefs/PROSE_TO_WORLD_CONTRACT.md
// (see §1b). Its only importers are the minimalWorld sandbox and the U8 /
// latentProjection determinism tests — kept solely to keep those green. If the
// minimalWorld sandbox is retired, delete this file with it. Do NOT extend it.
// ============================================================================
import crypto from 'node:crypto';

import { canonizeSurface } from '../csl/latent.js';
import { appendCanonEvent } from '../csl/canonLog.js';

function deterministicChildId(seed, parentId) {
  const h = crypto.createHash('sha256').update(seed + ':' + parentId).digest('hex');
  return parentId + '-child-' + h.slice(0, 6);
}

function resolveSurfaceContact(world, { nodeId, surfaceId, actionKey }) {
  const nodeIndex = world.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return world;

  const node = world.nodes[nodeIndex];
  const surfaceIndex = node.surfaces.findIndex((s) => s.id === surfaceId);
  if (surfaceIndex === -1) return world;

  const latentSurface = node.surfaces[surfaceIndex];

  const { surface: updatedSurface, events } = canonizeSurface(latentSurface, {
    seed: world.seed,
    actionKey
  });

  let updatedCanonLog = world.canonLog;
  for (const evt of events) {
    updatedCanonLog = appendCanonEvent(updatedCanonLog, evt);
  }

  const childId = deterministicChildId(world.seed, latentSurface.id);

  const newLatentSurface = {
    id: childId,
    canonical: false,
    sockets: [
      {
        id: childId + '-socket-0',
        kind: 'container',
        affordance: 'open',
        state: 'latent'
      }
    ]
  };

  const updatedNode = {
    ...node,
    surfaces: [
      ...node.surfaces.slice(0, surfaceIndex),
      updatedSurface,
      ...node.surfaces.slice(surfaceIndex + 1),
      newLatentSurface
    ]
  };

  const updatedNodes = [
    ...world.nodes.slice(0, nodeIndex),
    updatedNode,
    ...world.nodes.slice(nodeIndex + 1)
  ];

  return {
    ...world,
    nodes: updatedNodes,
    canonLog: updatedCanonLog
  };
}

export { resolveSurfaceContact };
