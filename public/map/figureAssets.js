// FIGURE ASSETS — GLB-backed character figures (the bridge from authored 3D models
// to the in-game minis). Sibling of figures3d.js: where figures3d builds PROCEDURAL
// archetype minis, this loads AUTHORED GLB sculpts (the hero warrior, the lich, …) and
// serves them in the SAME shape figures3d returns, so a renderer that calls
// buildArchetypeFigure(THREE, archetype, opts) transparently gets the GLB when it's
// ready and the procedural placeholder until then (graceful — the model is an
// enhancement, never a hard dependency; if the fetch/parse fails we silently fall back).
//
// PURE VIEW: no engine state, no determinism. Textures are shrunk offline (WebP) and the
// models live under /map/assets/. Untextured sculpts (the raw hero) get a flat tint +
// computed normals; textured ones (the lich) keep their material. Each figure stands on
// a coloured ring keyed to its archetype so it reads as a token on the board.
//
// Pipeline note: STATIC meshes for now — they bob/breathe as a whole via breatheMinis,
// but limb animation needs a rig (a later step).

// archetype -> { url, tint?(untextured only), ring, eliteOnly? }
const REG = {
  player: { url: '/map/assets/hero.glb', tint: 0xb4a896, ring: 0xd9a441 },     // warm stone + gold ring = you
  undead: { url: '/map/assets/lich.glb', ring: 0x6fd9c4 },                     // the purple lich, teal foe ring
};
const templates = {};                                  // archetype -> prepared Group | 'loading'
const FIGURE_HEIGHT = 2.0;                             // match the procedural minis (~2 units tall)

export function registerFigureGLB(archetype, entry) { REG[archetype] = entry; delete templates[archetype]; }
export function figureGLBReady(archetype) { return !!templates[archetype] && templates[archetype] !== 'loading'; }

// Load + prepare the GLB for an archetype (idempotent). Imports three + GLTFLoader
// itself (same importmap singleton the renderer uses) so it can preload with no caller.
export async function ensureFigureGLB(archetype = 'player') {
  if (figureGLBReady(archetype)) return templates[archetype];
  if (templates[archetype] === 'loading') return null;
  const reg = REG[archetype];
  if (!reg || typeof window === 'undefined') return null;
  templates[archetype] = 'loading';
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((res, rej) => new GLTFLoader().load(reg.url, res, undefined, rej));
    const root = gltf.scene;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      // untextured sculpts get the flat tint; textured ones (lich) keep their material
      if (reg.tint && (!o.material || !o.material.map)) o.material = new THREE.MeshStandardMaterial({ color: reg.tint, roughness: 0.72, metalness: 0.04 });
      o.castShadow = true; o.receiveShadow = true;
    });
    // normalize: feet at y=0, centred on x/z, scaled to the mini height
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const ctr = new THREE.Vector3(); box.getCenter(ctr);
    const s = FIGURE_HEIGHT / (size.y || 1);
    root.scale.setScalar(s);
    root.position.set(-ctr.x * s, -box.min.y * s, -ctr.z * s);
    templates[archetype] = root;
    return root;
  } catch (e) {
    templates[archetype] = null;   // give up → procedural fallback (and allow a retry)
    return null;
  }
}

// The token ring (mirrors figures3d's baseRing) — colour keyed to the archetype so a
// GLB figure reads as player (gold) / foe (teal) on the board, like the procedural one.
function baseRing(THREE, color, defeated) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.15, 8, 26),
    new THREE.MeshStandardMaterial({ color: defeated ? 0x5a4f3a : color, emissive: defeated ? 0x000000 : color, emissiveIntensity: defeated ? 0 : 0.6, metalness: 0.7, roughness: 0.3 })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; ring.castShadow = true;
  return ring;
}

// If a GLB is registered + loaded for this archetype, return a token Group (ring + a
// clone of the prepared sculpt, geometry/material shared) matching figures3d's contract
// (feet at y=0, userData for breathe). Otherwise null → caller uses the procedural mini.
// `eliteOnly` archetypes only use the GLB for elite/boss foes (minions stay procedural).
export function buildFigureFromGLB(THREE, archetype = 'player', opts = {}) {
  const reg = REG[archetype];
  if (!reg) return null;
  const { defeated = false, elite = false } = opts;
  if (reg.eliteOnly && !elite) return null;
  const tpl = templates[archetype];
  if (!tpl || tpl === 'loading') { ensureFigureGLB(archetype); return null; }
  const g = new THREE.Group();
  g.add(baseRing(THREE, reg.ring || 0xd9a441, defeated));
  const body = tpl.clone(true);   // clones nodes; geometry + material are shared (cheap)
  g.add(body);
  const baseScale = elite ? 1.24 : 1.0; // bosses read bigger (matches the procedural elite upscale)
  g.scale.setScalar(baseScale);
  if (defeated) {
    g.rotation.z = Math.PI / 2.15;
    g.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; } });
  }
  g.userData.archetype = archetype;
  g.userData.baseScale = baseScale;
  g.userData.defeated = defeated;
  g.userData.glb = true;
  return g;
}

// Head-start preload on import (browser only) so the figures are ready by first use:
// the hero for the overworld, the lich for when a fight starts.
if (typeof window !== 'undefined') { ensureFigureGLB('player').catch(() => {}); ensureFigureGLB('undead').catch(() => {}); }
