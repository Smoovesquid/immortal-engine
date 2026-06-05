import test from 'node:test';
import assert from 'node:assert/strict';

import { RACE_PLANS, RACES, getRacePlan } from '../public/map/plans/races.js';
import { planToSceneModel } from '../public/map/handDrawnInterior.js';

const MATERIALS = new Set(['stone', 'fortified', 'timber', 'cave']);
const EXPECTED = ['elf', 'orc', 'dwarf', 'hobbit', 'wizard', 'gnome', 'giant', 'lizardfolk'];

test('U102: a dwelling for every named race, unique ids', () => {
  for (const r of EXPECTED) assert.ok(RACES.includes(r), `missing ${r}`);
  assert.equal(new Set(RACE_PLANS.map(p => p.id)).size, RACE_PLANS.length);
});

test('U102: every race plan is well-formed and renderable', () => {
  for (const p of RACE_PLANS) {
    for (const f of ['id', 'race', 'name', 'material', 'tier', 'entry', 'rooms']) assert.ok(p[f] != null, `${p.id} missing ${f}`);
    assert.ok(MATERIALS.has(p.material), `${p.id} bad material`);
    const roomIds = new Set(p.rooms.map(r => String(r.id)));
    assert.ok(roomIds.has(String(p.entry)), `${p.id} entry not a room`);
    if (p.rooms.length > 1) assert.ok(((p.doors || []).length + (p.corridors || []).length) >= 1, `${p.id} disconnected`);
    const model = planToSceneModel(p, { currentRoomId: p.entry });
    assert.equal(model.rooms.filter(r => r.current).length, 1, `${p.id} one current room`);
  }
});

test('U102: getRacePlan resolves by race and id', () => {
  assert.equal(getRacePlan('dwarf').id, 'race_dwarf_hall');
  assert.equal(getRacePlan('race_elf_bower').race, 'elf');
  assert.equal(getRacePlan('nope'), null);
});
