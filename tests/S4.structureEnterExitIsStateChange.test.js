/**
 * Gate S4 — Structure Enter/Exit Is a Real State Change
 *
 * Entering a structure must set scene.interior with structureKey + roomId.
 * Exiting must clear scene.interior.
 * Re-entering the same structure must produce the identical roomId (determinism).
 * Enter → JSON round-trip → re-enter must produce the same roomId.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function makeWorldWithStructure(seed = 's4') {
  return ensureWorld({
    meta: { seed },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }],
      edges: [],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
}

test('S4: entering a structure sets scene.interior with structureKey and roomId', () => {
  const w0 = makeWorldWithStructure('s4-enter');
  const w1 = playerMove(w0, packsById, 'enter building').world;

  assert.ok(w1.scene?.interior, 'scene.interior must be set after entering');
  assert.ok(
    typeof w1.scene.interior.structureKey === 'string' && w1.scene.interior.structureKey.length > 0,
    'scene.interior.structureKey must be a non-empty string'
  );
  assert.ok(
    typeof w1.scene.interior.roomId === 'string' && w1.scene.interior.roomId.length > 0,
    'scene.interior.roomId must be a non-empty string'
  );
});

test('S4: exiting a structure clears scene.interior', () => {
  const w0 = makeWorldWithStructure('s4-exit');
  const w1 = playerMove(w0, packsById, 'enter building').world;
  assert.ok(w1.scene?.interior, 'must be inside before exit test');

  const w2 = playerMove(w1, packsById, 'exit').world;
  assert.equal(w2.scene?.interior ?? null, null, 'scene.interior must be null after exit');
});

test('S4: re-entering the same structure produces the same roomId', () => {
  const w0 = makeWorldWithStructure('s4-reenter');
  const w1 = playerMove(w0, packsById, 'enter building').world;
  const roomId1 = w1.scene?.interior?.roomId;
  assert.ok(roomId1, 'first enter must set roomId');

  const w2 = playerMove(w1, packsById, 'exit').world;
  assert.equal(w2.scene?.interior ?? null, null, 'must be outside between enters');

  const w3 = playerMove(w2, packsById, 'enter building').world;
  const roomId2 = w3.scene?.interior?.roomId;
  assert.ok(roomId2, 'second enter must set roomId');

  assert.equal(roomId1, roomId2, 're-entering same structure must produce identical roomId');
});

test('S4: enter → JSON round-trip → re-enter produces same roomId', () => {
  const w0 = makeWorldWithStructure('s4-roundtrip');
  const w1 = playerMove(w0, packsById, 'enter building').world;
  const roomId1 = w1.scene?.interior?.roomId;
  assert.ok(roomId1, 'first enter must set roomId');

  const w2 = playerMove(w1, packsById, 'exit').world;

  // Round-trip through JSON (simulates save/load)
  const restored = ensureWorld(JSON.parse(JSON.stringify(w2)));

  const w3 = playerMove(restored, packsById, 'enter building').world;
  const roomId2 = w3.scene?.interior?.roomId;
  assert.ok(roomId2, 're-enter after round-trip must set roomId');

  assert.equal(roomId1, roomId2, 'roomId must be identical after JSON round-trip');
});

test('S4: map.currentStructureId and map.currentRoomId sync with scene.interior', () => {
  const w0 = makeWorldWithStructure('s4-sync');
  const w1 = playerMove(w0, packsById, 'enter building').world;

  assert.equal(
    w1.map?.currentStructureId,
    w1.scene?.interior?.structureKey,
    'map.currentStructureId must equal scene.interior.structureKey'
  );
  assert.equal(
    w1.map?.currentRoomId,
    w1.scene?.interior?.roomId,
    'map.currentRoomId must equal scene.interior.roomId'
  );

  const w2 = playerMove(w1, packsById, 'exit').world;
  assert.equal(w2.map?.currentStructureId || '', '', 'map.currentStructureId must be cleared on exit');
  assert.equal(w2.map?.currentRoomId || '', '', 'map.currentRoomId must be cleared on exit');
});
