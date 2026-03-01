import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, resolveSurfaceContact } from '../engine/world/minimalWorld.js';

function countAllSurfaces(world) {
  return world.nodes.reduce((sum, n) => sum + n.surfaces.length, 0);
}

test('U8: resolving a surface increases structural surface count deterministically', () => {
  const seed = 'u8-expansion-seed';
  const world0 = createWorld({ seed });

  const node = world0.nodes[0];
  const surface = node.surfaces[0];

  const beforeCount = countAllSurfaces(world0);

  const world1 = resolveSurfaceContact(world0, {
    nodeId: node.id,
    surfaceId: surface.id,
    actionKey: 'open'
  });

  const afterCount = countAllSurfaces(world1);

  // For now this should FAIL until we implement expansion logic.
  assert.ok(afterCount > beforeCount);
});
