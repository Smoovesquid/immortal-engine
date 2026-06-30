// U306 — ONE MAP: the continuous map (2D⟷3D) / battle board is the always-present PRIMARY play
// surface, embedded directly in renderPlay (no gear detour), sized to ~60% of the viewport, and
// opening in the 3D (tilted) view. This locks the source contract the live browser proof validated
// (jsdom does no flexbox layout, so the faithful automated guard is the source + CSS contract):
//   (1) public/v1.js — renderPlay embeds renderContinuousMap (out of combat) and renderCombatBoard
//       (in combat) filling their container (height/heightCss '100%'), inside a '.play-map-3d'
//       wrapper, opening in the 3D zoom band; and the local-walk sim (renderWalkPlace, which keeps
//       placeCtl + ui.place alive) is still CALLED for its side-effects.
//   (2) public/v1.js — the gear menu no longer offers a 'Map' item (the settings detour is gone).
//   (3) public/styles.css — '.play-map-3d' is bounded to a vh height and held flex:0 0 auto so the
//       narration transcript takes the remaining height and never gets clipped (the U292 invariant).
// Hermetic — pure file reads, no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

async function v1Source() {
  return readFile(path.join(publicDir, 'v1.js'), 'utf8');
}

// Slice out renderPlay's body so the assertions are scoped to the play render.
async function renderPlaySource() {
  const src = await v1Source();
  const start = src.indexOf('function renderPlay');
  assert.ok(start >= 0, 'renderPlay must exist in public/v1.js');
  const next = src.indexOf('\nfunction ', start + 1);
  return src.slice(start, next > 0 ? next : undefined);
}

test('U306: renderPlay embeds the continuous map + battle board, filling a .play-map-3d wrapper', async () => {
  const body = await renderPlaySource();
  assert.match(body, /renderContinuousMap\(/, 'out-of-combat play embeds the continuous map');
  assert.match(body, /renderCombatBoard\(/, 'in-combat play embeds the tactical battle board');
  // The map fills its container (~60vh) rather than a fixed canvas height.
  assert.match(body, /heightCss:\s*'100%'/, 'the continuous map fills its container (heightCss 100%)');
  assert.match(body, /renderCombatBoard\(w,\s*\{\s*height:\s*'100%'\s*\}\)/, 'the battle board fills its container');
  // Wrapped in '.play-map-3d' (the CSS height authority).
  assert.match(body, /class:\s*'play-map-3d'/, 'the embedded map is wrapped in .play-map-3d');
});

test('U306: the embedded map opens in the 3D (tilted) zoom band, not the flat 2D plan', async () => {
  const body = await renderPlaySource();
  // initialZoom is seeded into the 3D band (Z_3D_CROSS 0.5 → Z_3D_TILT 2.5 in continuousMap.js).
  const m = body.match(/initialZoom:\s*([A-Z0-9_.]+)/);
  assert.ok(m, 'the continuous map embed must pass an initialZoom');
  // The constant resolves to a value inside the 3D band.
  const zm = body.match(/INPLAY_MAP_3D_ZOOM\s*=\s*([0-9.]+)/);
  assert.ok(zm, 'INPLAY_MAP_3D_ZOOM constant must be defined');
  const z = Number(zm[1]);
  assert.ok(z >= 0.5 && z <= 2.5, `initial zoom ${z} must land in the 3D band [0.5, 2.5]`);
});

test('U306: the local-walk sim (renderWalkPlace) is still called for its side-effects', async () => {
  const body = await renderPlaySource();
  // placeCtl + ui.place (compass + player marker) depend on it; it must still run.
  assert.match(body, /renderWalkPlace\(w\)/, 'renderWalkPlace must still be invoked to maintain placeCtl/ui.place');
});

test('U306: the gear menu no longer offers a "Map" item (no settings detour)', async () => {
  const src = await v1Source();
  // No gear-item button whose label is 'Map'.
  assert.doesNotMatch(src, /class:\s*'gear-item'[\s\S]{0,200}?\}\},\s*'Map'\)/, 'the gear "Map" item must be removed');
});

test('U306: styles.css bounds .play-map-3d and lets the transcript take the rest', async () => {
  const css = await readFile(path.join(publicDir, 'styles.css'), 'utf8');
  // Bounded to a viewport-relative height (the single height authority, ~60%).
  assert.match(css, /\.play-map-3d\s*\{[^}]*height:\s*\d+vh/, '.play-map-3d must have a vh-based height (~60%)');
  // On desktop the map may SHRINK from that basis (flex-shrink:1) so the transcript
  // keeps a readable height — it must not be pinned (flex:0 0) and swallow the column.
  assert.match(css, /\.play-body\s+\.play-map-3d\s*\{[^}]*flex:\s*0\s+1\s+auto/, '.play-body .play-map-3d must be flex:0 1 auto (shrinkable)');
  // The transcript fills the remaining space, scrolls, AND has a min-height floor so
  // the DM narration can never collapse to a sliver behind the map (the U292 invariant).
  assert.match(css, /\.play-body\s+\.transcript\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*overflow:\s*auto/, '.play-body .transcript must be flex:1 1 auto with overflow:auto');
  assert.match(css, /\.play-body\s+\.transcript\s*\{[^}]*min-height:\s*([1-9]\d{2,})px/, '.play-body .transcript must keep a min-height floor (≥100px) so narration stays readable');
});
