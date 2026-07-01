// WORLD ASSETS — procedural builders for the lush overworld diorama (the shared
// asset module, sibling of figures3d.js).
//
// These are the PURE-VIEW builders that dress the 3D map: the terrain heightfield,
// dirt-road ribbons, settlements (modular peelable buildings + well + palisade +
// trees), wilderness woods, and the chapel ruin. They were factored OUT of
// render3d.js so BOTH the live game (render3d.js → mountSlice3D) and the standalone
// design showroom (map-proto/asset-lab.html) draw the SAME meshes — design a look
// here once, it flows to the game on reload (no manual port, no drift).
//
// THE CONTRACT (mirrors figures3d.js):
//   - This file NEVER imports three; the caller passes the lazily-loaded THREE in.
//     So it stays a zero-cost static import with no CDN fetch of its own.
//   - PURE VIEW: no engine state, no determinism dependency, no Math.random. Every
//     scatter is driven by a seeded RNG the caller hands in (mulberry32), so a given
//     seed always builds the same diorama — the same guarantee the 2D map has.
//   - Materials are created ONCE per scene via createWorldMaterials(THREE) and the
//     returned bundle is passed to every builder. The `shared` Set identity is what
//     dimGroup() keys on to clone-before-tint, and the buildings clone the shared
//     mats into unique TRANSPARENT sets for the roof-peel cutaway — so keep one
//     bundle per mounted scene.
//
// THE BUILDER INTERFACE (so designing a new look = editing one function here):
//   createWorldMaterials(THREE) -> matsBundle
//   buildTerrain(THREE, { nodes, edges, bounds, seed, tileWU }) -> { mesh, heightAt }
//   buildEdge(THREE, ax, az, bx, bz, kind, heightAt) -> Mesh                (road/path ribbon)
//   buildBuilding(THREE, mats, rng, type, roofKind) -> { group, r, roof, roofMat, roofBaseY, walls }
//   buildWell(THREE, mats) -> Group                                          (caller sets .position.y)
//   buildTree(THREE, rng, { variant }) -> Group                             (one tree; lab/solo use)
//   addTreeScatter(THREE, g, rng, groundAt, picks, mats) -> void            (instanced scatter; game path)
//   buildPalisade(THREE, g, rng, groundAt, ringR, mats) -> palR (number)
//   buildSettlement(THREE, mats, rng, groundAt, discovered, peelables) -> Group
//   buildWilderness(THREE, mats, rng, groundAt, discovered) -> Group
//   buildChapelRuin(THREE, mats, rng, groundAt) -> Group
//   buildCampTent(THREE, mats, rng, groundAt) -> Group                      (lab-designed; not yet wired into the game)
//   dimGroup(grp, satDrop, lumDrop, sharedMats) -> void
//
// `type` ∈ keys of PARCELS ('inn'|'chapel'|'smithy'|'cottage'|'house'|'store').
// `roofKind` ∈ 'thatch'|'tile'|'shingle'. `variant` ∈ 'broadleaf'|'autumn'|'conifer'|'dead'.

// Authored GLB trees override the procedural scatter once loaded (see treeAssets.js);
// addTreeScatter falls through to procedural until/unless they're ready.
import { glbTreeScatter, glbBloomScatter, glbBarrelScatter, glbVillagerScatter, buildGLBProp } from './treeAssets.js';
import { ruinKitReady, ruinMesh, chapelBodyIndex, gravestoneIndices } from './ruinKit.js';

// ───────────────────────── seeded RNG (view-deterministic scatter) ─────────────
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function strHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}
export function nodeRng(seedStr, nodeId) { return mulberry32(strHash(seedStr + '_' + nodeId)); }

const _smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ───────────────────────── materials (outpost.html palette) ────────────────────
// plaster, timber, varied roofs (red tile / thatch / shingle), stone, wood, log.
// Created once per scene; the `shared` set + `roofMatOf` map travel with the bundle.
export function createWorldMaterials(THREE) {
  const plaster = new THREE.MeshStandardMaterial({ color: 0xcdbf9c, roughness: 0.95 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x49301a, roughness: 0.85 });
  const thatch = new THREE.MeshStandardMaterial({ color: 0xb8a05a, roughness: 1.0 });
  const tileRoof = new THREE.MeshStandardMaterial({ color: 0x9a4636, roughness: 0.85 }); // red tile
  const shingle = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8b8579, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4526, roughness: 0.8 });
  const log = new THREE.MeshStandardMaterial({ color: 0x6e4a28, roughness: 0.95 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x4a4642, roughness: 0.97 });
  const darkRoof = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, roughness: 0.95 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.95 });
  const roofMatOf = { thatch, tile: tileRoof, shingle };
  // Shared (re-used) materials must be cloned before a per-place tint; the peelable
  // buildings already use unique transparent clones, so those tint in place
  // (preserving the cutaway's material references — see dimGroup).
  const shared = new Set([plaster, timber, thatch, tileRoof, shingle, stone, wood, log, darkStone, darkRoof, trunk]);
  return { plaster, timber, thatch, tileRoof, shingle, stone, wood, log, darkStone, darkRoof, trunk, roofMatOf, shared };
}

// ───────────────────────── terrain: vertex-coloured heightfield ────────────────
// Gentle rolling hills FLATTENED where the world is inhabited (node centres + the
// roads between them) so buildings/paths sit level; coloured grass with dirt along
// the roads, rock on the high points, a forest tint past the settled tiles. All
// deterministic from the scene seed — a pure-view scatter, never engine state.
// Returns the positioned mesh + heightAt(x,z) so the caller can drop nodes/edges/
// the player onto the same surface.
export function buildTerrain(THREE, { nodes = [], edges = [], bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }, seed = '', tileWU = 40 } = {}) {
  const TILE_WU = tileWU;
  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;
  const wPos = n => ({ x: (Number(n.x) || 0) * TILE_WU, z: (Number(n.y) || 0) * TILE_WU });
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
  const mesh = new THREE.Mesh(tgeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }));
  mesh.position.set(tCx, 0, tCz); mesh.receiveShadow = true;
  return { mesh, heightAt };
}

// ───────────────────────── edge (dirt road) ribbon — follows the terrain ───────
export function buildEdge(THREE, ax, az, bx, bz, kind, heightAt) {
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

// ───────────────────────── buildings (modular, peelable) ───────────────────────
// roof prism whose ridge runs along the building's LONGER horizontal axis.
export function roofPrism(THREE, w, d, rh, eave, mat) {
  const long = Math.max(w, d), short = Math.min(w, d);
  const s = new THREE.Shape();
  s.moveTo(-short / 2 - eave, 0); s.lineTo(short / 2 + eave, 0); s.lineTo(0, rh); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: long + eave * 2, bevelEnabled: false });
  geo.translate(0, 0, -(long + eave * 2) / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  if (w >= d) m.rotation.y = Math.PI / 2;
  return m;
}

export const PARCELS = { inn: [5.2, 6.4], chapel: [4.2, 5.6], smithy: [4.0, 5.0], cottage: [3.8, 4.6], house: [4.2, 5.0], store: [4.6, 4.4] };

// The interior revealed when the roof peels — furnished with the authored GLB kit
// (hearth, dining set, dresser, bed, chest, cauldron, rug). Each piece appears once its
// GLB is loaded; the hearth + table fall back to procedural shapes so a just-mounted,
// not-yet-loaded interior is never bare. The building's own (fading) walls are the room
// walls, so this adds only the floor + furnishings. Emissive-only light — never leaks
// through the closed shell.
export function makeInterior(THREE, mats, rng, bw, bdep) {
  const woodMat = mats.wood, stoneMat = mats.stone;
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.3, 0.12, bdep - 0.3), woodMat.clone()); floor.position.y = 0.06; floor.receiveShadow = true; g.add(floor);
  const put = (kind, x, z, ry, useRng) => { const m = buildGLBProp(THREE, kind, useRng ? rng : undefined); if (m) { m.position.set(x, 0, z); if (ry) m.rotation.y = ry; g.add(m); } return m; };

  // hearth against the back (−z) wall — authored GLB (its own emissive fire) or a box+glow
  if (!put('hearth', 0, -bdep / 2 + 0.55, 0)) {
    const hb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.45), stoneMat.clone()); hb.position.set(-bw / 2 + 0.7, 0.5, -bdep / 2 + 0.35); hb.castShadow = true; g.add(hb);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5a14, emissiveIntensity: 2.2, roughness: 0.6 })); fire.position.set(-bw / 2 + 0.7, 0.42, -bdep / 2 + 0.5); fire.scale.y = 0.7; g.add(fire);
  }
  put('cauldron', 0.8, -bdep / 2 + 1.25, 0);

  // dining set (authored table + chair + stool) or a procedural table + stool fallback
  if (put('table', 0.1, 0.3, 0)) { put('chair', 0.1, 1.1, Math.PI); put('stool', 0.1, -0.5, 0); }
  else {
    const tx = (rng() - 0.5) * bw * 0.4, tz = (rng() - 0.1) * bdep * 0.22;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12), woodMat.clone()); top.position.set(tx, 0.78, tz); top.castShadow = true; g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 8), woodMat.clone()); leg.position.set(tx, 0.39, tz); g.add(leg);
    const sx = tx + 0.95, sz = tz + 0.25;
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10), woodMat.clone()); stool.position.set(sx, 0.46, sz); stool.castShadow = true; g.add(stool);
    const sleg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.46, 6), woodMat.clone()); sleg.position.set(sx, 0.23, sz); g.add(sleg);
  }

  put('dresser', -bw / 2 + 0.5, -0.4, Math.PI / 2);       // left (−x) wall
  put('bed', bw / 2 - 0.7, -bdep / 2 + 1.35, -Math.PI / 2); // right (+x) wall, headboard back
  put('chest', -bw / 2 + 0.6, bdep / 2 - 0.9, Math.PI, true); // front-left corner (rng variant)

  // crimson rug laid flat under the dining set
  const rug = buildGLBProp(THREE, 'rug');
  if (rug) { rug.rotation.x = -Math.PI / 2; rug.position.set(0.1, 0.07, 0.3); g.add(rug); }
  return g;
}

// A varied stylized COTTAGE, MODULAR for the roof-peel cutaway — restyled to match the
// authored Red Roof Cottage (steep red-tiled roof, half-timbered plaster walls, stone
// base course, mullioned warm-lit windows, an arched door, a stone chimney) while
// staying fully procedural + seeded + peelable. Each wall is its own group (a fading
// panel + timber framing + windows, with a unique transparent material set) PLUS a
// jagged masonry base that stays standing when the panel peels. The roof is one mesh
// sharing a single roofMat so the cutaway's fade covers it. Built at origin facing +z.
export function buildBuilding(THREE, mats, rng, type, roofKind) {
  const { plaster: plasterMat, timber: timberMat, wood: woodMat, stone: stoneMat, tileRoof } = mats;
  const g = new THREE.Group();
  const fp = PARCELS[type] || PARCELS.cottage;
  const bw = fp[0] * (0.92 + rng() * 0.16), bdep = fp[1] * (0.92 + rng() * 0.16);
  const h = type === 'inn' || type === 'chapel' ? 3.4 : 2.7; // taller cottage walls
  const T = 0.2; // wall thickness
  g.add(makeInterior(THREE, mats, rng, bw, bdep)); // revealed when peeled

  const walls = [];
  function jaggedBase(len, nx, nz) {
    const half = len / 2, teeth = Math.max(4, Math.round(len / 0.6));
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0); shape.lineTo(half, 0);
    for (let i = 0; i <= teeth; i++) { const x = half - len * (i / teeth); shape.lineTo(x, 0.42 + rng() * 0.46); }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false }); geo.translate(0, 0, -T / 2);
    const m = new THREE.Mesh(geo, stoneMat.clone()); m.castShadow = true; m.receiveShadow = true;
    if (Math.abs(nx) > 0.5) m.rotation.y = Math.PI / 2;
    m.position.set(-nx * 0.05, 0, -nz * 0.05);
    return m;
  }
  function wall(len, axis, x, z, nx, nz, deco) {
    const wg = new THREE.Group(); wg.position.set(x, 0, z);
    const mats2 = [], castSet = [];
    const pm = plasterMat.clone(); pm.transparent = true; mats2.push(pm);
    const geo = axis === 'x' ? new THREE.BoxGeometry(len, h, T) : new THREE.BoxGeometry(T, h, len);
    const panel = new THREE.Mesh(geo, pm); panel.position.y = h / 2; panel.castShadow = true; panel.receiveShadow = true; wg.add(panel); castSet.push(panel);
    wg.add(jaggedBase(len, nx, nz));
    if (deco) deco(wg, mats2, castSet);
    g.add(wg); walls.push({ group: wg, n: [nx, nz], mats: mats2, castSet });
  }
  const addDeco = (wg, mats2, castSet, geo, baseMat, x, y, z) => { const m2 = baseMat.clone(); m2.transparent = true; mats2.push(m2); const mm = new THREE.Mesh(geo, m2); mm.position.set(x, y, z); mm.castShadow = true; wg.add(mm); castSet.push(mm); };

  // half-timber framing + stone base course + mullioned windows (+ door on the front),
  // all placed on a wall's OUTER face and added to its fade set so they peel with it.
  function frameWall(wg, m, c, axis, len, sign, isFront) {
    const out = sign * (T / 2 + 0.02), tw = 0.16;
    // box oriented for the wall axis: `along` runs the wall's long axis, `d` = depth out
    const B = (along, y, sizeAlong, sizeY, d) => (axis === 'x'
      ? { geo: new THREE.BoxGeometry(sizeAlong, sizeY, d), x: along, y, z: out }
      : { geo: new THREE.BoxGeometry(d, sizeY, sizeAlong), x: out, y, z: along });
    const add = (mat, along, y, sizeAlong, sizeY, d) => { const b = B(along, y, sizeAlong, sizeY, d); addDeco(wg, m, c, b.geo, mat, b.x, b.y, b.z); };
    add(stoneMat, 0, 0.3, len, 0.6, 0.16);                                  // stone base course
    for (const s of [-1, 1]) add(timberMat, s * (len / 2 - tw / 2), h / 2, tw, h, 0.14); // corner posts
    add(timberMat, 0, h - 0.12, len, 0.2, 0.15);                            // top plate
    add(timberMat, 0, h * 0.58, len, 0.14, 0.13);                          // mid rail
    const winY = h * 0.52;
    const addWin = (along) => {
      const wm = new THREE.MeshStandardMaterial({ color: 0x2a3b52, emissive: 0xffcf87, emissiveIntensity: 0.6, roughness: 0.3 });
      add(wm, along, winY, 0.66, 0.78, 0.09);                               // warm pane
      add(timberMat, along, winY, 0.74, 0.06, 0.11);                        // muntin — horizontal
      add(timberMat, along, winY, 0.06, 0.86, 0.11);                        // muntin — vertical
    };
    if (isFront) {
      add(woodMat, 0, 0.85, 0.95, 1.7, 0.1);                               // door slab
      for (const s of [-1, 1]) add(timberMat, s * 0.56, 0.9, 0.12, 1.9, 0.12); // door posts
      add(timberMat, 0, 1.84, 1.34, 0.2, 0.13);                            // arched lintel
      addWin(-bw / 3.1); addWin(bw / 3.1);
    } else if (len > 4.2) { addWin(-len / 4); addWin(len / 4); } else addWin(0);
  }

  wall(bw, 'x', 0, bdep / 2, 0, 1, (wg, m, c) => frameWall(wg, m, c, 'x', bw, 1, true));      // front
  wall(bw, 'x', 0, -bdep / 2, 0, -1, (wg, m, c) => frameWall(wg, m, c, 'x', bw, -1, false));   // back
  wall(bdep, 'z', -bw / 2, 0, -1, 0, (wg, m, c) => frameWall(wg, m, c, 'z', bdep, -1, false));  // left
  wall(bdep, 'z', bw / 2, 0, 1, 0, (wg, m, c) => frameWall(wg, m, c, 'z', bdep, 1, false));     // right

  // steep RED tiled roof (one mesh, one roofMat → the cutaway fade covers all of it),
  // with a generous eave overhang. Slight per-house hue variation keeps a row alive.
  const rh = type === 'inn' ? 2.9 : type === 'chapel' ? 3.4 : 2.4;
  const roofMat = tileRoof.clone(); roofMat.color.offsetHSL(0, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05); roofMat.transparent = true;
  const roof = roofPrism(THREE, bw, bdep, rh, 0.45, roofMat); roof.position.y = h; g.add(roof);

  // stone chimney poking through the roof (solid — stays during peel, like the base)
  const chH = h + rh * 0.85;
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.6, chH, 0.6), stoneMat); chim.position.set(bw / 2 - 0.95, chH / 2, -bdep / 2 + 1.0); chim.castShadow = true; g.add(chim);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.8), stoneMat.clone()); cap.position.set(bw / 2 - 0.95, chH, -bdep / 2 + 1.0); g.add(cap);

  if (type === 'inn') { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), timberMat); post.position.set(bw / 2 + 0.4, 1.05, bdep / 2 - 1); g.add(post); const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.85), woodMat); sign.position.set(bw / 2 + 0.4, 1.55, bdep / 2 - 1.6); g.add(sign); }
  return { group: g, r: Math.hypot(bw, bdep) / 2, roof, roofMat, roofBaseY: h, walls };
}

// ───────────────────────── well ────────────────────────────────────────────────
// The village well: a stone ring, two posts, a little shingled roof. Built at the
// local origin; the caller sets .position.y onto the terrain. Consumes no RNG.
export function buildWell(THREE, mats) {
  const { stone: stoneMat, wood: woodMat, shingle: shingleMat } = mats;
  const well = new THREE.Group();
  const ring0 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.0, 14), stoneMat); ring0.position.y = 0.5; ring0.castShadow = true; well.add(ring0);
  for (const sx of [-0.8, 0.8]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), woodMat); p.position.set(sx, 1.3, 0); well.add(p); }
  const wr = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4), shingleMat); wr.position.y = 2.3; wr.rotation.y = Math.PI / 4; wr.castShadow = true; well.add(wr);
  return well;
}

// ───────────────────────── trees ───────────────────────────────────────────────
const TREE_GREENS = [0x3f6a35, 0x4f7a3f, 0x35602e, 0xb0732e, 0x8a9a3a];
const TREE_TRUNK_GEO = T => new T.CylinderGeometry(0.18, 0.3, 2.4, 5);
const TREE_FOLI_GEO = T => new T.IcosahedronGeometry(1.0, 0);

// Low-poly tree scatter (instanced trunks + icosahedron foliage clumps), each tree
// dropped onto the terrain via groundAt. picks: [[localX, localZ], …]. This is the
// GAME path — instanced for cheap, smooth crowds; matches buildTree's palette/shape.
export function addTreeScatter(THREE, g, rng, groundAt, picks, mats) {
  if (!picks.length) return;
  if (glbTreeScatter(THREE, g, rng, groundAt, picks)) return; // authored GLB trees when loaded
  const D = new THREE.Object3D();
  const trunkIM = new THREE.InstancedMesh(TREE_TRUNK_GEO(THREE), mats.trunk, picks.length); trunkIM.castShadow = true; g.add(trunkIM);
  const foliIM = new THREE.InstancedMesh(TREE_FOLI_GEO(THREE), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), picks.length * 3); foliIM.castShadow = true; g.add(foliIM);
  foliIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(picks.length * 3 * 3), 3);
  const greens = TREE_GREENS;
  let fi = 0;
  picks.forEach(([lx, lz], i) => {
    const gy = groundAt(lx, lz), s = 0.8 + rng() * 0.8;
    D.position.set(lx, gy + 1.2 * s, lz); D.scale.setScalar(s); D.rotation.set(0, rng() * 6.28, 0); D.updateMatrix(); trunkIM.setMatrixAt(i, D.matrix);
    const bc = new THREE.Color(greens[(rng() * greens.length) | 0]);
    for (let k = 0; k < 3; k++) { const bs = (1.0 + rng() * 0.7) * s; D.position.set(lx + (rng() - 0.5) * 0.8 * s, gy + (2.2 + k * 0.7) * s, lz + (rng() - 0.5) * 0.8 * s); D.scale.set(bs, bs * 0.9, bs); D.rotation.set(0, rng() * 6.28, 0); D.updateMatrix(); foliIM.setMatrixAt(fi, D.matrix); foliIM.setColorAt(fi, bc.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.08)); fi++; }
  });
  trunkIM.instanceMatrix.needsUpdate = true; foliIM.instanceMatrix.needsUpdate = true; foliIM.instanceColor.needsUpdate = true;
}

// A single tree as discrete meshes (NON-instanced) — for the showroom / solo display,
// and the seed of richer per-tree variants. `variant` ∈ broadleaf | autumn | conifer
// | dead. broadleaf reproduces addTreeScatter's look exactly (same trunk + 3 clumps,
// same green palette); the others are lab variants for designing new foliage.
export function buildTree(THREE, rng, opts = {}) {
  const variant = opts.variant || 'broadleaf';
  const trunkMat = new THREE.MeshStandardMaterial({ color: variant === 'dead' ? 0x6b5a44 : 0x5a3f28, roughness: 0.95 });
  const g = new THREE.Group();
  const s = 0.8 + rng() * 0.8;
  const trunk = new THREE.Mesh(TREE_TRUNK_GEO(THREE), trunkMat);
  trunk.position.set(0, 1.2 * s, 0); trunk.scale.setScalar(s); trunk.rotation.y = rng() * 6.28; trunk.castShadow = true; g.add(trunk);
  if (variant === 'dead') {
    // bare crooked branches — no foliage
    for (let k = 0; k < 4; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.1 * s, 5), trunkMat); const a = rng() * 6.28; br.position.set(Math.cos(a) * 0.3 * s, (2.0 + k * 0.4) * s, Math.sin(a) * 0.3 * s); br.rotation.set(rng() * 0.8 - 0.4, a, rng() * 0.8 - 0.4); br.castShadow = true; g.add(br); }
    return g;
  }
  if (variant === 'conifer') {
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x2f5230, roughness: 0.92, flatShading: true });
    for (let k = 0; k < 3; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * 0.4) * s, 1.6 * s, 7), needleMat); cone.position.set(0, (2.2 + k * 1.0) * s, 0); cone.castShadow = true; g.add(cone); }
    return g;
  }
  const palette = variant === 'autumn' ? [0xb0732e, 0xc88a2e, 0x9a5a22, 0x8a9a3a] : TREE_GREENS;
  const bc = new THREE.Color(palette[(rng() * palette.length) | 0]);
  for (let k = 0; k < 3; k++) {
    const bs = (1.0 + rng() * 0.7) * s;
    const foli = new THREE.Mesh(TREE_FOLI_GEO(THREE), new THREE.MeshStandardMaterial({ color: bc.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.08), roughness: 0.9, flatShading: true }));
    foli.position.set((rng() - 0.5) * 0.8 * s, (2.2 + k * 0.7) * s, (rng() - 0.5) * 0.8 * s); foli.scale.set(bs, bs * 0.9, bs); foli.rotation.y = rng() * 6.28; foli.castShadow = true; g.add(foli);
  }
  return g;
}

// ───────────────────────── palisade ────────────────────────────────────────────
// A ring of instanced log stakes + tips around the settlement, with one gate gap.
// Consumes RNG (the gate angle + a small per-stake lean) — call it at the SAME point
// in the settlement build so the seeded scatter stays identical. Returns palR (the
// ring radius) so the caller can place trees just outside the wall.
export function buildPalisade(THREE, g, rng, groundAt, ringR, mats) {
  const D = new THREE.Object3D();
  const logMat = mats.log;
  const palR = ringR + 5.5, PN = 44, gate = rng() * Math.PI * 2, ring = [];
  for (let i = 0; i < PN; i++) { const a = i / PN * Math.PI * 2; if (Math.abs(((a - gate + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.26) continue; const r = palR + Math.sin(a * 3 + 1) * 1.1; ring.push([Math.cos(a) * r, Math.sin(a) * r, a]); }
  const stakeIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 2.8, 5), logMat, ring.length); stakeIM.castShadow = true; g.add(stakeIM);
  const tipIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.4, 5), logMat, ring.length); g.add(tipIM);
  ring.forEach((p, i) => { const gy = groundAt(p[0], p[1]); D.position.set(p[0], gy + 1.4, p[1]); D.rotation.set(0, p[2], (rng() - 0.5) * 0.08); D.scale.setScalar(1); D.updateMatrix(); stakeIM.setMatrixAt(i, D.matrix); D.position.y = gy + 2.9; D.rotation.set(0, p[2], 0); D.updateMatrix(); tipIM.setMatrixAt(i, D.matrix); });
  stakeIM.instanceMatrix.needsUpdate = true; tipIM.instanceMatrix.needsUpdate = true;
  return palR;
}

// ───────────────────────── composite places ────────────────────────────────────
// A settlement: a ring of varied buildings (doors to the square) around a well,
// wrapped in a palisade of instanced log stakes with one gate gap, with a few trees
// just outside the wall. Deterministic from the node rng. Each peelable building is
// registered into `peelables` for the roof-peel cutaway (the caller resolves their
// world transforms after layout — see render3d.js).
export function buildSettlement(THREE, mats, rng, groundAt, discovered, peelables = []) {
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
      const b = buildBuilding(THREE, mats, rng, type, roofKinds[(rng() * 3) | 0]);
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
  const well = buildWell(THREE, mats); well.position.y = groundAt(0, 0); g.add(well);
  // palisade ring of instanced stakes + tips, one gate gap
  const palR = buildPalisade(THREE, g, rng, groundAt, ringR, mats);
  // a few trees just outside the wall
  const picks = []; for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = palR + 3 + rng() * 9; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  addTreeScatter(THREE, g, rng, groundAt, picks, mats);
  // flowering garden bushes dotted around the square (inside the wall, between the
  // buildings) — authored GLB blooms when loaded; nothing in the procedural fallback.
  const bloomPicks = []; for (let i = 0; i < 8; i++) { const a = rng() * 6.28, r = 4 + rng() * 5; bloomPicks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  glbBloomScatter(THREE, g, rng, groundAt, bloomPicks);
  // wooden barrels clustered near the buildings — village clutter (authored GLB when loaded)
  const barrelPicks = []; for (let i = 0; i < 6; i++) { const a = rng() * 6.28, r = 5 + rng() * 4; barrelPicks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  glbBarrelScatter(THREE, g, rng, groundAt, barrelPicks);
  // townsfolk milling around the square — a few NPC figures from the villager pool
  const vilPicks = []; for (let i = 0; i < 5; i++) { const a = rng() * 6.28, r = 3.5 + rng() * 5; vilPicks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  glbVillagerScatter(THREE, g, rng, groundAt, vilPicks);
  if (!discovered) dimGroup(g, 0.3, 0.1, mats.shared);
  return g;
}

// Wilderness: dense low-poly woods.
export function buildWilderness(THREE, mats, rng, groundAt, discovered) {
  const g = new THREE.Group();
  const n = 24 + Math.floor(rng() * 14), picks = [];
  for (let i = 0; i < n; i++) { const a = rng() * 6.28, r = rng() * 17; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  addTreeScatter(THREE, g, rng, groundAt, picks, mats);
  if (!discovered) dimGroup(g, 0.22, 0.08, mats.shared);
  return g;
}

// Dungeon entrance: a stone chapel / ruin — steep shingle roof + spire, an arched
// mouth with a cold glow from within, leaning gravestones, bare trees.
export function buildChapelRuin(THREE, mats, rng, groundAt) {
  const { stone: stoneMat, shingle: shingleMat, darkRoof: darkRoofMat } = mats;
  const g = new THREE.Group();

  // ── authored path: assemble a ruined chapel site from the split chapel_ruins kit ──
  if (ruinKitReady()) {
    const body = ruinMesh(THREE, chapelBodyIndex(), 5.2);       // gable structure = the chapel (its arch = entrance)
    if (body) { body.rotation.y = Math.PI; g.add(body); }        // arch faces the square (+z)
    const glow = new THREE.PointLight(0x6f55c8, 1.8, 18, 2); glow.position.set(0, 1.5, 2.2); g.add(glow); // cold light from within
    // graveyard: scatter the small upright pieces out front
    const graves = gravestoneIndices();
    for (let n = 0; n < 8 && graves.length; n++) {
      const gi = graves[(rng() * graves.length) | 0];
      const st = ruinMesh(THREE, gi, 0.85 + rng() * 0.5);
      if (!st) continue;
      const gx = (rng() - 0.5) * 12, gz = 4.5 + rng() * 6.5;
      st.position.set(gx, groundAt(gx, gz), gz);
      st.rotation.set((rng() - 0.5) * 0.16, rng() * Math.PI * 2, (rng() - 0.5) * 0.16);
      g.add(st);
    }
    // a couple of leaning ruined wall fragments flanking the chapel
    for (const [wi, wx] of [[2, -4.8], [3, 4.8]]) {
      const w = ruinMesh(THREE, wi, 2.2 + rng()); if (!w) continue;
      w.position.set(wx, groundAt(wx, 0), -1 + rng() * 2); w.rotation.y = (rng() - 0.5) * 0.8; g.add(w);
    }
    const picks = []; for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = 9 + rng() * 9; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
    addTreeScatter(THREE, g, rng, groundAt, picks, mats);
    return g;
  }

  // ── procedural fallback (kit not yet loaded): a stone chapel + roof + spire + graves ──
  const bw = 6, bdep = 9, h = 4.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bdep), stoneMat); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const roof = roofPrism(THREE, bw, bdep, 3.4, 0.3, shingleMat); roof.position.y = h; g.add(roof);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4.0, 6), shingleMat); spire.position.set(0, h + 3.4 + 1.6, -bdep / 2 + 1.0); spire.castShadow = true; g.add(spire);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.2), darkRoofMat); door.position.set(0, 1.1, bdep / 2 + 0.05); g.add(door);
  const glow = new THREE.PointLight(0x6f55c8, 1.7, 16, 2); glow.position.set(0, 1.4, bdep / 2 - 0.4); g.add(glow);
  for (let i = 0; i < 5; i++) { const gx = (rng() - 0.5) * 11, gz = bdep / 2 + 2 + rng() * 5; const st = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.18), stoneMat); st.position.set(gx, groundAt(gx, gz) + 0.45, gz); st.rotation.z = (rng() - 0.5) * 0.32; st.castShadow = true; g.add(st); }
  const picks = []; for (let i = 0; i < 9; i++) { const a = rng() * 6.28, r = 8 + rng() * 9; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  addTreeScatter(THREE, g, rng, groundAt, picks, mats);
  return g;
}

// A wilderness camp: a couple of A-frame canvas tents around a stone-ringed campfire,
// with a few trees. NEW lab-designed part — NOT yet wired into render3d.js (the game
// renders Crowfoot Camp via buildSettlement/buildWilderness today). Pure view; here
// so the showroom is complete and Tim can dial a camp look before it's adopted.
export function buildCampTent(THREE, mats, rng, groundAt = () => 0) {
  const { wood: woodMat, stone: stoneMat, log: logMat } = mats;
  const g = new THREE.Group();
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xcdbf9c, roughness: 0.96 });
  // tents on a small arc around the fire
  const tentN = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < tentN; i++) {
    const a = (i / tentN) * Math.PI * 1.4 + rng() * 0.3, r = 3.2 + rng() * 1.2;
    const tx = Math.cos(a) * r, tz = Math.sin(a) * r;
    const t = new THREE.Group();
    const tw = 2.0 + rng() * 0.6, tl = 2.8 + rng() * 0.8, th = 1.6 + rng() * 0.4;
    // canvas roof: a triangular prism (ridge along z)
    const s = new THREE.Shape();
    s.moveTo(-tw / 2, 0); s.lineTo(tw / 2, 0); s.lineTo(0, th); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: tl, bevelEnabled: false }); geo.translate(0, 0, -tl / 2);
    const canvas = new THREE.Mesh(geo, canvasMat.clone()); canvas.rotation.y = Math.PI / 2; canvas.castShadow = true; t.add(canvas);
    // ridge pole ends
    for (const ez of [-tl / 2 - 0.1, tl / 2 + 0.1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, th + 0.5, 5), woodMat); pole.position.set(0, (th + 0.5) / 2, ez); t.add(pole); }
    t.position.set(tx, groundAt(tx, tz), tz);
    t.rotation.y = Math.atan2(-tx, -tz) + (rng() - 0.5) * 0.4;
    g.add(t);
  }
  // campfire: a ring of stones + an emissive flame
  const fire = new THREE.Group(); fire.position.y = groundAt(0, 0);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const st = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), stoneMat); st.position.set(Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7); st.scale.y = 0.7; fire.add(st); }
  for (const [lx, ly, lz, sc] of [[0, 0.35, 0, 1], [0.12, 0.55, 0.06, 0.7]]) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3 * sc, 0.8 * sc, 6), new THREE.MeshStandardMaterial({ color: 0xff7a1e, emissive: 0xff5a14, emissiveIntensity: 2.2, roughness: 0.6 })); fl.position.set(lx, ly, lz); fire.add(fl); }
  const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 5), logMat); logs.rotation.z = Math.PI / 2; logs.position.set(0, 0.12, 0); fire.add(logs);
  g.add(fire);
  // a few trees just outside the camp
  const picks = []; for (let i = 0; i < 6; i++) { const a = rng() * 6.28, r = 6 + rng() * 5; picks.push([Math.cos(a) * r, Math.sin(a) * r]); }
  addTreeScatter(THREE, g, rng, groundAt, picks, mats);
  return g;
}

// ───────────────────────── dimming (undiscovered nodes) ────────────────────────
export function dimGroup(grp, satDrop, lumDrop, sharedMats) {
  grp.traverse(c => {
    if (!c.isMesh || !c.material || !c.material.color || c.isInstancedMesh) return;
    // Shared materials must be cloned so dimming one place doesn't dim all; unique
    // ones (incl. the peelable walls/roof) tint in place to keep cutaway refs live.
    if (sharedMats && sharedMats.has(c.material)) { const m = c.material.clone(); m.color.offsetHSL(0, -satDrop, -lumDrop); c.material = m; }
    else c.material.color.offsetHSL(0, -satDrop, -lumDrop);
  });
}
