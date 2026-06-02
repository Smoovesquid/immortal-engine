import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { ensureMap, stepCell, nodeAtCell } from '../engine/map/mapState.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

// Two nodes on a known edge. The deterministic embedding places them at fixed
// integer cells; we read those cells rather than hard-coding them so the test
// survives embedding tweaks.
function twoNodeWorld(seed = 'u89') {
  return ensureWorld({
    meta: { seed },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [
        { id: 'n0', name: 'Start', tags: [] },
        { id: 'n1', name: 'North', tags: [] }
      ],
      edges: [{ a: 'n0', b: 'n1' }],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
}

function walkToNode(w, targetId) {
  for (let i = 0; i < 100; i++) {
    const m = ensureMap(w.map);
    const target = m.nodes.find(n => String(n.id) === String(targetId));
    const { x, y } = m.pos;
    if (x === target.x && y === target.y) break;
    const cmd = (target.x !== x)
      ? (target.x > x ? 'go east' : 'go west')
      : (target.y > y ? 'go south' : 'go north');
    w = playerMove(w, packsById, cmd).world;
  }
  return w;
}

test('U89: a cardinal step moves the avatar exactly one cell and pos stays integer', () => {
  const w = twoNodeWorld('u89-step');
  const from = { ...ensureMap(w.map).pos };
  const after = ensureMap(playerMove(w, packsById, 'go east').world.map);
  assert.equal(after.pos.x, from.x + 1, 'one cell east');
  assert.equal(after.pos.y, from.y, 'y unchanged');
  assert.ok(Number.isInteger(after.pos.x) && Number.isInteger(after.pos.y), 'pos integral');
});

test('U89b: stepping off a node into open ground clears currentNodeId (you are in the wild)', () => {
  const w = twoNodeWorld('u89-wild');
  const m0 = ensureMap(w.map);
  // Pick a cardinal that does NOT immediately land on n1.
  const n1 = m0.nodes.find(n => n.id === 'n1');
  const dirs = ['go north', 'go south', 'go east', 'go west'];
  let stepped = null;
  for (const d of dirs) {
    const cell = stepCell(m0.pos, d.split(' ')[1]);
    if (!(cell.x === n1.x && cell.y === n1.y)) { stepped = playerMove(w, packsById, d).world; break; }
  }
  assert.ok(stepped, 'found a wilderness direction');
  assert.equal(stepped.map.currentNodeId, '', 'no named node underfoot in the wild');
});

test('U89c: walking onto a node cell arrives there (currentNodeId set, node discovered)', () => {
  let w = twoNodeWorld('u89-arrive');
  assert.equal(ensureMap(w.map).discovered.includes('n1'), false, 'n1 undiscovered at start');
  w = walkToNode(w, 'n1');
  const m = ensureMap(w.map);
  assert.equal(m.currentNodeId, 'n1', 'arrived at n1');
  assert.equal(nodeAtCell(m, m.pos.x, m.pos.y)?.id, 'n1', 'standing on n1 cell');
  assert.ok(m.discovered.includes('n1'), 'arrival discovered n1');
});

test('U89d: overworld walking is deterministic (same seed + steps => identical world hash)', () => {
  const run = () => {
    let w = twoNodeWorld('u89-det');
    for (const d of ['go north', 'go east', 'go south', 'go west']) {
      w = playerMove(w, packsById, d).world;
    }
    return w;
  };
  assert.equal(worldHash(run()), worldHash(run()), 'identical seed + inputs => identical world');
});

test('U89e: ensureMap backfills pos for a pre-v20 save (no map.pos field)', () => {
  const m = ensureMap({
    nodes: [{ id: 'n0', name: 'Start', x: 4, y: 7 }],
    edges: [],
    discovered: ['n0'],
    currentNodeId: 'n0'
    // note: no pos
  });
  assert.ok(m.pos && Number.isInteger(m.pos.x) && Number.isInteger(m.pos.y), 'pos backfilled');
  assert.deepEqual(m.pos, { x: 4, y: 7 }, 'backfill lands on the current node cell');
});
