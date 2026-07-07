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

// CARL-FOWL (Tim canon 2026-07-07: "he's a chicken"). A small procedural fowl
// mini for creature-NPCs, in the same solid-primitive idiom as the figures — a
// Rhode-Island-red hen: ovoid body, small head, red comb + wattle, a beak, a
// fanned tail, two yellow legs. Feet at y≈0, facing +z (repositionEntities never
// rotates minis, so a fixed forward is fine). Sized by the sheet-scale law like
// any mini: CHICKEN_HEIGHT_WU is its TRUE height (authored in feet → wu). Built
// at a natural LOCAL scale; measureAuthoredSize normalizes it, so proportions
// are what matter here, not the absolute local size. (CHICKEN_HEIGHT_WU is
// defined below, beside WU_PER_FT — it can't reference that constant up here.)
export function buildChickenMini(THREE) {
  const g = new THREE.Group();
  g.add(baseRing(THREE, PALETTE.beast, false));
  const feather = std(THREE, 0xa8542a, 0x2a1206, 0.06, { rough: 0.9 });   // hen reddish-brown
  const red = std(THREE, 0xc0392b, 0x3a0f0a, 0.25, { rough: 0.6 });        // comb + wattle
  const yellow = std(THREE, 0xe0a020, 0x4a3208, 0.2, { rough: 0.5 });      // beak + legs
  const dark = std(THREE, 0x7a3d1e, 0x1f0d05, 0.05, { rough: 0.9 });       // tail feathers
  // body — ovoid, leaning slightly forward
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), feather);
  body.scale.set(0.9, 0.82, 1.15); body.position.set(0, 0.62, 0); body.castShadow = true; g.add(body);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), feather);
  head.position.set(0, 1.02, 0.4); head.castShadow = true; g.add(head);
  // comb — a little row of three red bumps on top of the head
  for (let i = -1; i <= 1; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), red); c.position.set(0, 1.24, 0.4 + i * 0.11); g.add(c); }
  // wattle — a small red drop under the beak
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), red); wattle.position.set(0, 0.86, 0.58); g.add(wattle);
  // beak — a small cone pointing forward (+z)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 8), yellow);
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.0, 0.68); g.add(beak);
  // tail — three flattened feathers fanned up and back (−z)
  for (let i = -1; i <= 1; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.22), dark); t.position.set(i * 0.12, 0.78, -0.5); t.rotation.x = -0.7; t.rotation.z = i * 0.18; t.castShadow = true; g.add(t); }
  // legs — two thin yellow shanks
  for (const sx of [-0.16, 0.16]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 6), yellow); leg.position.set(sx, 0.21, 0.06); g.add(leg); }
  g.userData.archetype = 'chicken';
  return g;
}

// TT-PROPS (docs/briefs/TT-WORLD-paper-world.md Stage 3) — palette + rough
// proportions for the standing-prop minis. Kept intentionally plain: "simple
// solid pieces" per the brief, not a fifth rigged figure — a prop is a single
// box/cylinder, not a silhouette that needs archetype legibility the way a
// creature does.
const PROP_PALETTE = {
  barrel:  { color: 0x6b4a2c, rough: 0.88 },   // banded wood cask
  bed:     { color: 0x8a6a45, rough: 0.82 },   // wood frame (a pillow tick reads the "bed"-ness)
  chest:   { color: 0x5e3f26, rough: 0.7, metal: 0.15 }, // dark wood + a hint of iron banding
  dresser: { color: 0x7a5a38, rough: 0.8 },
};
const PROP_SHADOW_MAT_CACHE = new Map(); // one shared shadow material per THREE module instance

function propShadowMat(THREE) {
  let m = PROP_SHADOW_MAT_CACHE.get(THREE);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    PROP_SHADOW_MAT_CACHE.set(THREE, m);
  }
  return m;
}

/**
 * buildPropMini(THREE, kind) -> THREE.Group | null
 * A standing prop token — barrel/bed/chest/dresser — as a SIMPLE SOLID piece
 * (a single box or cylinder, full color, no rig) sitting on a soft round
 * shadow disc (the "base + soft shadow" that sells "standing on the tilted
 * table", per TABLETOP_MAP.md's miniature art direction). Feet at y=0, like
 * buildArchetypeFigure, so the caller positions/scales it identically. Returns
 * null for an unrecognized kind (never fabricate a shape for data that isn't
 * one of the props this stage covers).
 */
export function buildPropMini(THREE, kind) {
  const pal = PROP_PALETTE[String(kind || '')];
  if (!pal) return null;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: pal.color, roughness: pal.rough ?? 0.85, metalness: pal.metal ?? 0.05 });

  // Soft shadow disc — a flat, faded dark circle at the piece's feet.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), propShadowMat(THREE));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  g.add(shadow);

  let body;
  if (kind === 'barrel') {
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.62, 12), mat);
    body.position.y = 0.31;
  } else if (kind === 'chest') {
    body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.46), mat);
    body.position.y = 0.21;
  } else if (kind === 'dresser') {
    body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.4), mat);
    body.position.y = 0.39;
  } else { // bed
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 1.9), mat);
    frame.position.y = 0.12;
    g.add(frame);
    const tickMat = new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.95 });
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.16, 0.4), tickMat);
    tick.position.set(0, 0.28, -0.72); // the pillow end reads "bed" at a glance
    g.add(tick);
    body = null;
  }
  if (body) { body.castShadow = true; g.add(body); }
  g.userData.kind = String(kind);
  return g;
}

// MR-3b (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3b) — the wild drawn: the fog
// hides a world that was ALWAYS there (MR-3a's engine/world/wildFeatures.js),
// and this is that world's mini set. Five kinds, procedural (the wishlist GLBs
// slot in later per mix-by-role, same graceful precedent as buildPropMini/
// buildArchetypeFigure — this builder never fetches a network asset).
//
// DETERMINISM: every random-looking choice here (lean angle, size jitter, hue
// variance, foliage-clump offsets) comes from `rngFromKey`, a tiny local
// mulberry32-style PRNG SEEDED from the feature's own cell key (the same
// technique figures3d.js's phaseFromKey/hashToIndex hash — no rng object is
// threaded in, no Math.random anywhere) — so the SAME feature (identical
// world seed + cell) always builds the byte-identical mini, forever (U540).
// A tree at a given clearing looks like that tree every time you walk back.
const WILD_PALETTE = {
  tree:     { trunk: 0x5a3f28, foliage: [0x3f6a35, 0x4f7a3f, 0x35602e, 0x8a9a3a] },
  boulder:  { color: 0x8a8478, rough: 0.94 },                 // lichen-grey stone
  brush:    { color: [0x4f7a3f, 0x6b8a4a, 0x5a7a3a] },        // low scrub clump
  deadfall: { color: 0x6b5a44, rough: 0.9 },                  // bare fallen-log grey-brown
  stump:    { color: 0x5a4530, rough: 0.92 },                 // cut-off trunk stub
};

// A tiny seeded PRNG (mulberry32) from a string key — local to this file so a
// wild mini's "randomness" is 100% a pure function of its cell, never a
// second hash algorithm to keep in sync with wildFeatures.js's own h32 (this
// file doesn't need bit-identical numbers with the engine, only ITS OWN
// internal reproducibility call-to-call, which mulberry32 gives cheaply).
function rngFromKey(key) {
  let h = 2166136261;
  const s = String(key);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// sizeClass -> a uniform scale multiplier (large trees/boulders read bigger
// and more substantial — TT-MINIS-adjacent "a blocking tree reads as a thing
// you'd walk around" per the brief; small ground-clutter stays modest).
const WILD_SIZE_SCALE = { large: 1.15, medium: 0.9, small: 0.6 };

function wildTree(THREE, rng, scale) {
  const g = new THREE.Group();
  const pal = WILD_PALETTE.tree;
  const s = (0.75 + rng() * 0.55) * scale;
  const trunkMat = new THREE.MeshStandardMaterial({ color: pal.trunk, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.4, 6), trunkMat);
  trunk.position.y = 1.2 * s; trunk.scale.setScalar(s); trunk.rotation.y = rng() * Math.PI * 2;
  trunk.castShadow = true; g.add(trunk);
  const hue = pal.foliage[Math.floor(rng() * pal.foliage.length) % pal.foliage.length];
  const baseColor = new THREE.Color(hue);
  for (let k = 0; k < 3; k++) {
    const bs = (1.0 + rng() * 0.7) * s;
    const foliMat = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.08), roughness: 0.9, flatShading: true,
    });
    const foli = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), foliMat);
    foli.position.set((rng() - 0.5) * 0.8 * s, (2.2 + k * 0.7) * s, (rng() - 0.5) * 0.8 * s);
    foli.scale.set(bs, bs * 0.9, bs); foli.rotation.y = rng() * Math.PI * 2;
    foli.castShadow = true; g.add(foli);
  }
  return g;
}

function wildBoulder(THREE, rng, scale) {
  const pal = WILD_PALETTE.boulder;
  const mat = new THREE.MeshStandardMaterial({ color: pal.color, roughness: pal.rough, flatShading: true });
  const s = (0.5 + rng() * 0.4) * scale;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat);
  rock.position.y = 0.4 * s; rock.scale.set(s, s * (0.7 + rng() * 0.3), s);
  rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
  rock.castShadow = true;
  const g = new THREE.Group(); g.add(rock);
  return g;
}

function wildBrush(THREE, rng, scale) {
  const g = new THREE.Group();
  const palette = WILD_PALETTE.brush.color;
  const s = (0.35 + rng() * 0.25) * scale;
  const n = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const color = palette[Math.floor(rng() * palette.length) % palette.length];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true });
    const bs = s * (0.7 + rng() * 0.5);
    const clump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat);
    const a = rng() * Math.PI * 2, r = rng() * 0.3 * scale;
    clump.position.set(Math.cos(a) * r, bs * 0.5, Math.sin(a) * r);
    clump.scale.setScalar(bs); clump.castShadow = true; g.add(clump);
  }
  return g;
}

function wildDeadfall(THREE, rng, scale) {
  const pal = WILD_PALETTE.deadfall;
  const mat = new THREE.MeshStandardMaterial({ color: pal.color, roughness: pal.rough });
  const len = (1.6 + rng() * 0.8) * scale;
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.18 * scale, len, 6), mat);
  log.rotation.z = Math.PI / 2; log.rotation.y = rng() * Math.PI * 2;
  log.position.y = 0.16 * scale; log.castShadow = true;
  const g = new THREE.Group(); g.add(log);
  return g;
}

function wildStump(THREE, rng, scale) {
  const pal = WILD_PALETTE.stump;
  const mat = new THREE.MeshStandardMaterial({ color: pal.color, roughness: pal.rough });
  const s = (0.45 + rng() * 0.25) * scale;
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.36 * s, 0.5 * s, 8), mat);
  stump.position.y = 0.25 * s; stump.rotation.y = rng() * Math.PI * 2; stump.castShadow = true;
  const g = new THREE.Group(); g.add(stump);
  return g;
}

const WILD_BUILDERS = {
  tree: wildTree, boulder: wildBoulder, brush: wildBrush, deadfall: wildDeadfall, stump: wildStump,
};

/**
 * buildWildMini(THREE, kind, opts) -> THREE.Group | null
 * A procedural mini for one MR-3a wild feature — kind ∈ tree | boulder | brush
 * | deadfall | stump (wildFeatures.js's WILD_CONSTANTS.KINDS). `opts.seedKey`
 * is the feature's own stable identity (the caller passes its cell — e.g.
 * `${gx},${gy}` — so two boots of the same seed/cell build the identical mini,
 * U540); `opts.sizeClass` ('large'|'medium'|'small', wildFeatures.js's own
 * per-kind hint) scales the archetype's base proportions. Feet at y=0, same
 * "caller positions it" contract as buildArchetypeFigure/buildPropMini.
 * Returns null for an unrecognized kind (never fabricate a shape for data
 * outside the five kinds this stage covers — same discipline as buildPropMini).
 */
export function buildWildMini(THREE, kind, opts = {}) {
  const builder = WILD_BUILDERS[String(kind || '')];
  if (!builder) return null;
  const rng = rngFromKey(opts.seedKey ?? kind);
  const scale = WILD_SIZE_SCALE[String(opts.sizeClass || '')] || 1.0;
  const g = builder(THREE, rng, scale);
  g.userData.kind = String(kind);
  g.userData.wild = true;
  return g;
}

// TT-MINIS (docs/MINIS_WISHLIST.md's 2026-07-05 "received" corpse pair) — the
// fallen get bodies. Where a defeated figure used to just topple in place
// (buildArchetypeFigure's `defeated` branch, above: same standing rig, rotated
// 90° + faded translucent), an authored corpse GLB from miniLibrary.js now
// stands in when one is loaded — the one mini category where "still, on the
// ground" IS the correct pose, not a placeholder for it. Same graceful-GLB
// contract as figureAssets.js: lazy-loaded, cached, and a failed/missing/
// not-yet-loaded fetch returns null so the caller falls back to the existing
// toppled-archetype look — the map must never break over a corpse asset.
import { minisByCategory } from './miniLibrary.js';

const corpseTemplates = new Map();     // mini.id -> prepared Group | 'loading' | null (failed)

function corpseReady(id) { const t = corpseTemplates.get(id); return !!t && t !== 'loading'; }

// Load + normalize ONE corpse GLB (idempotent, keyed by miniLibrary id). Scales by
// the LONGEST HORIZONTAL footprint (mini.fitLong), the exact convention
// treeAssets.js's furniture path uses (a corpse has no "standing height" to
// speak of — it's fit by its ground footprint, like a bed or a rug) — lowest
// point pinned to y=0 so it lies flush with the paper, no floating/clipping.
async function ensureCorpseGLB(mini) {
  if (!mini?.id) return null;
  if (corpseReady(mini.id)) return corpseTemplates.get(mini.id);
  if (corpseTemplates.get(mini.id) === 'loading') return null;
  if (typeof window === 'undefined') return null;
  corpseTemplates.set(mini.id, 'loading');
  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((res, rej) => new GLTFLoader().load(mini.url, res, undefined, rej));
    const root = gltf.scene;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.castShadow = true; o.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3(); box.getSize(size);
    const ctr = new THREE.Vector3(); box.getCenter(ctr);
    const fitLong = Number(mini.fitLong) || 1.9;
    const s = fitLong / (Math.max(size.x, size.z) || 1);
    root.scale.setScalar(s);
    root.position.set(-ctr.x * s, -box.min.y * s, -ctr.z * s); // lowest point at y=0 — flush with the ground
    corpseTemplates.set(mini.id, root);
    return root;
  } catch (e) {
    corpseTemplates.set(mini.id, null); // give up → toppled-archetype fallback (retried next call)
    return null;
  }
}

// pickCorpseMini(key) -> miniLibrary entry, DETERMINISTIC per key (the same
// FNV-1a hash phaseFromKey below uses — an entity id/name always hashes to
// the SAME corpse, never Math.random). Returns null if the corpse category
// is empty (never fabricate a corpse when the library has none).
export function pickCorpseMini(key) {
  const pool = minisByCategory('corpse');
  if (!pool.length) return null;
  return pool[hashToIndex(key, pool.length)];
}
function hashToIndex(key, n) {
  const s = String(key || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % n;
}

/**
 * buildCorpseMini(THREE, key) -> THREE.Group | null
 * The GLB-backed corpse mini for a defeated entity, keyed by `key` (the
 * entity's id/name) so the SAME entity always renders the SAME corpse model
 * (hashToIndex picks which of the library's corpse entries; ensureCorpseGLB
 * loads it lazily). Returns null when the corpse category is empty, the GLB
 * hasn't finished loading yet, or the load failed — the caller (render3d.js)
 * falls back to the existing toppled-archetype figure in every one of those
 * cases, exactly like buildArchetypeFigure falls back from buildFigureFromGLB.
 * No breathe/bob: a corpse is the one mini legitimately still (render3d.js
 * marks it `defeated: true` in the minis list, which breatheMinis already
 * skips).
 */
export function buildCorpseMini(THREE, key) {
  const mini = pickCorpseMini(key);
  if (!mini) return null;
  if (!corpseReady(mini.id)) { ensureCorpseGLB(mini); return null; }
  const tpl = corpseTemplates.get(mini.id);
  if (!tpl) return null;
  const g = new THREE.Group();
  g.add(tpl.clone(true)); // clone nodes; geometry/material shared (cheap, matches figureAssets.js)
  g.userData.corpseId = mini.id;
  g.userData.defeated = true;
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

// ── REND-SCALE-1 — minis are SIZED by the sheet, exactly as REND-TRUTH-1 made
// them POSITIONED by it (the sizing half of docs/MAP_REAL.md promise 3).
//
// The ground ink's 5-ft squares span `5 · scenePerWu` scene units at the sheet's
// live zoom (worldSpace.js sheetScenePerWu — 1 wu = 1 ft at tactical scale, the
// U450 sizing-truth law). A figure whose size is AUTHORED-fixed therefore reads
// smaller and smaller as the squares grow — the "foot-tall Hobbit on a 5-ft
// square" falsifier (Tim, 2026-07-06). The law: a mini's drawn height must be
// its TRUE height in wu pushed through the SAME transform the squares use.
//
// `miniSheetScale` has a FLOOR (default 1 = today's authored token look): far
// zoomed out, true scale would shrink a person to a sub-pixel dot, and a region
// map wants legible tokens, not truth-sized specks — the floor keeps the
// pre-REND-SCALE-1 behavior everywhere the squares aren't visible, and the true
// law takes over exactly where they are (street/plan bands). Pure + THREE-free
// so tests run hermetic in node.
// UNIT-CLASH-1 (2026-07-06, Tim's colossus report): the sheet's wu is METRIC —
// worldSpace.js is the contract (NODE_WU=1000 ≈ 1 km, PLACE_WU=4 ≈ 4 m; the
// scale bar, house plans and tree ink all draw from it). Authored sizes here
// stay in FEET (they're SRD-native and human-legible: a 6-ft villager, a 7-ft
// bed) and cross into wu through WU_PER_FT at THIS seam only. Before this
// constant existed, these tables shipped raw feet as wu — every person/prop/
// wild mini rendered ×3.28 colossal against its own metric ink (a 6 m statue
// in the bedchamber the moment MAP-3DR's diorama tilted in).
export const WU_PER_FT = 0.3048;
const ftWu = (ft) => ft * WU_PER_FT;
export const FIGURE_HEIGHT_WU = { small: ftWu(3.5), medium: ftWu(6) }; // authored ft → wu (metres)
// CARL-FOWL — a standing hen's true height (~1.4 ft), the size Carl's chicken
// mini draws at through the same sheet-scale law the villagers use.
export const CHICKEN_HEIGHT_WU = ftWu(1.4);

/**
 * figureHeightWu(speciesLike) -> wu (metres; authored in feet, see WU_PER_FT).
 * `speciesLike` is a chargen sheet species
 * ({ id, name, size } — engine/chargen/srd/sheet.js), a bare string, or null.
 * SRD `size` is the honest source ('Small' → hobbit/halfling/gnome stock);
 * name/id matching covers pack-native spellings ("Hobbit") and the one Medium
 * species that reads wrong at 6 ft (dwarves are Medium but ~4½ ft). Default: a
 * 6-ft medium person — NPCs carry no species on their map records (drawModel
 * people rows are {id,name,role}), so the default is most of the village.
 */
export function figureHeightWu(speciesLike) {
  const sp = speciesLike && typeof speciesLike === 'object' ? speciesLike : { name: speciesLike };
  const text = `${sp?.id || ''} ${sp?.name || ''} ${sp?.subrace || ''}`.toLowerCase();
  if (/dwarf/.test(text)) return ftWu(4.5);
  if (String(sp?.size || '').toLowerCase() === 'small') return FIGURE_HEIGHT_WU.small;
  if (/hobbit|halfling|gnome/.test(text)) return FIGURE_HEIGHT_WU.small;
  return FIGURE_HEIGHT_WU.medium;
}

// True prop sizes authored in feet, exported in wu (× WU_PER_FT — see the
// UNIT-CLASH-1 note above), keyed by buildPropMini kind. `axis` names the authored
// dimension the true size measures (beds are LENGTH-true — height-scaling a low
// wide frame would draw a ten-foot bed). Unknown kinds default to a 3-ft 'y'.
export const PROP_TRUE_SIZE = {
  barrel:  { axis: 'y', wu: ftWu(3.2) },
  chest:   { axis: 'y', wu: ftWu(2.2) },
  dresser: { axis: 'y', wu: ftWu(4.2) },
  bed:     { axis: 'z', wu: ftWu(7) },
};
export function propTrueSize(kind) {
  return PROP_TRUE_SIZE[String(kind || '')] || { axis: 'y', wu: ftWu(3) };
}

/**
 * miniSheetScale(wuPerAuthored, scenePerWu, floorScale) -> group scale factor.
 * `wuPerAuthored` = the mini's true size in wu ÷ its authored size in scene
 * units (stamped once at build); `scenePerWu` = the sheet's live transform
 * (worldSpace.js sheetScenePerWu). At `wuPerAuthored·scenePerWu` the mini's
 * drawn size EQUALS its true size on the sheet's own ink — the same factor the
 * 5-ft squares are drawn with. Floored (never below `floorScale`, default 1)
 * for zoomed-out token legibility.
 */
export function miniSheetScale(wuPerAuthored, scenePerWu, floorScale = 1) {
  const t = (Number(wuPerAuthored) || 0) * (Number(scenePerWu) || 0);
  const f = Number(floorScale) || 1;
  return Math.max(f, t);
}

/**
 * measureAuthoredSize(THREE, group, axis) -> the group's authored extent in
 * scene units along 'x'|'y'|'z', measured at its build transform (Box3 over the
 * whole group — GLB sculpts and procedural rigs alike, no per-archetype
 * constants to drift). Guarded: a degenerate measure (empty GLB placeholder,
 * zero box) falls back to the procedural humanoid's ~2.2 so a bad asset can
 * never divide by zero or draw a skyscraper.
 */
export function measureAuthoredSize(THREE, group, axis = 'y') {
  try {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const v = Number(size[axis === 'x' ? 'x' : axis === 'z' ? 'z' : 'y']);
    if (Number.isFinite(v) && v > 0.05 && v < 50) return v;
  } catch { /* fall through to the guard value */ }
  return 2.2;
}

/**
 * measureAuthoredFootprint(THREE, group) -> the group's authored HORIZONTAL
 * extent (Box3 XZ diagonal, hypot(sizeX, sizeZ)), at its build transform.
 * Unlike measureAuthoredSize's single fixed axis, this is invariant to a
 * random YAW baked into the build (rotation around Y only) — needed because
 * wildDeadfall lays a long cylinder down and then spins it `rng()·2π` around
 * Y before this module ever sees it (buildPropMini's bed, by contrast, is
 * built axis-aligned with no baked rotation, so measureAuthoredSize's single
 * 'z' axis is exact for it — deadfall genuinely needs the diagonal). A
 * length-true log at any yaw has X²+Z² extents summing to the same true
 * diagonal, so this is exact, not an approximation, for a Y-only rotation.
 * Same degenerate guard as measureAuthoredSize (a bad/empty box never divides
 * by zero or reads as a football-field log).
 */
export function measureAuthoredFootprint(THREE, group) {
  try {
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    const v = Math.hypot(Number(size.x) || 0, Number(size.z) || 0);
    if (Number.isFinite(v) && v > 0.05 && v < 50) return v;
  } catch { /* fall through to the guard value */ }
  return 2.2;
}

// ── WILD-SCALE-1 — wild minis join the same sheet-scale law REND-SCALE-1 gave
// people/props (figureHeightWu/propTrueSize/miniSheetScale above): a wild
// feature's drawn FOOTPRINT must equal the 2-D ink's own footprint for that
// feature, through the identical sheetScenePerWu transform the 5-ft squares
// use — never a second, authored-fixed look drifting further wrong the deeper
// the squares zoom in.
//
// wildFeaturesAround (engine/world/wildFeatures.js) hands the renderer
// { kind, sizeClass, blocking } — no per-feature wu size (the brief's
// "or the feature's own wu size where the derivation provides one" clause:
// it doesn't, for any of the five kinds). The one wu-truth that DOES exist is
// the settlement-band ink's own tree token size (drawModel.js's
// INK_PARAMS.treeRadiusWu, the SAME grove ink oneMap.js draws) — trees anchor
// to that (see wildTrueSize below). The other four kinds carry no ink
// counterpart today (only trees are drawn as settlement-band grove tokens),
// so their true sizes below are reasoned taste constants — same footing
// PROP_TRUE_SIZE already stands on for barrel/chest/dresser (no engine field
// backs those either) — grounded in each builder's own authored geometry (a
// boulder is a substantial trail obstruction; a fallen log is length-true;
// brush/stumps are ground clutter a few feet across).
//
// `sizeClass` (SIZE_CLASS in wildFeatures.js) is a FIXED per-KIND tag — every
// tree is 'large', every brush 'small' — not per-instance variance; the
// per-instance jitter each wild builder already rolls (WILD_SIZE_SCALE times
// rng()-driven proportions) is captured by measuring the ACTUAL built
// instance's authored size below, so the ratio law self-corrects for it
// exactly as it already does for props (no separate sizeClass multiplier
// needed here — measuring the real instance IS the correction).
// `tree` deliberately has no wu constant here: its true size is DERIVED
// (2 · caller-supplied treeDiameterWu, see wildTrueSize below) rather than a
// second literal copy of drawModel.js's INK_PARAMS.treeRadiusWu that could
// silently drift from it — this module stays THREE-free AND engine/drawModel
// -free (its whole point, per this file's header), so the live ink value is
// threaded in as a parameter by render3d.js (which already imports
// INK_PARAMS for the settlement-band tree ink) rather than imported here.
export const WILD_TRUE_SIZE = {
  boulder:  { axis: 'y',        wu: ftWu(3.5) },  // height-true: a real trail boulder, big enough to block a body (isBlockingKind)
  deadfall: { axis: 'footprint', wu: ftWu(6.5) }, // length-true fallen log; 'footprint' = measureAuthoredFootprint (yaw-invariant — see above)
  brush:    { axis: 'x',        wu: ftWu(2.5) },  // a low scrub clump a stride across
  stump:    { axis: 'y',        wu: ftWu(2.0) },  // a cut-off trunk stub, knee-to-waist high
};
/**
 * wildTrueSize(kind, treeDiameterWu = 5.6) -> { axis, wu } | null. Returns
 * null for an unrecognized kind (never invent a size for data outside the
 * five kinds this stage covers — same discipline as buildWildMini/
 * propTrueSize's own guards). `treeDiameterWu` is 2·treeRadiusWu — the caller
 * (render3d.js) passes the LIVE drawModel.js INK_PARAMS.treeRadiusWu·2 so the
 * wild tree's footprint can never drift from the settlement-band ink's own
 * tree size; the default here only fires if a caller omits it (e.g. a bare
 * unit test), matching today's INK_PARAMS.treeRadiusWu (2.8) · 2.
 */
export function wildTrueSize(kind, treeDiameterWu = 5.6) {
  if (String(kind || '') === 'tree') {
    const wu = Number(treeDiameterWu) > 0 ? Number(treeDiameterWu) : 5.6;
    return { axis: 'x', wu };
  }
  return WILD_TRUE_SIZE[String(kind || '')] || null;
}
