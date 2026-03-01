import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, resolveSurfaceContact } from '../engine/world/minimalWorld.js';

function snapshot(world) {
  return world.nodes.map(n => ({
    id: n.id,
    surfaces: n.surfaces.map(s => ({
      id: s.id,
      canonical: s.canonical
    }))
  }));
}

test('U8: expansion is replay deterministic', () => {
  const seed = 'u8-replay-seed';

  const worldA0 = createWorld({ seed });
  const node = worldA0.nodes[0];
  const surface = node.surfaces[0];

  const worldA1 = resolveSurfaceContact(worldA0, {
    nodeId: node.id,
    surfaceId: surface.id,
    actionKey: 'open'
  });

  const snapA = snapshot(worldA1);

  const worldB0 = createWorld({ seed });

  const worldB1 = resolveSurfaceContact(worldB0, {
    nodeId: worldB0.nodes[0].id,
    surfaceId: worldB0.nodes[0].surfaces[0].id,
    actionKey: 'open'
  });

  const snapB = snapshot(worldB1);

  assert.deepEqual(snapA, snapB);
});
