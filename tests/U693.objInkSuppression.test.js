// U693 — OBJ-INK-1: in the 3D preview, a furniture glyph is suppressed from the
// ink ground ONLY when that exact object's real GLB mounted (userData.glb===true).
// Pure-2D and failed/unwired GLBs keep their ink mark; no block placeholder ever.
//
// Following the U692 split: the PURE contract (stable per-object ids that correlate
// the ink glyph, the prop, and the runtime GLB report) runs for real; the WIRING
// that only lives inside the browser renderer (the drawBase suppress option, the
// ground-texture refresh, the adapter's post-mount redraw) is proven as a
// source-contract against the actual file text — the glyph vanishing under the GLB
// is the live screenshot receipt (PLAYTEST_PROTOCOL), not a Node assertion.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectBuilderDoc } from '../public/map/builderPreview3d.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDER3D = fs.readFileSync(path.join(ROOT, 'public', 'map', 'render3d.js'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'public', 'map', 'builderPreview3d.js'), 'utf8');
const INK = fs.readFileSync(path.join(ROOT, 'public', 'map', 'handDrawnInterior.js'), 'utf8');
const flat = s => s.replace(/\n\s*/g, ' ');

// A 2-room cottage: hearth + table in the hall, a chair in the snug. Authored
// ux/uy (fraction inside the room) + rotation, exactly as the finalized doc carries.
function sampleDoc() {
  return {
    name: 'ink-test',
    rooms: [
      { id: 'hall', x: 0, y: 0, w: 6, h: 5, material: 'timber' },
      { id: 'snug', x: 6, y: 0, w: 4, h: 4, material: 'timber' },
    ],
    openings: [{ x: 6, y: 2, kind: 'door', orient: 'v' }],
    furniture: [
      { type: 'hearth', room: 'hall', x: 1, y: 0, w: 2, h: 1, ux: 0.20, uy: 0.05, rot: 0 },
      { type: 'table', room: 'hall', x: 2, y: 2, w: 2, h: 1, ux: 0.40, uy: 0.50, rot: 90 },
      { type: 'chair', room: 'snug', x: 7, y: 1, w: 1, h: 1, ux: 0.30, uy: 0.30, rot: 0 },
    ],
  };
}

// ── PURE: stable per-object identity correlates ink glyph ↔ prop ↔ GLB report ──

test('U693: projectBuilderDoc gives every prop a stable, distinct id', () => {
  const proj = projectBuilderDoc(sampleDoc());
  assert.equal(proj.props.length, 3, 'all three pieces project to props');
  for (const p of proj.props) assert.ok(p.id != null && String(p.id).length > 0, 'every prop carries a stable id');
  const ids = proj.props.map(p => String(p.id));
  assert.equal(new Set(ids).size, 3, 'distinct pieces get distinct ids');
});

test('U693: every ink furniture glyph carries the SAME id set as the props', () => {
  const proj = projectBuilderDoc(sampleDoc());
  for (const f of proj.sceneModel.furniture) assert.ok(f.id != null && String(f.id).length > 0, 'every ink glyph carries a stable id');
  const inkIds = proj.sceneModel.furniture.map(f => String(f.id));
  const propIds = proj.props.map(p => String(p.id));
  assert.deepEqual(new Set(inkIds), new Set(propIds),
    'the ink glyph and the prop for the same piece share one id — so a mounted GLB suppresses exactly its own glyph');
});

test('U693: ids are deterministic across calls (replay-safe)', () => {
  const a = projectBuilderDoc(sampleDoc()).props.map(p => String(p.id));
  const b = projectBuilderDoc(sampleDoc()).props.map(p => String(p.id));
  assert.deepEqual(a, b, 'same doc → same ids');
});

// ── SOURCE CONTRACT: the shared ink renderer takes an ID-keyed suppress option ──

test('U693: drawBase reads an id-keyed suppressFurnitureIds option', () => {
  assert.ok(/suppressFurnitureIds/.test(INK),
    'the shared hand-drawn interior renderer reads an id-keyed furniture suppression option');
});

test('U693: a suppressed glyph short-circuits by id WITHOUT re-indexing the jitter key', () => {
  // The surviving glyphs must be byte-identical between the first (un-suppressed)
  // draw and the redraw, so the loop must skip by id but keep the loop index i for
  // the deterministic jitter key ('F' + i).
  assert.ok(/'F' \+ i/.test(INK), 'the furniture jitter key still uses the loop index i (no re-indexing)');
  assert.ok(/\.has\(String\(f\.id\)\)\) return/.test(INK),
    'a suppressed id (set membership on f.id) returns early — before the glyph is drawn, index untouched');
});

test('U693: drawBase suppresses nothing by default — pure 2D / live gameplay keeps every glyph', () => {
  assert.ok(/function draw\(model, opts\b/.test(INK),
    'draw takes an optional opts, defaulting to no suppression (the live LocalMap call is unchanged)');
});

// ── SOURCE CONTRACT: render3d reports per-object GLB truth + a ground refresh ──

test('U693: the preview report carries a per-object id alongside wired/glb', () => {
  assert.ok(/previewProps\.push\(\{[^}]*\bid\b/.test(flat(RENDER3D)),
    'each reported prop carries its stable id, so the adapter maps a mounted GLB back to its glyph');
});

test('U693: the preview ground exposes a refresh that re-stamps the CanvasTexture', () => {
  assert.ok(/needsUpdate\s*=\s*true/.test(flat(RENDER3D)),
    'the preview ground marks its CanvasTexture needsUpdate so a redraw actually shows');
  assert.ok(/refreshGround/.test(RENDER3D),
    'the preview control exposes refreshGround so the adapter can re-texture after suppressing');
});

// ── SOURCE CONTRACT: the adapter redraws with suppression AFTER the GLBs mount ──

test('U693: the adapter suppresses ONLY ids whose GLB actually resolved, then refreshes', () => {
  const f = flat(ADAPTER);
  assert.ok(/p\.glb\b/.test(f),
    'the suppress set is drawn from the RUNTIME glb-success flag, not from artForKind.wired');
  assert.ok(/suppressFurnitureIds/.test(ADAPTER),
    'the adapter redraws the ink with the mounted-object ids suppressed');
  assert.ok(/refreshGround/.test(ADAPTER),
    'after the redraw the adapter refreshes the ground texture');
});

test('U693: the props handed to the renderer carry their stable id', () => {
  assert.ok(/id:\s*p\.id/.test(ADAPTER),
    'each prop passed into mountSlice3D carries its stable id');
});

test('U693: suppression never fabricates a placeholder — a missing GLB leaves the ink glyph', () => {
  assert.ok(!/BoxGeometry|CylinderGeometry/.test(ADAPTER),
    'the adapter never fabricates a block; a failed/unwired GLB keeps its honest ink mark');
});
