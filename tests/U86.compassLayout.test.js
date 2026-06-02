import test from 'node:test';
import assert from 'node:assert/strict';

import { generateInitialMap } from '../engine/map/generateMap.js';
import {
  compassLayout,
  exitsFrom,
  directionFromText,
  neighbors
} from '../engine/map/mapState.js';

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DIRS = ['north', 'east', 'south', 'west'];

function sampleMaps() {
  return [
    generateInitialMap({ seed: 'lark', packId: 'fantasy', pack: {} }),
    generateInitialMap({ seed: 'escape-2', packId: 'fantasy', pack: {} }),
    generateInitialMap({ seed: 'zzz', packId: 'horror', pack: {} })
  ];
}

test('U86: compass exits are reciprocal — north then south returns you', () => {
  for (const map of sampleMaps()) {
    const layout = compassLayout(map);
    for (const node of map.nodes) {
      const exits = layout.get(node.id) || {};
      for (const dir of DIRS) {
        const nb = exits[dir];
        if (!nb) continue;
        const back = (layout.get(nb) || {})[OPPOSITE[dir]];
        assert.equal(
          back, node.id,
          `non-reciprocal: ${node.id} --${dir}--> ${nb}, but back-${OPPOSITE[dir]} = ${back}`
        );
      }
    }
  }
});

test('U86: compass assignments are deterministic across recomputes', () => {
  for (const map of sampleMaps()) {
    const a = compassLayout(map);
    const b = compassLayout(map);
    for (const node of map.nodes) {
      assert.deepEqual(a.get(node.id), b.get(node.id), `unstable layout at ${node.id}`);
    }
  }
});

test('U86: no direction at a node points to two different neighbors', () => {
  for (const map of sampleMaps()) {
    const layout = compassLayout(map);
    for (const node of map.nodes) {
      const exits = layout.get(node.id) || {};
      const targets = DIRS.map(d => exits[d]).filter(Boolean);
      const unique = new Set(targets);
      assert.equal(targets.length, unique.size, `duplicate compass targets at ${node.id}`);
    }
  }
});

test('U86: every slotted exit points in the geometrically correct cardinal', () => {
  // v19: direction is read from coordinates, so a slotted exit must agree with the
  // actual delta between the two nodes' grid cells. (When two neighbors share a
  // cardinal the farther one is left name-reachable — that's expected, so we only
  // assert correctness of the slots that DID get assigned.)
  const byId = (map) => new Map(map.nodes.map(n => [String(n.id), n]));
  const cardinalOf = (dx, dy) => {
    if (dx === 0 && dy === 0) return '';
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west';
    return dy > 0 ? 'south' : 'north';
  };
  for (const map of sampleMaps()) {
    const nodes = byId(map);
    const layout = compassLayout(map);
    for (const node of map.nodes) {
      const exits = layout.get(node.id) || {};
      for (const dir of DIRS) {
        const nbId = exits[dir];
        if (!nbId) continue;
        const a = nodes.get(String(node.id));
        const b = nodes.get(String(nbId));
        assert.ok(Number.isInteger(a.x) && Number.isInteger(b.x), 'nodes must have coords');
        const want = cardinalOf(b.x - a.x, b.y - a.y);
        assert.equal(dir, want, `${node.id} slots ${nbId} as ${dir} but geometry says ${want}`);
      }
    }
  }
});

test('U86: directionFromText parses bare/short movement commands only', () => {
  assert.equal(directionFromText('north'), 'north');
  assert.equal(directionFromText('n'), 'north');
  assert.equal(directionFromText('go west'), 'west');
  assert.equal(directionFromText('head south'), 'south');
  assert.equal(directionFromText('  EAST '), 'east');
  // Not bare directions — must not be treated as compass commands.
  assert.equal(directionFromText('travel to North Tower'), '');
  assert.equal(directionFromText('enter the cave'), '');
  assert.equal(directionFromText('attack the goblin'), '');
  assert.equal(directionFromText(''), '');
});

test('U86: exitsFrom shape is always the four cardinal keys', () => {
  const map = sampleMaps()[0];
  const exits = exitsFrom(map, map.currentNodeId);
  assert.deepEqual(Object.keys(exits).sort(), ['east', 'north', 'south', 'west']);
});
