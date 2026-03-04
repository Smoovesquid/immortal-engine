import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinimalWorld } from '../engine/world/minimalWorld.js';

function pickNode(world, nodeId) {
  const n = world.nodes.find(x => x.id === nodeId);
  assert.ok(n, `missing node ${nodeId}`);
  return n;
}

test('U44: Gate A2 Structure Layer — same seed + same nodeId => identical structures (projection-only)', () => {
  const seed = 'U44-seed';

  const wA = createMinimalWorld({ seed });
  const wB = createMinimalWorld({ seed });

  const nodeId = 'node-1';
  const a = pickNode(wA, nodeId);
  const b = pickNode(wB, nodeId);

  assert.ok(Array.isArray(a.structures), 'missing structures[]');
  assert.ok(Array.isArray(b.structures), 'missing structures[]');

  assert.deepEqual(
    a.structures.map(s => ({ id: s.id, name: s.name, tags: s.tags, surfaces: s.surfaces })),
    b.structures.map(s => ({ id: s.id, name: s.name, tags: s.tags, surfaces: s.surfaces }))
  );

  for (const st of a.structures) {
    for (const ref of st.surfaces) {
      const surface = a.surfaces.find(x => x.id === ref.id);
      assert.ok(surface, `structure surface ref missing: ${ref.id}`);
      assert.equal(surface.canonical, false, 'surface should be latent by default');
    }
  }
});
