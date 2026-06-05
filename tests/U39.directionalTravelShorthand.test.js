import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { ensureMap } from '../engine/map/mapState.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function outsideWorld(seed) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  let w = beginAdventure(w0, packsById).world;
  // Leave the home interior so directional shorthand resolves to overworld
  // tile movement rather than interior room navigation.
  if (w.scene?.interior) w = playerMove(w, packsById, 'leave the house').world;
  return w;
}

// v20 free-roam: a bare cardinal steps the avatar exactly one tile across the
// overworld grid. North is -y (grid y grows downward, matching compass geometry).
test('U39: "go north" steps the avatar one tile north (free-roam)', () => {
  const outside = outsideWorld('u39');
  const from = { ...ensureMap(outside.map).pos };

  const t1 = playerMove(outside, packsById, 'go north');
  const m1 = ensureMap(t1.world.map);

  assert.equal(m1.pos.x, from.x, 'x unchanged on a north step');
  assert.equal(m1.pos.y, from.y - 1, 'one cell north (y decreases by 1)');
});

test('U39b: each cardinal moves the avatar exactly one cell in that direction', () => {
  const outside = outsideWorld('u39b');
  const deltas = {
    'go north': { dx: 0, dy: -1 },
    'go south': { dx: 0, dy: 1 },
    'go east': { dx: 1, dy: 0 },
    'go west': { dx: -1, dy: 0 }
  };
  for (const [cmd, d] of Object.entries(deltas)) {
    const from = { ...ensureMap(outside.map).pos };
    const next = ensureMap(playerMove(outside, packsById, cmd).world.map);
    assert.equal(next.pos.x, from.x + d.dx, `${cmd}: x delta`);
    assert.equal(next.pos.y, from.y + d.dy, `${cmd}: y delta`);
  }
});

test('U39c: overworld walking is deterministic (same seed + steps => same position)', () => {
  const walk = () => {
    let w = outsideWorld('u39c');
    for (const d of ['go north', 'go east', 'go east', 'go south', 'go west']) {
      w = playerMove(w, packsById, d).world;
    }
    return ensureMap(w.map).pos;
  };
  assert.deepEqual(walk(), walk(), 'identical seed + inputs => identical avatar cell');
});

test('U39d: travel to an UNKNOWN place does not move you, and the DM clarifies in fiction', () => {
  // Stage C.2 / THE_DM_TEST: a *known* neighbor by name now gets a journey (see
  // the C.2 tests). An *unknown* place must still not teleport you — but instead
  // of a bare "which way?" the DM says it knows of no such place and names the
  // real roads.
  const outside = outsideWorld('u39d');
  const from = { ...ensureMap(outside.map).pos };
  const r = playerMove(outside, packsById, 'travel to the far tower');
  const after = ensureMap(r.world.map);
  assert.deepEqual({ x: after.pos.x, y: after.pos.y }, from, 'no tile move to an unknown place');
  assert.match(r.output.narration, /no such place|where will you make for/i, 'DM clarifies in fiction');
  assert.doesNotMatch(r.output.narration, /a step at a time/i, 'no machine-y deflection');
});
