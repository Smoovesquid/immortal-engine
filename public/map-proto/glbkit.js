// glbkit — split a fused Meshy "parts sheet" into individual pieces by geometry islands.
// A Meshy export that visually holds several separate objects is ONE mesh with ONE texture
// atlas, but the objects are disconnected geometry. Connected-components over welded verts
// recovers them as separate placeable pieces, each keeping its own slice of the shared UV/
// texture. (A cohesive building/set-piece comes back as one big island → place whole.)
//
// splitIslands(THREE, root, opts) → [{ geo, mat, size:Vector3, box:Box3, tris }] sorted big→small.

export function splitIslands(THREE, root, { minTris = 20, weldQ = 1000 } = {}) {
  let mesh = null; root.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) return [];
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal, uv = geo.attributes.uv;
  const index = geo.index ? geo.index.array : null;
  const triCount = index ? index.length / 3 : pos.count / 3;
  const V = (t, j) => index ? index[t * 3 + j] : t * 3 + j;

  // weld vertices by rounded position so UV-seam splits don't fragment an island
  const nv = pos.count, key2id = new Map(), weld = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const k = Math.round(pos.getX(v) * weldQ) + ',' + Math.round(pos.getY(v) * weldQ) + ',' + Math.round(pos.getZ(v) * weldQ);
    let id = key2id.get(k); if (id === undefined) { id = key2id.size; key2id.set(k, id); }
    weld[v] = id;
  }
  const nw = key2id.size, par = new Int32Array(nw); for (let i = 0; i < nw; i++) par[i] = i;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < triCount; t++) { const a = weld[V(t, 0)], b = weld[V(t, 1)], c = weld[V(t, 2)]; uni(a, b); uni(b, c); }

  const groups = new Map();
  for (let t = 0; t < triCount; t++) { const r = find(weld[V(t, 0)]); let g = groups.get(r); if (!g) { g = []; groups.set(r, g); } g.push(t); }

  const pieces = [];
  for (const tris of groups.values()) {
    if (tris.length < minTris) continue;
    const remap = new Map(), P = [], N = [], U = [], I = [];
    for (const t of tris) for (let j = 0; j < 3; j++) {
      const vi = V(t, j); let ni = remap.get(vi);
      if (ni === undefined) {
        ni = P.length / 3; remap.set(vi, ni);
        P.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
        if (nrm) N.push(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi));
        if (uv) U.push(uv.getX(vi), uv.getY(vi));
      }
      I.push(ni);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if (N.length) bg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    if (U.length) bg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    bg.setIndex(I);
    if (!N.length) bg.computeVertexNormals();
    bg.computeBoundingBox();
    const size = new THREE.Vector3(); bg.boundingBox.getSize(size);
    pieces.push({ geo: bg, mat: mesh.material, size, box: bg.boundingBox.clone(), tris: tris.length });
  }
  pieces.sort((a, b) => b.tris - a.tris);
  return pieces;
}
