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
  const _smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const D = new THREE.Object3D(); // scratch matrix carrier for instanced placement
  // HUD hook (assigned once its DOM exists, below); the render loop calls it.
  let updateHud = () => {};

  // ---------- terrain: a vertex-coloured heightfield (outpost.html technique) ----------
  // Gentle rolling hills FLATTENED where the world is inhabited (node centres + the
  // roads between them) so buildings/paths sit level; coloured grass with dirt along
  // the roads, rock on the high points, a forest tint past the settled tiles. All
  // deterministic from the scene seed — a pure-view scatter, never engine state.
  const tRng = mulberry32(strHash(seed + '_terrain'));
  const edgeSegs = [];
  for (const e of edges) { const a = nodeById[e.a], b = nodeById[e.b]; if (a && b) edgeSegs.push([wPos(a), wPos(b)]); }
  function distToEdges(x, z) {
    let d = 1e9;
    for (const [a, b] of edgeSegs) {
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-6;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      d = Math.min(d, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)));
    }
    return d;
  }
  function distToNodes(x, z) {
    let d = 1e9;
    for (const n of nodes) { const p = wPos(n); d = Math.min(d, Math.hypot(x - p.x, z - p.z)); }
    return d;
  }
  const FLAT_R = TILE_WU * 0.78;
  function settledFlat(x, z) {
    return Math.max(1 - _smooth(FLAT_R * 0.5, FLAT_R, distToNodes(x, z)), 1 - _smooth(3, 9, distToEdges(x, z)));
  }
  function heightAt(x, z) {
    let h = 2.4 * Math.sin(x * 0.013) * Math.cos(z * 0.012) + 1.3 * Math.sin(x * 0.031 + 1.4) * Math.sin(z * 0.027);
    return h * (1 - settledFlat(x, z) * 0.95);
  }
  const MARGIN = TILE_WU * 2.4;
  const tMinX = bounds.minX * TILE_WU - MARGIN, tMaxX = bounds.maxX * TILE_WU + MARGIN;
  const tMinZ = bounds.minY * TILE_WU - MARGIN, tMaxZ = bounds.maxY * TILE_WU + MARGIN;
  const tCx = (tMinX + tMaxX) / 2, tCz = (tMinZ + tMaxZ) / 2;
  const tW = Math.max(80, tMaxX - tMinX), tD = Math.max(80, tMaxZ - tMinZ);
  const tgeo = new THREE.PlaneGeometry(tW, tD, Math.min(200, Math.max(48, Math.round(tW / 3))), Math.min(200, Math.max(48, Math.round(tD / 3))));
  tgeo.rotateX(-Math.PI / 2);
  const tposn = tgeo.attributes.position, tcol = [];
  const cGrass = new THREE.Color(0x5e7d3a), cGrass2 = new THREE.Color(0x6f8a44),
        cDirt = new THREE.Color(0x6b5234), cForest = new THREE.Color(0x415c2c), cRock = new THREE.Color(0x8b8472);
  for (let i = 0; i < tposn.count; i++) {
    const x = tposn.getX(i) + tCx, z = tposn.getZ(i) + tCz, y = heightAt(x, z);
    tposn.setY(i, y);
    let c;
    if (distToEdges(x, z) < 2.4) c = cDirt.clone();
    else if (y > 2.3) c = cRock.clone();
    else {
      c = (Math.sin(x * 0.6) * Math.cos(z * 0.5) > 0 ? cGrass : cGrass2).clone();
      c.lerp(cForest, _smooth(TILE_WU * 0.9, TILE_WU * 1.9, distToNodes(x, z)) * 0.7);
    }
    c.offsetHSL(0, 0, (tRng() - 0.5) * 0.05);
    tcol.push(c.r, c.g, c.b);
  }
  tgeo.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3));
  tgeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }));
  terrain.position.set(tCx, 0, tCz); terrain.receiveShadow = true;
  scene.add(terrain);

  // ---------- materials (outpost.html palette: plaster, timber, varied roofs) ----------
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xcdbf9c, roughness: 0.95 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x49301a, roughness: 0.85 });
  const thatchMat = new THREE.MeshStandardMaterial({ color: 0xb8a05a, roughness: 1.0 });
  const tileRoofMat = new THREE.MeshStandardMaterial({ color: 0x9a4636, roughness: 0.85 }); // red tile
  const shingleMat = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b8579, roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4526, roughness: 0.8 });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x6e4a28, roughness: 0.95 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4642, roughness: 0.97 });
  const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.95 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.95 });
  const roofMatOf = { thatch: thatchMat, tile: tileRoofMat, shingle: shingleMat };
  // Shared (re-used) materials must be cloned before a per-place tint; the
  // peelable buildings already use unique transparent clones, so those tint in
  // place (preserving the cutaway's material references — see dimGroup).
  const SHARED_MATS = new Set([plasterMat, timberMat, thatchMat, tileRoofMat, shingleMat, stoneMat, woodMat, logMat, darkStoneMat, darkRoofMat, trunkMat]);
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

  // ---------- node builders (outpost.html stylized look, data-driven) ----------
  // roof prism whose ridge runs along the building's LONGER horizontal axis.
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

  const PARCELS = { inn: [5.2, 6.4], chapel: [4.2, 5.6], smithy: [4.0, 5.0], cottage: [3.8, 4.6], house: [4.2, 5.0], store: [4.6, 4.4] };

  // A bare interior revealed when the roof peels: a wooden floor, a hearth (emissive
  // glow — no scene light, so it never leaks through the closed shell), a table + stool.
  function makeInterior(rng, bw, bdep) {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.3, 0.12, bdep - 0.3), woodMat.clone()); floor.position.y = 0.06; floor.receiveShadow = true; g.add(floor);
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.45), stoneMat.clone()); hearth.position.set(-bw / 2 + 0.7, 0.5, -bdep / 2 + 0.35); hearth.castShadow = true; g.add(hearth);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5a14, emissiveIntensity: 2.2, roughness: 0.6 })); fire.position.set(-bw / 2 + 0.7, 0.42, -bdep / 2 + 0.5); fire.scale.y = 0.7; g.add(fire);
    const tx = (rng() - 0.5) * bw * 0.4, tz = (rng() - 0.1) * bdep * 0.22;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12), woodMat.clone()); top.position.set(tx, 0.78, tz); top.castShadow = true; g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 8), woodMat.clone()); leg.position.set(tx, 0.39, tz); g.add(leg);
    const sx = tx + 0.95, sz = tz + 0.25;
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), woodMat.clone()); stool.position.set(sx, 0.46, sz); stool.castShadow = true; g.add(stool);
    const sleg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.46, 6), woodMat.clone()); sleg.position.set(sx, 0.23, sz); g.add(sleg);
    return g;
  }

  // A varied stylized building, now MODULAR for the roof-peel cutaway: 4 separate
  // walls (each a small group: panel + its decorations) + a separate roof + floor +
  // interior, instead of one sealed box. Built at the origin facing +z; the caller
  // positions/rotates it. Returns the separable pieces so updateCutaway() can lift
  // the roof and fade the camera-side walls of the focused building.
  function makeBuilding(rng, type, roofKind) {
    const g = new THREE.Group();
    const fp = PARCELS[type] || PARCELS.cottage;
    const bw = fp[0] * (0.92 + rng() * 0.16), bdep = fp[1] * (0.92 + rng() * 0.16);
    const h = type === 'inn' || type === 'chapel' ? 3.3 : 2.5;
    const T = 0.2; // wall thickness
    g.add(makeInterior(rng, bw, bdep)); // revealed when peeled (opaque; hidden inside the closed shell)

    // each wall is its own group (panel + decorations) with a unique transparent
    // material set, so the cutaway can fade only the camera-side walls.
    const walls = [];
    function wall(geo, x, z, nx, nz, deco) {
      const wg = new THREE.Group(); wg.position.set(x, 0, z);
      const mats = [], castSet = [];
      const pm = plasterMat.clone(); pm.transparent = true; mats.push(pm);
      const panel = new THREE.Mesh(geo, pm); panel.position.y = h / 2; panel.castShadow = true; panel.receiveShadow = true; wg.add(panel); castSet.push(panel);
      if (deco) deco(wg, mats, castSet);
      g.add(wg); walls.push({ group: wg, n: [nx, nz], mats, castSet });
    }
    const addDeco = (wg, mats, castSet, geo, baseMat, x, y, z) => { const m2 = baseMat.clone(); m2.transparent = true; mats.push(m2); const mm = new THREE.Mesh(geo, m2); mm.position.set(x, y, z); wg.add(mm); castSet.push(mm); };
    // front (+z): timber framing + door + warm-lit windows
    wall(new THREE.BoxGeometry(bw, h, T), 0, bdep / 2, 0, 1, (wg, mats, castSet) => {
      for (const sx of [-bw / 2 + 0.1, bw / 2 - 0.1]) addDeco(wg, mats, castSet, new THREE.BoxGeometry(0.16, h, 0.18), timberMat, sx, h / 2, T / 2 + 0.02);
      addDeco(wg, mats, castSet, new THREE.BoxGeometry(bw, 0.18, 0.2), timberMat, 0, h - 0.1, T / 2 + 0.02);
      addDeco(wg, mats, castSet, new THREE.BoxGeometry(bw, 0.18, 0.2), timberMat, 0, h * 0.5, T / 2 + 0.02);
      addDeco(wg, mats, castSet, new THREE.BoxGeometry(0.95, 1.6, 0.12), woodMat, 0, 0.8, T / 2 + 0.04);
      const winMat = new THREE.MeshStandardMaterial({ color: 0x3a4d63, emissive: 0xffd27a, emissiveIntensity: 0.5, roughness: 0.3 });
      for (const sx of [-bw / 3.2, bw / 3.2]) addDeco(wg, mats, castSet, new THREE.BoxGeometry(0.65, 0.75, 0.1), winMat, sx, 1.45, T / 2 + 0.04);
    });
    wall(new THREE.BoxGeometry(bw, h, T), 0, -bdep / 2, 0, -1);   // back
    wall(new THREE.BoxGeometry(T, h, bdep), -bw / 2, 0, -1, 0);   // left
    wall(new THREE.BoxGeometry(T, h, bdep), bw / 2, 0, 1, 0);     // right

    const rh = type === 'inn' ? 2.3 : type === 'chapel' ? 3.0 : 1.85;
    const roofMat = (roofMatOf[roofKind] || thatchMat).clone(); roofMat.transparent = true;
    const roof = roofPrism(bw, bdep, rh, 0.34, roofMat); roof.position.y = h; g.add(roof);
    // type extras stay on the shell (not peeled — minor silhouette details)
    if (type === 'smithy') { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.8, h + 1.4, 0.8), stoneMat); ch.position.set(bw / 2 - 0.6, (h + 1.4) / 2, -bdep / 2 + 0.7); ch.castShadow = true; g.add(ch); }
    if (type === 'inn') { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), timberMat); post.position.set(bw / 2 + 0.4, 1.05, bdep / 2 - 1); g.add(post); const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.85), woodMat); sign.position.set(bw / 2 + 0.4, 1.55, bdep / 2 - 1.6); g.add(sign); }
    return { group: g, r: Math.hypot(bw, bdep) / 2, roof, roofMat, roofBaseY: h, walls };
  }

  // Low-poly tree scatter (instanced trunks + icosahedron foliage clumps), each
  // tree dropped onto the terrain via groundAt. picks: [[localX, localZ], …].
  function addTreeScatter(g, rng, groundAt, picks) {
    if (!picks.length) return;
    const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.3, 2.4, 5), trunkMat, picks.length); trunkIM.castShadow = true; g.add(trunkIM);
    const foliIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.0, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), picks.length * 3); foliIM.castShadow = true; g.add(foliIM);
    foliIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(picks.length * 3 * 3), 3);
    const greens = [0x3f6a35, 0x4f7a3f, 0x35602e, 0xb0732e, 0x8a9a3a];
    let fi = 0;
    picks.forEach(([lx, lz], i) => {
      const gy = groundAt(lx, lz), s = 0.8 + rng() * 0.8;
      D.position.set(lx, gy + 1.2 * s, lz); D.scale.setScalar(s); D.rotation.set(0, rng() * 6.28, 0); D.updateMatrix(); trunkIM.setMatrixAt(i, D.matrix);
      const bc = new THREE.Color(greens[(rng() * greens.length) | 0]);
      for (let k = 0; k < 3; k++) { const bs = (1.0 + rng() * 0.7) * s; D.position.set(lx + (rng() - 0.5) * 0.8 * s, gy + (2.2 + k * 0.7) * s, lz + (rng() - 0.5) * 0.8 * s); D.scale.set(bs, bs * 0.9, bs); D.rotation.set(0, rng() * 6.28, 0); D.updateMatrix(); foliIM.setMatrixAt(fi, D.matrix); foliIM.setColorAt(fi, bc.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.08)); fi++; }
    });
    trunkIM.instanceMatrix.needsUpdate = true; foliIM.instanceMatrix.needsUpdate = true; foliIM.instanceColor.needsUpdate = true;
  }

  function dimGroup(grp, satDrop, lumDrop) {
    grp.traverse(c => {
      if (!c.isMesh || !c.material || !c.material.color || c.isInstancedMesh) return;
      // Shared materials must be cloned so dimming one place doesn't dim all; unique
      // ones (incl. the peelable walls/roof) tint in place to keep cutaway refs live.
      if (SHARED_MATS.has(c.material)) { const m = c.material.clone(); m.color.offsetHSL(0, -satDrop, -lumDrop); c.material = m; }
      else c.material.color.offsetHSL(0, -satDrop, -lumDrop);
    });
  }

  // A settlement: a ring of varied buildings (doors to the square) around a well,
  // wrapped in a palisade of instanced log stakes with one gate gap, with a few
  // trees just outside the wall. Deterministic from the node rng.
  function buildSettlement(rng, groundAt, discovered) {
    const g = new THREE.Group();
    const types = ['cottage', 'house', 'smithy', 'store', 'cottage', 'house'];
    const roofKinds = ['thatch', 'tile', 'shingle'];
    const count = 4 + Math.floor(rng() * 3);
    const placed = [];
    const order = ['inn'];
    for (let i = 0; i < count; i++) order.push(types[(rng() * types.length) | 0]);
    const ringR = 6.5;
    for (let k = 0; k < order.length; k++) {
      const type = order[k];
      for (let t = 0; t < 16; t++) {
        const ang = rng() * Math.PI * 2;
        const rr = k === 0 ? 0 : ringR + (rng() - 0.5) * 4;
        const bx = Math.cos(ang) * rr, bz = Math.sin(ang) * rr;
        const b = makeBuilding(rng, type, roofKinds[(rng() * 3) | 0]);
        if (placed.some(p => Math.hypot(bx - p.x, bz - p.z) < b.r + p.r + 1.4)) continue;
        b.group.position.set(bx, groundAt(bx, bz), bz);
        b.group.rotation.y = Math.atan2(-bx, -bz); // door (+z) faces the square
        g.add(b.group); placed.push({ x: bx, z: bz, r: b.r });
        // register for the roof-peel cutaway (world transforms resolved after layout)
        peelables.push({ bgroup: b.group, roof: b.roof, roofMat: b.roofMat, roofBaseY: b.roofBaseY, walls: b.walls, cur: 0 });
        break;
      }
    }
    // well at the square
    const well = new THREE.Group(); well.position.y = groundAt(0, 0);
    const ring0 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.0, 14), stoneMat); ring0.position.y = 0.5; ring0.castShadow = true; well.add(ring0);
    for (const sx of [-0.8, 0.8]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), woodMat); p.position.set(sx, 1.3, 0); well.add(p); }
    const wr = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4), shingleMat); wr.position.y = 2.3; wr.rotation.y = Math.PI / 4; wr.castShadow = true; well.add(wr); g.add(well);
    // palisade ring of instanced stakes + tips, one gate gap
    const palR = ringR + 5.5, PN = 44, gate = rng() * Math.PI * 2, ring = [];
    for (let i = 0; i < PN; i++) { const a = i / PN * Math.PI * 2; if (Math.abs(((a - gate + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.26) continue; const r = palR + Math.sin(a * 3 + 1) * 1.1; ring.push([Math.cos(a) * r, Math.sin(a) * r, a]); }
    const stakeIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 2.8, 5), logMat, ring.length); stakeIM.castShadow = true; g.add(stakeIM);
    const tipIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.4, 5), logMat, ring.length); g.add(tipIM);
    ring.forEach((p, i) => { const gy = groundAt(p[0], p[1]); D.position.set(p[0], gy + 1.4, p[1]); D.rotation.set(0, p[2], (rng() - 0.5) * 0.08); D.scale.setScalar(1); D.updateMatrix(); stakeIM.setMatrixAt(i, D.matrix); D.position.y = gy + 2.9; D.rotation.set(0, p[2], 0); D.updateMatrix(); tipIM.setMatrixAt(i, D.matrix); });
    stakeIM.instanceMatrix.needsUpdate = true; tipIM.instanceMatrix.needsUpdate = true;
    // a few trees just outside the wall
    const picks = []; for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = palR + 3 + rng() * 9; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
    addTreeScatter(g, rng, groundAt, picks);
    if (!discovered) dimGroup(g, 0.3, 0.1);
    return g;
  }

  // Wilderness: dense low-poly woods.
  function buildWilderness(rng, groundAt, discovered) {
    const g = new THREE.Group();
    const n = 24 + Math.floor(rng() * 14), picks = [];
    for (let i = 0; i < n; i++) { const a = rng() * 6.28, r = rng() * 17; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
    addTreeScatter(g, rng, groundAt, picks);
    if (!discovered) dimGroup(g, 0.22, 0.08);
    return g;
  }

  // Dungeon entrance: a stone chapel / ruin — steep shingle roof + spire, an
  // arched mouth with a cold glow from within, leaning gravestones, bare trees.
  function buildDungeon(rng, groundAt) {
    const g = new THREE.Group();
    const bw = 6, bdep = 9, h = 4.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bdep), stoneMat); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = roofPrism(bw, bdep, 3.4, 0.3, shingleMat); roof.position.y = h; g.add(roof);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4.0, 6), shingleMat); spire.position.set(0, h + 3.4 + 1.6, -bdep / 2 + 1.0); spire.castShadow = true; g.add(spire);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.2), darkRoofMat); door.position.set(0, 1.1, bdep / 2 + 0.05); g.add(door);
    const glow = new THREE.PointLight(0x6f55c8, 1.7, 16, 2); glow.position.set(0, 1.4, bdep / 2 - 0.4); g.add(glow);
    for (let i = 0; i < 5; i++) { const gx = (rng() - 0.5) * 11, gz = bdep / 2 + 2 + rng() * 5; const st = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.18), stoneMat); st.position.set(gx, groundAt(gx, gz) + 0.45, gz); st.rotation.z = (rng() - 0.5) * 0.32; st.castShadow = true; g.add(st); }
    const picks = []; for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = 8 + rng() * 9; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
    addTreeScatter(g, rng, groundAt, picks);
    return g;
  }

  // ---------- edge (dirt road) ribbon — follows the terrain height ----------
  function buildEdge(ax, az, bx, bz, kind) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const half = kind === 'road' ? 1.7 : 1.1;
    const nx = -dz / len * half, nz = dx / len * half;
    const STEPS = Math.max(6, Math.round(len / 8));
    const verts = [], idx = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS, x = ax + dx * t, z = az + dz * t, y = heightAt(x, z) + 0.08;
      verts.push(x + nx, y, z + nz, x - nx, y, z - nz);
      if (i < STEPS) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: kind === 'road' ? 0x6e5536 : 0x66502f, roughness: 1.0 }));
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
  let zoomPx = 0; // continuous-zoom depth signal (px per node-tile), set by setCamera
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

  // ---------- dress the world: roads, then a place per node (terrain-aware) ----------
  target.set(boundsCenter.x, 0, boundsCenter.z);
  for (const edge of edges) {
    const a = nodeById[edge.a], b = nodeById[edge.b];
    if (!a || !b) continue;
    const ap = wPos(a), bp = wPos(b);
    scene.add(buildEdge(ap.x, ap.z, bp.x, bp.z, edge.kind));
  }
  for (const node of nodes) {
    const base = wPos(node);
    const baseY = heightAt(base.x, base.z);
    const groundAt = (lx, lz) => heightAt(base.x + lx, base.z + lz) - baseY; // local terrain, relative to the place
    const rng = nodeRng(seed, node.id);
    const grp = new THREE.Group();
    grp.position.set(base.x, baseY, base.z);
    if (node.nodeType === 'settlement') grp.add(buildSettlement(rng, groundAt, node.discovered));
    else if (node.nodeType === 'dungeon_entrance') grp.add(buildDungeon(rng, groundAt));
    else grp.add(buildWilderness(rng, groundAt, node.discovered));
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
  const token = buildArchetypeFigure(THREE, 'player', {});
  token.position.set(px, py + 0.06, pz);
  scene.add(token);
  const sliceMinis = [{ group: token, baseY: py + 0.06, baseScale: 1, rate: 1.4, phase: 0, bob: 0.05, defeated: false }];

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
    if (o.az != null) az = o.az;
    let phi = clamp(o.phi != null ? o.phi : 0.06, 0.02, 1.35);
    let rad;
    if (o.pxPerTile != null && o.pxPerTile > 0) {
      const Hpx = Math.max(1, canvas.clientHeight || h0);
      rad = (TILE_WU * Hpx) / (2 * o.pxPerTile * vFovTan);
      zoomPx = o.pxPerTile; // continuous-zoom depth → drives the roof-peel cutaway
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
