// U294 — the roof-peel cutaway must be REACHABLE in casual play. The cutaway (render3d.js
// mountSlice3D → updateCutaway) peels the focused building's roof as the continuous zoom pushes
// in; the peel amount is smooth(PEEL_START_PX, PEEL_FULL_PX, zoomPx) where zoomPx = NODE_WU·z is
// the live zoom (NODE_WU = 1000; the in-play map OPENS at z = 2.0 → zoomPx = 2000, see v1.js
// INPLAY_MAP_3D_ZOOM). The shipped bug (v0.13.0): PEEL_FULL_PX was 6200 (z ≈ 6.2 — almost max
// zoom), so a natural "zoom in a bit" produced an imperceptible peel and the feature read as
// "not happening". This locks the band to a reachable range:
//   • PEEL_START_PX > 2000  — the z = 2.0 overview still shows ROOFS ON (the peel hasn't started).
//   • PEEL_FULL_PX  <= 4500 — the roof is fully off by a comfortable mid-zoom (z ≈ 4.5), not near
//     the deep end, so a modest zoom-in clearly reveals the interior.
// Hermetic — pure file reads, no network, no WebGL.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapDir = path.resolve(__dirname, '..', 'public', 'map');

function num(src, name) {
  const m = src.match(new RegExp(name + '\\s*=\\s*([0-9]+)'));
  assert.ok(m, `${name} must be defined in render3d.js`);
  return Number(m[1]);
}

test('U294: the roof-peel band is reachable — starts past the z=2.0 default, completes by a mid-zoom', async () => {
  const src = await readFile(path.join(mapDir, 'render3d.js'), 'utf8');
  const start = num(src, 'PEEL_START_PX');
  const full = num(src, 'PEEL_FULL_PX');
  // The in-play map opens at z = 2.0 → zoomPx = 2000. Roofs must be ON at the overview.
  assert.ok(start > 2000, `PEEL_START_PX (${start}) must be > 2000 so the z=2.0 overview keeps its roofs`);
  // The peel must finish at a comfortable zoom — not buried near max zoom (z=16 → zoomPx 16000).
  assert.ok(full <= 4500, `PEEL_FULL_PX (${full}) must be <= 4500 so a modest zoom-in fully peels (was 6200 — the bug)`);
  assert.ok(full > start, `PEEL_FULL_PX (${full}) must exceed PEEL_START_PX (${start})`);
});

test('U294: the in-play map still opens at the z=2.0 zoom the peel band is tuned against', async () => {
  const v1 = await readFile(path.resolve(__dirname, '..', 'public', 'v1.js'), 'utf8');
  const m = v1.match(/INPLAY_MAP_3D_ZOOM\s*=\s*([0-9.]+)/);
  assert.ok(m, 'INPLAY_MAP_3D_ZOOM must be defined in v1.js');
  assert.equal(Number(m[1]), 2.0, 'the in-play 3D map opens at z=2.0 (the peel band assumes this default)');
});
