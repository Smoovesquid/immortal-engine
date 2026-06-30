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

// ---------- seeded RNG (matches the proto: view-deterministic scatter) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function strHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}
function nodeRng(seedStr, nodeId) { return mulberry32(strHash(seedStr + '_' + nodeId)); }

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
  scene.fog = new THREE.Fog(0xd8cdb8, 180, 520);
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

  // ---------- ground ----------
  const groundGeo = new THREE.PlaneGeometry(900, 900, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x5e7040, roughness: 0.98 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- materials ----------
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xcdbf9c, roughness: 0.95 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x49301a, roughness: 0.85 });
  const thatchMat = new THREE.MeshStandardMaterial({ color: 0xb8a05a, roughness: 1.0 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4642, roughness: 0.97 });
  const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.95 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.95 });

  // ---------- label sprite ----------
  function makeLabel(text, color = '#fff') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d');
    x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 10;
    x.fillStyle = color;
    x.font = 'bold 44px Georgia, serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(22, 4.1, 1);
    return sprite;
  }

  // ---------- node builders ----------
  function roofPrism(w, d, rh, eave, mat) {
    const long = Math.max(w, d), short = Math.min(w, d);
    const s = new THREE.Shape();
    s.moveTo(-short / 2 - eave, 0); s.lineTo(short / 2 + eave, 0); s.lineTo(0, rh); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: long + eave * 2, bevelEnabled: false });
    geo.translate(0, 0, -(long + eave * 2) / 2);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true;
    if (w >= d) m.rotation.y = Math.PI / 2;
    return m;
  }

  function makeHouse(rng, dark = false) {
    const g = new THREE.Group();
    const w = 3.5 + rng() * 1.5, d = 4.0 + rng() * 2.0;
    const h = 2.4 + rng() * 0.5;
    const wall = dark ? darkStoneMat : plasterMat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const frMat = dark ? darkRoofMat : timberMat;
    for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.16), frMat);
      fr.position.set(sx, h / 2, d / 2 + 0.01); g.add(fr);
    }
    const roof = roofPrism(w, d, 1.6, 0.3, dark ? darkRoofMat : thatchMat);
    roof.position.y = h; g.add(roof);
    return g;
  }

  function buildSettlement(rng, dark = false) {
    const g = new THREE.Group();
    const count = dark ? 2 : 3;
    const offsets = [[0, 0], [5.5, 1.5], [-4.5, 2.5]];
    for (let i = 0; i < count; i++) {
      const h = makeHouse(rng, dark);
      h.position.set(offsets[i][0], 0, offsets[i][1]);
      h.rotation.y = (rng() - 0.5) * 0.6;
      g.add(h);
    }
    return g;
  }

  function buildWilderness(rng) {
    const g = new THREE.Group();
    const treeCount = 5 + Math.floor(rng() * 5);
    const greenVariants = [0x3f6a35, 0x4f7a3f, 0x35602e, 0x44702a, 0x547a44];
    for (let i = 0; i < treeCount; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 2 + rng() * 9;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      const s = 0.7 + rng() * 0.9;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.0, 6), trunkMat);
      trunk.position.set(tx, 1.0 * s, tz); trunk.scale.setScalar(s);
      trunk.castShadow = true; g.add(trunk);
      const greenColor = greenVariants[Math.floor(rng() * greenVariants.length)];
      const foliMat = new THREE.MeshStandardMaterial({ color: greenColor, roughness: 0.9 });
      const foli = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.0, 7), foliMat);
      foli.position.set(tx, (2.0 + 1.5) * s, tz); foli.scale.setScalar(s);
      foli.castShadow = true; g.add(foli);
    }
    return g;
  }

  function buildDungeon(rng) {
    const g = new THREE.Group();
    const w = 6, d = 9, h = 5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkStoneMat);
    body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = roofPrism(w, d, 2.5, 0.25, darkRoofMat);
    roof.position.y = h; g.add(roof);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 7.0, 6), darkRoofMat);
    spire.position.set(0, h + 2.5 + 3.5, -d / 2 + 1.2); spire.castShadow = true; g.add(spire);
    for (const sx of [-w / 2 - 0.3, w / 2 + 0.3]) {
      const pill = new THREE.Mesh(new THREE.BoxGeometry(0.8, h * 0.75, 1.2), darkStoneMat);
      pill.position.set(sx, h * 0.75 / 2, 0); pill.castShadow = true; g.add(pill);
    }
    const glow = new THREE.PointLight(0x6633aa, 1.5, 20, 2);
    glow.position.set(0, 2, 0); g.add(glow);
    return g;
  }

  // ---------- edge ribbon builder ----------
  function buildEdge(ax, az, bx, bz, kind) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const half = kind === 'road' ? 1.2 : 0.6;
    const nx = -dz / len, nz = dx / len;
    const verts = [
      ax + nx * half, 0.08, az + nz * half,
      ax - nx * half, 0.08, az - nz * half,
      bx + nx * half, 0.08, bz + nz * half,
      bx - nx * half, 0.08, bz - nz * half,
    ];
    const idx = [0, 1, 2, 1, 3, 2];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const color = kind === 'road' ? 0xa08050 : 0x7a6440;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1.0 }));
    m.receiveShadow = true;
    return m;
  }

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
  const target = new THREE.Vector3(0, 0, 0);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  function applyCamera() {
    const tilt = smooth(80, 400, alt);
    const phi = clamp(0.55 + (1 - tilt) * 0.6, 0.12, 1.3);
    const rad = clamp(alt * 0.65, 40, 500);
    camera.position.set(
      target.x + rad * Math.sin(phi) * Math.sin(az),
      target.y + rad * Math.cos(phi),
      target.z + rad * Math.sin(phi) * Math.cos(az)
    );
    camera.lookAt(target);
    sky.position.copy(camera.position);
  }

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

  // ---------- build the scene from the contract object ----------
  const nodeById = {};
  const nodes = Array.isArray(sceneData?.nodes) ? sceneData.nodes : [];
  const edges = Array.isArray(sceneData?.edges) ? sceneData.edges : [];
  const seed = String(sceneData?.seed || '');
  for (const n of nodes) nodeById[n.id] = n;

  const bounds = sceneData?.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  target.set(((bounds.minX + bounds.maxX) / 2) * TILE_WU, 0, ((bounds.minY + bounds.maxY) / 2) * TILE_WU);

  const wPos = n => ({ x: (Number(n.x) || 0) * TILE_WU, z: (Number(n.y) || 0) * TILE_WU });

  for (const edge of edges) {
    const a = nodeById[edge.a], b = nodeById[edge.b];
    if (!a || !b) continue;
    const ap = wPos(a), bp = wPos(b);
    scene.add(buildEdge(ap.x, ap.z, bp.x, bp.z, edge.kind));
  }

  for (const node of nodes) {
    const rng = nodeRng(seed, node.id);
    const pos = wPos(node);
    const grp = new THREE.Group();
    grp.position.set(pos.x, 0, pos.z);
    const dark = !node.discovered;
    let geo3d;
    if (node.nodeType === 'settlement') {
      geo3d = buildSettlement(rng, false);
      if (dark) geo3d.traverse(c => { if (c.isMesh && c.material) { const m = c.material.clone(); m.color.offsetHSL(0, -0.3, -0.1); c.material = m; } });
    } else if (node.nodeType === 'dungeon_entrance') {
      geo3d = buildDungeon(rng);
    } else {
      geo3d = buildWilderness(rng);
      if (dark) geo3d.traverse(c => { if (c.isMesh && c.material) { const m = c.material.clone(); m.color.offsetHSL(0, -0.25, -0.08); c.material = m; } });
    }
    if (geo3d) grp.add(geo3d);
    const labelY = node.nodeType === 'dungeon_entrance' ? 18 : node.nodeType === 'settlement' ? 12 : 16;
    grp.add((() => { const l = makeLabel(node.name, node.discovered ? '#fff9e6' : '#b0a890'); l.position.set(0, labelY, 0); return l; })());
    scene.add(grp);
  }

  // Player token (slight offset so it doesn't clip the settlement it sits on).
  const player = sceneData?.player || { nodeId: nodes[0]?.id, x: 0, y: 0 };
  const px = (Number(player.x) || 0) * TILE_WU + 3;
  const pz = (Number(player.y) || 0) * TILE_WU + 3;
  // The overworld avatar reuses the SAME player figure as the combat board (one
  // consistent "you"), with a gentle idle breathe.
  const token = buildArchetypeFigure(THREE, 'player', {});
  token.position.set(px, 0.06, pz);
  scene.add(token);
  const sliceMinis = [{ group: token, baseY: 0.06, baseScale: 1, rate: 1.4, phase: 0, bob: 0.05, defeated: false }];
  const youLabel = makeLabel('You', '#66aaff');
  youLabel.position.set(px, 8, pz);
  scene.add(youLabel);

  applyCamera();

  // ---------- render loop ----------
  let raf = 0, alive = true;
  function renderFrame() {
    if (!alive) return 0;
    breatheMinis(sliceMinis, (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000);
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
    if (o.az != null) az = o.az;
    let phi = clamp(o.phi != null ? o.phi : 0.06, 0.02, 1.35);
    let rad;
    if (o.pxPerTile != null && o.pxPerTile > 0) {
      const Hpx = Math.max(1, canvas.clientHeight || h0);
      rad = (TILE_WU * Hpx) / (2 * o.pxPerTile * vFovTan);
    } else { rad = o.rad != null ? o.rad : 200; }
    rad = clamp(rad, 30, 4000);
    camera.position.set(
      target.x + rad * Math.sin(phi) * Math.sin(az),
      target.y + rad * Math.cos(phi),
      target.z + rad * Math.sin(phi) * Math.cos(az)
    );
    camera.lookAt(target);
    sky.position.copy(camera.position);
    renderFrame();
    return { phi: +phi.toFixed(3), rad: Math.round(rad) };
  }

  return { dispose, renderFrame, setView, setCamera, pause, resume, canvas };
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
const CELL_WU = 6; // world units per tactical cell — minis sit at cell centres.

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
  const minis = [];

  // ---------- the board ----------
  const grid = combatScene?.grid || { w: 12, h: 10 };
  const W = Math.max(1, Math.trunc(grid.w) || 12);
  const H = Math.max(1, Math.trunc(grid.h) || 10);
  const boardW = W * CELL_WU, boardH = H * CELL_WU;
  const cx0 = boardW / 2, cz0 = boardH / 2; // board centre (world units)
  const cellCenter = (cx, cy) => ({ x: (cx + 0.5) * CELL_WU, z: (cy + 0.5) * CELL_WU });

  // Board base (a raised dais so the grid reads as a tabletop).
  const base = new THREE.Mesh(new THREE.BoxGeometry(boardW + 2, 0.6, boardH + 2),
    new THREE.MeshStandardMaterial({ color: 0x3a3326, roughness: 0.96 }));
  base.position.set(cx0, -0.05, cz0); base.receiveShadow = true; scene.add(base);
  // Board top (where minis cast shadows).
  const topGeo = new THREE.PlaneGeometry(boardW, boardH, 1, 1); topGeo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ color: 0x6f7d4a, roughness: 0.97 }));
  top.position.set(cx0, 0.26, cz0); top.receiveShadow = true; scene.add(top);
  // Grid lines (exact cell coords → aligned 1:1 with mini cells).
  const pts = [];
  for (let i = 0; i <= W; i++) { const x = i * CELL_WU; pts.push(x, 0.30, 0, x, 0.30, boardH); }
  for (let j = 0; j <= H; j++) { const z = j * CELL_WU; pts.push(0, 0.30, z, boardW, 0.30, z); }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xe9dcb6, transparent: true, opacity: 0.4 })));

  const labels = [];
  // Player mini + cell highlight + label.
  const player = combatScene?.player || { cx: 0, cy: 0, name: 'You' };
  const pc = cellCenter(player.cx, player.cy);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(CELL_WU * 0.94, CELL_WU * 0.94),
    new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.22, depthWrite: false }));
  hl.rotation.x = -Math.PI / 2; hl.position.set(pc.x, 0.32, pc.z); scene.add(hl);
  const pToken = buildArchetypeFigure(THREE, 'player', {});
  pToken.position.set(pc.x, 0.32, pc.z); scene.add(pToken);
  minis.push({ group: pToken, baseY: 0.32, baseScale: 1, rate: 1.5, phase: 0, bob: 0.05, defeated: false });
  const pLabel = makeLabel(String(player.name || 'You'), '#bfe0ff'); pLabel.position.set(pc.x, 4.0, pc.z); scene.add(pLabel); labels.push(pLabel);

  // Enemy minis + labels — figure keyed to archetype, elite upscales + crowns.
  const enemies = Array.isArray(combatScene?.enemies) ? combatScene.enemies : [];
  for (const e of enemies) {
    const ec = cellCenter(e.cx, e.cy);
    const arch = e.archetype || 'humanoid';
    const tok = buildArchetypeFigure(THREE, arch, { defeated: Boolean(e.defeated), elite: Boolean(e.elite) });
    tok.position.set(ec.x, 0.32, ec.z); scene.add(tok);
    minis.push({
      group: tok, baseY: 0.32, baseScale: e.elite ? 1.24 : 1,
      rate: arch === 'undead' ? 1.1 : 1.6, phase: phaseFromKey(e.id || e.name),
      bob: arch === 'undead' ? 0.09 : 0.05, defeated: Boolean(e.defeated),
    });
    const lbl = makeLabel(String(e.name || 'Foe'), e.defeated ? '#8a7d72' : '#ffb0a0');
    lbl.position.set(ec.x, e.defeated ? 2.4 : 3.9, ec.z); scene.add(lbl); labels.push(lbl);
  }

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
