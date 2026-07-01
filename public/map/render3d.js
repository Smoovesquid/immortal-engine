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
//     throws    : Error('webgl-unavailable') or an import error when 3D can't run.

const TILE_WU = 40; // world units per node tile — keeps the 3D geography to scale.

// Procedural archetype minis + idle breathe (MAPNINJA Step 5). Pure helpers; they
// receive the lazily-imported THREE, so this stays a zero-cost static import.
import { buildArchetypeFigure, breatheMinis, phaseFromKey } from './figures3d.js';

// World-asset builders (terrain, dirt roads, settlements, woods, the chapel ruin) —
// the SAME pure-view module the standalone asset lab (map-proto/asset-lab.html) uses,
// so a look designed there flows straight to the game on reload. THREE + the seeded
// RNG are passed in; this stays a zero-cost static import (no three fetch of its own).
import {
  nodeRng, createWorldMaterials, buildTerrain, buildEdge,
  buildSettlement, buildWilderness, buildChapelRuin,
} from './worldAssets.js';

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
  scene.fog = new THREE.Fog(0xe6d4ac, 200, 560); // warm haze (outpost.html atmosphere)
  const camera = new THREE.PerspectiveCamera(45, w0 / h0, 0.5, 1200);

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

  // ---------- world materials + terrain (shared worldAssets builders) ----------
  // One material bundle per scene — its `shared` set drives dimGroup's clone-before-
  // tint, and the peelable buildings clone it into transparent sets for the cutaway.
  // The terrain is a vertex-coloured heightfield FLATTENED under the nodes/roads; it
  // returns heightAt() so nodes, roads and the player all drop onto the same surface.
  // All deterministic from the scene seed — pure view, never engine state.
  const mats = createWorldMaterials(THREE);
  const { mesh: terrain, heightAt } = buildTerrain(THREE, { nodes, edges, bounds, seed, tileWU: TILE_WU });
  scene.add(terrain);

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
  for (const node of nodes) {
    const base = wPos(node);
    const baseY = heightAt(base.x, base.z);
    const groundAt = (lx, lz) => heightAt(base.x + lx, base.z + lz) - baseY; // local terrain, relative to the place
    const rng = nodeRng(seed, node.id);
    const grp = new THREE.Group();
    grp.position.set(base.x, baseY, base.z);
    if (node.nodeType === 'settlement') grp.add(buildSettlement(THREE, mats, rng, groundAt, node.discovered, peelables));
    else if (node.nodeType === 'dungeon_entrance') grp.add(buildChapelRuin(THREE, mats, rng, groundAt));
    else grp.add(buildWilderness(THREE, mats, rng, groundAt, node.discovered));
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
  const sliceMinis = [];
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
    sliceMinis.push({ group: token, baseY: py + 0.06, baseScale: 1, rate: 1.4, phase: 0, bob: 0.05, defeated: false });
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
  // (0 = north-up, matching the 2D plan).
  const vFovTan = Math.tan((camera.fov * Math.PI / 180) / 2);
  function setCamera(o = {}) {
    if (o.target) target.set((Number(o.target.tx) || 0) * TILE_WU, 0, (Number(o.target.ty) || 0) * TILE_WU);
    if (o.az != null) baseAz = o.az;
    basePhi = clamp(o.phi != null ? o.phi : 0.06, 0.02, 1.35);
    let rad;
    if (o.pxPerTile != null && o.pxPerTile > 0) {
      const Hpx = Math.max(1, canvas.clientHeight || h0);
      rad = (TILE_WU * Hpx) / (2 * o.pxPerTile * vFovTan);
      zoomPx = o.pxPerTile; // continuous-zoom depth → drives the roof-peel cutaway
    } else { rad = o.rad != null ? o.rad : 200; }
    curRad = clamp(rad, 30, 4000);
    positionCamera(); // base + the player's orbit offset
    renderFrame();
    return { phi: +basePhi.toFixed(3), rad: Math.round(curRad) };
  }

  return { dispose, renderFrame, setView, setCamera, orbitBy, setOrbiting, pause, resume, canvas };
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
    const tok = buildArchetypeFigure(THREE, arch, { defeated: Boolean(e.defeated), elite: Boolean(e.elite), variant: e.id || e.name });
    tok.position.set(ec.x, 0.32, ec.z); g.add(tok);
    minis.push({ group: tok, baseY: 0.32, baseScale: e.elite ? 1.24 : 1, rate: arch === 'undead' ? 1.1 : 1.6, phase: phaseFromKey(e.id || e.name), bob: arch === 'undead' ? 0.09 : 0.05, defeated: Boolean(e.defeated) });
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
  // humanoid / beast / undead foes, with an `elite` overlay for leaders/bosses and
  // a toppled pose for the downed. They breathe in the render loop (registered
  // into `minis` below). buildArchetypeFigure(THREE, archetype, { defeated, elite }).
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
