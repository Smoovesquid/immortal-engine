// builderPreview3d.js — a dedicated 3D INTERIOR preview of a House Builder draft.
//
// BUILDER-PREVIEW-2 (Tim's bar, 2026-07-11): the preview must show the AUTHORED
// building — the room shell (floor + walls), the furniture standing inside it at
// the drawn positions, a person for scale — framed so you instantly recognise
// "this is the house I drew." The overworld/settlement diorama can't do this: by
// design it draws architecture as INK on a flat ground sheet (TT-INK), so walls
// never rise. This renderer instead draws the floor plan DIRECTLY as geometry.
//
// It is fed the raw builder export (doc.rooms {x,y,w,h,shape,material}, doc.openings
// {x,y,room,entrance}, doc.furniture {type,ux,uy,rot,...}) — no engine world boot.
// Furniture reuses the GAME's GLB mini builder (figures3d buildPropMini, already
// GLB-wired per BUILDER-OBJ-2) so a placed table looks like the game's table; the
// person reuses buildArchetypeFigure. The room shell is simple lit geometry.
//
// buildPreviewLayout(doc) is PURE (no THREE) so the plan→geometry mapping is unit-
// tested in node (U691); mountBuilderPreview3D() is the thin Three.js consumer.

import {
  buildPropMini, buildArchetypeFigure, propTrueSize,
  measureAuthoredSize, measureAuthoredFootprint, figureHeightWu,
} from './figures3d.js';

// A builder cell is ~0.7 m. Furniture is true-sized by its GLB (metres), and this
// scale makes a piece fill the cell footprint it was drawn on (a 2×3-cell bed ≈
// 1.4×2.1 m — a real bed), so drawn layout and real furniture agree.
export const PREVIEW_CELL_M = 0.7;
const WALL_H = 2.2;      // metres — tall enough to read as a room, open-topped (no roof) so an angled camera sees in
const DOOR_W_CELLS = 1.2; // doorway gap left in a wall where an opening sits

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// ── PURE layout core (doc → world-space geometry spec; testable without THREE) ──

function onRoomEdge(o, r) {
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h, t = 0.6;
  const onH = (Math.abs(o.y - y0) < t || Math.abs(o.y - y1) < t) && o.x >= x0 - t && o.x <= x1 + t;
  const onV = (Math.abs(o.x - x0) < t || Math.abs(o.x - x1) < t) && o.y >= y0 - t && o.y <= y1 + t;
  return onH || onV;
}
const centerIn = (f, r) => {
  const cx = num(f.x) + num(f.w, 1) / 2, cy = num(f.y) + num(f.h, 1) / 2;
  return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
};

// One room's 4 edges as wall segments (cell coords), each split to leave a DOOR_W
// gap wherever an opening sits on it — so a doorway is a real hole you can see through.
function edgeSegments(r, ops) {
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h, t = 0.6, half = DOOR_W_CELLS / 2;
  const edges = [
    { axis: 'h', fixed: y0, lo: x0, hi: x1 }, // north
    { axis: 'h', fixed: y1, lo: x0, hi: x1 }, // south
    { axis: 'v', fixed: x0, lo: y0, hi: y1 }, // west
    { axis: 'v', fixed: x1, lo: y0, hi: y1 }, // east
  ];
  const out = [];
  for (const e of edges) {
    const along = ops
      .filter(o => (e.axis === 'h' ? Math.abs(o.y - e.fixed) < t : Math.abs(o.x - e.fixed) < t))
      .map(o => (e.axis === 'h' ? o.x : o.y))
      .filter(p => p > e.lo - t && p < e.hi + t)
      .sort((a, b) => a - b);
    let cursor = e.lo;
    const emit = (lo, hi) => {
      if (hi - lo < 0.05) return;
      out.push(e.axis === 'h'
        ? { ax: lo, ay: e.fixed, bx: hi, by: e.fixed }
        : { ax: e.fixed, ay: lo, bx: e.fixed, by: hi });
    };
    for (const p of along) {
      const gs = Math.max(e.lo, p - half), ge = Math.min(e.hi, p + half);
      if (gs > cursor) emit(cursor, gs);
      cursor = Math.max(cursor, ge);
    }
    if (cursor < e.hi) emit(cursor, e.hi);
  }
  return out;
}

export function buildPreviewLayout(doc, { cellM = PREVIEW_CELL_M } = {}) {
  const rooms = Array.isArray(doc?.rooms) ? doc.rooms : [];
  const openings = Array.isArray(doc?.openings) ? doc.openings : [];
  const furniture = Array.isArray(doc?.furniture) ? doc.furniture : [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) { minX = minY = 0; maxX = maxY = 10; }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const toX = (bx) => (bx - cx) * cellM;   // world X (east)
  const toZ = (by) => (by - cy) * cellM;   // world Z (builder y-down → +Z south)

  const roomOut = rooms.map(r => ({
    id: String(r.id), material: String(r.material || 'timber'), role: String(r.role || ''),
    dark: !!r.dark, shape: String(r.shape || 'rect'),
    cxW: toX(r.x + r.w / 2), czW: toZ(r.y + r.h / 2), w: r.w * cellM, d: r.h * cellM,
    rxW: (r.w / 2) * cellM, rzW: (r.h / 2) * cellM,
  }));

  const walls = [];
  for (const r of rooms) {
    if (String(r.shape) === 'round') {
      walls.push({ round: true, cxW: toX(r.x + r.w / 2), czW: toZ(r.y + r.h / 2), rxW: (r.w / 2) * cellM, rzW: (r.h / 2) * cellM, material: String(r.material || 'timber') });
      continue;
    }
    const ops = openings.filter(o => String(o.room || '') === String(r.id) || onRoomEdge(o, r));
    for (const s of edgeSegments(r, ops)) {
      walls.push({ x1: toX(s.ax), z1: toZ(s.ay), x2: toX(s.bx), z2: toZ(s.by), material: String(r.material || 'timber') });
    }
  }

  const byId = new Map(rooms.map(r => [String(r.id), r]));
  const furnitureOut = furniture.map(f => {
    const room = byId.get(String(f.room || '')) || rooms.find(r => centerIn(f, r)) || null;
    let bx, by;
    if (room && Number.isFinite(+f.ux) && Number.isFinite(+f.uy)) {
      bx = room.x + (+f.ux) * room.w; by = room.y + (+f.uy) * room.h;
    } else {
      bx = num(f.x) + num(f.w, 1) / 2; by = num(f.y) + num(f.h, 1) / 2;
    }
    return { kind: String(f.type || f.kind || ''), x: toX(bx), z: toZ(by), rot: num(f.rot, 0), wCells: num(f.w, 1), hCells: num(f.h, 1) };
  }).filter(f => f.kind);

  // The person stands in the entrance room (or the first room) for scale.
  const entry = openings.find(o => o.entrance);
  const entryRoom = entry ? (byId.get(String(entry.room || '')) || rooms.find(r => onRoomEdge(entry, r))) : null;
  const pr = entryRoom || rooms[0] || null;
  const player = pr ? { x: toX(pr.x + pr.w / 2), z: toZ(pr.y + pr.h / 2) } : { x: 0, z: 0 };

  return {
    cellM, rooms: roomOut, walls, furniture: furnitureOut, player,
    bounds: { minX: toX(minX), maxX: toX(maxX), minZ: toZ(minY), maxZ: toZ(maxY), w: (maxX - minX) * cellM, d: (maxY - minY) * cellM },
  };
}

// ── Three.js mount (thin consumer of the pure layout) ──

const FLOOR_COL = { timber: 0x7c5a34, stone: 0x6f7078 };
const WALL_COL = { timber: 0x9c7746, stone: 0x8a8b93 };

export async function mountBuilderPreview3D(container, doc, opts = {}) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  // Preload the GLB furniture + figure template pools so buildPropMini/buildArchetypeFigure
  // resolve to real sculpts on first build (a static preview never takes a turn to swap them in).
  try {
    const [tree, fig] = await Promise.all([import('./treeAssets.js'), import('./figureAssets.js')]);
    await Promise.all([tree.ensureFoliageGLBs?.(), fig.ensureFigureGLB?.('player')]);
  } catch { /* procedural fallbacks are fine */ }

  const layout = buildPreviewLayout(doc, opts);
  let W = container.clientWidth || 1280, H = container.clientHeight || 800;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x181a1f);
  const camera = new THREE.PerspectiveCamera(44, W / H, 0.03, 400);

  scene.add(new THREE.HemisphereLight(0xbcd2f0, 0x3a3020, 0.9));
  const sun = new THREE.DirectionalLight(0xffe6b0, 1.45);
  sun.position.set(6, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const ext = Math.max(6, Math.max(layout.bounds.w, layout.bounds.d));
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 60 });
  scene.add(sun);
  // A second soft fill from the opposite side + brighter ambient so the interior
  // furniture reads from any orbit angle (the walls otherwise shadow the pieces).
  const fill = new THREE.DirectionalLight(0xdfeaff, 0.5); fill.position.set(-8, 9, -6); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xfff0d8, 0.5));

  const ROOT = new THREE.Group(); scene.add(ROOT);

  // A dim ground pad under the whole building, so it doesn't float in the void.
  {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.bounds.w + 6, layout.bounds.d + 6),
      new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 1 }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = -0.02; pad.receiveShadow = true;
    ROOT.add(pad);
  }

  // Floors (one lit slab per room; dark rooms dimmer).
  for (const r of layout.rooms) {
    const col = FLOOR_COL[r.material] || FLOOR_COL.timber;
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0.02 });
    if (r.dark) mat.color.multiplyScalar(0.55);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.2, r.w), Math.max(0.2, r.d)), mat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(r.cxW, 0, r.czW); floor.receiveShadow = true;
    ROOT.add(floor);
    // a thin skirting border so each room reads as its own cell even where floors abut
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(r.w, r.d)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
    edge.rotation.x = -Math.PI / 2; edge.position.set(r.cxW, 0.005, r.czW); ROOT.add(edge);
  }

  // Walls (box beams tracing each edge; door gaps already cut in the layout).
  const WALL_T = 0.12;
  for (const w of layout.walls) {
    const mat = new THREE.MeshStandardMaterial({ color: WALL_COL[w.material] || WALL_COL.timber, roughness: 0.85 });
    if (w.round) {
      const rad = (w.rxW + w.rzW) / 2;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, WALL_H, 40, 1, true), mat);
      mat.side = THREE.DoubleSide;
      ring.position.set(w.cxW, WALL_H / 2, w.czW); ring.castShadow = true; ROOT.add(ring);
      continue;
    }
    const dx = w.x2 - w.x1, dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz); if (len < 0.05) continue;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, WALL_H, WALL_T), mat);
    beam.position.set((w.x1 + w.x2) / 2, WALL_H / 2, (w.z1 + w.z2) / 2);
    beam.rotation.y = -Math.atan2(dz, dx);
    beam.castShadow = true; beam.receiveShadow = true;
    ROOT.add(beam);
  }

  // Furniture — the game's own GLB minis, true-sized (scene units are metres), at
  // the drawn positions. Kinds without a mini get a labelled box so nothing the
  // player placed silently vanishes.
  for (const f of layout.furniture) {
    let mini = null;
    try { mini = buildPropMini(THREE, f.kind); } catch { mini = null; }
    if (mini) {
      const ts = propTrueSize(f.kind);
      let pAuth = 1;
      try { pAuth = ts.axis === 'footprint' ? measureAuthoredFootprint(THREE, mini) : measureAuthoredSize(THREE, mini, ts.axis); } catch {}
      const s = (ts.wu || 1) / (pAuth || 1);   // ts.wu is metres; scene is metres
      if (Number.isFinite(s) && s > 0) mini.scale.multiplyScalar(s);
    } else {
      const w = Math.max(0.3, f.wCells * layout.cellM * 0.8), d = Math.max(0.3, f.hCells * layout.cellM * 0.8);
      mini = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d),
        new THREE.MeshStandardMaterial({ color: 0x9c6b3e, roughness: 0.9 }));
      mini.position.y = 0.35;
    }
    const holder = new THREE.Group();
    holder.add(mini);
    holder.position.set(f.x, 0, f.z);
    holder.rotation.y = -(f.rot || 0) * Math.PI / 180;
    holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    ROOT.add(holder);
  }

  // The person, for scale — the same figure the game stands you up as.
  try {
    const fig = buildArchetypeFigure(THREE, 'humanoid', {});
    const targetH = figureHeightWu('human') || 1.8;
    let h = 1;
    try { h = measureAuthoredSize(THREE, fig, 'y') || 1; } catch {}
    const s = targetH / h;
    if (Number.isFinite(s) && s > 0) fig.scale.multiplyScalar(s);
    fig.position.set(layout.player.x, 0, layout.player.z);
    fig.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    ROOT.add(fig);
  } catch { /* the room reads fine without the figure */ }

  // Camera framed on the building — a 3/4 dollhouse view from above the SE corner,
  // distance derived from the bounds diagonal so the whole plan sits in frame.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.target.set(0, 0.6, 0);
  const diag = Math.max(4, Math.hypot(layout.bounds.w, layout.bounds.d));
  const dist = diag * 1.15 + 3;
  const frame = () => {
    camera.position.set(dist * 0.62, dist * 0.82, dist * 0.62);
    controls.target.set(0, 0.5, 0); controls.update();
  };
  frame();

  let alive = true;
  const render = () => renderer.render(scene, camera);
  const loop = () => { if (!alive) return; controls.update(); render(); requestAnimationFrame(loop); };
  loop();

  const onResize = () => {
    W = container.clientWidth || W; H = container.clientHeight || H;
    renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  return {
    canvas: renderer.domElement,
    layout,
    resetView: frame,
    dispose() {
      alive = false;
      window.removeEventListener('resize', onResize);
      try { controls.dispose(); } catch {}
      try { renderer.dispose(); } catch {}
      try { renderer.domElement.remove(); } catch {}
    },
  };
}
