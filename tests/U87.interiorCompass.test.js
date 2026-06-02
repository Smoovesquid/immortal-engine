/**
 * U87 — Interior cardinal navigation has a real reciprocal compass.
 *
 * Regression for the "infinite south" bug: inside a structure you could walk
 * one direction forever because pickAdjacentInteriorByDirection folded every
 * direction onto an existing doorway (`idx % exits.length`). Interiors now use
 * the same reciprocal compass the overland map has — a direction with no doorway
 * is genuinely a wall, and the playloop only narrates a move when the room id
 * actually changes (not merely when ensureWorld() hands back a fresh object).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { interiorCompassLayout, interiorExitsFrom } from '../engine/structures/topology.js';

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DIRS = ['north', 'east', 'south', 'west'];

function sampleTopologies() {
  return [
    // chain a-b-c-d
    {
      kind: 'rooms',
      rooms: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'd' }]
    },
    // hub with three spokes
    {
      kind: 'rooms',
      rooms: [{ id: 'h' }, { id: 'x' }, { id: 'y' }, { id: 'z' }],
      edges: [{ a: 'h', b: 'x' }, { a: 'h', b: 'y' }, { a: 'h', b: 'z' }]
    },
    // small loop a-b-c-a
    {
      kind: 'rooms',
      rooms: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'a' }]
    }
  ];
}

test('U87: interior compass exits are reciprocal — north then south returns you', () => {
  for (const topo of sampleTopologies()) {
    const layout = interiorCompassLayout(topo);
    for (const room of topo.rooms) {
      const exits = layout.get(room.id) || {};
      for (const dir of DIRS) {
        const nb = exits[dir];
        if (!nb) continue;
        const back = (layout.get(nb) || {})[OPPOSITE[dir]];
        assert.equal(back, room.id, `non-reciprocal: ${room.id} --${dir}--> ${nb}, back-${OPPOSITE[dir]} = ${back}`);
      }
    }
  }
});

test('U87: interior compass is deterministic across recomputes', () => {
  for (const topo of sampleTopologies()) {
    const a = interiorCompassLayout(topo);
    const b = interiorCompassLayout(topo);
    for (const room of topo.rooms) {
      assert.deepEqual(a.get(room.id), b.get(room.id), `unstable layout at ${room.id}`);
    }
  }
});

test('U87: no interior direction points to two different rooms', () => {
  for (const topo of sampleTopologies()) {
    const layout = interiorCompassLayout(topo);
    for (const room of topo.rooms) {
      const exits = layout.get(room.id) || {};
      const targets = DIRS.map(d => exits[d]).filter(Boolean);
      assert.equal(targets.length, new Set(targets).size, `duplicate compass targets at ${room.id}`);
    }
  }
});

test('U87: interiorExitsFrom shape is always the four cardinal keys', () => {
  const exits = interiorExitsFrom(sampleTopologies()[0], 'a');
  assert.deepEqual(Object.keys(exits).sort(), ['east', 'north', 'south', 'west']);
});

// ── Integration: the actual infinite-travel repro ────────────────────────────

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function worldInsideStructure(seed = 'u87') {
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

test('U87: walking one direction repeatedly terminates at a wall (no infinite travel)', () => {
  for (const dir of DIRS) {
    let w = worldInsideStructure(`u87-walk-${dir}`);
    let moves = 0;
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      const before = String(w.scene?.interior?.roomId || '');
      w = playerMove(w, packsById, `go ${dir}`).world;
      const after = String(w.scene?.interior?.roomId || '');
      if (after === before) { blocked = true; break; }
      moves++;
    }
    assert.ok(blocked, `walking ${dir} never hit a wall after ${moves} moves — infinite travel`);
    // A 3-4 room structure can never allow 12 same-direction moves.
    assert.ok(moves <= 4, `walked ${dir} ${moves} times — more than the room count allows`);
  }
});

test('U87: a no-op directional move does not narrate a successful move', () => {
  let w = worldInsideStructure('u87-noop');
  // Find a direction with no doorway from the entry room.
  const startRoom = String(w.scene.interior.roomId);
  const st = w.structures.byId[w.scene.interior.structureKey];
  const exits = interiorExitsFrom(st.topology, startRoom);
  const wall = DIRS.find(d => !exits[d]);
  assert.ok(wall, 'entry room should have at least one wall direction');

  const res = playerMove(w, packsById, `go ${wall}`);
  assert.equal(String(res.world.scene.interior.roomId), startRoom, 'roomId must not change');
  assert.match(res.output.narration, /no way|wall/i, `expected a blocked message, got: ${res.output.narration}`);
});
