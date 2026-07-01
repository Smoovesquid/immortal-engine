// buildingKit — loads the authored sealed building shells (inn, smithy, extra cottages)
// and serves them as LANDMARK buildings in the settlement, for silhouette variety
// alongside the peelable procedural cottages. Non-peelable (sealed single meshes), so
// they're the "look at" buildings, not the "enter" ones. Pure view; browser-only load.

const REG = {
  smithy:   { url: '/map/assets/smithy.glb',         w: 5.6 },
  cottage_blue:     { url: '/map/assets/cottage_blue.glb',     w: 5.0 },
  cottage_thatched: { url: '/map/assets/cottage_thatched.glb', w: 4.8 },
  inn:      { url: '/map/assets/inn_crooked.glb',     w: 6.6 },
};
const templates = {};   // name -> prepared root | 'loading'
let state = 'idle';

export function buildingKitReady() { return state === 'ready'; }

export async function ensureBuildingKit() {
  if (state !== 'idle' || typeof window === 'undefined') return;
  state = 'loading';
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    for (const [name, reg] of Object.entries(REG)) {
      let gltf;
      try { gltf = await new Promise((res, rej) => new GLTFLoader().load(reg.url, res, undefined, rej)); }
      catch { continue; }
      const root = gltf.scene;
      root.traverse(o => { if (o.isMesh) { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.castShadow = true; o.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size); const ctr = new THREE.Vector3(); box.getCenter(ctr);
      const s = reg.w / (Math.max(size.x, size.z) || 1);   // scale by footprint to the target width
      root.scale.setScalar(s);
      root.position.set(-ctr.x * s, -box.min.y * s, -ctr.z * s);
      templates[name] = root;
    }
    state = Object.keys(templates).length ? 'ready' : 'failed';
  } catch { state = 'failed'; }
}

// A landmark building clone (feet at y=0, centred x/z). Returns a Group or null.
export function buildShell(THREE, name) {
  const tpl = templates[name];
  if (!tpl || tpl === 'loading') { ensureBuildingKit(); return null; }
  const g = new THREE.Group(); g.add(tpl.clone(true)); return g;
}

if (typeof window !== 'undefined') ensureBuildingKit().catch(() => {});
