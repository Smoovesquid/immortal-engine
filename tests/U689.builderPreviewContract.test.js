// U689 — BUILDER-PREVIEW-3: Preview 3D ships the SAME document the finalize/export
// path ships, its storage can NEVER touch a real save, and it renders through a
// THIN WRAPPER over the real gameplay renderer (mountSlice3D) — never its own
// renderer, never an engine world boot.
//
// Source-level guard on the two BROWSER surfaces (the projection geometry itself
// is covered by U691's pure test; the preview projection contract by U692):
//   1. the Builder's preview handler runs buildExportDoc() → validateAuthoredExport
//      → finalizeAuthoredExport — the identical gate + artifact as Validate &
//      Finalize (one shared helper, one export shape);
//   2. the ONLY key the Builder ever writes is the scratch key 'ie.builderPreview'
//      — never a game save slot (real saves live under save.js's 'ai-dm-v2:slot:*');
//   3. the preview page READS the scratch key, renders via the THIN adapter
//      (builderPreview3d.js) — and NEVER writes storage or imports the save module;
//   4. the adapter is a THIN PROJECTION over the gameplay renderer: it wraps
//      mountSlice3D and owns NO renderer / camera / lighting / architectural
//      geometry of its own (the rejected b155 dollhouse renderer is gone);
//   5. both surfaces say plainly, in persistent copy, what the preview is.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { slotKey } from '../engine/save.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILDER = fs.readFileSync(path.join(ROOT, 'public', 'house-builder.html'), 'utf8');
const PREVIEW = fs.readFileSync(path.join(ROOT, 'public', 'builder-preview.html'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'public', 'map', 'builderPreview3d.js'), 'utf8');

function previewHandler() {
  const start = BUILDER.indexOf("getElementById('btnPreview3d').addEventListener");
  assert.ok(start > 0, 'the Builder wires a Preview 3D button');
  // The whole handler (the popup fix opens window.open near the top now, so slice
  // by the handler body length, not up to the first window.open).
  return BUILDER.slice(start, start + 1700);
}

test('U689: Preview 3D opens the tab SYNCHRONOUSLY (before any await) so a strict popup blocker cannot swallow it', () => {
  const block = previewHandler();
  const openIdx = block.indexOf("window.open('', 'ie-builder-preview')") >= 0
    ? block.indexOf("window.open('', 'ie-builder-preview')")
    : block.indexOf("window.open('','ie-builder-preview')");
  const awaitIdx = block.indexOf('await ');
  assert.ok(openIdx > 0, 'the handler opens a blank named tab up front');
  assert.ok(awaitIdx > 0 && openIdx < awaitIdx, 'the window.open happens BEFORE the first await (still user-activated)');
  assert.ok(block.includes("win.location.href='/builder-preview.html'") || block.includes('win.location.href = "/builder-preview.html"'),
    'the opened tab is navigated to the preview page once the draft is stashed');
});

test('U689: Preview 3D runs the SAME document through the SAME gate as finalize', () => {
  const block = previewHandler();
  assert.ok(block.includes('buildExportDoc()'), 'preview starts from buildExportDoc() — the one export shape');
  assert.ok(block.includes('validateAuthoredExport'), 'preview validates via the engine loader-validator');
  assert.ok(block.includes('finalizeAuthoredExport'), 'preview ships the finalized artifact');
  assert.ok(block.includes('draftProblems(doc,report)'), 'preview explains failures with the SAME problem-lister finalize uses');
  const fin = BUILDER.slice(BUILDER.indexOf("getElementById('btnFinalize')"), BUILDER.indexOf("getElementById('btnPreview3d')"));
  assert.ok(fin.includes('draftProblems(doc,report)') && fin.includes('engineLoaderMod()'),
    'finalize shares the same helpers — one gate, two buttons');
});

test('U689: the Builder writes ONLY the scratch key — never a save slot', () => {
  const writes = [...BUILDER.matchAll(/localStorage\.setItem\(\s*'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(writes, ['ie.builderPreview'], 'exactly one storage write, the preview scratch key');
  assert.ok(!BUILDER.includes(slotKey('slot1')), 'the real save key never appears in the Builder');
  assert.ok(!writes.some(k => k.startsWith('ai-dm-v2:')), 'the scratch key is outside the save namespace');
});

test('U689: the preview page is read-only storage — renders via the thin adapter, no engine world', () => {
  assert.ok(PREVIEW.includes("localStorage.getItem('ie.builderPreview')"), 'reads the scratch key');
  assert.ok(!/localStorage\.(setItem|removeItem)/.test(PREVIEW), 'NEVER writes or clears storage — ephemeral by contract');
  assert.ok(!PREVIEW.includes('save.js') && !PREVIEW.includes('saveSlot'), 'never even imports the save module');
  assert.ok(PREVIEW.includes('mountBuilderPreview3D') && PREVIEW.includes('builderPreview3d.js'),
    'renders through the builder preview adapter');
  assert.ok(PREVIEW.includes('"three"') && PREVIEW.includes('importmap'),
    'carries the three.js import map the gameplay renderer needs');
  // No engine world boot leaks back in (the b153/b154 approach is gone for good).
  assert.ok(!PREVIEW.includes('beginAdventure') && !PREVIEW.includes('newWorld') && !PREVIEW.includes('registerBuilderPreviewHouse'),
    'the preview never boots an engine world — the raw doc is the input');
});

test('U689: the adapter is a THIN wrapper over the gameplay renderer — no renderer/camera/lighting/geometry of its own', () => {
  assert.ok(/import\s*\{[^}]*\bmountSlice3D\b[^}]*\}\s*from\s*'\.\/render3d\.js'/.test(ADAPTER),
    'the adapter mounts the REAL gameplay renderer (mountSlice3D), not a bespoke one');
  assert.ok(/from\s*'\.\/handDrawnInterior\.js'/.test(ADAPTER),
    'the ground ink is drawn by the SHARED hand-drawn-interior renderer (createInteriorMap)');
  // The rejected b155 dollhouse renderer owned all of these — the thin adapter owns NONE.
  assert.ok(!/WebGLRenderer/.test(ADAPTER), 'the adapter owns no THREE.WebGLRenderer');
  assert.ok(!/PerspectiveCamera|OrbitControls/.test(ADAPTER), 'the adapter owns no camera / controls');
  assert.ok(!/DirectionalLight|HemisphereLight|AmbientLight/.test(ADAPTER), 'the adapter owns no lighting rig');
  assert.ok(!/BoxGeometry|PlaneGeometry|CylinderGeometry|WALL_H/.test(ADAPTER), 'the adapter builds no architectural geometry');
  assert.ok(!/from\s*'three'|import\(\s*'three'\s*\)/.test(ADAPTER), 'the adapter never imports THREE directly — mountSlice3D owns THREE');
  assert.ok(!/buildArchetypeFigure/.test(ADAPTER), 'the adapter stands up no player / scale figure');
});

test('U689: both surfaces say plainly what the preview is — persistent target/status copy', () => {
  assert.ok(PREVIEW.includes('PREVIEW') && PREVIEW.includes('Nothing here is saved'),
    'the preview page banner names itself a preview and disclaims saving');
  assert.ok(BUILDER.includes('Preview 3D ↗'), 'the button signals it opens elsewhere');
  assert.ok(BUILDER.includes('place real objects into the building'),
    'the plain-English Builder goal line stays visible');
  // The corrected, un-stale target copy: the preview is this building alone on the
  // game's tabletop, with the placed furniture.
  assert.ok(/this building alone on the game'?s tabletop, with your placed furniture/.test(BUILDER),
    'the Builder states the corrected 3D Preview target plainly');
});
