// 3D OVERWORLD RENDERER — the mountable form of the slice proto (MAP_PATH bridge).
//
// Factored out of public/map-proto/slice.html so the live game (public/v1.js)
// can drop a 3D overworld into its Map screen. This is a PURE VIEW: it consumes
// a `slice-overworld-scene/v1` object (from engine-reading sliceScene.js's
// sceneFromWorld) and draws it. It NEVER writes engine state and touches nothing
// worldHash/determinism depend on — the same guarantee the 2D map has.
//
// Three.js is LAZY-LOADED from the CDN via the importmap declared in v1.html, so
// it costs zero bytes at first paint; the fetch only happens the moment a player
// opts into 3D. If WebGL is unavailable (or the import fails), mountSlice3D
// throws and the caller falls back to the 2D map — 3D is an enhancement, never a
// hard dependency.
//
// API:
//   mountSlice3D(container, scene, opts?) -> Promise<{ dispose() }>
//     container : a DOM element (already in the document); gets the canvas.
//     scene     : a slice-overworld-scene/v1 object.
//     opts.world: the RAW world object (TT-WORLD) — lets the tilt view's ground
//                 mount a hidden 2-D sheet (renderOneMap) as its texture source
//                 and resolve the SAME playerFocusWu point the ink marker uses.
//                 Optional: falls back to the scene's node-bounds center when
//                 absent (a bare-sceneData caller, e.g. a lab page).
//     throws    : Error('webgl-unavailable') or an import error when 3D can't run.

const TILE_WU = 40; // world units per node tile — keeps the 3D geography to scale.

// Procedural archetype minis + idle breathe (MAPNINJA Step 5), plus the
// TT-PROPS standing-prop mini builder (barrels/beds/dressers/chests) and
// MR-3b's wild-feature mini builder (trees/boulders/brush/deadfall/stumps).
// Pure helpers; they receive the lazily-imported THREE, so this stays a
// zero-cost static import.
import { buildArchetypeFigure, buildPropMini, buildWildMini, buildCorpseMini, breatheMinis, phaseFromKey, miniSheetScale, figureHeightWu, propTrueSize, measureAuthoredSize, wildTrueSize, measureAuthoredFootprint } from './figures3d.js';

// World-asset builders (terrain, dirt roads, settlements, woods, the chapel ruin) —
// the SAME pure-view module the standalone asset lab (map-proto/asset-lab.html) uses,
// so a look designed there flows straight to the game on reload. THREE + the seeded
// RNG are passed in; this stays a zero-cost static import (no three fetch of its own).
import {
  nodeRng, createWorldMaterials, buildEdge,
  buildSettlement, buildWilderness, buildChapelRuin,
} from './worldAssets.js';

// TT-WORLD — the world sheet. The tilt view's ground is the 2-D sheet's OWN ink
// (oneMap.js's live-drawn canvas), captured as a texture and painted onto ONE flat
// plane — so 2-D and 3-D can never disagree (the brief's suggested seam) and the
// "rest of the map" (terrain washes, water, roads, neighboring places) is visible
// past the local slice, exactly like the outer zooms already are. The sheet is
// FLAT (tabletop law) — no heightAt() relief; a hidden renderOneMap mount is the
// texture source, re-rendered on world-signature change (same diff discipline
// MAP-3DR already uses), on a real focus move, or when the tilt camera's zoom
// changes enough that the old capture's ink density would read wrong.
//
// PERF FINDING (verified live, not taken on faith — two rounds of live capture,
// see docs/AGENT_CHANGELOG.md's TT-WORLD entry): two bugs stacked here.
//   1. A texture drawn at one FIXED wide zoom (e.g. "show the whole region")
//      needs a patch only a few texture-px wide to cover what the tilt camera
//      actually sees at its typical close-in distance (setCamera's curRad
//      clamps to 30..4000 wu; deep zoom sits near the 30-wu floor) — hopelessly
//      under-resolved, a blurry brown wash. FIX: the hidden mount draws at the
//      SAME px-per-wu the live 2-D sheet is at (derived from setCamera's own
//      pxPerTile, which carries the 2-D map's live cam.z) — ink density always
//      matches what the tilt camera is actually looking at, exactly mirroring
//      how oneMap.js redraws at its live z every frame.
//   2. The plane's PHYSICAL SIZE must be sized from the 3-D CAMERA's own ground
//      footprint at its current distance (curRad, FOV) — NOT from the 2-D map's
//      unrelated canvas pixel dimensions (that produced a plane a fraction of a
//      percent of curRad, a tiny mostly-empty patch adrift in the scene). FIX:
//      planeSpanWuForRad below derives the span directly from the SAME
//      rad/vFovTan the camera math already computes, with a fixed margin
//      multiple so panning/orbiting never runs off the edge before the next
//      zoom-drift redraw catches up.
import { renderOneMap, playerFocusWu } from './oneMap.js';
import { NODE_WU, regionCellToWu, entityScenePosOnSheet, sheetScenePerWu } from './worldSpace.js';
// TT-PROPS — placedTokenModel(world, nodeId) is the pure engine-position read
// (people/trees/props/livestock, all {wx,wy} world units) the 2-D sheet
// already draws minis from; the tilt view reuses the SAME model, never a
// second derivation, so 2-D and 3-D can never disagree on where a barrel or
// an NPC actually stands.
import { placedTokenModel, INK_PARAMS } from './drawModel.js';
// MR-3b (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3b) — wildFeaturesAround is the
// SAME pure engine derivation MR-3a's tacticalPos.js walkable-mask reads
// through (engine/world/wildFeatures.js): a function of (world.meta.seed, the
// region truth, center, radius), no rng, no stored state. This is a READ of a
// pure engine module (engine/**), the identical pattern placedTokenModel above
// already establishes for engine-owned occupancy — never a second derivation.
import { wildFeaturesAround } from '../../engine/world/wildFeatures.js';

const SHEET_PX = 1024;         // texture resolution (px) — the hidden mount's square canvas.
const SHEET_SPAN_MARGIN = 4.5; // the plane spans this many multiples of the camera's own ground footprint.
const SHEET_MIN_SPAN_WU = 40;  // never shrink the plane below this (tight building-plan close-ups).
const SHEET_REZOOM_RATIO = 1.5; // re-render the texture once z has drifted this much (up or down)
const SHEET_TARGET_REFRESH_FRAC = 0.28; // re-render once target has drifted this fraction of the plane span

// MR-3b — THE VISIBILITY BUBBLE (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3b): how
// far out, in REGION CELLS (5 ft/cell, engine/map/spatial/tacticalPos.js's
// CELL_FT), the wild's individual tree/boulder/brush minis render around the
// player at walking zoom. Pinned taste, not derived from the ground-sheet's
// own camera-footprint math (spanWorldForRad/SHEET_SPAN_MARGIN, above): that
// span is sized generously so PANNING never outruns the captured 2-D texture
// — at a typical close-in curRad it works out to several HUNDRED cells across,
// far past where an individual tree silhouette is legible as a tree rather
// than a texture wash. A tabletop mini reads as a mini a few strides from the
// player token, not a quarter-mile off. Pinned instead to THE MOVEMENT LAW's
// own per-turn unit (MAX_WALK_CELLS = 6, engine/map/spatial/tacticalPos.js):
// 2× a single turn's walk, so the player sees "about the next two moves'
// worth of woods" — close enough to read as individual minis you'd walk
// around, far enough that the bubble doesn't visibly pop in as you advance.
// Verified against a real forest cell (Aldermere slice, seed 'aldermere'):
// radius 12 derives ~55 features (~35 blocking) per call — legible as a
// proper stand of trees and cheap enough to rebuild every setPlayerFocus
// call (radius 24 already balloons past 300 features on a dense cluster,
// too many fresh THREE.Group instantiations for a per-move rebuild).
const WILD_BUBBLE_CELLS = 12;

// A hidden, off-DOM renderOneMap mount used ONLY as a texture source. It never
// receives pointer events (not attached to the visible tree) and its own camera
// is driven directly via __oneMapFocus — never the live map's camera. One
// instance is reused across re-renders (same discipline as continuousMap's own
// persistent 2D mount) so a repeated capture is cheap.
let _sheetMount = null; // { wrap, canvas }
function ensureSheetMount(world) {
  if (_sheetMount) return _sheetMount;
  const wrap = renderOneMap(world, { height: SHEET_PX, initialZoom: 0.1 });
  const canvas = wrap.querySelector ? wrap.querySelector('canvas') : null;
  // The stub/real DOM both support a simple child walk; querySelector isn't on
  // the test stub, so fall back to the first canvas child directly.
  const cv = canvas || (wrap.children || []).find(c => c && c.tag === 'canvas') || null;
  _sheetMount = { wrap, canvas: cv };
  return _sheetMount;
}
export function disposeSheetMount() {
  if (_sheetMount && _sheetMount.wrap && _sheetMount.wrap.__ro) { try { _sheetMount.wrap.__ro.disconnect(); } catch {} }
  _sheetMount = null;
}

/**
 * worldSheetTexture(THREE, world, focusWu, z) -> THREE.CanvasTexture | null
 * Captures the 2-D sheet's OWN drawing, centered on focusWu ({wx,wy} world
 * units — the same rail playerFocusWu/resolveEntityWuFromWorld already feed
 * the ink marker with) and drawn at px-per-wu `z` (the SAME z the live 2-D map
 * is at — see the file-header perf note), into a texture for the tilt-view
 * ground plane. Pure read + a canvas draw call; never touches world state or
 * engine positions. Returns null if the hidden mount can't be captured
 * (headless/no-canvas test stub) — the caller falls back to a flat paper ground.
 */
function worldSheetTexture(THREE, world, focusWu, z) {
  try {
    const { wrap, canvas } = ensureSheetMount(world);
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    if (wrap.__rebind) wrap.__rebind(world, {});
    if (wrap.__oneMapFocus) wrap.__oneMapFocus(focusWu?.wx || 0, focusWu?.wy || 0, z);
    if (typeof canvas.toDataURL !== 'function' && typeof createImageBitmap !== 'function') return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch { return null; }
}

// buildWorldSheet(THREE, world, worldPos, z, rad) -> { mesh, heightAt, refresh(...) }
// ONE flat plane (tabletop law — no relief), sized DIRECTLY from the 3-D
// camera's own ground footprint at distance `rad` (SHEET_SPAN_MARGIN multiples
// of it — margin for pan/orbit before the next zoom-drift redraw), centered
// under `worldPos` ({x,z} — 3-D WORLD units, the SAME point the camera's own
// `target` sits at; see the file-header centering note), textured with a live
// 2-D sheet capture drawn at `z` (px-per-wu — the SAME density the live 2-D
// sheet is at, see the file-header perf note). `refresh` re-centers/re-zooms
// the hidden mount, re-stamps the texture, and resizes the plane — called on a
// real content change, a camera-target move, or a large-enough zoom drift
// (never every frame). heightAt always returns 0: the ground the rest of this
// file's node-dressing loop drops things onto is flat, by design.
//
// CENTERING NOTE (the third bug this packet found, live-verified): the plane
// must track the SAME point the 3-D camera's `target` sits at, not a second,
// independently-resolved focus (the first cut here used playerFocusWu(world)
// directly — normally consistent with target, but a genuinely separate call,
// and a test-script drive that moved the camera's target without also moving
// the independent focus reproduced exactly this class of bug: the plane sat
// centered on the "right" point while the camera looked somewhere else
// entirely, and NO material/texture change was visible because the plane was
// simply outside the frustum). buildWorldSheet/refresh take worldPos in 3-D
// units DIRECTLY — callers pass target.x/target.z (or the wu equivalent
// converted once at the one call site, worldPosFromWu below) so there is
// exactly one source of "where the camera looks," never two.
//
// spanWorldForRad: the plane's side length in 3-D WORLD units — a pure function
// of the camera's own distance + FOV (vFovTan, computed once in mountSlice3D
// from camera.fov), completely independent of the UNRELATED 2-D map's own
// canvas pixel size (the second bug this packet found: sizing the plane off
// viewport px produced a plane a tiny fraction of curRad — a mostly-empty
// patch adrift in the scene at any normal tilt-camera distance).
// Exported for U478 (hermetic, DOM/THREE-free — pure math): the sizing/bridge
// contracts a live capture can't easily assert (three.js never actually loads
// in the test environment; the dynamic import fails gracefully, same as any
// no-WebGL browser). These two functions carry every load-bearing number this
// packet's live debugging found broken, so they're the regression guard.
export function spanWorldForRad(rad, vFovTan) {
  const groundHalfHeight = Math.max(1e-6, Number(rad) || 30) * Math.max(1e-6, Number(vFovTan) || 0.4);
  return Math.max(SHEET_MIN_SPAN_WU, groundHalfHeight * 2 * SHEET_SPAN_MARGIN);
}
// worldPosFromWu(wx, wy) -> {x, z} — the ONE wu -> 3-D bridge (÷NODE_WU × TILE_WU),
// used only to feed the hidden 2-D mount's __oneMapFocus (which speaks wu); the
// PLANE itself is always positioned from worldPos (3-D units) directly.
export function worldPosFromWu(wx, wy) {
  return { x: (Number(wx) || 0) / NODE_WU * TILE_WU, z: (Number(wy) || 0) / NODE_WU * TILE_WU };
}
function buildWorldSheet(THREE, world, worldPos, z, rad, vFovTan) {
  let curZ = Math.max(1e-6, Number(z) || 0.1);
  let spanWorld = spanWorldForRad(rad, vFovTan);
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const focusWu0 = { wx: (Number(worldPos?.x) || 0) * NODE_WU / TILE_WU, wy: (Number(worldPos?.z) || 0) * NODE_WU / TILE_WU };
  const tex = worldSheetTexture(THREE, world, focusWu0, curZ);
  const mat = tex
    ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.97 })
    : new THREE.MeshStandardMaterial({ color: 0xe7ecdd, roughness: 0.98 }); // paper fallback (headless/no-canvas)
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.scale.set(spanWorld, 1, spanWorld);
  mesh.position.set(Number(worldPos?.x) || 0, 0, Number(worldPos?.z) || 0);
  const heightAt = () => 0; // FLAT — the tabletop law; terrain reads as ink, not geometry.
  function refresh(newWorldPos, newWorld, newZ, newRad, newVFovTan) {
    if (Number.isFinite(newZ) && newZ > 0) curZ = newZ;
    spanWorld = spanWorldForRad(newRad, newVFovTan);
    const wx = Number(newWorldPos?.x) || 0, wz = Number(newWorldPos?.z) || 0;
    const focusWu = { wx: wx * NODE_WU / TILE_WU, wy: wz * NODE_WU / TILE_WU };
    const t2 = worldSheetTexture(THREE, newWorld || world, focusWu, curZ);
    if (t2) {
      if (mesh.material.map && mesh.material.map !== t2) { try { mesh.material.map.dispose(); } catch {} }
      mesh.material.map = t2; mesh.material.needsUpdate = true;
    }
    mesh.scale.set(spanWorld, 1, spanWorld);
    mesh.position.set(wx, 0, wz);
  }
  return { mesh, heightAt, refresh, currentZ: () => curZ };
}

// MR-3b (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3b) — THE FOG EDGE. Beyond the
// wild-mini visibility bubble the page fades to UNPAINTED PARCHMENT — never
// darkness, never a hard ring (the brief's falsifier). Painted as a separate,
// thin transparent disc laid just above the ground sheet (never replacing its
// texture — the sheet stays the single "what's really there" ink; this is a
// pure ATMOSPHERIC read layered on top, exactly the relationship the sky/fog
// already have to the ground). A radial-gradient canvas texture: fully
// transparent at the disc's center (the ground sheet's own ink shows through
// clean, undimmed, right around the player) easing OUTWARD to the same paper
// tone the 2-D sheet's own parchment base uses (oneMap.js's PAPER = '#e8ecdd'
// — matched here so the wash reads as MORE of the same paper, not a
// different material) — a soft ink-wash, not a cliff.
const FOG_TEX_PX = 256;      // small — this is a soft gradient, not detail.
const FOG_PAPER = '#e8ecdd'; // oneMap.js's PAPER constant, matched exactly.
function fogEdgeTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = FOG_TEX_PX; c.height = FOG_TEX_PX;
  const x = c.getContext('2d');
  const r = FOG_TEX_PX / 2;
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  // Transparent through the bubble's own radius (~62% of the disc — the disc
  // itself is oversized past the bubble so the OUTER edge, where opacity
  // finally reaches 1, sits safely past the last mini, never clipping a tree
  // mid-fade), then a gentle ease to full parchment at the rim. No stop is
  // ever black or a hard cutoff — every stop is (paper color, some alpha).
  g.addColorStop(0.0, 'rgba(232,236,221,0)');
  g.addColorStop(0.55, 'rgba(232,236,221,0)');
  g.addColorStop(0.78, 'rgba(232,236,221,0.55)');
  g.addColorStop(1.0, 'rgba(232,236,221,0.96)');
  x.fillStyle = g;
  x.fillRect(0, 0, FOG_TEX_PX, FOG_TEX_PX);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
// buildFogEdgeOverlay(THREE) -> { mesh, setSpan(worldRadius) }. The disc is
// OVERSIZED relative to the mini bubble (FOG_OVERSIZE) so the gradient's
// transparent core comfortably covers every drawn mini and only the outer
// wash extends past them — a mini is never seen fading out mid-tree.
const FOG_OVERSIZE = 1.6;
function buildFogEdgeOverlay(THREE) {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: fogEdgeTexture(THREE), transparent: true, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1; // paint after the ground sheet, before minis/props
  function setSpan(worldRadius) {
    const span = Math.max(1e-3, Number(worldRadius) || 1) * 2 * FOG_OVERSIZE;
    mesh.scale.set(span, 1, span);
  }
  return { mesh, setSpan };
}

// ---------- WebGL capability probe (so we can fall back BEFORE importing) ----------
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch { return false; }
}

export async function mountSlice3D(container, sceneData, opts = {}) {
  if (!container) throw new Error('no-container');
  if (!webglAvailable()) throw new Error('webgl-unavailable');

  const THREE = await import('three');

  // Postprocessing (bloom) is a nicety — if the addon fetch fails we still
  // render directly. Never let it become a hard dependency.
  let EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
  try {
    ({ EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js'));
    ({ RenderPass } = await import('three/addons/postprocessing/RenderPass.js'));
    ({ UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js'));
    ({ OutputPass } = await import('three/addons/postprocessing/OutputPass.js'));
  } catch { EffectComposer = null; }

  const w0 = Math.max(1, container.clientWidth || 800);
  const h0 = Math.max(1, container.clientHeight || 480);

  // ---------- renderer ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) { throw new Error('webgl-unavailable'); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w0, h0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'none';

  // Clear any loading placeholder the caller put in the container, then attach.
  while (container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  // TT-WORLD — the fog was tuned (200-560) for the OLD local-only heightfield,
  // where nothing existed past ~560 units to fog out anyway. The world sheet now
  // legitimately extends far past that (the whole point: "the rest of the map"
  // stays visible past the local slice) — a tight fog here would fog the sheet
  // itself into a flat wash at any normal tilt-view camera distance (curRad
  // ranges 30..4000, setCamera below). Widened so the sheet reads clearly at
  // every distance the tilt camera actually uses, with the horizon still easing
  // into haze rather than a hard edge.
  scene.fog = new THREE.Fog(0xe6d4ac, 900, 3600);
  const camera = new THREE.PerspectiveCamera(45, w0 / h0, 0.5, 4200);
  // Hoisted here (setCamera below reuses this SAME constant) because
  // buildWorldSheet needs it at construction time, before setCamera exists —
  // it only depends on camera.fov, fixed at construction.
  const vFovTan = Math.tan((camera.fov * Math.PI / 180) / 2);

  // ---------- sky ----------
  function skyTex() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#4a78b0'); g.addColorStop(0.45, '#8fb0cc');
    g.addColorStop(0.72, '#e0ccaa'); g.addColorStop(0.9, '#f2c98a'); g.addColorStop(1, '#e9b878');
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xbcd2f0, 0x6a5a40, 0.7));
  const sun = new THREE.DirectionalLight(0xffe2a8, 2.0);
  sun.position.set(-80, 90, 50); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 500;
  sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
  sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0xfff0d8, 0.3));

  // ---------- scene-data parse (the engine positions this view dresses) ----------
  const nodes = Array.isArray(sceneData?.nodes) ? sceneData.nodes : [];
  const edges = Array.isArray(sceneData?.edges) ? sceneData.edges : [];
  const seed = String(sceneData?.seed || '');
  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;
  const bounds = sceneData?.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const wPos = n => ({ x: (Number(n.x) || 0) * TILE_WU, z: (Number(n.y) || 0) * TILE_WU });
  const boundsCenter = { x: ((bounds.minX + bounds.maxX) / 2) * TILE_WU, z: ((bounds.minY + bounds.maxY) / 2) * TILE_WU };
  // HUD hook (assigned once its DOM exists, below); the render loop calls it.
  let updateHud = () => {};

  // ---------- world materials + the world sheet (TT-WORLD) ----------
  // One material bundle per scene — its `shared` set drives dimGroup's clone-before-
  // tint, and the peelable buildings clone it into transparent sets for the cutaway.
  // TT-WORLD: the ground is no longer a local heightfield — it's ONE flat plane
  // textured with the 2-D sheet's own live drawing (buildWorldSheet, above),
  // player-centered, carrying the world's cartography past the local slice's old
  // bounds (terrain washes, water, roads, neighbouring places all read as INK).
  // heightAt() always returns 0 (the tabletop law: terrain is ink, not relief) —
  // nodes/roads/the player all still call it, so everything sits flush on the
  // sheet with zero further plumbing. Pure view of engine state; never a write.
  const mats = createWorldMaterials(THREE);
  // The sheet's INITIAL center: the SAME engine-truthful focus point the 2-D
  // ink marker uses (playerFocusWu, WS-2) when the real `world` is available
  // (the live-play path always passes opts.world), converted to 3-D world
  // units; falls back to the scene's node-tile bounds center for a bare
  // sceneData caller (e.g. a lab page with no world object). This is only a
  // SEED — setCamera's very next call (continuousMap.js always makes one
  // immediately after mount, before first paint) re-centers the plane on
  // `target` directly, which is the sheet's real, ongoing source of truth
  // (see buildWorldSheet's centering note — never a second independent focus).
  const boundsCenterWu = { wx: ((bounds.minX + bounds.maxX) / 2) * NODE_WU, wy: ((bounds.minY + bounds.maxY) / 2) * NODE_WU };
  const focusWu0 = (opts.world && playerFocusWu(opts.world)) || boundsCenterWu;
  const worldPos0 = worldPosFromWu(focusWu0.wx, focusWu0.wy);
  const worldSheet = buildWorldSheet(THREE, opts.world || sceneData, worldPos0, 32 / NODE_WU, 200, vFovTan);
  const { heightAt } = worldSheet;
  scene.add(worldSheet.mesh);
  // The last point the sheet was actually centered/re-textured on (3-D world
  // units) — compared against `target` in setCamera to decide whether a real
  // enough move happened to justify a re-render (never every frame).
  let _sheetTarget = { x: worldPos0.x, z: worldPos0.z };

  // REND-TRUTH-1 — THE ONE ENTITY↔SHEET TRANSFORM. A world-unit point projected
  // onto the ground sheet's OWN ink, so an engine-occupancy mini (people/props)
  // stands exactly where the sheet drew it — at ANY zoom. The sheet paints its
  // 2-D capture (SHEET_PX px, at its live px-per-wu currentZ()) across a plane of
  // `mesh.scale.x` 3-D units, centred at `mesh.position` (== the camera target).
  // So on the sheet ONE wu spans `span·z/SHEET_PX` 3-D units — the same factor
  // the ink itself uses — and the sheet centre corresponds to the focus wu
  // `Fwu = center · NODE_WU/TILE_WU` (the exact inverse buildWorldSheet uses to
  // derive its own focusWu). A mini at `wu` therefore lands at
  // `center + (wu - Fwu)·scenePerWu`. This is why worldPosFromWu (a FIXED
  // node-tile scale, right only for the region lattice) was wrong here: at
  // interior zoom the sheet zooms in but that fixed scale did not, collapsing
  // every occupant onto the player. Pure view — reads the sheet's own live
  // transform, writes only mini positions.
  function entityScenePos(wx, wy) {
    // Delegates to worldSpace.js's pure entityScenePosOnSheet (the ONE derivation,
    // hermetically tested by U548/U549), reading the sheet's OWN live transform:
    // its plane centre (== the camera target), its plane span in 3-D units, and its
    // current px-per-wu texture zoom.
    const center = { x: worldSheet.mesh.position.x, z: worldSheet.mesh.position.z };
    return entityScenePosOnSheet(center, worldSheet.mesh.scale.x, worldSheet.currentZ(), SHEET_PX, TILE_WU, wx, wy);
  }
  // Reproject every engine-occupancy mini onto the sheet's current ink. Called at
  // mount (below, once the entities exist) and on every setCamera after the sheet
  // re-centres/re-zooms, so people/props never drift off their own drawn footprint.
  // Touches x/z (+ the flat ground y) AND — REND-SCALE-1 — the mini's SIZE: a
  // figure whose true height is `heightWu · scenePerWu` scene units is exactly as
  // tall against the ink as the real thing (heightWu is METRIC wu since
  // UNIT-CLASH-1 — a 6-ft man is 1.83 wu, ~0.37 of a 5 wu cell; the old feet-
  // as-wu reading drew him 6 m tall, the colossus-in-the-bedchamber report,
  // Tim 2026-07-06). `wuPerAuthored` is stamped at each build site; the breathe loop
  // re-applies `baseScale` every frame, so writing it here is the whole change.
  // Floored at each rec's `floorScale` (default 1 = the authored token look) so
  // region-zoom tokens stay legible where no squares are drawn. Figure geometry
  // itself stays untouched (beauty locked).
  function repositionEntities() {
    const spw = sheetScenePerWu(worldSheet.mesh.scale.x, worldSheet.currentZ(), SHEET_PX);
    for (const m of entityMinis) {
      if (!m || !m.group) continue;
      const p = entityScenePos(m.wx, m.wy);
      const y = heightAt(p.x, p.z) + (Number(m.yOff) || 0);
      m.group.position.set(p.x, y, p.z);
      m.baseY = y; // the breathe loop bobs around this
      if (Number.isFinite(m.wuPerAuthored) && m.wuPerAuthored > 0) {
        m.baseScale = miniSheetScale(m.wuPerAuthored, spw, m.floorScale || 1);
      }
    }
    // The player token keeps its own placement (it sits AT the sheet focus) but
    // rides the SAME size law — it was the reported falsifier's own figure.
    if (playerMini && Number.isFinite(playerMini.wuPerAuthored) && playerMini.wuPerAuthored > 0) {
      playerMini.baseScale = miniSheetScale(playerMini.wuPerAuthored, spw, playerMini.floorScale || 1);
    }
    // WILD-SCALE-1 — the wild bubble's own SCALE-ONLY pass: a wild mini's
    // POSITION is a separate, region-frame-only contract (worldPosFromWu,
    // untouched here — MR-3b's own placement law, out of this packet's
    // scope), but its FOOTPRINT must still track the sheet's live zoom
    // exactly like people/props do, so a tree read against the 5-ft squares
    // never drifts wrong as the sheet zooms — the brief's "build-time scale +
    // reproject-on-zoom must both hold". wildMinis is declared further below
    // in this function (MR-3b); referencing it here is safe — this closure is
    // only ever CALLED after that declaration runs (mount, then every
    // setCamera), never before.
    for (const m of wildMinis) {
      if (!m || !m.group || !Number.isFinite(m.wuPerAuthored) || m.wuPerAuthored <= 0) continue;
      m.baseScale = miniSheetScale(m.wuPerAuthored, spw, m.floorScale || 1);
    }
    // Debug/verification hook (window.__map3d idiom): exact live numbers —
    // drawnWu must equal heightWu wherever the true law is above the floor.
    try {
      const audit = (m, who) => m && Number.isFinite(m.wuPerAuthored) ? {
        who, heightWu: m.heightWu, baseScale: +m.baseScale.toFixed(4),
        drawnWu: +((m.baseScale * (m.authoredSize || 0)) / (spw || 1)).toFixed(3),
        floored: m.baseScale === (m.floorScale || 1) && m.wuPerAuthored * spw < (m.floorScale || 1)
      } : null;
      window.__rendScaleAudit = {
        spw: +spw.toFixed(5), cellScene: +(5 * spw).toFixed(4),
        entries: [
          audit(playerMini, 'player'),
          ...entityMinis.slice(0, 6).map(m => audit(m, m.group?.userData?.kind || 'entity')),
          ...wildMinis.slice(0, 6).map(m => audit(m, m.group?.userData?.kind || 'wild')),
        ].filter(Boolean)
      };
    } catch { /* headless-safe: the audit is never load-bearing */ }
  }

  // MR-3b — the fog-edge overlay disc, mounted just above the ground sheet
  // (never replacing its texture — see buildFogEdgeOverlay's own header).
  // Y-offset is tiny (well under a mini's own ground-clearance) purely to
  // avoid z-fighting with the flat sheet underneath; it sits BELOW every
  // mini's base geometry, so a tree's trunk/foliage always paint over the
  // wash, never the reverse.
  const fogEdge = buildFogEdgeOverlay(THREE);
  fogEdge.mesh.position.y = 0.02;
  scene.add(fogEdge.mesh);

  // ROOF-PEEL CUTAWAY registry: each modular settlement building registers its
  // separable roof + walls here so the per-frame updateCutaway() can lift/fade the
  // FOCUSED building (the one the camera looks into) as the continuous zoom pushes
  // in. Pure view — camera-driven, never engine state.
  const peelables = [];

  // ---------- clean corner HUD (replaces the giant in-scene 3D labels) ----------
  // A DOM overlay added INTO the 3D container, so it fades with the 3D layer's
  // opacity through the zoom morph and never blocks input (pointer-events:none).
  function buildHud(host, title) {
    const wrap = document.createElement('div');
    wrap.className = 'map3d-hud';
    wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;font-family:"Iowan Old Style",Palatino,Georgia,serif;';
    const vig = document.createElement('div');
    vig.style.cssText = 'position:absolute;inset:0;box-shadow:inset 0 0 170px 46px rgba(0,0,0,0.5);';
    wrap.appendChild(vig);
    for (const corner of ['tl', 'br']) {
      const b = document.createElement('div');
      b.style.cssText = 'position:absolute;width:32px;height:32px;border:2px solid rgba(217,164,65,0.4);'
        + (corner === 'tl' ? 'top:12px;left:12px;border-right:none;border-bottom:none;' : 'bottom:12px;right:12px;border-left:none;border-top:none;');
      wrap.appendChild(b);
    }
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:14px;left:26px;';
    const name = document.createElement('div');
    name.textContent = title || '';
    name.style.cssText = 'font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:#d9a441;text-shadow:0 1px 4px rgba(0,0,0,.7);';
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:10px;letter-spacing:.22em;color:#cbb68a;margin-top:3px;font-family:ui-monospace,Menlo,monospace;text-shadow:0 1px 3px rgba(0,0,0,.7);';
    sub.textContent = '3D';
    box.appendChild(name); box.appendChild(sub);
    wrap.appendChild(box);
    wrap._title = name; wrap._sub = sub; wrap._id = '';
    host.appendChild(wrap);
    return wrap;
  }

  // ---------- node builders ----------
  // The world-asset builders (roofPrism, makeInterior, buildBuilding, buildWell,
  // buildPalisade, addTreeScatter, buildSettlement, buildWilderness, buildChapelRuin,
  // buildEdge, buildTerrain, dimGroup) now live in the shared ./worldAssets.js so the
  // asset lab and the live game draw the SAME meshes. They are imported at the top and
  // called by the node-dressing loop below; only the HUD + camera/cutaway/render loop
  // (the scene-specific wiring) stay here.

  // ---------- postprocessing ----------
  let composer = null;
  if (EffectComposer) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w0, h0), 0.28, 0.5, 0.88));
      composer.addPass(new OutputPass());
    } catch { composer = null; }
  }

  // ---------- camera state ----------
  let alt = (opts.alt != null ? opts.alt : 280);
  let az = (opts.az != null ? opts.az : -0.65);
  let zoomPx = 0; // continuous-zoom depth signal (px per node-tile), set by setCamera
  const target = new THREE.Vector3(0, 0, 0);

  // Free-orbit: the continuous map drives a BASE azimuth/tilt (north-up, locked to
  // the 2D plan) + a scale-locked distance via setCamera; the player ADDS an orbit
  // offset by dragging the 3D view. positionCamera() places the camera from base +
  // offset, so orbit preserves the zoom scale & centre and only swings the angle.
  // The offset eases back to north-up as you zoom out (so the 2D morph re-aligns).
  let baseAz = az, basePhi = 0.06, curRad = 200;
  let azOffset = 0, phiOffset = 0, orbiting = false;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function positionCamera() {
    const a = baseAz + azOffset;
    const phi = clamp(basePhi + phiOffset, 0.1, 1.46);
    camera.position.set(
      target.x + curRad * Math.sin(phi) * Math.sin(a),
      target.y + curRad * Math.cos(phi),
      target.z + curRad * Math.sin(phi) * Math.cos(a)
    );
    camera.lookAt(target);
    sky.position.copy(camera.position);
  }

  // Standalone path (controls:true): alt/az drive the camera; routed through the same
  // positionCamera so the orbit offset still applies if present.
  function applyCamera() {
    const tilt = smooth(80, 400, alt);
    basePhi = clamp(0.55 + (1 - tilt) * 0.6, 0.12, 1.3);
    baseAz = az; curRad = clamp(alt * 0.65, 40, 500);
    positionCamera();
  }

  // Free-orbit input (the in-play 3D drag, wired by continuousMap): swing azimuth +
  // tilt around the current target. Pure view — only moves the camera.
  function orbitBy(daz, dphi) {
    azOffset += daz;
    phiOffset = clamp(basePhi + phiOffset + dphi, 0.12, 1.46) - basePhi;
    positionCamera(); renderFrame();
  }
  function setOrbiting(v) { orbiting = !!v; }

  // ---------- orbit controls (canvas-scoped — never hijacks the page) ----------
  // Skipped when opts.controls === false: in the continuous-zoom map the 3D
  // layer is a PASSIVE overlay (pointer-events:none) whose camera is driven
  // externally via setCamera() by the 2D map's zoom. Standalone use keeps them.
  let drag = false, lx = 0;
  function onPointerDown(e) { drag = true; lx = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch {} }
  function onPointerUp() { drag = false; }
  function onPointerMove(e) { if (!drag) return; az -= (e.clientX - lx) * 0.005; lx = e.clientX; applyCamera(); }
  function onWheel(e) { e.preventDefault(); alt = clamp(alt + e.deltaY * 0.6, 60, 700); applyCamera(); }
  const interactive = opts.controls !== false;
  if (interactive) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
  }

  // ---------- dress the world: roads, then a place per node (terrain-aware) ----------
  target.set(boundsCenter.x, 0, boundsCenter.z);
  for (const edge of edges) {
    const a = nodeById[edge.a], b = nodeById[edge.b];
    if (!a || !b) continue;
    const ap = wPos(a), bp = wPos(b);
    scene.add(buildEdge(THREE, ap.x, ap.z, bp.x, bp.z, edge.kind, heightAt));
  }
  // TT-INK — architecture is ink, never geometry (yet). buildSettlement (houses +
  // palisade wall) and buildChapelRuin (the ruined chapel building) STOP
  // MOUNTING here: their content is exactly the ONE-drawing-brain floor plan the
  // world sheet (TT-WORLD, above) already draws as ink from drawnStructureModel —
  // mounting the 3-D building meshes on top of that ink was the double-
  // representation the brief calls out (a wall occluding the floor plan it's
  // supposed to BE). "(Yet)" honored: buildSettlement/buildChapelRuin are NOT
  // deleted from worldAssets.js — they simply aren't called from this loop.
  // buildWilderness is UNCHANGED: it has no buildings (trees/tents/barrels
  // only) — already the "everything standing is a mini" law TT-PROPS formalizes
  // next, not the ink-vs-geometry distinction this stage draws.
  for (const node of nodes) {
    if (node.nodeType === 'settlement' || node.nodeType === 'dungeon_entrance') continue;
    const base = wPos(node);
    const baseY = heightAt(base.x, base.z);
    const groundAt = (lx, lz) => heightAt(base.x + lx, base.z + lz) - baseY; // local terrain, relative to the place
    const rng = nodeRng(seed, node.id);
    const grp = new THREE.Group();
    grp.position.set(base.x, baseY, base.z);
    grp.add(buildWilderness(THREE, mats, rng, groundAt, node.discovered));
    scene.add(grp);
  }

  // Resolve each peelable building's world transform once the hierarchy is placed:
  // its centre (for picking the focused building) and each wall's world position +
  // outward normal (for the camera-relative fade). Static thereafter — only the
  // camera moves, so updateCutaway() just reads these per frame.
  scene.updateMatrixWorld(true);
  {
    const _q = new THREE.Quaternion();
    for (const b of peelables) {
      b.center = b.bgroup.getWorldPosition(new THREE.Vector3());
      b.bgroup.getWorldQuaternion(_q);
      for (const w of b.walls) {
        w.worldPos = w.group.getWorldPosition(new THREE.Vector3());
        w.worldNormal = new THREE.Vector3(w.n[0], 0, w.n[1]).applyQuaternion(_q).normalize();
      }
    }
  }

  // Player token — the SAME figure as the combat board (one consistent "you"),
  // sitting on the terrain with a gentle idle breathe. No giant label (the clean
  // HUD names the place instead).
  const player = sceneData?.player || { nodeId: nodes[0]?.id, x: 0, y: 0 };
  const px = (Number(player.x) || 0) * TILE_WU + 3, pz = (Number(player.y) || 0) * TILE_WU + 3;
  const py = heightAt(px, pz);
  // `let`, not `const`: MR-3b's refreshWildMinis splices out last bubble's wild
  // entries by reassigning a filtered array (cheaper + simpler than an
  // in-place splice given the set changes shape every rebuild) — every other
  // push onto this array (combat board minis, TT-PROPS people/props, the
  // player mini) is unaffected, they still just .push() the same array.
  let sliceMinis = [];
  // REND-TRUTH-1 — the subset of sliceMinis that are engine-occupancy entities
  // (people + props) carrying a canonical `.wx/.wy`; repositionEntities reprojects
  // exactly these through the ground sheet's live scale on every camera change.
  const entityMinis = [];
  let playerToken = null, playerMini = null; // set in the non-combat branch (setPlayerFocus).
  if (sceneData?.combat) {
    // Combat is this overworld scene zoomed in: the tactical board sits ON the ground at
    // the player's node, scaled so a cell ≈ 5 ft (1.5 u ≈ half a node tile), the player's
    // cell aligned to the avatar's overworld position. Zoom in → the fight is right there.
    const board = buildTacticalBoard(THREE, sceneData.combat, { dais: false });
    const S = 1.5 / CELL_WU;
    board.group.scale.setScalar(S);
    board.group.position.set(px - board.playerCenter.x * S, py + 0.05, pz - board.playerCenter.z * S);
    scene.add(board.group);
    for (const m of board.minis) sliceMinis.push(m);
  } else {
    const token = buildArchetypeFigure(THREE, 'player', {});
    token.position.set(px, py + 0.06, pz);
    scene.add(token);
    playerToken = token;
    // REND-SCALE-1 — the player's TRUE height from the character sheet's own
    // species (SRD size; 'Hobbit'/'Halfling' → 3½ ft), over the figure's
    // measured authored height. repositionEntities pushes it through the
    // sheet's live transform so the figure is real-sized against the squares.
    // Two historical spellings of the sheet field: chargen writes `dnd`
    // (createCharacter5e), some paths carry `sheet` — same record, read both.
    const p0 = opts.world?.party?.[0] || null;
    const pHeightWu = figureHeightWu(p0?.dnd?.species || p0?.sheet?.species || null);
    const pAuthored = measureAuthoredSize(THREE, token, 'y');
    playerMini = {
      group: token, baseY: py + 0.06, baseScale: 1, rate: 1.4, phase: 0, bob: 0.05, defeated: false,
      wuPerAuthored: pHeightWu / pAuthored, heightWu: pHeightWu, authoredSize: pAuthored, floorScale: 1
    };
    sliceMinis.push(playerMini);
  }

  // TT-PROPS — everything standing is a mini. Positions come from the SAME
  // engine scene contract the brief requires: placedTokenModel(world, nodeId)
  // (drawModel.js) is a pure read of engine-owned occupancy/terrain — the
  // renderer never invents a position. Skipped entirely for a bare sceneData
  // caller (opts.world is the only source; a lab page with no world sees no
  // props/people, exactly as it saw no trees/furniture on the 2-D sheet either).
  // Not run during combat: the tactical board above already owns every mini in
  // that scene. People use the SAME archetype-figure builder combat/overworld
  // both use ('humanoid'); trees stay on their existing worldAssets.js path
  // (buildWilderness/addTreeScatter) — TT-PROPS only adds furniture + people,
  // per the brief's Stage 3 scope ("trees (already law), PLUS props").
  // REND-TRUTH-1 — engine-occupancy minis (people + props) whose scene position
  // must track the GROUND SHEET's live wu→scene scale, not the fixed node-tile
  // scale worldPosFromWu bakes in. `.wx/.wy` are the entity's canonical world
  // units; `entityScenePos` (defined with the sheet, below) reprojects them onto
  // the sheet's own ink every time the sheet re-zooms/re-centers (repositionEntities,
  // called at mount + on every setCamera). Without this, a person 60 ft away (a
  // small wu offset) collapsed onto the player at interior zoom — reading as
  // "standing in the bedroom" while the ink correctly drew them outside (the
  // MAP-REAL promise-3 falsifier this packet closes). Player + wild minis keep
  // their own placement: the player sits AT the focus (entityScenePos of its own
  // wu is the sheet centre, unchanged) and the wild bubble is region-frame-only,
  // never in an interior.
  if (opts.world && !sceneData?.combat) {
    for (const node of nodes) {
      if (node.nodeType !== 'settlement') continue;
      const tok = placedTokenModel(opts.world, node.id);
      for (const npc of (tok.people || [])) {
        const p = entityScenePos(npc.wx, npc.wy);
        const y = heightAt(p.x, p.z);
        const fig = buildArchetypeFigure(THREE, 'humanoid', {});
        fig.position.set(p.x, y + 0.02, p.z);
        scene.add(fig);
        // REND-SCALE-1 — villagers default to a 6-ft medium person (their map
        // records carry no species); the sheet transform does the rest.
        const nHeightWu = figureHeightWu(null);
        const nAuthored = measureAuthoredSize(THREE, fig, 'y');
        const rec = {
          group: fig, baseY: y + 0.02, baseScale: 1, rate: 1.3, phase: phaseFromKey(npc.id || npc.name), bob: 0.04, defeated: false, wx: npc.wx, wy: npc.wy, yOff: 0.02,
          wuPerAuthored: nHeightWu / nAuthored, heightWu: nHeightWu, authoredSize: nAuthored, floorScale: 1
        };
        sliceMinis.push(rec); entityMinis.push(rec);
      }
      for (const prop of (tok.props || [])) {
        const mini = buildPropMini(THREE, prop.kind);
        if (!mini) continue;
        const p = entityScenePos(prop.wx, prop.wy);
        const y = heightAt(p.x, p.z);
        mini.position.set(p.x, y, p.z);
        scene.add(mini);
        // Props breathe far more subtly than creatures — a prop is inert, not
        // alive; the tiny bob is only enough to avoid a perfectly static scene
        // reading as a screenshot (Dejarik-alive per the brief, kept honest —
        // furniture doesn't have a pulse).
        // REND-SCALE-1 — a prop's true size per kind (a bed is LENGTH-true: 7 ft
        // along its long axis; casks/chests/dressers height-true).
        const trueSize = propTrueSize(prop.kind);
        const pAuth = measureAuthoredSize(THREE, mini, trueSize.axis);
        const rec = {
          group: mini, baseY: y, baseScale: 1, rate: 0.6, phase: phaseFromKey(prop.kind + prop.wx + prop.wy), bob: 0.008, defeated: false, wx: prop.wx, wy: prop.wy, yOff: 0,
          wuPerAuthored: trueSize.wu / pAuth, heightWu: trueSize.wu, authoredSize: pAuth, floorScale: 1
        };
        sliceMinis.push(rec); entityMinis.push(rec);
      }
    }
  }
  // MR-3b (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3b) — THE WILD DRAWN. The wild
  // stands wherever the engine says it stands (MR-3a's wildFeaturesAround) —
  // this loop only DRAWS it, never invents a feature the derivation didn't
  // return. Outside a settlement's footprint (wildFeaturesAround itself
  // excludes settlement extents — TT-PROPS/TT-INK own that ink), a bubble of
  // WILD_BUBBLE_CELLS region-cells around the player's live tactical position
  // renders as minis; refreshWildMinis re-derives + rebuilds them on every
  // real player move (setPlayerFocus, below) and once at mount.
  //
  // ONE GROUP, cleared and rebuilt each call — cheaper than diffing a mini set
  // that changes shape every few steps (a fresh cluster enters/leaves the
  // bubble), and correctness-simple: the group's children are ALWAYS exactly
  // what the current bubble derives, by construction, matching this file's
  // "renderer never invents a position" discipline just like TT-PROPS above.
  //
  // WILD-SCALE-1 — declared BEFORE the mount-time repositionEntities() call
  // just below (moved up from after it): that function's wild-mini pass reads
  // `wildMinis` by closure, and a `let` binding is in the temporal dead zone
  // until ITS OWN declaration executes — calling repositionEntities() before
  // this line ran would throw, not just see an empty array.
  const wildGroup = new THREE.Group();
  scene.add(wildGroup);
  let wildMinis = []; // this bubble's { group, baseY, baseScale, rate, phase, bob, defeated } entries — folded into sliceMinis for breathe, but tracked separately so a rebuild can splice out exactly last bubble's set.

  // REND-TRUTH-1 — settle the entities onto the sheet's mount-time projection.
  // (setCamera, called by the host right after mount, reprojects them onto the
  // live zoom; this guarantees a correct placement even before that first call.)
  repositionEntities();

  // The current node the player's region-frame pos projects to (regionCellToWu
  // needs a node with real x/y — the SAME node the pos invariant already keeps
  // this cell's nearest-node in agreement with, engine/invariants.js). Falls
  // back to null (no wild bubble) for a bare sceneData caller or an indoor pos.
  function currentRegionNode() {
    const nodeId = String(opts.world?.map?.currentNodeId || '');
    return nodeById[nodeId] || null;
  }

  // updateFogEdge(centerP): position + size the fog-edge overlay around the
  // player's OWN 3-D point (centerP = {x,z}, already through worldPosFromWu —
  // the same point every mini in the bubble is placed relative to), with a
  // radius derived through the IDENTICAL region-cell -> wu -> 3-D pipeline
  // the minis themselves use (one cell due east of center, converted the same
  // way) — so the fog can never drift out of step with where the minis
  // actually stop. `null` hides the overlay entirely (indoors / no outdoor
  // pos / bare sceneData caller — nothing to fade around).
  function updateFogEdge(node, center, centerP) {
    if (!node || !center || !centerP) { fogEdge.mesh.visible = false; return; }
    const edgeWu = regionCellToWu(node, center.gx + WILD_BUBBLE_CELLS, center.gy);
    const edgeP = edgeWu ? worldPosFromWu(edgeWu.wx, edgeWu.wy) : null;
    const radius = edgeP ? Math.hypot(edgeP.x - centerP.x, edgeP.z - centerP.z) : 0;
    if (!(radius > 0)) { fogEdge.mesh.visible = false; return; }
    fogEdge.mesh.visible = true;
    fogEdge.setSpan(radius);
    fogEdge.mesh.position.set(centerP.x, heightAt(centerP.x, centerP.z) + 0.02, centerP.z);
  }

  function refreshWildMinis() {
    // Clear last bubble's minis (both the group's children and their breathe
    // entries) before rebuilding — a stale mini from the last cell must never
    // linger once the player has moved on.
    wildGroup.clear();
    if (wildMinis.length) {
      const drop = new Set(wildMinis);
      sliceMinis = sliceMinis.filter(m => !drop.has(m));
    }
    wildMinis = [];
    if (!opts.world) { updateFogEdge(null, null, null); return; } // bare sceneData caller — no engine world to derive from (same gate TT-PROPS uses)

    const pos = opts.world?.party?.[0]?.pos;
    if (!pos || typeof pos !== 'object' || pos.frame !== 'region'
      || !Number.isInteger(pos.gx) || !Number.isInteger(pos.gy)) { updateFogEdge(null, null, null); return; } // indoors / no tactical pos yet — no wild bubble to draw
    const node = currentRegionNode();
    if (!node) { updateFogEdge(null, null, null); return; }

    const center = { gx: pos.gx, gy: pos.gy };
    const centerWu = regionCellToWu(node, center.gx, center.gy);
    const centerP = centerWu ? worldPosFromWu(centerWu.wx, centerWu.wy) : null;
    const feats = wildFeaturesAround(opts.world, center, WILD_BUBBLE_CELLS);
    for (const f of feats) {
      const wu = regionCellToWu(node, f.cell.gx, f.cell.gy);
      if (!wu) continue;
      const p = worldPosFromWu(wu.wx, wu.wy);
      const mini = buildWildMini(THREE, f.kind, { seedKey: `${f.cell.gx},${f.cell.gy}`, sizeClass: f.sizeClass });
      if (!mini) continue;
      const y = heightAt(p.x, p.z);
      mini.position.set(p.x, y, p.z);
      wildGroup.add(mini);
      // Wild growth breathes barely at all — a tree sways, it doesn't pulse;
      // slower + smaller bob than even the inert-prop rate above, so a whole
      // stand of trees reads as gently alive without looking animated.
      const entry = { group: mini, baseY: y, baseScale: 1, rate: 0.4, phase: phaseFromKey(`${f.cell.gx},${f.cell.gy},${f.kind}`), bob: f.blocking ? 0.012 : 0.006, defeated: false };
      // WILD-SCALE-1 — the mini's FOOTPRINT rides the same sheet-scale law
      // REND-SCALE-1 gave people/props: true wu size (wildTrueSize; trees
      // anchor to the settlement-band ink's own tree diameter,
      // INK_PARAMS.treeRadiusWu·2) over the actual built instance's measured
      // authored size (its own sizeClass jitter already baked in — the ratio
      // self-corrects). repositionEntities' wild pass (below) reapplies
      // baseScale on every camera zoom; the breathe loop re-applies it every
      // frame, so stamping these four fields is the whole change.
      const trueSize = wildTrueSize(f.kind, INK_PARAMS.treeRadiusWu * 2);
      if (trueSize) {
        const authored = trueSize.axis === 'footprint'
          ? measureAuthoredFootprint(THREE, mini)
          : measureAuthoredSize(THREE, mini, trueSize.axis);
        entry.wuPerAuthored = trueSize.wu / authored;
        entry.heightWu = trueSize.wu;
        entry.authoredSize = authored;
        entry.floorScale = 1;
      }
      wildMinis.push(entry);
      sliceMinis.push(entry);
    }
    updateFogEdge(node, center, centerP);
  }
  refreshWildMinis(); // the mount-time bubble, before any move

  // MAP-3DR — setPlayerFocus(tx, ty): stand the player mini on an exact node-TILE
  // point (tx,ty), the SAME resolveEntityWuFromWorld point the 2D ink marker uses
  // (continuousMap divides wu by NODE_WU to get tiles). So at the 2D→3D morph the
  // mini is on the very square the marker occupied — no jump. Pure view: only the
  // token's transform (+ its breathe baseY) move; no engine state, no scene rebuild.
  // A no-op during combat (the board owns the player cell there).
  //
  // TT-WORLD: the world sheet does NOT refresh here. It tracks `target` — the
  // SAME point setCamera authoritatively points the 3-D camera at — never a
  // second independent focus (see buildWorldSheet's centering note: that was
  // this packet's third live-found bug). setCamera owns the sheet refresh.
  //
  // MR-3b: this is also the wild-mini re-derivation hook. setPlayerFocus is
  // already called on every real camera/position update (continuousMap.js's
  // applyFromCam calls it every onCamera tick — the SAME hook the 2-D marker
  // rides), so re-deriving the bubble here (rather than adding a second,
  // independent "on move" event) keeps ONE trigger for "the player's position
  // just became current" — no separate polling, no drift between when the
  // token moves and when the wild around it catches up.
  function setPlayerFocus(tx, ty) {
    refreshWildMinis();
    if (!playerToken || !playerMini) return;
    const wx = (Number(tx) || 0) * TILE_WU, wz = (Number(ty) || 0) * TILE_WU;
    const wy = heightAt(wx, wz);
    playerToken.position.set(wx, wy + 0.06, wz);
    playerMini.baseY = wy + 0.06; // the breathe loop bobs around this
  }

  // ---------- clean HUD (corner title = the place you're in, + zoom band) ----------
  const placeName = (nodeById[player.nodeId] && nodeById[player.nodeId].name) || (nodes[0] && nodes[0].name) || '';
  const hudEl = buildHud(container, placeName);
  const typeLabel = t => t === 'settlement' ? 'SETTLEMENT' : t === 'dungeon_entrance' ? 'RUIN' : 'WILDERNESS';
  // The corner title names the place the camera is looking at (updates on pan),
  // with its kind as the subtitle. Only writes on change — cheap per frame.
  updateHud = () => {
    let best = null, bd = 1e9;
    for (const n of nodes) { const p = wPos(n); const d = Math.hypot(target.x - p.x, target.z - p.z); if (d < bd) { bd = d; best = n; } }
    if (!best || best.id === hudEl._id) return;
    hudEl._id = best.id;
    hudEl._title.textContent = best.name || '';
    hudEl._sub.textContent = typeLabel(best.nodeType) + ' · 3D';
  };

  applyCamera();

  // ---------- roof-peel cutaway (XCOM-style), driven by the continuous zoom ----------
  // As the zoom pushes in, the FOCUSED building (the one nearest the look-at) lifts +
  // fades its roof and fades its CAMERA-SIDE walls (far walls stay solid) to reveal the
  // interior; it reverses smoothly on zoom-out. Per-building lerp → no pop on focus
  // change. Pure view: reads the camera + the precomputed wall normals, writes only
  // material opacity / mesh position — never engine state.
  // px-per-tile band where the roof comes off. The play map opens at zoom z=2.0
  // (zoomPx = NODE_WU·z = 2000), so the peel must START just past that and COMPLETE
  // at a comfortable mid-zoom — otherwise it's only visible near max zoom and reads
  // as "not happening" in casual play (the bug this fixes). z≈2.4 → z≈4.0.
  const PEEL_START_PX = 2400, PEEL_FULL_PX = 4000;
  const ROOF_LIFT = 2.6;
  const FOCUS_R2 = 20 * 20;                          // look-at within ~20wu of a building → it's focused
  const _camDir = new THREE.Vector3();
  function updateCutaway() {
    if (!peelables.length) return;
    const zp = zoomPx > 0 ? smooth(PEEL_START_PX, PEEL_FULL_PX, zoomPx)
                          : smooth(78, 40, camera.position.distanceTo(target));
    let focus = null, fd = Infinity;
    for (const b of peelables) { const dx = b.center.x - target.x, dz = b.center.z - target.z; const d = dx * dx + dz * dz; if (d < fd) { fd = d; focus = b; } }
    const focusValid = fd < FOCUS_R2;
    for (const b of peelables) {
      const tgt = (focusValid && b === focus) ? zp : 0;
      b.cur += (tgt - b.cur) * 0.16;
      if (b.cur < 0.003) b.cur = 0;
      const c = b.cur;
      b.roof.position.y = b.roofBaseY + c * ROOF_LIFT;
      b.roofMat.opacity = 1 - c; b.roofMat.depthWrite = c < 0.5;
      b.roof.visible = c < 0.997; b.roof.castShadow = c < 0.5;
      for (const w of b.walls) {
        _camDir.copy(camera.position).sub(w.worldPos).normalize();
        const op = 1 - c * smooth(0.05, 0.5, Math.max(0, w.worldNormal.dot(_camDir)));
        for (const m of w.mats) { m.opacity = op; m.depthWrite = op > 0.5; }
        for (const mesh of w.castSet) mesh.castShadow = op > 0.5;
      }
    }
  }

  // ---------- render loop ----------
  let raf = 0, alive = true;
  function renderFrame() {
    if (!alive) return 0;
    // Ease the player's free-orbit back to north-up as the zoom approaches the flat
    // 2D plan, so the 2D⟷3D morph stays aligned (the parchment plan is north-up).
    if (!orbiting && zoomPx > 0 && zoomPx < PEEL_START_PX && (azOffset !== 0 || phiOffset !== 0)) {
      azOffset *= 0.84; phiOffset *= 0.84;
      if (Math.abs(azOffset) < 0.003) azOffset = 0;
      if (Math.abs(phiOffset) < 0.003) phiOffset = 0;
      positionCamera();
    }
    breatheMinis(sliceMinis, (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000);
    updateHud();      // corner title (cheap; only writes on change)
    updateCutaway();  // roof-peel of the focused building per the zoom depth
    if (composer) composer.render(); else renderer.render(scene, camera);
    return 1;
  }
  let paused = false;
  // Paint one frame up front so first paint never depends on rAF (which is
  // throttled in headless/background tabs) — the canvas is never blank.
  renderFrame();
  function frame() {
    if (!alive || paused) { raf = 0; return; }
    renderFrame();
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (alive && !paused && !raf) raf = requestAnimationFrame(frame); }
  raf = requestAnimationFrame(frame);
  // pause/resume: idle the rAF loop while the 3D overlay is hidden (zoomed out
  // into pure 2D) so a hidden diorama costs no GPU.
  function pause() { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function resume() { paused = false; renderFrame(); startLoop(); }

  // ---------- resize to the container ----------
  let ro = null;
  function resize() {
    const w = Math.max(1, container.clientWidth || w0);
    const h = Math.max(1, container.clientHeight || h0);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }
  try { ro = new ResizeObserver(resize); ro.observe(container); } catch { ro = null; }

  // ---------- teardown ----------
  function dispose() {
    if (!alive) return;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    if (ro) { try { ro.disconnect(); } catch {} }
    if (interactive) {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
    }
    scene.traverse(obj => {
      if (obj.geometry) { try { obj.geometry.dispose(); } catch {} }
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) { if (m.map) { try { m.map.dispose(); } catch {} } try { m.dispose(); } catch {} }
    });
    if (composer) { try { composer.dispose && composer.dispose(); } catch {} }
    try { renderer.dispose(); } catch {}
    try { renderer.forceContextLoss(); } catch {}
    if (canvas.parentNode === container) container.removeChild(canvas);
    if (hudEl && hudEl.parentNode) try { hudEl.parentNode.removeChild(hudEl); } catch {}
    // TT-WORLD — the hidden 2-D sheet mount is DELIBERATELY module-level and
    // survives an individual controller's dispose (maybeRefreshScene disposes
    // the OLD controller right after mounting a NEW one on a content refresh —
    // tearing the sheet mount down here would force a pointless rebuild on every
    // node/room/combat change, defeating its whole "reused like MAP-3DR's 2-D
    // map" point). The true exit (leaving the map surface) calls the exported
    // disposeSheetMount() directly — see continuousMap.js's disposeContinuousMap3d.
  }

  // setView: drive the camera directly (headless verification + future MAP_PATH
  // steps). alt = altitude band, az = orbit azimuth (radians; north-up = -0.65).
  function setView(view = {}) {
    if (view.alt != null) alt = clamp(view.alt, 60, 700);
    if (view.az != null) az = view.az;
    applyCamera();
    renderFrame();
    return { alt: Math.round(alt), az: +az.toFixed(2) };
  }

  // setCamera: the continuous-zoom driver. The 2D map's zoom hands us a
  // pxPerTile (screen px for one node-tile); we pick the camera DISTANCE that
  // makes one tile cover the same screen px in 3D — so the 3D scale stays locked
  // to the 2D map's scale through the crossover. `phi` is the tilt (≈0 top-down,
  // larger = oblique), `target` the look-at in node-tile units, `az` orientation
  // (0 = north-up, matching the 2D plan). (vFovTan is hoisted above, by the
  // camera's construction — buildWorldSheet needs it before this function exists.)
  function setCamera(o = {}) {
    if (o.target) target.set((Number(o.target.tx) || 0) * TILE_WU, 0, (Number(o.target.ty) || 0) * TILE_WU);
    if (o.az != null) baseAz = o.az;
    basePhi = clamp(o.phi != null ? o.phi : 0.06, 0.02, 1.35);
    let rad, zNew = null;
    if (o.pxPerTile != null && o.pxPerTile > 0) {
      const Hpx = Math.max(1, canvas.clientHeight || h0);
      rad = (TILE_WU * Hpx) / (2 * o.pxPerTile * vFovTan);
      zoomPx = o.pxPerTile; // continuous-zoom depth → drives the roof-peel cutaway
      zNew = o.pxPerTile / NODE_WU; // TT-WORLD — pxPerTile === NODE_WU * the 2-D map's live cam.z
    } else { rad = o.rad != null ? o.rad : 200; }
    curRad = clamp(rad, 30, 4000);
    // TT-WORLD — re-zoom the world-sheet texture to the SAME px-per-wu the live
    // 2-D sheet draws at (the ink-density perf fix), re-size the plane from the
    // camera's OWN just-clamped ground footprint (curRad, the sizing-bug fix —
    // never off the unrelated 2-D canvas's pixel dimensions), and re-center on
    // `target` (the centering-bug fix — the SAME point the camera itself looks
    // at, never a second independent focus). Re-render only past a real zoom
    // drift OR a real target move (both relative to the CURRENT plane span) so
    // a smooth pan/zoom doesn't thrash a canvas-draw + GPU-upload every frame.
    const targetDriftWorld = Math.hypot(target.x - _sheetTarget.x, target.z - _sheetTarget.z);
    const zCur = worldSheet.currentZ();
    const zoomDrifted = zNew != null && (zNew > zCur * SHEET_REZOOM_RATIO || zNew < zCur / SHEET_REZOOM_RATIO);
    const targetDrifted = targetDriftWorld > worldSheet.mesh.scale.x * SHEET_TARGET_REFRESH_FRAC;
    if (zoomDrifted || targetDrifted) {
      _sheetTarget = { x: target.x, z: target.z };
      worldSheet.refresh(_sheetTarget, opts.world, zNew != null ? zNew : zCur, curRad, vFovTan);
      // REND-TRUTH-1 — the sheet just re-centred/re-zoomed, so its wu→scene scale
      // and origin changed; reproject the engine-occupancy minis onto the new ink
      // (they share the SAME transform the sheet's own drawing uses).
      repositionEntities();
    }
    positionCamera(); // base + the player's orbit offset
    renderFrame();
    return { phi: +basePhi.toFixed(3), rad: Math.round(curRad) };
  }

  return { dispose, renderFrame, setView, setCamera, setPlayerFocus, orbitBy, setOrbiting, pause, resume, canvas };
}

// ───────────────────────────────────────────────────────────────────────────
// COMBAT TACTICAL BOARD (MX-2 render) — the XCOM board made visible.
//
// mountCombat3D(container, combatScene, opts?) -> Promise<controller>
//   container : a DOM element (already in the document); gets the canvas.
//   combatScene : a combat-scene/v1 object (combatScene.js combatSceneFromWorld).
//   throws    : Error('webgl-unavailable') when 3D can't run (caller falls back
//               to the 2D board / text — the board is an aid, never required).
//
// A PURE VIEW of world.combat: a gridded w×h board with the player + enemy minis
// standing on their engine cells (cx=east, cy=south). Reuses the diorama look
// (sky/light/ground) + the "You" token style. Intentionally self-contained from
// mountSlice3D so the shipped overworld morph can never be regressed by combat
// changes. Minis show CURRENT positions only — they do not move yet (talk→token
// is the next step); the caller re-mounts on combat-state change.
const CELL_WU = 6;       // world units per tactical cell — minis sit at cell centres.
const CELL_FT = 5;       // each grid square = 5 feet (D&D tactical scale).
const MOVE_FT = 30;      // a normal creature's move; 30 ft / 5 ft = 6 squares.
const MOVE_SQ = Math.round(MOVE_FT / CELL_FT);

// buildTacticalBoard — the shared tactical scene (dais + 5-ft grid + minis + 30-ft move
// range), built into its OWN group at local origin (cells 0..W*CELL_WU). Used two ways:
//   • mountCombat3D — added at origin, dais on (the standalone tabletop);
//   • mountSlice3D — added at the player's node and SCALED to 5 ft ≈ 1.5 units so the
//     fight is the overworld ground zoomed in (dais off — it sits on the terrain).
// Returns { group, minis, boardW, boardH, playerCenter }. Pure view; no scene refs.
function buildTacticalBoard(THREE, combatScene, opts = {}) {
  const { makeLabel = null, dais = true } = opts;
  const g = new THREE.Group();
  const minis = [];
  const grid = combatScene?.grid || { w: 12, h: 10 };
  const W = Math.max(1, Math.trunc(grid.w) || 12);
  const H = Math.max(1, Math.trunc(grid.h) || 10);
  const boardW = W * CELL_WU, boardH = H * CELL_WU;
  const cellCenter = (cx, cy) => ({ x: (cx + 0.5) * CELL_WU, z: (cy + 0.5) * CELL_WU });

  if (dais) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(boardW + 2, 0.6, boardH + 2), new THREE.MeshStandardMaterial({ color: 0x3a3326, roughness: 0.96 }));
    base.position.set(boardW / 2, -0.05, boardH / 2); base.receiveShadow = true; g.add(base);
    const topGeo = new THREE.PlaneGeometry(boardW, boardH, 1, 1); topGeo.rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ color: 0x6f7d4a, roughness: 0.97 }));
    top.position.set(boardW / 2, 0.26, boardH / 2); top.receiveShadow = true; g.add(top);
  }
  const pts = [];
  for (let i = 0; i <= W; i++) { const x = i * CELL_WU; pts.push(x, 0.30, 0, x, 0.30, boardH); }
  for (let j = 0; j <= H; j++) { const z = j * CELL_WU; pts.push(0, 0.30, z, boardW, 0.30, z); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xe9dcb6, transparent: true, opacity: 0.4 })));

  const player = combatScene?.player || { cx: 0, cy: 0, name: 'You' };
  const pc = cellCenter(player.cx, player.cy);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(CELL_WU * 0.94, CELL_WU * 0.94), new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.22, depthWrite: false }));
  hl.rotation.x = -Math.PI / 2; hl.position.set(pc.x, 0.32, pc.z); g.add(hl);
  const pToken = buildArchetypeFigure(THREE, 'player', {});
  pToken.position.set(pc.x, 0.32, pc.z); g.add(pToken);
  minis.push({ group: pToken, baseY: 0.32, baseScale: 1, rate: 1.5, phase: 0, bob: 0.05, defeated: false });
  if (makeLabel) { const pLabel = makeLabel(String(player.name || 'You'), '#bfe0ff'); pLabel.position.set(pc.x, 4.0, pc.z); g.add(pLabel); }

  const enemies = Array.isArray(combatScene?.enemies) ? combatScene.enemies : [];
  for (const e of enemies) {
    const ec = cellCenter(e.cx, e.cy);
    const arch = e.archetype || 'humanoid';
    const defeated = Boolean(e.defeated);
    // TT-MINIS: the fallen get bodies. A defeated foe used to just topple in
    // place (buildArchetypeFigure's `defeated` branch — same standing rig,
    // rotated 90° + faded). Now try an authored corpse GLB (miniLibrary.js)
    // FIRST, deterministic per entity (buildCorpseMini hashes e.id||e.name —
    // the SAME foe always shows the SAME corpse); buildCorpseMini returns null
    // whenever the library's empty, the GLB hasn't loaded yet, or it failed to
    // load — in every one of those cases fall straight back to the toppled
    // archetype figure, exactly like buildArchetypeFigure already falls back
    // from buildFigureFromGLB. The map must never break over a corpse asset.
    const tok = (defeated && buildCorpseMini(THREE, e.id || e.name)) ||
      buildArchetypeFigure(THREE, arch, { defeated, elite: Boolean(e.elite), variant: e.id || e.name });
    tok.position.set(ec.x, 0.32, ec.z); g.add(tok);
    // A corpse mini is already ground-flush geometry (its own userData.corpseId
    // marks it) — no toppled-figure rate/bob needed either way since `defeated:
    // true` makes breatheMinis skip it entirely (a corpse is the one mini
    // legitimately still).
    minis.push({ group: tok, baseY: 0.32, baseScale: e.elite ? 1.24 : 1, rate: arch === 'undead' ? 1.1 : 1.6, phase: phaseFromKey(e.id || e.name), bob: arch === 'undead' ? 0.09 : 0.05, defeated });
    if (makeLabel) { const lbl = makeLabel(String(e.name || 'Foe'), e.defeated ? '#8a7d72' : '#ffb0a0'); lbl.position.set(ec.x, e.defeated ? 2.4 : 3.9, ec.z); g.add(lbl); }
  }

  // 30-ft move range (Chebyshev ≤ 6 squares) around the player — reachable, unoccupied cells.
  const occupied = new Set(enemies.filter(e => !e.defeated).map(e => e.cx + ',' + e.cy));
  const rangeMat = new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.13, depthWrite: false });
  const tileGeo = new THREE.PlaneGeometry(CELL_WU * 0.9, CELL_WU * 0.9); tileGeo.rotateX(-Math.PI / 2);
  for (let gx = 0; gx < W; gx++) for (let gy = 0; gy < H; gy++) {
    const d = Math.max(Math.abs(gx - player.cx), Math.abs(gy - player.cy));
    if (d === 0 || d > MOVE_SQ || occupied.has(gx + ',' + gy)) continue;
    const t = new THREE.Mesh(tileGeo, rangeMat); const c = cellCenter(gx, gy);
    t.position.set(c.x, 0.315, c.z); g.add(t);
  }

  return { group: g, minis, boardW, boardH, playerCenter: pc };
}

export async function mountCombat3D(container, combatScene, opts = {}) {
  if (!container) throw new Error('no-container');
  if (!webglAvailable()) throw new Error('webgl-unavailable');

  const THREE = await import('three');
  let EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
  try {
    ({ EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js'));
    ({ RenderPass } = await import('three/addons/postprocessing/RenderPass.js'));
    ({ UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js'));
    ({ OutputPass } = await import('three/addons/postprocessing/OutputPass.js'));
  } catch { EffectComposer = null; }

  const w0 = Math.max(1, container.clientWidth || 800);
  const h0 = Math.max(1, container.clientHeight || 480);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch (e) { throw new Error('webgl-unavailable'); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w0, h0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%';
  canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';
  while (container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfc4ad, 220, 620);
  const camera = new THREE.PerspectiveCamera(45, w0 / h0, 0.5, 1400);

  // ---------- sky / lighting / ground (the shared diorama look) ----------
  function skyTex() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#3f6aa0'); g.addColorStop(0.45, '#86a6c4');
    g.addColorStop(0.72, '#d8c6a6'); g.addColorStop(0.9, '#eec488'); g.addColorStop(1, '#e6b478');
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }));
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xbcd2f0, 0x6a5a40, 0.7));
  const sun = new THREE.DirectionalLight(0xffe2a8, 2.1);
  sun.position.set(-60, 110, 70); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
  sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
  sun.shadow.bias = -0.0004;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0xfff0d8, 0.32));
  const grassGeo = new THREE.PlaneGeometry(1400, 1400, 1, 1); grassGeo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({ color: 0x556437, roughness: 0.99 }));
  grass.position.y = -0.3; grass.receiveShadow = true; scene.add(grass);

  // ---------- labels + minis (the "You" token style, reused) ----------
  function makeLabel(text, color = '#fff', sx = 11, sy = 2.0) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d');
    x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 10;
    x.fillStyle = color; x.font = 'bold 44px Georgia, serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: true }));
    sprite.scale.set(sx, sy, 1);
    return sprite;
  }
  // Minis are stylized procedural archetype figures (figures3d.js): the player +
  // humanoid / beast / undead foes, with an `elite` overlay for leaders/bosses.
  // They breathe in the render loop (registered into `minis` below).
  // buildArchetypeFigure(THREE, archetype, { defeated, elite }). TT-MINIS: a
  // defeated foe now prefers an authored corpse GLB (buildCorpseMini,
  // miniLibrary.js) over the toppled-archetype pose, falling back to it when no
  // corpse is available — see buildTacticalBoard's enemy loop, below.
  // The tactical scene (dais + 5-ft grid + minis + 30-ft move range) — shared builder,
  // added at the board origin. (mountSlice3D reuses the same builder, embedded + scaled.)
  const board = buildTacticalBoard(THREE, combatScene, { makeLabel, dais: true });
  scene.add(board.group);
  const minis = board.minis;
  const boardW = board.boardW, boardH = board.boardH;
  const cx0 = boardW / 2, cz0 = boardH / 2; // board centre (world units)

  // ---------- postprocessing ----------
  let composer = null;
  if (EffectComposer) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(w0, h0), 0.22, 0.5, 0.9));
      composer.addPass(new OutputPass());
    } catch { composer = null; }
  }

  // ---------- camera (oblique XCOM 3/4 view, framing the whole board) ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const target = new THREE.Vector3(cx0, 0, cz0);
  const boardMax = Math.max(boardW, boardH);
  let alt = clamp((boardMax * 1.5) / 0.65, 80, 700);
  let az = (opts.az != null ? opts.az : -0.6);
  function applyCamera() {
    const tilt = smooth(80, 460, alt);
    const phi = clamp(0.5 + (1 - tilt) * 0.62, 0.16, 1.2);
    const rad = clamp(alt * 0.65, 40, 560);
    camera.position.set(
      target.x + rad * Math.sin(phi) * Math.sin(az),
      target.y + rad * Math.cos(phi),
      target.z + rad * Math.sin(phi) * Math.cos(az)
    );
    camera.lookAt(target);
    sky.position.copy(camera.position);
  }

  // ---------- orbit controls (view-only — the board never moves anyone) ----------
  let drag = false, lx = 0;
  function onPointerDown(e) { drag = true; lx = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch {} }
  function onPointerUp() { drag = false; }
  function onPointerMove(e) { if (!drag) return; az -= (e.clientX - lx) * 0.005; lx = e.clientX; applyCamera(); }
  function onWheel(e) { e.preventDefault(); alt = clamp(alt + e.deltaY * 0.5, 70, 700); applyCamera(); }
  const interactive = opts.controls !== false;
  if (interactive) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
  }

  applyCamera();

  // ---------- render loop ----------
  let raf = 0, alive = true, paused = false;
  function renderFrame() {
    if (!alive) return 0;
    // idle breathe — the minis read as alive (cheap sine, view-only).
    breatheMinis(minis, (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000);
    // billboard labels stay upright (sprites auto-face); just render.
    if (composer) composer.render(); else renderer.render(scene, camera);
    return 1;
  }
  renderFrame();
  function frame() { if (!alive || paused) { raf = 0; return; } renderFrame(); raf = requestAnimationFrame(frame); }
  function startLoop() { if (alive && !paused && !raf) raf = requestAnimationFrame(frame); }
  raf = requestAnimationFrame(frame);
  function pause() { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function resume() { paused = false; renderFrame(); startLoop(); }

  // ---------- resize ----------
  let ro = null;
  function resize() {
    const w = Math.max(1, container.clientWidth || w0);
    const h = Math.max(1, container.clientHeight || h0);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }
  try { ro = new ResizeObserver(resize); ro.observe(container); } catch { ro = null; }

  // ---------- teardown ----------
  function dispose() {
    if (!alive) return;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    if (ro) { try { ro.disconnect(); } catch {} }
    if (interactive) {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
    }
    scene.traverse(obj => {
      if (obj.geometry) { try { obj.geometry.dispose(); } catch {} }
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) { if (m.map) { try { m.map.dispose(); } catch {} } try { m.dispose(); } catch {} }
    });
    if (composer) { try { composer.dispose && composer.dispose(); } catch {} }
    try { renderer.dispose(); } catch {}
    try { renderer.forceContextLoss(); } catch {}
    if (canvas.parentNode === container) container.removeChild(canvas);
  }

  // setView: drive the camera (headless verification + orbit recentring).
  function setView(view = {}) {
    if (view.alt != null) alt = clamp(view.alt, 70, 700);
    if (view.az != null) az = view.az;
    applyCamera(); renderFrame();
    return { alt: Math.round(alt), az: +az.toFixed(2) };
  }

  return { dispose, renderFrame, setView, pause, resume, canvas };
}
