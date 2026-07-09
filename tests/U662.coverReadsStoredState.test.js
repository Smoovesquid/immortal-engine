// U662 — FUNC-MINIS-1: cover consults the SAME stored furniture state that
// destruction mutates (Tim's acceptance #6), at the unit level.
//
// U661 proves the salvage lane (piece removed → cover gone) through playerMove;
// this file proves the RULINGS lane and the edges: a damaged-but-standing piece
// still shelters, a damaged piece with its parts exhausted is a wreck and stops
// sheltering, a removed piece stops sheltering, an UNSEEDED structure reports
// nothing destroyed, and a procgen room's cover is byte-identical with or
// without the live ctx (no authored pieces → no behavior change).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { coverForRoom } from '../engine/structures/coverFeatures.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { destroyedAuthoredPieceIds } from '../engine/structures/authoredFurniture.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootDemo() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

function hut(world) {
  const st = world.structures.byId[`authored:${String(world.map.currentNodeId)}`];
  const room = normalizeTopology(st.topology).rooms[0];
  return { st, room, ctx: { world, structureId: String(st.id) } };
}

function barrelIndex(world) {
  const nid = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === nid);
  return (node.furniture || []).findIndex(f => f && f.authored === true && String(f.name) === 'barrel');
}

function mutateBarrel(world, changes) {
  const nid = String(world.map.currentNodeId);
  return applyDeltas(world, [{ op: 'modifyFurniture', nodeId: nid, furnitureId: barrelIndex(world), changes }]);
}

test('U662: damaged-but-standing keeps sheltering; parts-exhausted is a wreck and stops', () => {
  const w0 = bootDemo();
  const { room } = hut(w0);

  // Intermediate damage — two parts still attached: still cover.
  const wDamaged = mutateBarrel(w0, { state: 'damaged', parts: ['hoop', 'lid'], notes: 'stave torn off' });
  const h1 = hut(wDamaged);
  assert.ok(coverForRoom(room, h1.ctx).some(c => c.kind === 'barrel'),
    'a battered barrel with staves left still grants cover');

  // Terminal — nothing left to tear off: a wreck shelters no one.
  const wWrecked = mutateBarrel(wDamaged, { state: 'damaged', parts: [], notes: 'battered apart' });
  const h2 = hut(wWrecked);
  assert.ok(!coverForRoom(room, h2.ctx).some(c => c.kind === 'barrel'),
    'parts exhausted → wreck → no cover');
  assert.equal(destroyedAuthoredPieceIds(wWrecked, h2.st).size, 1, 'exactly the barrel is destroyed');
});

test('U662: a removed piece (taken/salvaged away) stops sheltering — the twin-absent branch', () => {
  const w0 = bootDemo();
  const { room } = hut(w0);
  const nid = String(w0.map.currentNodeId);

  const wRemoved = applyDeltas(w0, [{ op: 'removeFurniture', nodeId: nid, furnitureId: barrelIndex(w0) }]);
  const h = hut(wRemoved);
  assert.ok(!coverForRoom(room, h.ctx).some(c => c.kind === 'barrel'), 'an absent piece is no cover');
  // The static plan view (no ctx) still lists it — the suppression is live state.
  assert.ok(coverForRoom(room).some(c => c.kind === 'barrel'), 'ctx-less call stays the static plan view');
});

test('U662: an unseeded structure reports nothing destroyed (no false wrecks before its pieces exist)', () => {
  const w0 = bootDemo();
  const { st } = hut(w0);
  // Strip the seed marker: the same structure with no furnitureSeeded record.
  const nid = String(w0.map.currentNodeId);
  const wUnseeded = {
    ...w0,
    map: { ...w0.map, nodes: w0.map.nodes.map(n => String(n.id) === nid ? { ...n, furniture: [], furnitureSeeded: [] } : n) },
  };
  assert.equal(destroyedAuthoredPieceIds(wUnseeded, st).size, 0,
    'without the seed marker, absent twins do not read as destroyed');
});

test('U662: a procgen room\'s cover is byte-identical with or without the live ctx', () => {
  const w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const interior = w.scene?.interior;
  assert.ok(interior, 'tallow boots into an interior');
  const st = w.structures.byId[String(interior.structureKey)];
  const room = normalizeTopology(st.topology).rooms.find(r => String(r.id) === String(interior.roomId));
  assert.ok(room, 'the interior room resolves');

  const bare = coverForRoom(room);
  const live = coverForRoom(room, { world: w, structureId: String(st.id) });
  assert.deepEqual(live, bare, 'no authored pieces → the live ctx changes nothing');
});
