import { forestDomain } from '../csl/domains/forest.js';
import { generateLatentSurfacesForNode } from '../scene/latentProjection.js';
import { createCanonLog } from '../csl/canonLog.js';
import { projectStructuresForNode } from './structures.js';

function createMinimalWorld({ seed }) {
  if (!seed) {
    throw new Error('MinimalWorld: seed required');
  }

  const nodes = [];
  const nodeCount = 5;

  for (let i = 0; i < nodeCount; i++) {
    const nodeId = 'node-' + i;

    const surfaces = generateLatentSurfacesForNode({
      seed,
      domain: forestDomain,
      nodeId,
      count: 3
    });

    nodes.push({
      id: nodeId,
      domainId: forestDomain.domainId,
      surfaces,
      structures: projectStructuresForNode({ nodeId, surfaces })
    });
  }

  return {
    seed,
    nodes,
    canonLog: createCanonLog(),
    pressure: 0,
    turn: 0
  };
}

function newScene(world) {
  const nodeIndex = world.turn % world.nodes.length;
  const node = world.nodes[nodeIndex];

  const interactables = node.surfaces.filter(s => !s.canonical);

  const pressureSignal = {
    level: world.pressure,
    band: world.pressure < 3 ? 'low' : world.pressure < 6 ? 'mid' : 'high'
  };

  const choiceFork = interactables.slice(0, 2).map(s => ({
    targetId: s.id,
    affordances: s.sockets.map(sock => sock.affordance)
  }));

  const callbackHook =
    world.canonLog.events.length > 0
      ? world.canonLog.events[world.canonLog.events.length - 1].targetId
      : null;

  return {
    nodeId: node.id,
    interactables,
    pressureSignal,
    choiceFork,
    callbackHook
  };
}

export { createMinimalWorld, newScene };

function createWorld(opts) {
  return createMinimalWorld(opts);
}

function worldTick(world) {
  const nextTurn = world.turn + 1;
  const nextPressure = world.pressure + 1;

  return {
    ...world,
    turn: nextTurn,
    pressure: nextPressure
  };
}

export { createWorld, worldTick };

import { resolveSurfaceContact } from './resolveSurfaceContact.js';
export { resolveSurfaceContact };
