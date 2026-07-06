// U567 — REND-SCALE-1: the figure↔square proportion is ZOOM-INVARIANT.
//
// The ground ink draws a 5-ft square as `5 · scenePerWu` scene units; a mini
// scaled by miniSheetScale stands `heightWu · scenePerWu` tall. Their ratio is
// heightWu/5 — a constant, at EVERY zoom where the true law is above the floor.
// A 6-ft villager is 1.2 squares tall; a 3½-ft hobbit 0.7. This is the exact
// arithmetic the falsifier violated (figure ≈ 0.2 squares — a "foot-tall"
// person), pinned here through the same worldSpace transform the renderer uses.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetScenePerWu } from '../public/map/worldSpace.js';
import { miniSheetScale, figureHeightWu } from '../public/map/figures3d.js';

const SHEET_PX = 2048; // render3d's capture size — any consistent value works here
const CELL_WU = 5;     // one 5-ft square (1 wu = 1 ft at tactical scale, U450 law)

// A mini authored `authoredH` scene units tall, with true height `heightWu`:
// its drawn height at a given sheet zoom.
function drawnHeight(heightWu, authoredH, spanScene, z) {
  const spw = sheetScenePerWu(spanScene, z, SHEET_PX);
  const scale = miniSheetScale(heightWu / authoredH, spw, 1);
  return { h: scale * authoredH, cell: CELL_WU * spw, spw };
}

test('U567a a 6-ft person spans 1.2 squares at every square-visible zoom', () => {
  const authoredH = 2.2; // the procedural humanoid's authored height
  // Three zooms across the street→plan band (span 100 scene units, rising px/wu).
  for (const z of [45, 60, 90]) {
    const { h, cell } = drawnHeight(figureHeightWu(null), authoredH, 100, z);
    assert.ok(Math.abs(h / cell - 6 / 5) < 1e-12,
      `medium figure/square ratio must be exactly 1.2 (z=${z}, got ${h / cell})`);
  }
});

test('U567b a hobbit spans 0.7 squares — and never reads one foot tall', () => {
  const authoredH = 2.2;
  const hob = figureHeightWu({ name: 'Hobbit' });
  for (const z of [45, 60, 90]) {
    const { h, cell } = drawnHeight(hob, authoredH, 100, z);
    assert.ok(Math.abs(h / cell - hob / CELL_WU) < 1e-12, `hobbit ratio must be ${hob / CELL_WU}`);
    // The falsifier itself: at no square-visible zoom may the figure read ≤ a
    // fifth of a square (the "about a foot tall" report).
    assert.ok(h / cell > 0.2 + 1e-9, `hobbit must never read foot-tall (z=${z}, ratio ${h / cell})`);
  }
});

test('U567c zoomed far out the floor holds the authored token look', () => {
  const authoredH = 2.2;
  // Region zoom: tiny px/wu — true scale would be a speck; the floor binds and
  // the drawn height equals the authored height (today's token look, unchanged).
  const { h, spw } = drawnHeight(figureHeightWu(null), authoredH, 100, 0.8);
  assert.ok(6 * spw < authoredH, 'premise: true scale is below the authored look out here');
  assert.equal(h, authoredH);
});
