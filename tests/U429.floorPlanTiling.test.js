// U429 — FP-1 proper floorplans: rooms TILE, doorways are gaps in shared walls,
// corridors abolished, compass honesty intact (docs/briefs/FP-1-proper-floorplans.md).
//
// Tim's ruling (2026-07-04): "the 'rooms-interconnected-by-corridors' is actually
// an old bug. That's not how floorplans are supposed to look. They should look like
// proper floorplans. Meaning rooms with doorways that open into one another." The
// FICTION already behaved that way ("you step through into the pantry", "a doorway
// leading deeper in", never a corridor); floorPlan.js's geometry contradicted it by
// padding a void between every pair of rooms and bridging it with an auto-generated
// hallway. This test proves the geometry now agrees with the words: connected rooms
// ABUT along a shared wall, a doorway is a gap ON that shared wall on the edge the
// topology crosses, and there are no corridors anywhere.
//
// Pure, deterministic, read-only — no engine writes, no Math.random, no network, no
// API key. worldHash untouched (floorPlan is a pure projection, never hashed).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { interiorCompassLayout, adjacentRooms } from '../engine/structures/topology.js';
import { buildingTypeFor } from '../engine/structures/roomDetail.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootTallow = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Every structure registered in a booted world (byId map values with a topology).
function allStructures(world) {
  const byId = (world && world.structures && world.structures.byId) || {};
  return Object.values(byId).filter(s => s && s.topology && Array.isArray(s.topology.rooms) && s.topology.rooms.length);
}

// A synthetic structure of a chosen building type with a chain topology — a proper
// floorplan a real generator emits (generateStructures.js: chain of 3–4 rooms). Used
// to exercise EVERY building type's tiling, not just the one the tallow boot spawns.
function chainStruct(type, n) {
  const id = `stgen:v27:U429_${type}_${n}:0`;
  const rooms = [];
  for (let i = 1; i <= n; i++) rooms.push({ id: `room:${id}:${i}`, tags: i === 1 ? ['entry'] : [] });
  const edges = [];
  for (let i = 1; i < n; i++) edges.push({ a: `room:${id}:${i}`, b: `room:${id}:${i + 1}` });
  return { id, kind: 'building', nodeId: 'n', buildingType: type, topology: { kind: 'rooms', rooms, edges } };
}

const ALL_TYPES = ['chapel', 'tavern', 'market', 'keep', 'cottage', 'longhouse', 'lair', 'tower', 'hive'];
const GAP = 0.13; // max gap between two abutting boxes = the shared-wall inset (WALL=0.12)

// The compass direction a door of `dir` crosses, as a unit grid vector.
const DIR_VEC = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// Assert one structure's plan is a proper tiled floorplan.
function assertTiled(st, label) {
  const fp = floorPlan(st);
  if (!fp.rooms.length) return;

  // (1) NO corridors anywhere.
  assert.equal(fp.corridors.length, 0, `${label}: corridors must be abolished (got ${fp.corridors.length})`);

  const byId = new Map(fp.rooms.map(r => [r.id, r]));
  const posOf = new Map(fp.rooms.map(r => [r.id, { gx: r.gx, gy: r.gy }]));
  const nonAdj = new Set((fp.nonAdjacent || []).map(n => `${n.a}|${n.b}`));
  const exits = interiorCompassLayout(st.topology);

  // (2) Every topology edge has exactly one door; the door count for a room equals
  //     that room's topology-exit count (the map never hides an exit, nor invents one).
  const edgeCount = st.topology.edges.length;
  assert.equal(fp.doors.length, edgeCount, `${label}: one door per topology edge (${fp.doors.length} vs ${edgeCount})`);
  for (const r of fp.rooms) {
    const exitCount = adjacentRooms(st.topology, r.id).length;
    const doorCount = fp.doors.filter(d => d.a === r.id || d.b === r.id).length;
    assert.equal(doorCount, exitCount, `${label}: room ${r.id} draws ${doorCount} doors but topology gives it ${exitCount} exits`);
  }

  // (3) Connected rooms placed orthogonally-adjacent ABUT on a shared wall, and the
  //     door is a gap ON that shared wall. The rare cycle edge a square grid can't
  //     tile (a triangle) is FLAGGED on fp.nonAdjacent — never silently mis-drawn.
  for (const d of fp.doors) {
    const a = byId.get(d.a), b = byId.get(d.b);
    assert.ok(a && b, `${label}: door ${d.a}-${d.b} names two real rooms`);
    if (nonAdj.has(`${d.a}|${d.b}`)) continue; // exempt flagged un-tileable edge

    const pa = posOf.get(d.a), pb = posOf.get(d.b);
    assert.equal(Math.abs(pa.gx - pb.gx) + Math.abs(pa.gy - pb.gy), 1, `${label}: non-flagged connected rooms ${d.a},${d.b} must be orthogonally adjacent on the grid`);

    // Abut: the two boxes meet along a shared wall (edges coincide within the inset)
    // with an overlapping span on the other axis.
    const ax0 = a.cx - a.w / 2, ax1 = a.cx + a.w / 2, ay0 = a.cy - a.h / 2, ay1 = a.cy + a.h / 2;
    const bx0 = b.cx - b.w / 2, bx1 = b.cx + b.w / 2, by0 = b.cy - b.h / 2, by1 = b.cy + b.h / 2;
    const vShare = (Math.abs(ax1 - bx0) < GAP || Math.abs(bx1 - ax0) < GAP) && Math.min(ay1, by1) - Math.max(ay0, by0) > -1e-9;
    const hShare = (Math.abs(ay1 - by0) < GAP || Math.abs(by1 - ay0) < GAP) && Math.min(ax1, bx1) - Math.max(ax0, bx0) > -1e-9;
    assert.ok(vShare || hShare, `${label}: connected rooms ${d.a},${d.b} must ABUT along a shared wall (no pad-void)`);

    // The door point sits on BOTH rooms' edges (i.e. in the shared wall band).
    const inBand = (r, x, y) => x >= r.cx - r.w / 2 - GAP && x <= r.cx + r.w / 2 + GAP && y >= r.cy - r.h / 2 - GAP && y <= r.cy + r.h / 2 + GAP;
    assert.ok(inBand(a, d.x, d.y) && inBand(b, d.x, d.y), `${label}: door ${d.a}-${d.b} must be a gap ON the shared wall of both rooms`);

    // (4) Compass honesty: the door's direction matches the ACTUAL grid delta AND the
    //     compass layout movement uses — "go <dir>" reaches the room drawn <dir>.
    const v = DIR_VEC[d.dir];
    assert.ok(v, `${label}: door dir '${d.dir}' is a cardinal`);
    // From whichever endpoint owns this compass slot toward the other:
    const exA = exits.get(d.a) || {}, exB = exits.get(d.b) || {};
    const aToB = exA[d.dir] === d.b; // room a leaves by d.dir to reach b
    const bToA = exB[d.dir] === d.a;
    assert.ok(aToB || bToA, `${label}: door dir '${d.dir}' must be a real compass exit between ${d.a} and ${d.b}`);
    const [from, to] = aToB ? [pa, pb] : [pb, pa];
    assert.equal(to.gx - from.gx, v[0], `${label}: "go ${d.dir}" must reach the room drawn ${d.dir} (x)`);
    assert.equal(to.gy - from.gy, v[1], `${label}: "go ${d.dir}" must reach the room drawn ${d.dir} (y)`);
  }
}

test('U429-A: the tallow boot world — every structure is a proper tiled floorplan (rooms abut, doors on shared walls, zero corridors, compass honest)', () => {
  const w = bootTallow();
  const structs = allStructures(w);
  assert.ok(structs.length > 0, 'the boot world registers at least one structure');
  for (const st of structs) assertTiled(st, `struct ${st.id}`);
});

test('U429-B: every building TYPE tiles — a chain building of each style (3 and 4 rooms) has abutting rooms, shared-wall doors, and no corridors', () => {
  for (const t of ALL_TYPES) {
    for (const n of [3, 4]) assertTiled(chainStruct(t, n), `${t}/${n}`);
  }
});

test('U429-C: the buildingTypeFor default path also tiles (id-hash-derived type, no forced buildingType)', () => {
  // No buildingType field → floorPlan derives it from the id hash (the procedural
  // path). Prove tiling holds there too, across a spread of ids.
  for (let k = 0; k < 40; k++) {
    const id = `stgen:v27:U429hash_${k}_${(k * 2654435761) >>> 0}:0`;
    const n = 3 + (k % 2);
    const rooms = [], edges = [];
    for (let i = 1; i <= n; i++) rooms.push({ id: `room:${id}:${i}`, tags: i === 1 ? ['entry'] : [] });
    for (let i = 1; i < n; i++) edges.push({ a: `room:${id}:${i}`, b: `room:${id}:${i + 1}` });
    if (n >= 4) edges.push({ a: `room:${id}:1`, b: `room:${id}:3` }); // the generator's shortcut edge
    const st = { id, kind: 'building', nodeId: 'n', topology: { kind: 'rooms', rooms, edges } };
    assert.equal(buildingTypeFor(id) in { chapel: 1, tavern: 1, market: 1, keep: 1, cottage: 1, longhouse: 1, lair: 1, tower: 1, hive: 1 }, true, `type resolves for ${id}`);
    assertTiled(st, `hash ${id}`);
  }
});

test('U429-D: deterministic ×2 — the same structure yields a byte-identical floor plan every build (rooms, doors, corridors, nonAdjacent)', () => {
  const w1 = bootTallow();
  const w2 = bootTallow();
  const s1 = allStructures(w1), s2 = allStructures(w2);
  assert.equal(s1.length, s2.length, 'same structure set across two boots');
  for (const st of s1) {
    assert.deepEqual(floorPlan(st), floorPlan(st), `${st.id}: floorPlan is a pure function (stable within a build)`);
  }
  // And identical across two independent boots of the same seed.
  const byId2 = new Map(s2.map(s => [s.id, s]));
  for (const st of s1) {
    const other = byId2.get(st.id);
    assert.ok(other, `${st.id} present in both boots`);
    assert.deepEqual(floorPlan(st), floorPlan(other), `${st.id}: identical plan across two boots of seed 'tallow'`);
  }
});
