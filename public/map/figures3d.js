// FIGURES 3D — procedural archetype minis (MAPNINJA Step 5, first cut).
//
// Given a THREE module (the caller owns the lazy import — this file never imports
// three, so it stays a pure, dependency-free helper), build a low-poly but
// READABLE figure keyed to archetype, plus a cheap idle "breathe" so the minis
// read as ALIVE.
//
// The honest goal of this cut: archetype LEGIBILITY (name the figure from its
// silhouette — upright humanoid vs low 4-legged beast vs gaunt hooded shade) +
// aliveness through MOTION. This is NOT photoreal and may be thrown away when the
// real authored / AI-gen asset pipeline lands. Composition over a brittle 5th
// mesh: an `elite` flag (legendary/lair foe, cr≥2, or a leader by name) upscales
// any base and adds a crown — so a "captain" or a boss-shade reads as a leader.
//
// archetype ∈ 'player' | 'humanoid' | 'beast' | 'undead'.
// Pure view: no engine state, no randomness that worldHash depends on.

// Authored GLB sculpts (e.g. the hero warrior) override the procedural archetype when
// they're loaded — see figureAssets.js. Graceful: until/unless a GLB is ready, the
// procedural figure below is used. The preload kicks on import of that module.
import { buildFigureFromGLB } from './figureAssets.js';

const PALETTE = {
  player:   { body: 0x2f6fd0, accent: 0x9fc8ff, emissive: 0x163a78, ring: 0xd9a441, ei: 0.34 },
  humanoid: { body: 0x8a3b2e, accent: 0x5a2a20, emissive: 0x35110b, ring: 0xe05038, ei: 0.16 },
  beast:    { body: 0x6f5a39, accent: 0x4a3a24, emissive: 0x140f06, ring: 0xb0883a, ei: 0.08 },
  undead:   { body: 0xacc3bb, accent: 0xcfeee6, emissive: 0x2f6f63, ring: 0x6fd9c4, ei: 0.5, ghost: true },
};
const ELITE_TRIM = 0xf2cf5e, ELITE_EMIS = 0x6a4f12;

function std(THREE, color, emissive, ei, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: ei,
    roughness: o.rough ?? 0.62, metalness: o.metal ?? 0.12,
    transparent: !!o.transparent, opacity: o.opacity ?? 1,
  });
}

// Upright biped: legs (or a hooded robe for a shade), tapered torso, shoulders,
// arms, a head. `hero` broadens the shoulders (the player reads bigger/braver);
// `gaunt` + `robe` make the wasted, hooded shade silhouette.
function humanoidRig(THREE, pal, { gaunt = false, robe = false, hero = false } = {}) {
  const g = new THREE.Group();
  const ghost = !!pal.ghost;
  const bodyMat = std(THREE, pal.body, pal.emissive, pal.ei, { transparent: ghost, opacity: ghost ? 0.8 : 1, rough: ghost ? 0.5 : 0.6 });
  const accMat = std(THREE, pal.accent, pal.emissive, pal.ei * 0.7, { transparent: ghost, opacity: ghost ? 0.68 : 1 });
  const tR = gaunt ? 0.28 : 0.36;
  const sh = hero ? 0.62 : 0.5;
  if (robe) {
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.3, 7, 1, true), bodyMat);
    skirt.position.y = 0.66; skirt.castShadow = true; g.add(skirt);
  } else {
    for (const lx of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.9, 6), accMat);
      leg.position.set(lx, 0.45, 0); leg.castShadow = true; g.add(leg);
    }
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(tR * 0.78, tR, robe ? 0.72 : 0.82, 8), bodyMat);
  torso.position.y = robe ? 1.42 : 1.26; torso.castShadow = true; g.add(torso);
  const sho = new THREE.Mesh(new THREE.BoxGeometry(sh * 2, 0.26, 0.42), bodyMat);
  sho.position.y = robe ? 1.7 : 1.58; sho.castShadow = true; g.add(sho);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.9, 6), accMat);
    arm.position.set(s * (sh + 0.07), robe ? 1.36 : 1.2, 0);
    arm.rotation.z = s * 0.13; arm.castShadow = true; g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(gaunt ? 0.23 : 0.28, 10, 8), bodyMat);
  head.position.y = robe ? 2.04 : 1.92; head.castShadow = true; g.add(head);
  if (robe) {
    // a hood brow over the shade's face
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 7), bodyMat);
    hood.position.y = 2.16; hood.castShadow = true; g.add(hood);
  }
  return g;
}

// Low, long quadruped: a horizontal body, four legs, a lowered head + snout, a
// tail. The horizontal mass at knee height is what reads "animal, not person".
function beastRig(THREE, pal) {
  const g = new THREE.Group();
  const bodyMat = std(THREE, pal.body, pal.emissive, pal.ei, { rough: 0.82 });
  const accMat = std(THREE, pal.accent, pal.emissive, pal.ei, { rough: 0.86 });
  const bodyGeo = THREE.CapsuleGeometry
    ? new THREE.CapsuleGeometry(0.34, 0.95, 4, 8)
    : new THREE.CylinderGeometry(0.34, 0.34, 1.55, 8);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2; body.position.y = 0.64; body.castShadow = true; g.add(body);
  for (const [lx, lz] of [[-0.24, 0.44], [0.24, 0.44], [-0.24, -0.44], [0.24, -0.44]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 6), accMat);
    leg.position.set(lx, 0.3, lz); leg.castShadow = true; g.add(leg);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bodyMat);
  head.position.set(0, 0.7, 0.82); head.castShadow = true; g.add(head);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), accMat);
  snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.62, 1.08); g.add(snout);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.62, 6), accMat);
  tail.rotation.x = -Math.PI / 2.3; tail.position.set(0, 0.74, -0.74); g.add(tail);
  return g;
}

function baseRing(THREE, pal, defeated) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.15, 8, 26),
    std(THREE, defeated ? 0x5a4f3a : pal.ring, defeated ? 0x000000 : pal.ring, defeated ? 0 : 0.6, { metal: 0.7, rough: 0.3 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; ring.castShadow = true;
  return ring;
}

function eliteCrown(THREE, topY) {
  const c = new THREE.Group();
  const gold = std(THREE, ELITE_TRIM, ELITE_EMIS, 0.75, { metal: 0.85, rough: 0.22 });
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 5), gold);
    const a = (i / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.26, topY, Math.sin(a) * 0.26);
    c.add(spike);
  }
  return c;
}

/**
 * buildArchetypeFigure(THREE, archetype, { defeated, elite }) -> THREE.Group.
 * The group sits with its feet at y=0 (caller positions it on the cell). Stores
 * userData.{archetype, baseScale, defeated} for the breathe loop.
 */
export function buildArchetypeFigure(THREE, archetype = 'humanoid', opts = {}) {
  // Authored GLB sculpt for this archetype takes precedence once loaded (the hero
  // warrior for 'player'); otherwise fall through to the procedural figure.
  const glb = buildFigureFromGLB(THREE, archetype, opts);
  if (glb) return glb;
  const { defeated = false, elite = false } = opts;
  const pal = PALETTE[archetype] || PALETTE.humanoid;
  const g = new THREE.Group();
  g.add(baseRing(THREE, pal, defeated));
  const body = archetype === 'beast'
    ? beastRig(THREE, pal)
    : humanoidRig(THREE, pal, { hero: archetype === 'player', gaunt: archetype === 'undead', robe: archetype === 'undead' });
  g.add(body);
  if (elite && archetype !== 'beast') g.add(eliteCrown(THREE, archetype === 'undead' ? 2.34 : 2.24));
  const baseScale = elite ? 1.24 : 1.0;
  g.scale.setScalar(baseScale);
  if (defeated) {
    g.rotation.z = Math.PI / 2.15; // toppled — a downed foe
    g.traverse(o => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = Math.min(o.material.opacity ?? 1, 0.5); } });
  }
  g.userData.archetype = archetype;
  g.userData.baseScale = baseScale;
  g.userData.defeated = defeated;
  return g;
}

/**
 * breatheMinis(minis, tSeconds) — the idle "alive" pass. Each mini is
 * { group, baseY, baseScale, rate, phase, bob, defeated }. A defeated mini is
 * still (it's down). Cheap: a sine per figure, no rigging. Cardinal: this only
 * touches view transforms — never world state.
 */
export function breatheMinis(minis, tSeconds) {
  for (const m of minis) {
    const g = m.group;
    if (!g || m.defeated) continue;
    const s = Math.sin(tSeconds * (m.rate || 1.5) + (m.phase || 0));
    g.position.y = (m.baseY || 0) + s * (m.bob || 0.05);
    const sc = (m.baseScale || 1) * (1 + s * 0.018);
    g.scale.set(m.baseScale || 1, sc, m.baseScale || 1);
  }
}

// A stable per-figure phase so a row of minis doesn't breathe in lockstep.
export function phaseFromKey(key) {
  const s = String(key || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000 * Math.PI * 2;
}
