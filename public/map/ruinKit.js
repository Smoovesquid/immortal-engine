// ruinKit — loads the authored ruined-chapel "parts sheet" (chapel_ruins.glb) and splits
// it into individual pieces (gable structures, walls, altar, gravestones, rubble) via
// glbSplit. buildChapelRuin (worldAssets) assembles a ruined chapel site from these once
// loaded; until then it uses its procedural fallback. Pure view; browser-only load.

import { splitIslands } from './glbSplit.js';

let pieces = [];        // [{ geo, mat, size:Vector3, box:Box3, tris }] sorted big→small
let state = 'idle';     // idle | loading | ready | failed

export function ruinKitReady() { return state === 'ready'; }
export function ruinPieces() { return pieces; }

export async function ensureRuinKit() {
  if (state !== 'idle' || typeof window === 'undefined') return;
  state = 'loading';
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((res, rej) => new GLTFLoader().load('/map/assets/chapel_ruins.glb', res, undefined, rej));
    pieces = splitIslands(THREE, gltf.scene);
    state = pieces.length ? 'ready' : 'failed';
  } catch { state = 'failed'; }
}

// A placed group for piece `i`, uniformly scaled so its height = targetH, feet at y=0,
// centred on x/z. Returns a Group (or null). Geometry + texture shared across instances.
export function ruinMesh(THREE, i, targetH) {
  const p = pieces[i]; if (!p) return null;
  const s = targetH / (p.size.y || 1);
  const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true;
  m.scale.setScalar(s);
  const b = p.box;
  m.position.set(-((b.min.x + b.max.x) / 2) * s, -b.min.y * s, -((b.min.z + b.max.z) / 2) * s);
  const g = new THREE.Group(); g.add(m); return g;
}

// The tallest of the biggest few pieces = the chapel gable/body; small upright pieces =
// gravestones. Indices into ruinPieces().
export function chapelBodyIndex() {
  let idx = 0, bestY = -1;
  pieces.slice(0, 5).forEach((p, i) => { if (p.size.y > bestY) { bestY = p.size.y; idx = i; } });
  return idx;
}
export function gravestoneIndices() {
  return pieces.map((p, i) => ({ p, i }))
    .filter(({ p }) => p.size.y >= 0.14 && p.size.y <= 0.45 && Math.max(p.size.x, p.size.z) < 0.36)
    .map(({ i }) => i);
}

if (typeof window !== 'undefined') ensureRuinKit().catch(() => {});
