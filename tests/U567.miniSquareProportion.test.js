// U567 — REND-SCALE-1: the figure↔cell proportion is ZOOM-INVARIANT.
//
// The ground ink draws a tactical cell as `5 · scenePerWu` scene units; a mini
// scaled by miniSheetScale stands `heightWu · scenePerWu` tall. Their ratio is
// heightWu/5 — a constant, at EVERY zoom where the true law is above the floor.
//
// UNIT-CLASH-1 relock (2026-07-06): the sheet's wu is METRIC (worldSpace.js —
// NODE_WU 1 km, PLACE_WU 4 m; the plans/scale-bar/tree ink all metric), so a
// cell is 5 wu ≈ 5 m of ground and a 6-ft villager is 1.83 wu ≈ 0.366 cells.
// This file previously read "1 wu = 1 ft" and pinned the villager at 1.2
// squares — the exact feet-as-wu confusion that drew every mini ×3.28 colossal
// (a 6 m statue in the bedchamber, Tim's report). The LAW is unchanged (true
// size through the sheet's own transform, zoom-invariant); only the unit frame
// is corrected. The original falsifier ("my Hobbit reads about a foot tall")
// keeps its teeth below, restated frame-honestly.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetScenePerWu } from '../public/map/worldSpace.js';
import { miniSheetScale, figureHeightWu, FIGURE_HEIGHT_WU, WU_PER_FT } from '../public/map/figures3d.js';

const SHEET_PX = 2048; // render3d's capture size — any consistent value works here
const CELL_WU = 5;     // one tactical cell = 5 wu ≈ 5 m of ground (U450 pins the cell↔wu chain)

// A mini authored `authoredH` scene units tall, with true height `heightWu`:
// its drawn height at a given sheet zoom.
function drawnHeight(heightWu, authoredH, spanScene, z) {
  const spw = sheetScenePerWu(spanScene, z, SHEET_PX);
  const scale = miniSheetScale(heightWu / authoredH, spw, 1);
  return { h: scale * authoredH, cell: CELL_WU * spw, spw };
}

test('U567a a 6-ft (1.83 wu) person spans 0.366 cells at every cell-visible zoom', () => {
  const authoredH = 2.2; // the procedural humanoid's authored height
  const expected = FIGURE_HEIGHT_WU.medium / CELL_WU; // 6 ft · WU_PER_FT / 5 wu
  // Three zooms across the street→plan band (span 100 scene units, rising px/wu).
  for (const z of [45, 60, 90]) {
    const { h, cell } = drawnHeight(figureHeightWu(null), authoredH, 100, z);
    assert.ok(Math.abs(h / cell - expected) < 1e-12,
      `medium figure/cell ratio must be exactly ${expected} (z=${z}, got ${h / cell})`);
  }
});

test('U567b a hobbit holds its own ratio — and never reads one foot tall', () => {
  const authoredH = 2.2;
  const hob = figureHeightWu({ name: 'Hobbit' });
  const footRatio = (1 * WU_PER_FT) / CELL_WU; // what "about a foot tall" means against a cell
  for (const z of [45, 60, 90]) {
    const { h, cell } = drawnHeight(hob, authoredH, 100, z);
    assert.ok(Math.abs(h / cell - hob / CELL_WU) < 1e-12, `hobbit ratio must be ${hob / CELL_WU}`);
    // The original falsifier, frame-honest: at no cell-visible zoom may the
    // figure collapse to a foot-tall read (Tim's report). A true 3½-ft hobbit
    // (1.07 wu) stands 3.5× that bound.
    assert.ok(h / cell > footRatio + 1e-9, `hobbit must never read foot-tall (z=${z}, ratio ${h / cell})`);
  }
});

test('U567c zoomed far out the floor holds the authored token look', () => {
  const authoredH = 2.2;
  // Region zoom: tiny px/wu — true scale would be a speck; the floor binds and
  // the drawn height equals the authored height (today's token look, unchanged).
  const { h, spw } = drawnHeight(figureHeightWu(null), authoredH, 100, 0.8);
  assert.ok(FIGURE_HEIGHT_WU.medium * spw < authoredH, 'premise: true scale is below the authored look out here');
  assert.equal(h, authoredH);
});
