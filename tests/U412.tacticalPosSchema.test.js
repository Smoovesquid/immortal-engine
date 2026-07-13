// U412–U415 — TAC-1: position-as-canon (docs/POSITION_AS_CANON.md).
//
// The engine now owns a canonical TACTICAL position, `pos`, on party members and
// present settlement NPCs: null | { frame:'region', gx, gy } | { frame:'struct:<id>',
// gx, gy }. 1 cell = 5 ft. It is deterministic, seeded, INSIDE worldHash, and
// COMPLETELY DARK in TAC-1 — nothing consumes it (movement unchanged; the verb is
// TAC-2, the renderer snaps at TAC-4). This is the keystone under 5-ft minis and the
// DND_XCOM arc.
//
// U412 — schema + migration: a pre-bump save loads with a warn, gains pos on the
//         player + present NPCs, is invariant-clean, and is idempotent (two
//         consecutive ensureWorld calls → byte-identical).
// U413 — determinism: same seed, two fresh worlds → identical pos everywhere; replay
//         hash equality with pos hashed; the MAP-OCC-2 interplay (pos IN the hash,
//         renderer pixels ux/uy OUT).
// U414 — invariants: hand-built bad states throw (out-of-bounds cell; region pos
//         projecting to the wrong node; struct pos disagreeing with scene.interior);
//         good states pass.
// U415 — pinned constants: the unit block exists, values match the contract, and a
//         cell → wu → cell round-trip is exact.
//
// Pure, LLM-off (deterministic). Boots the exact live slice via the pre-rolled hero.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { projectPartyForHash } from '../engine/crunchHashProjection.js';
import { loadSlot } from '../engine/save.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import {
  CELL_FT, PLACE_WU, NODE_WU, NODE_CELLS,
  layoutToCells, cellsToFt, ftToCells,
  nodeGridToRegionCell, regionCellToNodeGrid,
  nearestNodeToRegionCell, roomOfStructCell
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// The exact live boot: pre-rolled hero into the Aldermere slice. The boot drops the
// player INSIDE the wake room (scene.interior set at the n0 structure), with a few
// settlement NPCs present at the node.
function bootIndoors(seed = SLICE_SEED) {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

function presentNpcs(world) {
  const cur = String(world.map?.currentNodeId ?? '');
  const node = (world.map?.nodes || []).find(n => n && String(n.id) === cur) || null;
  return Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
}

function posEqual(a, b) {
  if (a == null && b == null) return true;
  if (!a || !b) return false;
  return a.frame === b.frame && a.gx === b.gx && a.gy === b.gy;
}

// ── U412 — schema + migration ────────────────────────────────────────────────

test('U412-01: WORLD_VERSION is 33 (TAC-1 bumped to 30; MR-2a doors → 31; SP-2 faction ethos → 32; OBJ-STATE-1 objects → 33)', () => {
  assert.equal(WORLD_VERSION, 33);
});

test('U412-02: the player gets a valid struct pos at the indoor boot', () => {
  const w = bootIndoors();
  const pos = w.party[0].pos;
  assert.ok(pos && typeof pos === 'object', 'player has a pos object');
  assert.match(String(pos.frame), /^struct:/, `boot is indoors → struct frame (got ${pos.frame})`);
  assert.ok(Number.isInteger(pos.gx) && Number.isInteger(pos.gy), 'gx/gy are integers');
  // The cell lands in exactly the room scene.interior names.
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  const room = roomOfStructCell(floorPlan(st), pos.gx, pos.gy);
  assert.equal(room, String(w.scene.interior.roomId), 'the pos cell is in the wake room rect');
});

test('U412-03: present NPCs gain a valid seeded pos (all placed after one ensure pass)', () => {
  const w = bootIndoors();
  const npcs = presentNpcs(w);
  assert.ok(npcs.length > 0, 'the boot node has present NPCs');
  // Every NPC that carries a pos carries a WELL-FORMED one (null is legal — e.g. an
  // NPC injected after the boot's last ensureWorld, like the Lingerer, is placed on
  // the next ensure pass).
  for (const npc of npcs) {
    if (npc.pos == null) continue;
    const pos = npc.pos;
    assert.ok(Number.isInteger(pos.gx) && Number.isInteger(pos.gy), `${npc.id || npc.name} integer cells`);
    assert.ok(String(pos.frame) === 'region' || /^struct:/.test(String(pos.frame)), `valid frame: ${pos.frame}`);
  }
  // After one more ensureWorld pass, EVERY present NPC is placed (deterministic backfill).
  const w2 = ensureWorld(w);
  const npcs2 = presentNpcs(w2);
  assert.ok(npcs2.length > 0 && npcs2.every(n => n.pos && Number.isInteger(n.pos.gx)),
    'all present NPCs have a valid pos after a full ensure pass');
});

test('U412-04: a pre-bump (v29) save loads with a warn and gains pos', () => {
  // A synthetic pre-TAC-1 save: valid v29 world with NO pos fields anywhere.
  const w = bootIndoors();
  const legacy = JSON.parse(JSON.stringify(w));
  legacy.meta.version = 29;
  // Strip every pos to mimic a build that never had the field.
  for (const m of legacy.party) delete m.pos;
  for (const npc of presentNpcs(legacy)) delete npc.pos;

  const data = {};
  const storage = {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(legacy));

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let loaded;
  try { loaded = loadSlot(storage, 'slot1'); }
  finally { console.warn = origWarn; }

  assert.ok(loaded, 'the save loads');
  assert.equal(loaded.meta.version, WORLD_VERSION, 'upgraded to the current version');
  assert.ok(warnings.length > 0 && warnings[0].includes('v29') && warnings[0].includes('v33'),
    `warns about the version jump: ${warnings[0]}`);
  // The upgrade populated pos on the player + present NPCs.
  assert.ok(loaded.party[0].pos, 'player gained a pos on upgrade');
  assert.ok(presentNpcs(loaded).every(n => n.pos), 'present NPCs gained pos on upgrade');
  assert.doesNotThrow(() => assertWorldInvariants(loaded), 'the upgraded world is invariant-clean');
});

test('U412-05: backfill is idempotent — two consecutive ensureWorld calls are byte-identical', () => {
  const w = bootIndoors();
  const a = ensureWorld(w);
  const b = ensureWorld(a);
  assert.equal(worldHash(a), worldHash(b), 'consecutive ensureWorld hashes match');
  assert.equal(JSON.stringify(a.party[0].pos), JSON.stringify(b.party[0].pos), 'player pos stable');
  const na = presentNpcs(a), nb = presentNpcs(b);
  for (let i = 0; i < na.length; i++) {
    assert.equal(JSON.stringify(na[i].pos), JSON.stringify(nb[i].pos), `npc[${i}] pos stable`);
  }
});

// ── U413 — determinism ────────────────────────────────────────────────────────

test('U413-01: same seed, two fresh worlds → identical pos everywhere + identical hash', () => {
  const a = bootIndoors();
  const b = bootIndoors();
  assert.equal(worldHash(a), worldHash(b), 'two fresh boots of the same seed hash identically');
  assert.ok(posEqual(a.party[0].pos, b.party[0].pos), 'player pos identical across fresh worlds');
  const na = presentNpcs(a), nb = presentNpcs(b);
  assert.equal(na.length, nb.length, 'same present-NPC count');
  for (let i = 0; i < na.length; i++) {
    assert.ok(posEqual(na[i].pos, nb[i].pos), `npc[${i}] pos identical across fresh worlds`);
  }
});

test('U413-02: pos IS in the hash — a consistent move to another valid cell changes it', () => {
  const w = bootIndoors();
  const h0 = worldHash(w);
  const p = w.party[0].pos;
  // Move within the SAME room (still consistent → survives ensureWorld, TAC-2-ready).
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  // Find a different in-room cell. FP-1 relock: rooms now TILE (abutting walls),
  // and roomRectCells reserves a wall band so room territories are disjoint — a
  // small room can be a single cell wide on one axis. Probe BOTH axes (the "pos is
  // hashed" property is direction-agnostic) so the test doesn't assume the wider
  // pre-tiling rects that always had a horizontal neighbour.
  let alt = null;
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  for (const [dx, dy] of deltas) {
    const cand = { frame: p.frame, gx: p.gx + dx, gy: p.gy + dy };
    if (roomOfStructCell(floorPlan(st), cand.gx, cand.gy) === String(w.scene.interior.roomId)) { alt = cand; break; }
  }
  assert.ok(alt, 'a second in-room cell exists');
  const wMoved = ensureWorld({ ...w, party: w.party.map((m, i) => i === 0 ? { ...m, pos: alt } : m) });
  assert.ok(posEqual(wMoved.party[0].pos, alt), 'a consistent pos survives ensureWorld (not healed away)');
  assert.notEqual(worldHash(wMoved), h0, 'a different pos changes the world hash → pos is hashed');
});

test('U413-03: MAP-OCC-2 interplay — pos included in the hash image, renderer ux/uy excluded', () => {
  const w = bootIndoors();
  const projected = projectPartyForHash(w.party);
  // pos survives into the hash image verbatim.
  assert.ok('pos' in projected[0], 'pos is present in the hash projection');
  assert.equal(JSON.stringify(projected[0].pos), JSON.stringify(w.party[0].pos), 'pos passes through unmodified');
  // Legacy renderer pixels are stripped.
  const h0 = worldHash(w);
  const wUx = ensureWorld({
    ...w,
    party: w.party.map((m, i) => i === 0
      ? { ...m, position: { ...(m.position || { zone: 'far' }), ux: 4242, uy: 9999 } }
      : m)
  });
  assert.equal(worldHash(wUx), h0, 'mutating position.ux/uy does NOT change the hash (renderer pixels excluded)');
});

// ── U414 — invariants ─────────────────────────────────────────────────────────

test('U414-01: an out-of-bounds struct cell (no room contains it) THROWS', () => {
  const w = bootIndoors();
  const p = w.party[0].pos; // struct frame
  const bad = { ...w, party: w.party.map((m, i) => i === 0 ? { ...m, pos: { frame: p.frame, gx: 9999, gy: 9999 } } : m) };
  assert.throws(() => assertWorldInvariants(bad), /lands in no room of structure/i,
    'a struct cell in no room rect is rejected');
});

test('U414-02: a non-integer cell THROWS', () => {
  const w = bootIndoors();
  const p = w.party[0].pos;
  const bad = { ...w, party: w.party.map((m, i) => i === 0 ? { ...m, pos: { frame: p.frame, gx: 2.5, gy: 6 } } : m) };
  assert.throws(() => assertWorldInvariants(bad), /gx\/gy must be integers/i, 'fractional cells are rejected');
});

test('U414-03: a struct pos disagreeing with scene.interior (wrong structure) THROWS', () => {
  const w = bootIndoors();
  const p = w.party[0].pos;
  // Point the pos frame at a bogus structure id (not scene.interior's).
  const bad = { ...w, party: w.party.map((m, i) => i === 0 ? { ...m, pos: { frame: 'struct:not-a-real-structure', gx: p.gx, gy: p.gy } } : m) };
  assert.throws(() => assertWorldInvariants(bad), /not registered/i, 'a struct pos naming an unregistered structure is rejected');
});

test('U414-04: a region pos projecting to the WRONG node THROWS', () => {
  // Build a minimal two-node outdoor world; place the player near node B while
  // currentNodeId is node A → the region cell projects to B, not A.
  const world = ensureWorld({
    meta: { seed: 'u414-region', version: WORLD_VERSION, fate: 0.2 },
    map: {
      currentNodeId: 'nA',
      nodes: [
        { id: 'nA', name: 'A', x: 0, y: 0, nodeType: 'settlement' },
        { id: 'nB', name: 'B', x: 5, y: 0, nodeType: 'settlement' }
      ],
      edges: [{ a: 'nA', b: 'nB' }],
      pos: { x: 0, y: 0 }
    },
    party: [{ id: 'party', name: 'Hero' }],
    scene: { interior: null }
  });
  // The ensured world is clean (player placed near nA).
  assert.doesNotThrow(() => assertWorldInvariants(world), 'the ensured outdoor world is clean');
  assert.equal(world.party[0].pos.frame, 'region', 'player is outdoors → region frame');
  assert.equal(nearestNodeToRegionCell(world.map, world.party[0].pos.gx, world.party[0].pos.gy), 'nA', 'and projects to nA');

  // Now hand-place the cell at node B's centre while currentNodeId is still nA.
  const bCentre = nodeGridToRegionCell(5, 0);
  const bad = { ...world, party: world.party.map(m => ({ ...m, pos: { frame: 'region', gx: bCentre.gx, gy: bCentre.gy } })) };
  assert.throws(() => assertWorldInvariants(bad), /region pos must project to the current node/i,
    'a region cell whose nearest node is not the current node is rejected');
});

test('U414-05: a null pos is always legal (good state passes)', () => {
  const w = bootIndoors();
  const cleared = { ...w, party: w.party.map((m, i) => i === 0 ? { ...m, pos: null } : m) };
  // ensureWorld will re-place it, but the raw invariant on a null pos must not throw.
  assert.doesNotThrow(() => assertWorldInvariants(cleared), 'null pos passes the invariant');
});

// ── U415 — pinned constants ───────────────────────────────────────────────────

test('U415-01: the pinned unit constants match the contract', () => {
  assert.equal(CELL_FT, 5, '1 cell = 5 ft');
  assert.equal(PLACE_WU, 4, '4 cells per floorPlan layout unit (1 layout unit = 20 ft)');
  assert.equal(NODE_WU, 1000, '1000 ft per node-grid unit');
  assert.equal(NODE_CELLS, NODE_WU / CELL_FT, 'derived region cells per node step');
  assert.equal(NODE_CELLS, 200, 'NODE_CELLS = 200');
});

test('U415-02: cell → ft → cell round-trips exactly', () => {
  for (const cells of [0, 1, 2, 7, 30, 200, -3]) {
    assert.equal(ftToCells(cellsToFt(cells)), cells, `round-trip cells=${cells}`);
  }
  // Whole feet that are multiples of CELL_FT round-trip to whole cells.
  for (const ft of [0, 5, 10, 30, 1000]) {
    assert.equal(cellsToFt(ftToCells(ft)), ft, `round-trip ft=${ft}`);
  }
});

test('U415-03: node-grid ↔ region-cell round-trips exactly at the centre', () => {
  for (const [nx, ny] of [[0, 0], [3, 0], [-2, 5], [10, -7]]) {
    const c = nodeGridToRegionCell(nx, ny);
    const back = regionCellToNodeGrid(c.gx, c.gy);
    assert.deepEqual(back, { x: nx, y: ny }, `node grid (${nx},${ny}) round-trips through the region cell`);
  }
});

test('U415-04: layoutToCells maps a layout unit to PLACE_WU cells', () => {
  assert.equal(layoutToCells(1), PLACE_WU, '1 layout unit = PLACE_WU cells');
  assert.equal(layoutToCells(2), 2 * PLACE_WU, '2 layout units = 8 cells');
  assert.equal(layoutToCells(0.5), Math.round(0.5 * PLACE_WU), 'half a layout unit rounds to nearest cell');
});
