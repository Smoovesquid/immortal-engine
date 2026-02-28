import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinimalWorld, newScene } from '../engine/world/minimalWorld.js';

test('U4: New Scene produces required structural elements over 20 turns', () => {
  const world = createMinimalWorld({ seed: 'alpha' });

  for (let i = 0; i < 20; i++) {
    world.turn = i;
    const scene = newScene(world);

    assert.ok(scene.interactables.length >= 3);
    assert.ok(scene.pressureSignal);
    assert.ok(scene.choiceFork.length >= 1);
  }
});
