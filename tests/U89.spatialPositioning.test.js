import test from 'node:test';
import assert from 'node:assert/strict';

import {
  distance,
  isAdjacent,
  sameLevel,
  canMove,
  hasLineOfSight,
  dcModifierForDistance,
  moveToward,
  positionAround
} from '../engine/spatial/positioning.js';

// ── U89 — Spatial Positioning (Distance & LOS) ──────────────────────

test('U89-01: distance calculates Euclidean distance between positions', () => {
  const p1 = { ux: 0, uy: 0, elevation: 0 };
  const p2 = { ux: 3, uy: 4, elevation: 0 };
  const d = distance(p1, p2);
  assert.equal(d, 5); // 3-4-5 triangle
});

test('U89-02: distance returns Infinity for null positions', () => {
  assert.equal(distance(null, { ux: 0, uy: 0 }), Infinity);
  assert.equal(distance({ ux: 0, uy: 0 }, null), Infinity);
});

test('U89-03: isAdjacent detects positions within threshold', () => {
  const p1 = { ux: 50, uy: 50, elevation: 0 };
  const p2 = { ux: 60, uy: 50, elevation: 0 };
  assert.ok(isAdjacent(p1, p2, 15)); // distance 10 < 15
});

test('U89-04: isAdjacent returns false for distant positions', () => {
  const p1 = { ux: 0, uy: 0, elevation: 0 };
  const p2 = { ux: 100, uy: 100, elevation: 0 };
  assert.ok(!isAdjacent(p1, p2, 15)); // distance ~141 > 15
});

test('U89-05: sameLevel checks elevation equality', () => {
  const p1 = { ux: 50, uy: 50, elevation: 0 };
  const p2 = { ux: 60, uy: 50, elevation: 0 };
  assert.ok(sameLevel(p1, p2));

  const p3 = { ux: 60, uy: 50, elevation: 1 };
  assert.ok(!sameLevel(p1, p3));
});

test('U89-06: sameLevel defaults elevation to 0', () => {
  const p1 = { ux: 50, uy: 50 }; // no elevation
  const p2 = { ux: 60, uy: 50, elevation: 0 };
  assert.ok(sameLevel(p1, p2));
});

test('U89-07: canMove returns true with no obstacles', () => {
  const start = { ux: 0, uy: 0, elevation: 0 };
  const end = { ux: 50, uy: 50, elevation: 0 };
  assert.ok(canMove(start, end, []));
});

test('U89-08: canMove returns false with blocking obstacle', () => {
  const start = { ux: 0, uy: 0, elevation: 0 };
  const end = { ux: 100, uy: 0, elevation: 0 };
  const obstacle = { position: { ux: 50, uy: 0, elevation: 0 } };
  assert.ok(!canMove(start, end, [obstacle])); // obstacle on path
});

test('U89-09: hasLineOfSight returns true with no obstacles', () => {
  const from = { ux: 0, uy: 0, elevation: 0 };
  const to = { ux: 100, uy: 100, elevation: 0 };
  assert.ok(hasLineOfSight(from, to, []));
});

test('U89-10: hasLineOfSight blocked by obstacle on line', () => {
  const from = { ux: 0, uy: 0, elevation: 0 };
  const to = { ux: 100, uy: 100, elevation: 0 };
  const obstacle = { position: { ux: 50, uy: 50, elevation: 0 } };
  assert.ok(!hasLineOfSight(from, to, [obstacle])); // on the line
});

test('U89-11: dcModifierForDistance scales by range', () => {
  assert.equal(dcModifierForDistance(0.5), 0); // adjacent
  assert.equal(dcModifierForDistance(15), 1); // close
  assert.equal(dcModifierForDistance(45), 2); // medium
  assert.equal(dcModifierForDistance(70), 3); // far
});

test('U89-12: moveToward moves partway toward target', () => {
  const from = { ux: 0, uy: 0, elevation: 0 };
  const to = { ux: 100, uy: 0, elevation: 0 };
  const moved = moveToward(from, to, 30);
  assert.ok(moved.ux > 0 && moved.ux <= 30); // partway (30% of distance)
  assert.equal(moved.uy, 0);
  assert.equal(moved.elevation, 0);
});

test('U89-13: moveToward reaches target if close enough', () => {
  const from = { ux: 0, uy: 0, elevation: 0 };
  const to = { ux: 20, uy: 0, elevation: 0 };
  const moved = moveToward(from, to, 30);
  assert.equal(moved.ux, 20); // reached target
  assert.equal(moved.uy, 0);
});

test('U89-14: positionAround creates offset position', () => {
  const center = { ux: 50, uy: 50, elevation: 0 };
  const pos = positionAround(center, 0, 10);
  assert.ok(pos.ux > 50); // offset right
  assert.ok(Math.abs(pos.uy - 50) < 1); // roughly same y
});

test('U89-15: spatial calculations preserve elevation', () => {
  const p1 = { ux: 0, uy: 0, elevation: 2 };
  const p2 = { ux: 50, uy: 50, elevation: 2 };
  assert.ok(sameLevel(p1, p2));
  const moved = moveToward(p1, p2, 20);
  assert.equal(moved.elevation, 2);
});
