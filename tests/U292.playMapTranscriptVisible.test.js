// U292 — the DM narration transcript stays VISIBLE in play (it must not get clipped off-screen
// behind the map). This is a static layout-CONTRACT test: jsdom does no flexbox layout, so the
// faithful automated guard is to lock the source contract the live browser proof validated. The
// regression (commit be5cb58, day/night glyph) nested the map canvas in an UNCLASSED wrapper div,
// so the desktop height-bound selector (.play-body .play-map > .local-map-canvas) no longer matched
// — the map ballooned to its intrinsic ~854px square and pushed the transcript below the viewport,
// so the DM's spoken text "disappeared". Two halves of the contract are asserted here:
//   (1) public/v1.js — the map wrapper carries class 'play-map' AND the canvas height is a DEFINITE
//       viewport-relative clamp, never the circular `calc(100% - …)` that left it unresolved.
//   (2) public/styles.css — the bound + the transcript-gets-the-rest rules exist.
// Hermetic — pure file reads, no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

// Slice out the renderWalkPlace function body so the assertions are scoped to the map render.
async function walkPlaceSource() {
  const src = await readFile(path.join(publicDir, 'v1.js'), 'utf8');
  const start = src.indexOf('function renderWalkPlace');
  assert.ok(start >= 0, 'renderWalkPlace must exist in public/v1.js');
  // Find the next top-level `function ` after it (end of this function).
  const next = src.indexOf('\nfunction ', start + 1);
  return src.slice(start, next > 0 ? next : undefined);
}

test('U292: the map wrapper carries class "play-map" so the height-bound CSS matches it', async () => {
  const body = await walkPlaceSource();
  // The wrapper div that contains the canvas (+ day/night glyph) must be classed 'play-map'.
  assert.match(body, /class:\s*'play-map'/, 'the map wrapper must have class "play-map"');
  // And it must still wrap the canvas (the bounded element).
  assert.match(body, /class:\s*'local-map-canvas'/, 'the walk-place canvas must keep class "local-map-canvas"');
});

test('U292: the map canvas height is a DEFINITE viewport clamp, not a circular calc(100% - …)', async () => {
  const body = await walkPlaceSource();
  // The fixed regression: a height that depends on the wrapper height (which sizes to the canvas)
  // cannot resolve once nested, so the map oversizes. Forbid that circular term.
  assert.doesNotMatch(body, /calc\(100%\s*-\s*\d+px\)/, 'canvas height must not depend on its own container (circular)');
  // It must use a viewport-relative clamp so it is definite on both desktop and mobile.
  assert.match(body, /local-map-canvas[\s\S]{0,160}clamp\([^)]*vh[^)]*\)/, 'canvas height must be a vh-based clamp');
});

test('U292: styles.css bounds the play-map canvas and lets the transcript take the remaining height', async () => {
  const css = await readFile(path.join(publicDir, 'styles.css'), 'utf8');
  // The desktop bound on the canvas inside the .play-map wrapper.
  assert.match(css, /\.play-body\s+\.play-map\s*>\s*\.local-map-canvas/, 'styles.css must bound .play-body .play-map > .local-map-canvas');
  // .play-map is held to its content size (it must not grow and swallow the column).
  assert.match(css, /\.play-body\s+\.play-map\s*\{[^}]*flex:\s*0\s+0\s+auto/, '.play-body .play-map must be flex:0 0 auto');
  // The transcript fills the remaining space and scrolls — never clipped to a sliver.
  assert.match(css, /\.play-body\s+\.transcript\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*overflow:\s*auto/, '.play-body .transcript must be flex:1 1 auto with overflow:auto');
});
