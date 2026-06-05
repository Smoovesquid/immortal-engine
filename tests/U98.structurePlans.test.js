/**
 * U98 — structure plan catalog validator.
 *
 * Guards the hand-authored building catalog the way the bestiary validators guard
 * creatures: every plan must be well-formed and renderable. As the catalog grows
 * past 100, this catches a malformed plan the moment it's added.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PLANS, PLAN_TYPES, getPlan } from '../public/map/plans/index.js';
import { planToSceneModel } from '../public/map/handDrawnInterior.js';

const MATERIALS = new Set(['stone', 'fortified', 'timber', 'cave']);
const EXPECTED_TYPES = ['cottage', 'tavern', 'chapel', 'keep', 'market', 'longhouse', 'lair', 'tower', 'hive'];

test('U98: one plan of every building style, unique ids', () => {
  for (const t of EXPECTED_TYPES) assert.ok(PLAN_TYPES.includes(t), `missing a ${t} plan`);
  const ids = PLANS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'plan ids must be unique');
});

test('U98: every plan is well-formed', () => {
  for (const p of PLANS) {
    for (const f of ['id', 'type', 'name', 'material', 'tier', 'entry', 'rooms']) {
      assert.ok(p[f] != null, `${p.id} missing ${f}`);
    }
    // Multi-room plans must be connected — by doors (butting rooms) or corridors
    // (tunnels). Caves/towers/hives legitimately use corridors only.
    if (p.rooms.length > 1) {
      const links = (p.doors || []).length + (p.corridors || []).length;
      assert.ok(links >= 1, `${p.id} multi-room plan has no doors or corridors`);
    }
    assert.ok(MATERIALS.has(p.material), `${p.id} bad material ${p.material}`);
    assert.ok(p.tier >= 1 && p.tier <= 4, `${p.id} tier out of range`);
    assert.ok(Array.isArray(p.rooms) && p.rooms.length >= 1, `${p.id} needs rooms`);

    const roomIds = new Set(p.rooms.map(r => String(r.id)));
    assert.ok(roomIds.has(String(p.entry)), `${p.id} entry '${p.entry}' is not a room`);

    for (const r of p.rooms) {
      assert.equal(typeof r.cx, 'number'); assert.equal(typeof r.cy, 'number');
      if (r.shape === 'round') assert.ok(r.r > 0, `${p.id}.${r.id} round needs r`);
      else { assert.ok(r.w > 0 && r.h > 0, `${p.id}.${r.id} rect needs w/h`); }
      assert.ok(r.name || r.role, `${p.id}.${r.id} needs a name/role`);
    }
    for (const d of (p.doors || [])) {
      assert.equal(typeof d.x, 'number'); assert.equal(typeof d.y, 'number');
      assert.ok(d.orient === 'h' || d.orient === 'v', `${p.id} door bad orient`);
    }
  }
});

test('U98: each plan renders to a valid scene model with exactly one current room', () => {
  for (const p of PLANS) {
    const model = planToSceneModel(p, { currentRoomId: p.entry });
    assert.equal(model.rooms.length, p.rooms.length, `${p.id} room count`);
    assert.equal(model.rooms.filter(r => r.current).length, 1, `${p.id} must have one current room`);
    assert.ok(MATERIALS.has(model.material));
    for (const r of model.rooms) assert.ok(r.shape === 'rect' || r.shape === 'round');
  }
});

test('U98: getPlan resolves by id and by type; fog-of-war filters rooms', () => {
  assert.equal(getPlan('keep_sunken').type, 'keep');
  assert.equal(getPlan('tavern').id, 'tavern_tankard');
  assert.equal(getPlan('nope'), null);

  const keep = getPlan('keep');
  const fogged = planToSceneModel(keep, { currentRoomId: keep.entry, visited: [keep.entry] });
  assert.equal(fogged.rooms.length, 1, 'only the entered room is drawn under fog-of-war');
});
