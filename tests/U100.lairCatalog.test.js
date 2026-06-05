import test from 'node:test';
import assert from 'node:assert/strict';

import { LAIRS, LAIR_ARCHETYPES, getLair } from '../public/map/plans/lairs.js';
import { planToSceneModel } from '../public/map/handDrawnInterior.js';

const MATERIALS = new Set(['stone', 'fortified', 'timber', 'cave']);

test('U100: lair catalog is non-trivial with unique archetypes', () => {
  assert.ok(LAIRS.length >= 16, `expected >=16 lairs, got ${LAIRS.length}`);
  assert.equal(new Set(LAIR_ARCHETYPES).size, LAIR_ARCHETYPES.length, 'archetypes must be unique');
  assert.equal(new Set(LAIRS.map(l => l.id)).size, LAIRS.length, 'ids must be unique');
});

test('U100: every lair is well-formed and renderable', () => {
  for (const l of LAIRS) {
    for (const f of ['id', 'archetype', 'name', 'material', 'tier', 'entry', 'rooms']) {
      assert.ok(l[f] != null, `${l.id} missing ${f}`);
    }
    assert.ok(MATERIALS.has(l.material), `${l.id} bad material`);
    assert.ok(l.tier >= 1 && l.tier <= 4, `${l.id} tier`);
    const roomIds = new Set(l.rooms.map(r => String(r.id)));
    assert.ok(roomIds.has(String(l.entry)), `${l.id} entry not a room`);
    if (l.rooms.length > 1) {
      const links = (l.doors || []).length + (l.corridors || []).length;
      assert.ok(links >= 1, `${l.id} disconnected`);
    }
    const model = planToSceneModel(l, { currentRoomId: l.entry });
    assert.equal(model.rooms.filter(r => r.current).length, 1, `${l.id} one current room`);
  }
});

test('U100: getLair resolves by archetype and id', () => {
  assert.equal(getLair('web_nest').id, 'lair_web_nest');
  assert.equal(getLair('lair_burrow').archetype, 'burrow');
  assert.equal(getLair('nope'), null);
});
