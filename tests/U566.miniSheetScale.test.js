// U566 — REND-SCALE-1: the mini size law (pure).
//
// A mini's drawn size must be its TRUE size in wu pushed through the SAME
// transform the ground ink's 5-ft squares use (worldSpace.js sheetScenePerWu),
// floored at the authored token look for zoomed-out legibility. The falsifier
// this guards: Tim's "my Hobbit figurine looks about a foot tall on a 5-ft
// square" (2026-07-06) — authored-fixed figure size under a zooming sheet.

import test from 'node:test';
import assert from 'node:assert/strict';
import { miniSheetScale, figureHeightWu, propTrueSize, FIGURE_HEIGHT_WU, WU_PER_FT } from '../public/map/figures3d.js';

test('U566a miniSheetScale — true scale above the floor, floor below it', () => {
  // wuPerAuthored 3 (e.g. a 6-ft man over a 2-unit authored figure), spw 2.2
  // (interior zoom): true scale 6.6 wins over floor 1.
  assert.equal(miniSheetScale(3, 2.2, 1), 3 * 2.2);
  // Region zoom (spw 0.04): true scale 0.12 — the floor (authored look) binds.
  assert.equal(miniSheetScale(3, 0.04, 1), 1);
  // Exact crossover: max(f, t) — at t == f either branch is the same number.
  assert.equal(miniSheetScale(2, 0.5, 1), 1);
  // Custom floor respected.
  assert.equal(miniSheetScale(3, 0.04, 1.24), 1.24);
  // Degenerate inputs never explode: 0/NaN wuPerAuthored → the floor.
  assert.equal(miniSheetScale(0, 2.2, 1), 1);
  assert.equal(miniSheetScale(NaN, 2.2, 1), 1);
});

test('U566b miniSheetScale — monotonic in zoom (squares grow, figures grow with them)', () => {
  const wpa = 2.7; // ~6 ft over ~2.2 authored
  let prev = 0;
  for (const spw of [0.5, 0.8, 1.4, 2.2, 3.0]) {
    const s = miniSheetScale(wpa, spw, 1);
    assert.ok(s >= prev, `scale must not shrink as the sheet zooms in (spw=${spw})`);
    prev = s;
  }
});

test('U566c figureHeightWu — sheet species truth, pack spellings, sane default', () => {
  // SRD size is the honest source.
  assert.equal(figureHeightWu({ id: 'halfling', name: 'Halfling', size: 'Small' }), FIGURE_HEIGHT_WU.small);
  assert.equal(figureHeightWu({ id: 'human', name: 'Human', size: 'Medium' }), FIGURE_HEIGHT_WU.medium);
  // Pack-native spellings without a size field still land small.
  assert.equal(figureHeightWu({ name: 'Hobbit' }), FIGURE_HEIGHT_WU.small);
  assert.equal(figureHeightWu('hobbit'), FIGURE_HEIGHT_WU.small);
  assert.equal(figureHeightWu({ name: 'Gnome' }), FIGURE_HEIGHT_WU.small);
  // Dwarves: SRD Medium, but 6 ft would read wrong — the one name override.
  // Authored 4½ ft, exported metric (UNIT-CLASH-1: sheet wu is metres).
  assert.equal(figureHeightWu({ id: 'dwarf', name: 'Dwarf', size: 'Medium' }), 4.5 * WU_PER_FT);
  // NPC map records carry no species → a 6-ft medium villager.
  assert.equal(figureHeightWu(null), FIGURE_HEIGHT_WU.medium);
  assert.equal(figureHeightWu(undefined), FIGURE_HEIGHT_WU.medium);
});

test('U566d propTrueSize — per-kind truths, beds length-true, unknown kinds sane', () => {
  assert.equal(propTrueSize('bed').axis, 'z');       // length-true (authored 7 ft along the frame)
  assert.equal(propTrueSize('bed').wu, 7 * WU_PER_FT); // exported metric (UNIT-CLASH-1)
  assert.equal(propTrueSize('barrel').axis, 'y');    // height-true
  assert.ok(propTrueSize('barrel').wu > 2 * WU_PER_FT && propTrueSize('barrel').wu < 4 * WU_PER_FT);
  const unknown = propTrueSize('gazebo');
  assert.equal(unknown.axis, 'y');
  assert.ok(unknown.wu > 0, 'unknown kinds still get a positive default');
});
