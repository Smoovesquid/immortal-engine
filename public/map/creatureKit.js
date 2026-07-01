// creatureKit — loads the animal menagerie (enemies_menagerie.glb) and splits it into
// individual creatures (chickens, ducks, goats, cows, wolves) via glbSplit. buildSettlement
// scatters a few as Aldermere livestock. Ring-less (these are scenery animals, not combat
// tokens). Pure view; browser-only load.

import { splitIslands } from './glbSplit.js';

let creatures = [];     // [{ geo, mat, size:Vector3, box:Box3, tris }]
let state = 'idle';

export function creatureKitReady() { return state === 'ready'; }

export async function ensureCreatureKit() {
  if (state !== 'idle' || typeof window === 'undefined') return;
  state = 'loading';
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((res, rej) => new GLTFLoader().load('/map/assets/enemies_menagerie.glb', res, undefined, rej));
    const raw = splitIslands(THREE, gltf.scene);
    const mx = raw.reduce((m, p) => Math.max(m, p.tris), 1);
    creatures = raw.filter(p => p.tris >= mx * 0.15);   // drop tiny fragments; keep the animals
    state = creatures.length ? 'ready' : 'failed';
  } catch { state = 'failed'; }
}

// A scenery animal scaled so its longest horizontal span ≈ targetLong, feet at y=0,
// centred on x/z. Random pick (rng) for a mixed flock. Returns a Group or null.
export function buildCreature(THREE, rng, targetLong = 1.3) {
  if (!creatures.length) { ensureCreatureKit(); return null; }
  const p = creatures[(rng ? (rng() * creatures.length) | 0 : 0)];
  const s = targetLong / (Math.max(p.size.x, p.size.z) || 1);
  const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true;
  m.scale.setScalar(s);
  const b = p.box;
  m.position.set(-((b.min.x + b.max.x) / 2) * s, -b.min.y * s, -((b.min.z + b.max.z) / 2) * s);
  const g = new THREE.Group(); g.add(m); return g;
}

if (typeof window !== 'undefined') ensureCreatureKit().catch(() => {});
