// U689 — BUILDER-PREVIEW-1: the Preview 3D flow ships the SAME document the
// finalize/export path ships, and its storage can never touch a real save.
//
// Companion to U688 (which proves the engine seam behaviorally). This file
// guards the two BROWSER surfaces at source level, the way U685 guards the
// palette law:
//   1. the Builder's preview handler runs buildExportDoc() → validateAuthoredExport
//      → finalizeAuthoredExport — the identical gate + artifact as Validate &
//      Finalize (one shared helper, one export shape; no second geometry pass);
//   2. the ONLY key the Builder ever writes is the scratch key 'ie.builderPreview'
//      — never a game save slot (real saves live under save.js's 'ai-dm-v2:slot:*');
//   3. the preview page READS the scratch key, registers it on the engine seam,
//      boots the 'builderPreview' seed, mounts the game's own renderContinuousMap
//      — and NEVER writes storage or imports the save module at all;
//   4. both pages say plainly that the preview is not the real game.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { slotKey } from '../engine/save.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILDER = fs.readFileSync(path.join(ROOT, 'public', 'house-builder.html'), 'utf8');
const PREVIEW = fs.readFileSync(path.join(ROOT, 'public', 'builder-preview.html'), 'utf8');

// The preview button's handler block, by its own anchors.
function previewHandler() {
  const start = BUILDER.indexOf("getElementById('btnPreview3d').addEventListener");
  assert.ok(start > 0, 'the Builder wires a Preview 3D button');
  const block = BUILDER.slice(start, BUILDER.indexOf('window.open', start) + 200);
  return block;
}

test('U689: Preview 3D runs the SAME document through the SAME gate as finalize', () => {
  const block = previewHandler();
  assert.ok(block.includes('buildExportDoc()'), 'preview starts from buildExportDoc() — the one export shape');
  assert.ok(block.includes('validateAuthoredExport'), 'preview validates via the engine loader-validator');
  assert.ok(block.includes('finalizeAuthoredExport'), 'preview ships the finalized artifact (strict-load provenance)');
  assert.ok(block.includes('draftProblems(doc,report)'), 'preview explains failures with the SAME problem-lister finalize uses');
  // and finalize itself uses the shared pieces (no second copy of the gate)
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

test('U689: the preview page is read-only storage — boots ephemeral, mounts the game renderer', () => {
  assert.ok(PREVIEW.includes("localStorage.getItem('ie.builderPreview')"), 'reads the scratch key');
  assert.ok(!/localStorage\.(setItem|removeItem)/.test(PREVIEW), 'NEVER writes or clears storage — ephemeral by contract');
  assert.ok(!PREVIEW.includes('save.js') && !PREVIEW.includes('saveSlot'), 'never even imports the save module');
  assert.ok(PREVIEW.includes('registerBuilderPreviewHouse'), 'arms the engine seam with the draft');
  assert.ok(PREVIEW.includes("seed: 'builderPreview'"), 'boots the opt-in preview seed');
  assert.ok(PREVIEW.includes('beginAdventure') && PREVIEW.includes('renderContinuousMap'),
    'the world and the view are the game\'s own — no bespoke renderer');
  // render3d.js imports the bare specifier 'three'; without this import map the
  // 3D mount throws and the map silently latches 2D (_failed). Found live.
  assert.ok(PREVIEW.includes('"three"') && PREVIEW.includes('importmap'),
    'the page carries v1.html\'s three.js import map so the diorama can mount');
});

test('U689: both surfaces say plainly what the preview is', () => {
  assert.ok(PREVIEW.includes('PREVIEW') && PREVIEW.includes('Nothing here is saved'),
    'the preview page banner names itself a preview and disclaims saving');
  assert.ok(BUILDER.includes('Preview 3D ↗'), 'the button signals it opens elsewhere');
  assert.ok(BUILDER.includes('place real objects into the building'),
    'the plain-English Builder goal line stays visible');
});
