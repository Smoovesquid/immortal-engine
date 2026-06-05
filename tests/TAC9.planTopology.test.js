import test from 'node:test';
import assert from 'node:assert/strict';
import { planToTopology, structurePlanFor, ALL_PLANS } from '../public/map/plans/planTopology.js';
import { getPlan } from '../public/map/plans/index.js';
import { reachableRooms } from '../engine/movement/interiorMovement.js';

test('TAC9: structurePlanFor maps engine building types to catalog plans', () => {
  for (const t of ['cottage', 'tavern', 'chapel', 'keep', 'market', 'longhouse', 'lair', 'tower', 'hive']) {
    assert.ok(structurePlanFor(t), `no plan for building type ${t}`);
    assert.equal(structurePlanFor(t).type, t);
  }
  assert.equal(structurePlanFor('nonsense'), null);
});

test('TAC9: derived topology connects every room (no orphans)', () => {
  let checked = 0;
  for (const plan of ALL_PLANS) {
    if (plan.rooms.length < 2) continue;
    const topo = planToTopology(plan);
    const entry = String(plan.entry || plan.rooms[0].id);
    const { dist } = reachableRooms(topo, entry);
    for (const r of topo.rooms) assert.ok(dist.has(r.id), `${plan.id}: room ${r.id} unreachable from entry`);
    checked++;
  }
  assert.ok(checked > 30, `expected to check many plans, did ${checked}`);
});

test('TAC9: keep topology has the right rooms + the entry tag', () => {
  const keep = getPlan('keep');
  const topo = planToTopology(keep);
  assert.equal(topo.rooms.length, keep.rooms.length);
  const entryRoom = topo.rooms.find(r => r.tags.includes('entry'));
  assert.equal(entryRoom.id, keep.entry);
  assert.ok(topo.edges.length >= keep.rooms.length - 1, 'at least a spanning set of edges');
});

test('TAC9: deterministic', () => {
  const a = JSON.stringify(planToTopology(getPlan('tavern')));
  const b = JSON.stringify(planToTopology(getPlan('tavern')));
  assert.equal(a, b);
});
