// U686 — BUILDER-OBJ-1: the supported 16-kind Builder set is engine truth with
// HONEST per-kind physics.
//
// Tim's hard law (2026-07-11 dispatch): "If it is placeable in the Builder, the
// game must believe in it. No decor-only minis." FUNC-MINIS-1 (U659–U664) proved
// the chain for four kinds; this file extends the lock to the full supported
// palette — barrel, bed, dresser, chest, cookpot, crate, shelf, table, chair,
// nightstand, wardrobe, rug, runner, lantern, candles, hearth — and closes the
// silent-default honesty gap: before this packet a placed lantern minted with
// material 'fire' / hardness 0 (Model B's render material leaking into smash
// physics), a hearth was hardness-0 'fire' masonry, and a wardrobe was not a
// container you could open.
//
// Layers locked here: FURN identity → loader carry (exact kind/count/position,
// both rooms) → Model B flat/light fields → Model A explicit physics per kind →
// seeding (count, unique names, idempotence, pieceId join).

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { roomDetail, FURN } from '../engine/structures/roomDetail.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import {
  authoredNodePieces, seedAuthoredNodeFurniture,
} from '../engine/structures/authoredFurniture.js';

export const SUPPORTED_KINDS = [
  'barrel', 'bed', 'dresser', 'chest', 'cookpot', 'crate', 'shelf', 'table',
  'chair', 'nightstand', 'wardrobe', 'rug', 'runner', 'lantern', 'candles', 'hearth',
];

// ── fixture: a two-room lodge holding one of every supported kind ──
// Rooms share the x=22 wall; furniture entries carry the same room/ux/uy the
// Builder's export writes (center of the piece, room-relative).
const hallRoom  = { id: 'hall',  name: 'Hall',  role: 'greathall', shape: 'rect', material: 'timber', x: 10, y: 10, w: 12, h: 10 };
const storeRoom = { id: 'store', name: 'Store', role: 'quarters',  shape: 'rect', material: 'timber', x: 22, y: 10, w: 10, h: 10 };

function piece(type, room, x, y, w, h) {
  return {
    type, x, y, w, h, rot: 0, room: room.id,
    ux: +(((x - room.x) + w / 2) / room.w).toFixed(4),
    uy: +(((y - room.y) + h / 2) / room.h).toFixed(4),
  };
}

const HALL_PIECES = [
  piece('hearth',  hallRoom, 14, 10, 2, 1),
  piece('table',   hallRoom, 14, 13, 2, 2),
  piece('chair',   hallRoom, 17, 13, 1, 1),
  piece('shelf',   hallRoom, 11, 11, 2, 1),
  piece('rug',     hallRoom, 14, 16, 3, 2),
  piece('runner',  hallRoom, 11, 13, 1, 4),
  piece('lantern', hallRoom, 20, 11, 1, 1),
  piece('candles', hallRoom, 20, 17, 1, 1),
];
const STORE_PIECES = [
  piece('bed',        storeRoom, 23, 11, 2, 3),
  piece('dresser',    storeRoom, 26, 11, 2, 1),
  piece('nightstand', storeRoom, 25, 12, 1, 1),
  piece('wardrobe',   storeRoom, 29, 11, 2, 1),
  piece('chest',      storeRoom, 23, 16, 1, 1),
  piece('crate',      storeRoom, 25, 17, 1, 1),
  piece('barrel',     storeRoom, 27, 17, 1, 1),
  piece('cookpot',    storeRoom, 29, 16, 1, 1),
];

const supportedLodge = {
  kind: 'authored-structure',
  schema: 'house-builder/v10',
  name: 'Sixteen-Kind Lodge',
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [hallRoom, storeRoom],
  walls: [],
  openings: [
    { kind: 'door', x: 10, y: 15, angle: 90, orient: 'v', len: 1, room: 'hall', entrance: true },
    { kind: 'door', x: 22, y: 15, angle: 90, orient: 'v', len: 1 },
  ],
  tunnels: [],
  corridors: [],
  furniture: [...HALL_PIECES, ...STORE_PIECES],
  secrets: [],
  traps: [],
};

const NODE = 'n_test_lodge';

test('U686: every supported Builder kind is an engine FURN kind (the hard law\'s floor)', () => {
  for (const kind of SUPPORTED_KINDS) {
    assert.ok(FURN[kind], `FURN catalog is missing '${kind}' — a placeable the engine would not believe in`);
  }
});

test('U686: the loader carries all sixteen drawn pieces into their rooms verbatim — kind, count, position', () => {
  const st = loadAuthoredStructure(supportedLodge, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);

  const kindsByRoom = new Map(topo.rooms.map(r => [String(r.id), roomDetail(r, st.buildingType).furniture.map(f => f.kind).sort()]));
  const rooms = [...kindsByRoom.values()];
  assert.deepEqual(rooms.find(k => k.includes('hearth')), HALL_PIECES.map(p => p.type).sort(),
    'the hall holds exactly the eight hall pieces — no role loadout, no injected extras');
  assert.deepEqual(rooms.find(k => k.includes('bed')), STORE_PIECES.map(p => p.type).sort(),
    'the store holds exactly the eight store pieces');

  // Drawn position survives: every authored plan item sits at its export ux/uy.
  const drawn = new Map([...HALL_PIECES, ...STORE_PIECES].map(p => [p.type, p]));
  const planRooms = st.authoredPlan?.rooms || [];
  let checked = 0;
  for (const room of planRooms) {
    for (const f of (room.furniture || [])) {
      if (f.authored !== 1) continue;
      const src = drawn.get(f.kind);
      assert.ok(src, `unexpected authored piece kind '${f.kind}'`);
      assert.ok(Math.abs(f.fx - src.ux) < 1e-3 && Math.abs(f.fy - src.uy) < 1e-3,
        `${f.kind} sits where it was drawn (fx/fy ${f.fx}/${f.fy} vs drawn ${src.ux}/${src.uy})`);
      checked++;
    }
  }
  assert.equal(checked, 16, 'sixteen authored plan pieces, none dropped');
});

test('U686: Model B fields the world reads are carried — rugs lie flat, fire kinds glow', () => {
  const st = loadAuthoredStructure(supportedLodge, { nodeId: NODE });
  const items = (st.authoredPlan?.rooms || []).flatMap(r => (r.furniture || []).filter(f => f.authored === 1));
  const byKind = new Map(items.map(f => [f.kind, f]));

  // flat:1 is what tacticalPos's furnitureBlockedCells skips — a rug you stand ON.
  assert.equal(byKind.get('rug')?.flat, 1, 'a rug is a floor covering, never a wall of cloth');
  assert.equal(byKind.get('runner')?.flat, 1, 'an aisle runner lies flat');
  assert.equal(byKind.get('table')?.flat, 0, 'a table blocks the square it stands on');

  // Model B light — the same field procgen hearths/lanterns already glow by.
  assert.equal(byKind.get('hearth')?.light, 2, 'a placed hearth lights its room like a procgen hearth');
  assert.equal(byKind.get('lantern')?.light, 1);
  assert.equal(byKind.get('candles')?.light, 1);
});

test('U686: Model A physics are explicit and honest per kind — no silent wood/fire defaults', () => {
  const st = loadAuthoredStructure(supportedLodge, { nodeId: NODE });
  const pieces = authoredNodePieces(st);
  assert.equal(pieces.length, 16, 'sixteen drawn pieces, sixteen world objects');
  const byKind = new Map(pieces.map(p => [p.kind, p]));

  // Light-bearers are OBJECTS that carry fire, not fire itself. The render
  // material (Model B 'fire') must never leak into smash physics.
  const lantern = byKind.get('lantern');
  assert.equal(lantern.material, 'iron', 'a lantern smashes as ironwork, not as flame');
  assert.ok(lantern.hardness >= 3, 'ironwork does not crumple at a touch');
  assert.ok(lantern.bulk <= 2, 'a lantern is made to be carried');

  const candles = byKind.get('candles');
  assert.equal(candles.material, 'wax', 'candles are wax, not fire');
  assert.equal(candles.hardness, 0);
  assert.ok(candles.bulk <= 1, 'candles are pocketable');

  const hearth = byKind.get('hearth');
  assert.equal(hearth.material, 'stone', 'a hearth is set masonry');
  assert.equal(hearth.hardness, 5, 'your blow rings off it');
  assert.ok(hearth.bulk >= 5, 'part of the house — nobody pockets a hearth');

  // Containers: the open/search affordance class.
  for (const kind of ['chest', 'crate', 'nightstand', 'wardrobe', 'barrel', 'cookpot', 'dresser']) {
    assert.equal(byKind.get(kind)?.category, 'container', `${kind} can be opened/searched`);
  }
  const chest = byKind.get('chest');
  assert.equal(chest.material, 'iron');
  assert.equal(chest.hardness, 4, 'an iron-banded chest dents, never splinters');
  assert.ok(chest.parts.length >= 2, 'a chest has parts to pry at — not the anonymous default');

  // Plain furniture stays furniture.
  for (const kind of ['table', 'chair', 'shelf', 'bed', 'rug', 'runner', 'hearth']) {
    assert.equal(byKind.get(kind)?.category, 'furniture', `${kind} is an obstacle/fixture, not a container`);
  }

  // Soft goods tear, they don't splinter.
  for (const kind of ['rug', 'runner']) {
    assert.equal(byKind.get(kind)?.material, 'cloth');
    assert.equal(byKind.get(kind)?.hardness, 0);
  }

  for (const p of pieces) {
    assert.ok(p.authored === true && p.pieceId && p.roomId && p.structureId, `${p.kind} carries full provenance`);
    assert.ok(Array.isArray(p.parts), `${p.kind} has a parts array`);
    assert.ok(p.notes && p.notes !== 'placed by its builder',
      `${p.kind} has its own physical description, not the anonymous fallback`);
  }
});

test('U686: seeding preserves exact count and identity — three barrels are three barrels', () => {
  const trioHouse = {
    ...supportedLodge,
    name: 'Barrel Store',
    rooms: [storeRoom],
    openings: [{ kind: 'door', x: 22, y: 15, angle: 90, orient: 'v', len: 1, room: 'store', entrance: true }],
    furniture: [
      piece('barrel', storeRoom, 23, 11, 1, 1),
      piece('barrel', storeRoom, 25, 11, 1, 1),
      piece('barrel', storeRoom, 27, 11, 1, 1),
      piece('candles', storeRoom, 23, 17, 1, 1),
      piece('candles', storeRoom, 27, 17, 1, 1),
    ],
  };
  const st = loadAuthoredStructure(trioHouse, { nodeId: NODE });
  const stub = {
    meta: { seed: 'u686' },
    map: { currentNodeId: NODE, nodes: [{ id: NODE, furniture: [] }] },
    structures: { byId: { [st.id]: st } },
  };

  const w1 = seedAuthoredNodeFurniture(stub, NODE);
  const node1 = w1.map.nodes[0];
  assert.equal(node1.furniture.length, 5, 'three barrels + two candle clusters = five objects, not one of each');
  assert.deepEqual(node1.furniture.filter(p => p.kind === 'barrel').map(p => p.name).sort(),
    ['barrel', 'barrel 2', 'barrel 3'], 'each barrel is its own named object (ROM-4)');

  // pieceId join: every Model A twin points at a real Model B plan piece.
  const planIds = new Set((st.authoredPlan?.rooms || []).flatMap(r => (r.furniture || []).map(f => String(f.id))));
  for (const p of node1.furniture) {
    assert.ok(planIds.has(String(p.pieceId)), `${p.name} joins its drawn twin by pieceId`);
  }

  const w2 = seedAuthoredNodeFurniture(w1, NODE);
  assert.equal(w2.map.nodes[0].furniture.length, 5, 'reseeding never resurrects or duplicates');
});
