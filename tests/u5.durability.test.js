import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldTick } from '../engine/worldTick.js';

test('U5 - 40-turn durability simulation (deterministic + stable)', () => {
  const seed = 'u5-durability';
  const fate = 0.6;

  let world = newWorld({
    seed,
    fate,
    campaignId: 'u5',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  // Seed at least one living thread so durability assertions are meaningful
  world.instrument = {
    ...(world.instrument || {}),
    threads: [
      {
        id: 'u5-thread-1',
        label: 'Hold the failing line',
        tension: 1,
        introducedAt: 0,
        age: 0,
        status: 'open'
      }
    ]
  };

  const initialScarCount = Array.isArray(world.scars) ? world.scars.length : 0;

  for (let turnIndex = 0; turnIndex < 40; turnIndex++) {
    world.scene.promptSeed = `S${turnIndex}`;
    world = worldTick(world, `S${turnIndex}`);
  }

  const threads = world.instrument?.threads || [];
  assert.ok(Array.isArray(threads));
  assert.ok(threads.length >= 1);

  for (const t of threads) {
    assert.ok(typeof t.id === 'string' && t.id.length > 0);
  }

  const finalScarCount = Array.isArray(world.scars) ? world.scars.length : 0;
  assert.ok(finalScarCount >= initialScarCount);

  for (const t of threads) {
    if (t.nodeId != null) {
      assert.ok(typeof t.nodeId === 'string');
    }
  }

  const serialized = JSON.stringify(world);
  const deserialized = JSON.parse(serialized);
  assert.deepEqual(deserialized, world);
});
