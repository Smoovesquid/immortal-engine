import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { findSpatialRuling, applySpatialRuling, SPATIAL_RULINGS } from '../engine/adjudication/spatialRulings.js';

// ── U90 — Spatial Rulings (5 Board-Aware Adjudications) ──────────────

// Create a world with positioned furniture and enemies
function makeWorldWithPositioning() {
  return ensureWorld({
    meta: { version: 21, seed: 'u90-spatial', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Hero',
      stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 },
      position: { ux: 30, uy: 50, elevation: 0, nodeId: 'n0' }
    }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        currentNodeId: 'n0',
        furniture: [
          {
            name: 'wooden barrel',
            parts: ['staves', 'hoops'],
            state: 'intact',
            bulk: 4,
            weight: 3,
            tags: ['wood', 'container'],
            ux: 70,
            uy: 50,
            elevation: 0,
            position: { ux: 70, uy: 50, elevation: 0 }
          },
          {
            name: 'wooden door',
            state: 'intact',
            bulk: 5,
            weight: 4,
            tags: ['wood', 'entrance', 'doorway'],
            ux: 50,
            uy: 20,
            elevation: 0,
            position: { ux: 50, uy: 20, elevation: 0 }
          }
        ]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: [],
    conductor: {
      threat: { perception: 1 }
    }
  });
}

test('U90-01: findSpatialRuling detects HIDE_BEHIND_POSITIONED for cover action', () => {
  const w = makeWorldWithPositioning();
  const barrel = w.map.nodes[0].furniture[0];
  const playerPos = w.party[0].position;
  const threatPos = { ux: 90, uy: 50, elevation: 0 };

  // Position player adjacent to barrel
  playerPos.ux = 72;
  playerPos.uy = 50;

  const ruling = findSpatialRuling('hide behind the barrel', barrel, w, playerPos, threatPos);
  assert.ok(ruling);
  assert.equal(ruling.name, 'HIDE_BEHIND_POSITIONED');
});

test('U90-02: findSpatialRuling detects FLANK for flank action', () => {
  const w = makeWorldWithPositioning();
  const enemy = { id: 'goblin', position: { ux: 80, uy: 50, elevation: 0 } };
  const playerPos = w.party[0].position; // at 30, 50

  const ruling = findSpatialRuling('flank the goblin', enemy, w, playerPos);
  assert.ok(ruling);
  assert.equal(ruling.name, 'FLANK');
});

test('U90-03: findSpatialRuling detects BLOCK_DOORWAY for block action', () => {
  const w = makeWorldWithPositioning();
  const door = w.map.nodes[0].furniture[1];
  const playerPos = { ux: 50, uy: 22, elevation: 0 }; // adjacent to door

  const ruling = findSpatialRuling('block the wooden door', door, w, playerPos);
  assert.ok(ruling);
  assert.equal(ruling.name, 'BLOCK_DOORWAY');
});

test('U90-04: findSpatialRuling detects CHARGE for charge action', () => {
  const w = makeWorldWithPositioning();
  const enemy = { id: 'wolf', position: { ux: 80, uy: 50, elevation: 0 } };
  const playerPos = w.party[0].position; // at 30, 50

  const ruling = findSpatialRuling('charge at the wolf', enemy, w, playerPos);
  assert.ok(ruling);
  assert.equal(ruling.name, 'CHARGE');
});

test('U90-05: findSpatialRuling detects DISENGAGE for retreat action', () => {
  const w = makeWorldWithPositioning();
  const enemy = { id: 'goblin', position: { ux: 35, uy: 50, elevation: 0 } }; // adjacent
  const playerPos = w.party[0].position; // at 30, 50

  const ruling = findSpatialRuling('disengage from the goblin', enemy, w, playerPos);
  assert.ok(ruling);
  assert.equal(ruling.name, 'DISENGAGE');
});

test('U90-06: HIDE_BEHIND_POSITIONED precondition requires adjacency', () => {
  const w = makeWorldWithPositioning();
  const barrel = w.map.nodes[0].furniture[0];
  const playerPos = { ux: 30, uy: 50, elevation: 0 }; // far from barrel
  const threatPos = { ux: 90, uy: 50, elevation: 0 };

  const ruling = SPATIAL_RULINGS.HIDE_BEHIND_POSITIONED;
  assert.ok(!ruling.precondition(barrel, w, playerPos, threatPos)); // too far
});

test('U90-07: FLANK precondition requires non-adjacent position', () => {
  const w = makeWorldWithPositioning();
  const enemy = { id: 'goblin', position: { ux: 32, uy: 50, elevation: 0 } }; // adjacent to player
  const playerPos = w.party[0].position;

  const ruling = SPATIAL_RULINGS.FLANK;
  assert.ok(!ruling.precondition(enemy, w, playerPos)); // already adjacent
});

test('U90-08: BLOCK_DOORWAY precondition requires entrance tag', () => {
  const w = makeWorldWithPositioning();
  const barrel = w.map.nodes[0].furniture[0]; // not a doorway
  const playerPos = { ux: 70, uy: 52, elevation: 0 }; // adjacent

  const ruling = SPATIAL_RULINGS.BLOCK_DOORWAY;
  assert.ok(!ruling.precondition(barrel, w, playerPos)); // not an entrance
});

test('U90-09: CHARGE precondition requires distance 20-80 units', () => {
  const w = makeWorldWithPositioning();
  const enemy = { id: 'wolf', position: { ux: 35, uy: 50, elevation: 0 } }; // too close (5 units)
  const playerPos = w.party[0].position;

  const ruling = SPATIAL_RULINGS.CHARGE;
  assert.ok(!ruling.precondition(enemy, w, playerPos)); // too close to charge
});

test('U90-10: DISENGAGE precondition requires adjacency', () => {
  const w = makeWorldWithPositioning();
  const enemy = { id: 'goblin', position: { ux: 70, uy: 50, elevation: 0 } }; // far away
  const playerPos = w.party[0].position;

  const ruling = SPATIAL_RULINGS.DISENGAGE;
  assert.ok(!ruling.precondition(enemy, w, playerPos)); // not adjacent
});

test('U90-11: spatial ruling success outcome generates position delta', () => {
  const ruling = SPATIAL_RULINGS.HIDE_BEHIND_POSITIONED;
  const barrel = { name: 'barrel', position: { ux: 70, uy: 50, elevation: 0 } };
  const deltas = applySpatialRuling(ruling, 'success', barrel);

  assert.ok(deltas);
  assert.ok(deltas.length > 0);
});

test('U90-12: FLANK success gives attack bonus', () => {
  const ruling = SPATIAL_RULINGS.FLANK;
  const enemy = { name: 'goblin', position: { ux: 80, uy: 50, elevation: 0 } };
  const playerPos = { ux: 30, uy: 50, elevation: 0 };

  const deltas = applySpatialRuling(ruling, 'success', enemy, null, playerPos);
  assert.ok(deltas);

  // Should have both position and flanking condition
  const hasPosition = deltas.some(d => d.op === 'modifyPosition');
  const hasFlanking = deltas.some(d => d.op === 'condition' && d.name === 'flanking');
  assert.ok(hasPosition);
  assert.ok(hasFlanking);
});

test('U90-13: CHARGE mixed outcome moves but no bonus', () => {
  const ruling = SPATIAL_RULINGS.CHARGE;
  const enemy = { name: 'wolf', position: { ux: 80, uy: 50, elevation: 0 } };
  const playerPos = { ux: 30, uy: 50, elevation: 0 };

  const deltas = applySpatialRuling(ruling, 'mixed', enemy, null, playerPos);
  assert.ok(deltas);

  const hasPosition = deltas.some(d => d.op === 'modifyPosition');
  assert.ok(hasPosition);
});

test('U90-14: DISENGAGE failure has no deltas', () => {
  const ruling = SPATIAL_RULINGS.DISENGAGE;
  const enemy = { name: 'goblin' };

  const deltas = applySpatialRuling(ruling, 'failure', enemy);
  assert.equal(deltas.length, 0); // Can't escape
});

test('U90-15: spatial ruling narration varies by outcome', () => {
  const ruling = SPATIAL_RULINGS.HIDE_BEHIND_POSITIONED;
  const obj = { name: 'barrel' };

  const narSuccess = ruling.narrationTemplate.success(obj);
  const narMixed = ruling.narrationTemplate.mixed(obj);
  const narFailure = ruling.narrationTemplate.failure(obj);

  assert.ok(narSuccess.includes('barrel'));
  assert.ok(narMixed.includes('barrel'));
  assert.ok(narFailure.includes('barrel'));
  assert.notEqual(narSuccess, narMixed);
  assert.notEqual(narMixed, narFailure);
});
