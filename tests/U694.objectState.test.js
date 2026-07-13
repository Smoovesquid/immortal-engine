// U694 — OBJ-STATE-1: every furniture object gets a globally-unique, deterministic,
// stable objectId; a canonical hash-visible live-object overlay (world.objects) holds
// optional placement overrides; resolvedObjectPlacement merges base+override; and
// applyDeltas can address a piece by stable id (legacy index/name kept). Foundation
// packet — no visible change, no new action; proof is identity + migration + hash.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { authoredObjectId, procgenObjectId, deriveObjectId, hasObjectId } from '../engine/objects/identity.js';
import { resolvedObjectPlacement, findFurnitureByObjectId } from '../engine/objects/placement.js';
import { authoredNodePieces } from '../engine/structures/authoredFurniture.js';
import { generateNodeFurniture } from '../engine/decompression/generateFurniture.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { objectsHere } from '../engine/structures/roomObjects.js';

const baseWorld = () => newWorld({ seed: 'u694', fate: 0.4, campaignId: 'u694', pack: { primaryId: 'fantasy', mixerId: null } });
const firstNodeId = (w) => String(w.map.nodes[0].id);
function seedFurniture(pieces) {
  const w = baseWorld();
  w.map.nodes[0].furniture = pieces;
  return ensureWorld(w);
}

// ── A. identity is deterministic, namespaced, globally-scoped (pure) ──

test('U694-A: authored/procgen ids are namespaced and structure/node-scoped', () => {
  assert.equal(authoredObjectId('h1', 'f3'), 'au:h1:f3');
  assert.equal(procgenObjectId('n5', 2), 'pg:n5:2');
  // two authored buildings, SAME pieceId → different ids (no cross-building collision)
  assert.notEqual(authoredObjectId('h1', 'f0'), authoredObjectId('h2', 'f0'));
  assert.equal(deriveObjectId({ structureId: 'h1', pieceId: 'f0' }, 'n', 5), 'au:h1:f0');
  assert.equal(deriveObjectId({ name: 'Barrel' }, 'n', 5), 'pg:n:5');
  assert.equal(hasObjectId({ objectId: 'au:h1:f0' }), true);
  assert.equal(hasObjectId({ name: 'Barrel' }), false);
});

test('U694-B: WORLD_VERSION is 33', () => {
  assert.equal(WORLD_VERSION, 33);
});

// ── C. procgen mints a stable id AT BIRTH, deterministically ──

test('U694-C: generateNodeFurniture stamps a deterministic pg: id on every piece', () => {
  const a = generateNodeFurniture('nodeA', 'seedX');
  const b = generateNodeFurniture('nodeA', 'seedX');
  assert.ok(a.length > 0, 'produces furniture');
  for (const p of a) assert.match(String(p.objectId), /^pg:nodeA:\d+$/, 'each procgen piece is born with a pg: id');
  assert.equal(new Set(a.map(p => p.objectId)).size, a.length, 'ids are distinct within the node');
  assert.deepEqual(a.map(p => p.objectId), b.map(p => p.objectId), 'same seed+node → same ids (replay-stable)');
});

// ── D. authored mints an au: id at its seeding seam ──

test('U694-D: authoredNodePieces stamps au:<structureId>:<pieceId>', () => {
  const st = { id: 'bld1', authoredPlan: { rooms: [{ id: 'r1', furniture: [
    { authored: 1, kind: 'barrel', id: 'p0', label: 'Barrel' },
    { authored: 1, kind: 'table', id: 'p1', label: 'Table' },
  ] }] } };
  const pieces = authoredNodePieces(st);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].objectId, 'au:bld1:p0');
  assert.equal(pieces[1].objectId, 'au:bld1:p1');
});

// ── E. ensureWorld backfills legacy pieces deterministically + idempotently ──

test('U694-E: backfill mints ids for legacy pieces; world.objects defaults to {}; idempotent', () => {
  const w1 = seedFurniture([
    { name: 'Barrel', state: 'intact' },                                   // procgen → pg:<nid>:0
    { name: 'Chest', state: 'intact' },                                    // procgen → pg:<nid>:1
    { name: 'Table', state: 'intact', authored: true, structureId: 'bld1', pieceId: 'p0' }, // authored → au:
  ]);
  const nid = firstNodeId(w1);
  const f = w1.map.nodes[0].furniture;
  assert.equal(f[0].objectId, `pg:${nid}:0`);
  assert.equal(f[1].objectId, `pg:${nid}:1`);
  assert.equal(f[2].objectId, 'au:bld1:p0');
  assert.deepEqual(w1.objects, {}, 'the canonical overlay defaults to an empty (but present) object');

  const w2 = ensureWorld(w1);
  assert.deepEqual(w2.map.nodes[0].furniture.map(p => p.objectId), f.map(p => p.objectId), 're-run mints nothing new');
  assert.equal(worldHash(w2), worldHash(w1), 'ensureWorld is idempotent — same world, same hash');
});

// ── F. global uniqueness across the WHOLE map, not merely per node ──

test('U694-F: objectIds are globally unique across all nodes', () => {
  const w = baseWorld();
  w.map.nodes[0].furniture = [{ name: 'Barrel' }, { name: 'Crate' }];
  if (w.map.nodes[1]) w.map.nodes[1].furniture = [{ name: 'Barrel' }, { name: 'Crate' }];
  const e = ensureWorld(w);
  const ids = [];
  for (const n of e.map.nodes) for (const p of (n.furniture || [])) ids.push(p.objectId);
  assert.ok(ids.length >= 2);
  assert.equal(new Set(ids).size, ids.length, 'no two objects anywhere share an id');
});

// ── G. the resolver: base / placed / held precedence + null + finder ──

test('U694-G: resolvedObjectPlacement merges base + override with held > placed > base', () => {
  const w = seedFurniture([{ name: 'Barrel', roomId: 'r1' }]);
  const nid = firstNodeId(w);
  const id = w.map.nodes[0].furniture[0].objectId;

  const base = resolvedObjectPlacement(w, id);
  assert.equal(base.status, 'base');
  assert.equal(base.node, nid);
  assert.equal(base.room, 'r1');

  w.objects[id] = { placedAt: { node: nid, room: 'r2', cell: { x: 5, y: 6 }, rot: 90 } };
  const placed = resolvedObjectPlacement(w, id);
  assert.equal(placed.status, 'placed');
  assert.deepEqual(placed.cell, { x: 5, y: 6 });
  assert.equal(placed.rot, 90);
  assert.equal(placed.room, 'r2');

  w.objects[id] = { placedAt: { node: nid, cell: { x: 5, y: 6 } }, heldByActorId: 'p1' };
  const held = resolvedObjectPlacement(w, id);
  assert.equal(held.status, 'held', 'held wins over placed');
  assert.equal(held.cell, null, 'a held object is on NO floor cell');
  assert.equal(held.node, null);
  assert.equal(held.heldByActorId, 'p1');

  assert.equal(resolvedObjectPlacement(w, 'nope:0'), null, 'unknown id → null');
  assert.equal(findFurnitureByObjectId(w, id).nodeId, nid);
});

// ── H. applyDeltas addresses by stable id — THE failure mode + legacy compat ──

test('U694-H: two same-named objects stay independently addressable after a splice', () => {
  const w = seedFurniture([
    { objectId: 'pg:x:0', name: 'Barrel', state: 'intact' },
    { objectId: 'pg:x:1', name: 'Chest', state: 'intact' },
    { objectId: 'pg:x:2', name: 'Barrel', state: 'intact' }, // a SECOND same-named barrel
  ]);
  const nid = firstNodeId(w);

  // remove the middle piece → the array splices
  const w1 = applyDeltas(w, [{ op: 'removeFurniture', nodeId: nid, objectId: 'pg:x:1' }]);
  const after = w1.map.nodes[0].furniture;
  assert.equal(after.length, 2);
  assert.deepEqual(after.map(p => p.objectId), ['pg:x:0', 'pg:x:2']);

  // now address the SECOND barrel by its stable id — must hit pg:x:2, not pg:x:0
  const w2 = applyDeltas(w1, [{ op: 'modifyFurniture', nodeId: nid, objectId: 'pg:x:2', changes: { state: 'wrecked' } }]);
  const f = w2.map.nodes[0].furniture;
  assert.equal(f.find(p => p.objectId === 'pg:x:2').state, 'wrecked', 'the addressed barrel changed');
  assert.equal(f.find(p => p.objectId === 'pg:x:0').state, 'intact', 'the other same-named barrel is untouched');
});

test('U694-H2: a legacy index/name delta (no objectId) still resolves during the transition', () => {
  const w = seedFurniture([
    { objectId: 'pg:y:0', name: 'Barrel', state: 'intact' },
    { objectId: 'pg:y:1', name: 'Chest', state: 'intact' },
  ]);
  const nid = firstNodeId(w);
  const w1 = applyDeltas(w, [{ op: 'modifyFurniture', nodeId: nid, furnitureId: 0, changes: { state: 'wrecked' } }]);
  const f = w1.map.nodes[0].furniture;
  assert.equal(f[0].state, 'wrecked', 'the legacy index+name path still hits the right piece');
  assert.equal(f[1].state, 'intact');
});

// P1 (Tim, 2026-07-13): an EXPLICIT objectId must NEVER fall back to index/name. A
// stale/foreign id is a no-op, not a silent wrong-object mutation.

test('U694-H3: modifyFurniture with an unresolved objectId NO-OPS — never falls back to index/name', () => {
  const w = seedFurniture([
    { objectId: 'pg:z:0', name: 'Barrel', state: 'intact' },
    { objectId: 'pg:z:1', name: 'Chest', state: 'intact' },
  ]);
  const nid = firstNodeId(w);
  // a missing objectId PLUS a valid furnitureId + name that WOULD hit index 0
  const w1 = applyDeltas(w, [{ op: 'modifyFurniture', nodeId: nid, objectId: 'pg:z:missing', furnitureId: 0, changes: { state: 'wrecked' } }]);
  const f = w1.map.nodes[0].furniture;
  assert.equal(f[0].state, 'intact', 'index-0 barrel is NOT wrecked by a failed-id fallback');
  assert.equal(f[1].state, 'intact');
});

test('U694-H3b: modifyFurniture with an objectId belonging to ANOTHER node no-ops — no local index fallback', () => {
  const w = seedFurniture([{ objectId: 'pg:z:0', name: 'Barrel', state: 'intact' }]);
  const nid = firstNodeId(w);
  const w1 = applyDeltas(w, [{ op: 'modifyFurniture', nodeId: nid, objectId: 'au:other:p9', furnitureId: 0, changes: { state: 'wrecked' } }]);
  assert.equal(w1.map.nodes[0].furniture[0].state, 'intact', 'a foreign objectId does not fall back to local index 0');
});

test('U694-H4: removeFurniture with an unresolved objectId NO-OPS — never splices by index/name', () => {
  const w = seedFurniture([
    { objectId: 'pg:z:0', name: 'Barrel' },
    { objectId: 'pg:z:1', name: 'Chest' },
  ]);
  const nid = firstNodeId(w);
  const w1 = applyDeltas(w, [{ op: 'removeFurniture', nodeId: nid, objectId: 'pg:z:missing', furnitureId: 0 }]);
  assert.equal(w1.map.nodes[0].furniture.length, 2, 'nothing removed on a failed id');
  assert.deepEqual(w1.map.nodes[0].furniture.map(p => p.objectId), ['pg:z:0', 'pg:z:1']);
});

// ── I. migration is deterministic once; save round-trip + replay preserve the hash ──

test('U694-I: a v32 world migrates deterministically to v33; save→load and re-ensure preserve the hash', () => {
  // simulate a pre-feature v32 save: no world.objects, furniture without ids
  const legacy = baseWorld();
  legacy.map.nodes[0].furniture = [{ name: 'Barrel', state: 'intact' }, { name: 'Chest', state: 'intact' }];
  legacy.meta = { ...legacy.meta, version: 32 };
  delete legacy.objects;
  for (const n of legacy.map.nodes) for (const p of (n.furniture || [])) delete p.objectId;

  const migrated = ensureWorld(legacy);
  assert.equal(migrated.meta.version, 33, 'migrates once to v33');
  const h = worldHash(migrated);

  // idempotent: re-ensure → same hash
  assert.equal(worldHash(ensureWorld(migrated)), h, 'idempotent migration');
  // save → load → save preserves the v33 hash
  assert.equal(worldHash(importWorld(exportWorld(migrated))), h, 'export/import round-trip preserves the hash');
});

// ── J. the invariants: global uniqueness + valid override shape ──

test('U694-J: a duplicate objectId is an invariant violation', () => {
  const w = seedFurniture([{ objectId: 'dup:1', name: 'A' }]);
  w.map.nodes[0].furniture.push({ objectId: 'dup:1', name: 'B' }); // collide
  assert.throws(() => assertWorldInvariants(w), /duplicate furniture objectId/);
});

test('U694-J2: a malformed placement override is an invariant violation', () => {
  const w = seedFurniture([{ objectId: 'ok:1', name: 'A' }]);
  const nid = firstNodeId(w);
  w.objects['ok:1'] = { placedAt: { node: nid, cell: { x: 1.5, y: 2 } } }; // non-integer cell (node is real)
  assert.throws(() => assertWorldInvariants(w), /placedAt\.cell must be an integer/);
  w.objects['ok:1'] = { placedAt: { cell: { x: 1, y: 2 } } }; // missing node
  assert.throws(() => assertWorldInvariants(w), /placedAt\.node must be a non-empty string/);
});

test('U694-J3: overlay integrity — every key names a known object; placedAt.node names a real node', () => {
  const w = seedFurniture([{ objectId: 'pg:ov:0', name: 'Barrel' }]);
  const nid = firstNodeId(w);
  // a ghost overlay key — no such furniture object anywhere
  w.objects['pg:ov:ghost'] = { placedAt: { node: nid, cell: { x: 1, y: 1 } } };
  assert.throws(() => assertWorldInvariants(w), /unknown furniture objectId/);
  // a real key, but placedAt names a node that doesn't exist
  delete w.objects['pg:ov:ghost'];
  w.objects['pg:ov:0'] = { placedAt: { node: 'not-a-node', cell: { x: 1, y: 1 } } };
  assert.throws(() => assertWorldInvariants(w), /placedAt\.node .* does not match any node/);
});

// L. procgen migration decision — LOCKED IN (not left as an untested known limit).
// A fresh world stamps generation-slot ids at birth (survivors keep a GAP after a
// splice); a migrated legacy save compacts to array ordinals. The two differ ON
// PURPOSE — they are different world instances, and determinism only requires
// within-world stability + replay-equality of the SAME initial state.

test('U694-L: fresh generation-slot ids vs migrated ordinals — an intentional, tested divergence', () => {
  // (a) fresh: birth-stamped ids survive a splice WITH a gap (0, 2)
  const born = seedFurniture([
    { objectId: 'pg:g:0', name: 'A' }, { objectId: 'pg:g:1', name: 'B' }, { objectId: 'pg:g:2', name: 'C' },
  ]);
  const bnid = firstNodeId(born);
  const afterRemove = applyDeltas(born, [{ op: 'removeFurniture', nodeId: bnid, objectId: 'pg:g:1' }]);
  assert.deepEqual(afterRemove.map.nodes[0].furniture.map(p => p.objectId), ['pg:g:0', 'pg:g:2'],
    'birth-stamped ids survive a splice, gap preserved');

  // (b) a legacy v32 save of the SAME two survivors (no ids) migrates to COMPACTED
  //     ordinals — deterministic + idempotent, but NOT equal to the fresh slots.
  const legacy = baseWorld();
  legacy.map.nodes[0].furniture = [{ name: 'A' }, { name: 'C' }];
  legacy.meta = { ...legacy.meta, version: 32 };
  delete legacy.objects;
  for (const n of legacy.map.nodes) for (const p of (n.furniture || [])) delete p.objectId;
  const migrated = ensureWorld(legacy);
  const mnid = firstNodeId(migrated);
  const migIds = migrated.map.nodes[0].furniture.map(p => p.objectId);
  assert.deepEqual(migIds, [`pg:${mnid}:0`, `pg:${mnid}:1`], 'migration compacts to array ordinals');
  assert.equal(worldHash(ensureWorld(migrated)), worldHash(migrated), 'migration is idempotent');
  // the documented divergence: piece "C" is generation slot 2 fresh, ordinal 1 migrated
  assert.notEqual('2', migIds[1].split(':')[2], 'migrated ordinal deliberately differs from the fresh generation slot');
});

// ── K. read-path neutrality — no consumer is rewired; objectId is inert to reads ──

test('U694-K: objectsHere returns the same furniture with or without the added objectId', () => {
  const w = seedFurniture([
    { name: 'Barrel', state: 'intact' },
    { name: 'Chest', state: 'intact' },
    { name: 'Table', state: 'intact' },
  ]);
  w.map.currentNodeId = firstNodeId(w);
  const withIds = objectsHere(w).map(({ piece, nodeIndex }) => ({ name: piece.name, nodeIndex }));

  // strip the objectId the migration stamped, re-read: the presence view is identical
  const stripped = JSON.parse(JSON.stringify(w));
  for (const n of stripped.map.nodes) for (const p of (n.furniture || [])) delete p.objectId;
  const withoutIds = objectsHere(stripped).map(({ piece, nodeIndex }) => ({ name: piece.name, nodeIndex }));

  assert.ok(withIds.length >= 3, 'the three seeded pieces are present at the node');
  assert.deepEqual(withIds, withoutIds, 'the object-presence read is unchanged by the additive objectId (foundation-only: no consumer rewired)');
});
