// FOLIAGE / PROP ASSETS — GLB-backed INSTANCED greenery (trees + garden bushes).
// Sibling of figureAssets.js. worldAssets' procedural scatter calls in here; once the
// authored GLB sculpts are loaded they're instanced in (one draw call per type,
// geometry + texture uploaded once), with the procedural look as graceful fallback.
// Pure view; per-prop placement stays seeded.
//
// Each registered asset declares a `kind` ('tree' | 'bush') and a target `height`;
// the geometry is baked at load (feet at y=0, centred on x/z, scaled to that height)
// so the instance matrices only carry position + per-prop scale/spin. Tree scatters
// pull the 'tree' kinds; the in-town garden scatter pulls the 'bush' kinds.

const REG = [
  { url: '/map/assets/tree_verdant.glb',  kind: 'tree',   height: 5.2 },
  { url: '/map/assets/tree_gnarled.glb',  kind: 'tree',   height: 5.2 },
  { url: '/map/assets/bloom.glb',         kind: 'bush',   height: 1.8 }, // prismatic flowering shrub
  { url: '/map/assets/barrel_rustic.glb', kind: 'barrel', height: 1.1 }, // village clutter / future cover
  { url: '/map/assets/barrel_wood.glb',   kind: 'barrel', height: 1.2 },
  { url: '/map/assets/bed_rustic.glb',    kind: 'bed',    fitLong: 2.0 }, // cottage furniture (interiors)
  { url: '/map/assets/chest_iron_a.glb',  kind: 'chest',  height: 0.85 }, // interior treasure
  { url: '/map/assets/chest_iron_b.glb',  kind: 'chest',  height: 0.85 },
  // authored interior furniture (revealed on the cottage roof-peel — see makeInterior)
  { url: '/map/assets/hearth.glb',        kind: 'hearth', height: 1.4 },  // emissive fireplace
  { url: '/map/assets/table_rustic.glb',  kind: 'table',  fitLong: 1.35 },
  { url: '/map/assets/chair_wood.glb',    kind: 'chair',  height: 0.95 },
  { url: '/map/assets/stool_wood.glb',    kind: 'stool',  height: 0.5 },
  { url: '/map/assets/dresser_wood.glb',  kind: 'dresser', fitLong: 1.4 },
  { url: '/map/assets/cauldron.glb',      kind: 'cauldron', height: 0.7 },
  { url: '/map/assets/rug_crimson.glb',   kind: 'rug',    fitLong: 1.9 }, // laid flat by caller
  // cottage_red.glb (authored house) stays on disk as a reference — the procedural
  // buildBuilding is now restyled to match it, so it's the standard (peelable) house.
  // townsfolk — a pool of NPC figures scattered around the settlement square
  { url: '/map/assets/villager_maid.glb',       kind: 'villager', height: 2.0 },
  { url: '/map/assets/villager_homemaker.glb',  kind: 'villager', height: 2.0 },
  { url: '/map/assets/villager_desert.glb',     kind: 'villager', height: 2.0 },
  { url: '/map/assets/villager_lumberjack.glb', kind: 'villager', height: 2.0 },
  { url: '/map/assets/villager_green.glb',      kind: 'villager', height: 2.0 },
  { url: '/map/assets/villager_grizzled.glb',   kind: 'villager', height: 2.0 },
  { url: '/map/assets/villager_wasteland.glb',  kind: 'villager', height: 2.0 },
];
const templates = [];      // [{ geo, mat, kind }]
let state = 'idle';        // idle | loading | ready | failed

export function registerFoliageGLB(url, kind = 'tree', height = 5.2) { REG.push({ url, kind, height }); }
function ready(kind) { return state === 'ready' && templates.some(t => t.kind === kind); }
export function treeGLBsReady() { return ready('tree'); }
export function bushGLBsReady() { return ready('bush'); }

export async function ensureFoliageGLBs() {
  if (state !== 'idle' || !REG.length || typeof window === 'undefined') return;
  state = 'loading';
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    for (const reg of REG) {
      let gltf;
      try { gltf = await new Promise((res, rej) => new GLTFLoader().load(reg.url, res, undefined, rej)); }
      catch { continue; } // skip a missing asset, keep the rest
      gltf.scene.updateMatrixWorld(true);
      let mesh = null;
      gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) continue;
      // Measure the whole prop in world space, then bake S·T·worldMatrix into the cloned
      // geometry → centred x/z, feet at 0, scaled to the declared height.
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3(); box.getSize(size);
      const ctr = new THREE.Vector3(); box.getCenter(ctr);
      // trees/bushes/barrels scale by target HEIGHT; furniture (beds) by longest
      // horizontal footprint so it fits a room regardless of its modelled height.
      const s = reg.fitLong ? reg.fitLong / (Math.max(size.x, size.z) || 1) : reg.height / (size.y || 1);
      const M = new THREE.Matrix4().makeScale(s, s, s)
        .multiply(new THREE.Matrix4().makeTranslation(-ctr.x, -box.min.y, -ctr.z))
        .multiply(mesh.matrixWorld);
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(M);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      templates.push({ geo, mat: mesh.material, kind: reg.kind });
    }
    state = templates.length ? 'ready' : 'failed';
  } catch { state = 'failed'; }
}
// back-compat name (worldAssets imported this)
export const ensureTreeGLBs = ensureFoliageGLBs;

// Instance the GLB props of `kind` across `picks` ([[localX, localZ], …]). Returns true
// if it placed them (GLBs ready); false → caller falls back to the procedural look.
function scatter(THREE, g, rng, groundAt, picks, kind, scaleLo, scaleHi) {
  const kinds = templates.filter(t => t.kind === kind);
  if (!kinds.length) { ensureFoliageGLBs(); return false; }
  if (!picks.length) return true;
  const buckets = kinds.map(() => []);
  for (const [lx, lz] of picks) {
    const ti = (rng() * kinds.length) | 0;
    const sc = scaleLo + rng() * (scaleHi - scaleLo);
    const ry = rng() * Math.PI * 2;
    buckets[ti].push([lx, lz, sc, ry]);
  }
  const D = new THREE.Object3D();
  kinds.forEach((t, ti) => {
    const list = buckets[ti];
    if (!list.length) return;
    const im = new THREE.InstancedMesh(t.geo, t.mat, list.length);
    im.castShadow = true; im.receiveShadow = true;
    list.forEach(([lx, lz, sc, ry], i) => {
      const gy = groundAt(lx, lz);
      D.position.set(lx, gy, lz); D.scale.setScalar(sc); D.rotation.set(0, ry, 0); D.updateMatrix();
      im.setMatrixAt(i, D.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false; // instances are offset far from the mesh origin
    g.add(im);
  });
  return true;
}

export function glbTreeScatter(THREE, g, rng, groundAt, picks) {
  if (!treeGLBsReady()) { ensureFoliageGLBs(); return false; }
  return scatter(THREE, g, rng, groundAt, picks, 'tree', 0.7, 1.4);
}
export function glbBloomScatter(THREE, g, rng, groundAt, picks) {
  if (!bushGLBsReady()) { ensureFoliageGLBs(); return false; }
  return scatter(THREE, g, rng, groundAt, picks, 'bush', 0.8, 1.25);
}
export function barrelGLBsReady() { return ready('barrel'); }
export function glbBarrelScatter(THREE, g, rng, groundAt, picks) {
  if (!barrelGLBsReady()) { ensureFoliageGLBs(); return false; }
  return scatter(THREE, g, rng, groundAt, picks, 'barrel', 0.85, 1.1);
}

// Townsfolk: place a random villager NPC at each pick, standing + facing a random way,
// so the settlement reads as inhabited. Distinct meshes (not instanced) so each pick can
// be a different person from the pool. Returns true if the villager GLBs are loaded.
export function villagerGLBsReady() { return ready('villager'); }
export function glbVillagerScatter(THREE, g, rng, groundAt, picks) {
  if (!villagerGLBsReady()) { ensureFoliageGLBs(); return false; }
  for (const [lx, lz] of picks) {
    const v = buildGLBProp(THREE, 'villager', rng);
    if (!v) continue;
    v.position.set(lx, groundAt(lx, lz), lz);
    v.rotation.y = rng() * Math.PI * 2;
    g.add(v);
  }
  return true;
}

// A single furniture prop of `kind` (e.g. 'bed'), centred on x/z with feet at y=0, for
// the caller to position inside a room. Returns a Mesh (geometry + texture shared with
// any other instances) or null → caller keeps its procedural furniture.
export function buildGLBProp(THREE, kind, rng) {
  const list = templates.filter(x => x.kind === kind);
  if (!list.length) { ensureFoliageGLBs(); return null; }
  const t = list[rng ? (rng() * list.length) | 0 : 0];
  const m = new THREE.Mesh(t.geo, t.mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Head-start preload on import (browser only) so props are ready by first mount.
if (typeof window !== 'undefined') { ensureFoliageGLBs().catch(() => {}); }
