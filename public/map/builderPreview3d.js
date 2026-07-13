// builderPreview3d.js — a THIN projection adapter for the House Builder's
// "Preview 3D": your building ALONE, on the GAME's own graph-paper/tabletop
// surface, at the game's normal tilted 3D map POV, with your placed furniture as
// real GLB minis at the authored positions + rotations.
//
// BUILDER-PREVIEW-3 (Tim's correction of b155): the b155 renderer drew its OWN
// look — raised box-beam walls, colored floor slabs, a scale person, a bespoke
// camera, generic-block fallbacks. That was a THIRD visual direction. The correct
// architecture is a thin wrapper around the REAL gameplay 3D renderer:
//
//   finalized builder doc
//     -> projectBuilderDoc()  (PURE: doc -> canonical ink scene model + authored
//                              prop transforms + isolated building bounds)
//     -> createInteriorMap()  (the SHARED hand-drawn floorplan renderer draws the
//                              graph-paper + ink onto an offscreen canvas)
//     -> mountSlice3D({ preview })  (the game's OWN camera / lighting / tabletop /
//                              GLB prop presentation — see render3d.js's seam)
//
// This module owns NO renderer, camera, lighting, or architectural geometry (it
// never even imports THREE) — mountSlice3D owns all of that. It only derives the
// projection and hands it over. The finalized RAW builder furniture is the source
// of truth for prop placement (room / ux / uy / rot) — the preview never loses the
// authored rotation the engine's own materialization may drop.

import { mountSlice3D } from './render3d.js';
import { createInteriorMap } from './handDrawnInterior.js';

// A builder cell is ~0.7 m (the same figure b155 pinned, so real furniture fills
// the cell footprint it was drawn on). The one place metres enter the projection.
export const PREVIEW_CELL_M = 0.7;

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// ── PURE projection: builder doc → canonical ink scene model + props + bounds ──
// No THREE, no canvas, no DOM — unit-tested (U691). Produces exactly what the two
// downstream consumers need: `sceneModel` for the shared floorplan ink renderer,
// `props` (authored CENTER in cells + rotation) for the gameplay prop path, and
// `bounds` (cells) isolated to just the drawn building for camera framing.
export function projectBuilderDoc(doc) {
  const rooms = Array.isArray(doc?.rooms) ? doc.rooms : [];
  const openings = Array.isArray(doc?.openings) ? doc.openings : [];
  const furniture = Array.isArray(doc?.furniture) ? doc.furniture : [];

  // The shared ink renderer draws ONE material band (rock hatch). Use the first
  // room's material (the ink is a floorplan, not a material study). timber default.
  const material = String(rooms[0]?.material || 'timber');

  // rooms → the canonical interior scene-model room shape (CENTER + size + name).
  const sceneRooms = rooms.map(r => {
    const shape = r.shape === 'round' ? 'round' : 'rect';
    const w = num(r.w, 1), h = num(r.h, 1);
    const cx = Number.isFinite(+r.cx) ? +r.cx : num(r.x) + w / 2;
    const cy = Number.isFinite(+r.cy) ? +r.cy : num(r.y) + h / 2;
    return { id: String(r.id), shape, cx, cy, w, h, r: Number.isFinite(+r.r) ? +r.r : Math.min(w, h) / 2, name: r.name || r.role || String(r.id) };
  });

  // openings → ink doors + windows. The glyphs read orient 'h'|'v'; an 'angled'
  // opening (rare) defaults to horizontal.
  const orientOf = o => {
    if (o.orient === 'v' || o.orient === 'h') return o.orient;
    const m = ((num(o.angle) % 180) + 180) % 180;
    return (m > 45 && m < 135) ? 'v' : 'h';
  };
  const doors = [], windows = [];
  for (const o of openings) {
    const rec = { x: num(o.x), y: num(o.y), orient: orientOf(o) };
    if (String(o.kind) === 'window') windows.push({ ...rec, t: 'casement', len: num(o.len, 0.7) });
    else doors.push(rec);
  }

  // OBJ-INK-1 — a stable per-object id, minted once on the RAW furniture element and
  // carried onto BOTH the ink glyph and the 3-D prop, so a GLB that mounts can
  // suppress exactly its own glyph (never the wrong one, never all-or-nothing). It
  // prefers an id the finalized doc already carries (id/pieceId — the forward path
  // for gameplay's stable object identity in OBJ-STATE-1) and otherwise mints a
  // deterministic index id. Both derivations below filter on the same predicate, so
  // minting on the raw element keeps the two views correlated by construction.
  const furnId = (f, i) => (f && f.id != null ? String(f.id) : f && f.pieceId != null ? String(f.pieceId) : 'fp-' + i);

  // furniture → ink glyphs (absolute top-left cell + size — the SAME the Builder draws).
  const inkFurniture = furniture
    .map((f, i) => ({ f, id: furnId(f, i) }))
    .filter(({ f }) => f.type || f.kind)
    .map(({ f, id }) => ({ id, type: String(f.type || f.kind), ux: num(f.x), uy: num(f.y), uw: num(f.w, 1), uh: num(f.h, 1) }));

  // furniture → props: authored CENTER in cells (from the finalized ux/uy inside
  // its room — the truthful placement) + rotation, both preserved verbatim.
  const rawRoomById = new Map(rooms.map(r => [String(r.id), r]));
  const props = furniture.map((f, i) => {
    const kind = String(f.type || f.kind || '');
    if (!kind) return null;
    const room = rawRoomById.get(String(f.room || ''));
    let cellX, cellY;
    if (room && Number.isFinite(+f.ux) && Number.isFinite(+f.uy)) {
      cellX = num(room.x) + (+f.ux) * num(room.w, 1);
      cellY = num(room.y) + (+f.uy) * num(room.h, 1);
    } else {
      cellX = num(f.x) + num(f.w, 1) / 2;
      cellY = num(f.y) + num(f.h, 1) / 2;
    }
    return { id: furnId(f, i), kind, cellX, cellY, rot: num(f.rot, 0), room: room ? String(room.id) : null };
  }).filter(Boolean);

  // isolated building bounds (cells) — just the union of the drawn rooms.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, num(r.x)); minY = Math.min(minY, num(r.y));
    maxX = Math.max(maxX, num(r.x) + num(r.w, 1)); maxY = Math.max(maxY, num(r.y) + num(r.h, 1));
  }
  if (!Number.isFinite(minX)) { minX = minY = maxX = maxY = 0; }

  const sceneModel = {
    material,
    rooms: sceneRooms,
    doors, windows,
    corridors: [],
    furniture: inkFurniture,
    tokens: [], // the preview shows JUST the building — no player / NPC token
  };
  return { material, sceneModel, props, bounds: { minX, minY, maxX, maxY } };
}

// ── PURE honesty banner: reflect the RUNTIME prop facts, never hard-code success ──
// report.props = [{ kind, wired, glb }] from the renderer's preview projection.
// Success stays compact; only FAILURES expand (a wired GLB that didn't resolve, or
// a kind with no registered GLB whose ink mark stands alone).
export function previewBanner(report) {
  const props = Array.isArray(report?.props) ? report.props : [];
  const wired = props.filter(p => p.wired);
  const placed = wired.filter(p => p.glb);
  const failed = wired.filter(p => !p.glb);
  const noArt = props.filter(p => !p.wired && !p.glb);
  const line = 'Preview proves: ' + [
    'your building only',
    'graph-paper floorplan',
    `${placed.length}/${wired.length} placed GLBs`,
    'game camera',
    'save untouched',
  ].join(' · ');
  const warnings = [];
  if (failed.length) {
    const kinds = [...new Set(failed.map(p => p.kind))].join(', ');
    warnings.push(`Furniture art incomplete: ${kinds} GLB failed. No placeholder was shown.`);
  }
  if (noArt.length) {
    const kinds = [...new Set(noArt.map(p => p.kind))].join(', ');
    warnings.push(`No 3D art registered yet for: ${kinds} — the ink mark is shown honestly, with no stand-in.`);
  }
  return { line, warnings, ok: failed.length === 0 && noArt.length === 0 };
}

// ── the browser mount: draw the ink ground, then hand it to the gameplay renderer ──
// Returns { ctrl, proj, report, banner, empty }. Owns no THREE — createInteriorMap
// draws a 2-D canvas, mountSlice3D owns the whole 3-D scene.
export async function mountBuilderPreview3D(container, doc) {
  const proj = projectBuilderDoc(doc);
  if (!proj.sceneModel.rooms.length) {
    const report = { props: [] };
    return { ctrl: null, proj, report, banner: previewBanner(report), empty: true };
  }

  // Warm the GLB furniture pool so the game's buildPropMini resolves real sculpts
  // on the first (static) mount — a preview never takes a turn to swap a late
  // template in. (This is a pool warm, not a THREE import — treeAssets owns THREE.)
  // ensureFoliageGLBs() early-returns if a load is already in flight (it kicks off
  // on import), so its await alone can return MID-load; poll treeGLBsReady() — which
  // flips true only once the WHOLE REG finished (state='ready' is set once, after
  // the last template) — so every wired furniture GLB is ready before we mount.
  try {
    const t = await import('./treeAssets.js');
    await t.ensureFoliageGLBs?.();
    const deadline = Date.now() + 6000;
    while (!t.treeGLBsReady?.() && Date.now() < deadline) await new Promise(r => setTimeout(r, 60));
  } catch { /* procedural nothing — reported honestly */ }

  // 1) Draw the CANONICAL graph-paper + ink floorplan onto an offscreen canvas via
  //    the SHARED hand-drawn-interior renderer (grid · rock band · inked walls ·
  //    door swings · furniture glyphs) — the exact routine the live LocalMap uses.
  const b = proj.bounds;
  const cellsW = Math.max(1, b.maxX - b.minX), cellsH = Math.max(1, b.maxY - b.minY);
  const PX_PER_CELL = 46, MARGIN_CELLS = 3, CAP = 2200;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(CAP, Math.round((cellsW + MARGIN_CELLS * 2) * PX_PER_CELL));
  canvas.height = Math.min(CAP, Math.round((cellsH + MARGIN_CELLS * 2) * PX_PER_CELL));
  const ink = createInteriorMap(canvas, { seed: doc?.name || 'builder-preview' });
  ink.drawBase(proj.sceneModel); // floorplan only — NO tokens (no player figure)
  const TT = ink.transform;      // { s: px/cell, ox, oy } — the fit transform the ink used

  // 2) ONE mapping, derived from the SAME fit transform the ink drew with, so every
  //    prop lands exactly on its drawn mark. s px = 1 cell = PREVIEW_CELL_M metres;
  //    the ground plane is centered at the scene origin, so a canvas pixel (px,py)
  //    maps to scene ((px - W/2)·mPerPx, (py - H/2)·mPerPx).
  const mPerPx = PREVIEW_CELL_M / TT.s;
  const cellToScene = (cx, cy) => ({
    x: (TT.ox + cx * TT.s - canvas.width / 2) * mPerPx,
    z: (TT.oy + cy * TT.s - canvas.height / 2) * mPerPx,
  });

  const props = proj.props.map(p => {
    const s = cellToScene(p.cellX, p.cellY);
    return { id: p.id, kind: p.kind, x: s.x, z: s.z, rot: p.rot };
  });
  const c0 = cellToScene(b.minX, b.minY), c1 = cellToScene(b.maxX, b.maxY);
  const bounds = { minX: Math.min(c0.x, c1.x), maxX: Math.max(c0.x, c1.x), minZ: Math.min(c0.z, c1.z), maxZ: Math.max(c0.z, c1.z) };
  const groundSize = { w: canvas.width * mPerPx, d: canvas.height * mPerPx };

  // 3) Hand the ground canvas + prop transforms + isolated bounds to the REAL
  //    gameplay renderer. Empty nodes/edges + no world → no settlement/terrain/NPC
  //    content can enter. showPlayer:false → no scale figure.
  const ctrl = await mountSlice3D(container, {
    nodes: [], edges: [], seed: doc?.name || 'builder-preview', bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  }, {
    preview: { groundCanvas: canvas, groundSize, groundCenter: { x: 0, z: 0 }, props, bounds, showPlayer: false },
  });

  const report = (ctrl && ctrl.preview) || { props: [] };

  // OBJ-INK-1 — the glyphs are drawn; the GLBs are mounted; the report tells us
  // which objects ACTUALLY resolved a real GLB (glb === true, not merely wired). Now
  // redraw the ink ground with exactly those ids suppressed, so a mounted mini isn't
  // doubled by an outline beneath it — while a failed/unwired GLB keeps its honest
  // ink mark. Only the successfully-mounted set is passed, so the redraw is truthful
  // by construction. Then re-stamp the ground texture the 3-D plane samples.
  const mounted = new Set((report.props || []).filter(p => p.glb).map(p => String(p.id)));
  if (mounted.size) {
    ink.drawBase(proj.sceneModel, { suppressFurnitureIds: mounted });
    ctrl?.preview?.refreshGround?.();
  }

  return { ctrl, proj, report, banner: previewBanner(report), empty: false };
}
