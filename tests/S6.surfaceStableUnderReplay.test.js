/**
 * Gate S6 — Surface Is Stable Under Replay
 *
 * Given the same seed + same sequence of canonical surface inputs,
 * the worldHash must be identical every time.
 * No randomness may leak into the surface from projection or rendering.
 *
 * This test drives the Surface v1 gates (movement, node travel,
 * structure enter/exit, room navigation) and verifies the hash
 * is identical across independent runs from the same seed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
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

function makeBase(seed = 's6') {
  return ensureWorld({
    meta: { seed },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [
        { id: 'n0', name: 'Start', tags: ['structure:demo'] },
        { id: 'n1', name: 'North', tags: [] }
      ],
      edges: [{ a: 'n0', b: 'n1' }],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
}

function runSurface(seed) {
  let w = makeBase(seed);

  // Local movement (S3)
  w = playerMove(w, packsById, 'go north').world;
  w = playerMove(w, packsById, 'go east').world;
  w = playerMove(w, packsById, 'go south').world;

  // Node travel (S1/S2)
  w = playerMove(w, packsById, 'travel to North').world;
  w = playerMove(w, packsById, 'travel to Start').world;

  // Enter structure (S4)
  w = playerMove(w, packsById, 'enter building').world;

  // Room navigation (S5)
  const structureKey = w.scene?.interior?.structureKey;
  if (structureKey) {
    const st = w.structures?.byId?.[structureKey];
    if (st) {
      const adj = adjacentRooms(st.topology, w.scene.interior.roomId);
      if (adj.length > 0) {
        w = moveWithinInterior(w, adj[0]);
      }
    }
  }

  // Exit structure (S4)
  w = playerMove(w, packsById, 'exit').world;

  return worldHash(w);
}

test('S6: 10 identical surface runs produce the same worldHash', () => {
  const seed = 's6-stability';
  const hashes = Array.from({ length: 10 }, () => runSurface(seed));
  const first = hashes[0];
  for (let i = 1; i < hashes.length; i++) {
    assert.equal(hashes[i], first, `run ${i + 1} worldHash must equal run 1`);
  }
});

test('S6: different seeds produce different worldHashes', () => {
  const h1 = runSurface('s6-alpha');
  const h2 = runSurface('s6-beta');
  assert.notEqual(h1, h2, 'different seeds must produce different hashes');
});

test('S6: worldHash is stable across JSON round-trip mid-session', () => {
  let w = makeBase('s6-roundtrip');
  w = playerMove(w, packsById, 'go north').world;
  w = playerMove(w, packsById, 'enter building').world;

  const h1 = worldHash(w);

  // Simulate save/load
  const restored = ensureWorld(JSON.parse(JSON.stringify(w)));
  const h2 = worldHash(restored);

  assert.equal(h2, h1, 'worldHash must be identical after JSON round-trip');
});

test('S6: re-running the same surface sequence from same seed = same hash', () => {
  const run = () => runSurface('s6-det');
  assert.equal(run(), run(), 'surface must be fully deterministic');
});
