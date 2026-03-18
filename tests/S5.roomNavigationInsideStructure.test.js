/**
 * Gate S5 — Room Navigation Inside a Structure
 *
 * Player can move between rooms via door adjacency.
 * Current roomId updates in world state.
 * Attempting to move to a non-adjacent room is blocked.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { moveWithinInterior } from '../engine/structures/interiors.js';
import { adjacentRooms } from '../engine/structures/topology.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function worldInsideStructure(seed = 's5') {
  const w0 = ensureWorld({
    meta: { seed },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }],
      edges: [],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
  return playerMove(w0, packsById, 'enter building').world;
}

test('S5: player starts in entry room after entering structure', () => {
  const w = worldInsideStructure('s5-entry');
  const roomId = w.scene?.interior?.roomId;
  assert.ok(roomId, 'must be in a room');
  assert.ok(roomId.includes(':1'), 'entry room should be room 1');
});

test('S5: moving to adjacent room updates roomId', () => {
  const w0 = worldInsideStructure('s5-move');
  const structureKey = w0.scene.interior.structureKey;
  const fromRoomId = w0.scene.interior.roomId;
  const st = w0.structures.byId[structureKey];
  const adj = adjacentRooms(st.topology, fromRoomId);
  assert.ok(adj.length > 0, 'entry room must have at least one adjacent room');

  const w1 = moveWithinInterior(w0, adj[0]);
  assert.equal(w1.scene.interior.roomId, adj[0], 'roomId must update to adjacent room');
  assert.equal(w1.map.currentRoomId, adj[0], 'map.currentRoomId must update too');
});

test('S5: attempting to move to a non-adjacent room is blocked', () => {
  const w0 = worldInsideStructure('s5-block');
  const structureKey = w0.scene.interior.structureKey;
  const fromRoomId = w0.scene.interior.roomId;
  const st = w0.structures.byId[structureKey];
  const allRooms = st.topology.rooms.map(r => r.id);
  const adj = adjacentRooms(st.topology, fromRoomId);
  const nonAdj = allRooms.filter(r => r !== fromRoomId && !adj.includes(r));

  if (nonAdj.length === 0) {
    // All rooms happen to be adjacent — skip the block assertion
    return;
  }

  const w1 = moveWithinInterior(w0, nonAdj[0]);
  assert.equal(
    w1.scene.interior.roomId,
    fromRoomId,
    'moving to non-adjacent room must be blocked — roomId unchanged'
  );
});

test('S5: room navigation is deterministic — same inputs = same roomId', () => {
  const move = () => {
    const w0 = worldInsideStructure('s5-det');
    const structureKey = w0.scene.interior.structureKey;
    const fromRoomId = w0.scene.interior.roomId;
    const st = w0.structures.byId[structureKey];
    const adj = adjacentRooms(st.topology, fromRoomId);
    const w1 = moveWithinInterior(w0, adj[0]);
    return w1.scene.interior.roomId;
  };
  assert.equal(move(), move(), 'room nav must be deterministic');
});

test('S5: can navigate from entry through all adjacent rooms', () => {
  const w0 = worldInsideStructure('s5-chain');
  const structureKey = w0.scene.interior.structureKey;
  const st = w0.structures.byId[structureKey];
  const allRoomIds = new Set(st.topology.rooms.map(r => r.id));
  const visited = new Set();

  let w = w0;
  visited.add(w.scene.interior.roomId);

  // BFS-style: visit all reachable rooms
  let changed = true;
  while (changed) {
    changed = false;
    const current = w.scene.interior.roomId;
    const adj = adjacentRooms(st.topology, current);
    for (const next of adj) {
      if (!visited.has(next)) {
        w = moveWithinInterior(w, next);
        visited.add(next);
        changed = true;
        break;
      }
    }
  }

  // All rooms in a chain+shortcut topology should be reachable from entry
  for (const roomId of allRoomIds) {
    assert.ok(visited.has(roomId), `room ${roomId} must be reachable from entry`);
  }
});
