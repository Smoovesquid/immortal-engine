import test from 'node:test';
import assert from 'node:assert/strict';

import { floorPlan } from '../engine/structures/floorPlan.js';
import { floorPlanToSceneModel } from '../public/map/handDrawnInterior.js';

function keepStructure() {
  return {
    id: 'keep1', kind: 'building', nodeId: 'n', anchors: { nodeId: 'n' },
    topology: {
      kind: 'rooms',
      rooms: [{ id: 'entry', tags: ['entry'] }, { id: 'hall' }, { id: 'kitchen' }, { id: 'vault' }],
      edges: [{ a: 'entry', b: 'hall' }, { a: 'entry', b: 'kitchen' }, { a: 'hall', b: 'vault' }]
    }
  };
}

test('U95: adapter maps real floorPlan output onto the scene model', () => {
  const fp = floorPlan(keepStructure());
  const model = floorPlanToSceneModel(fp, { currentRoomId: 'entry' });

  assert.ok(['stone', 'fortified', 'timber', 'cave'].includes(model.material), 'material resolved');
  assert.equal(model.rooms.length, fp.rooms.length);
  for (const r of model.rooms) {
    assert.equal(typeof r.cx, 'number');
    assert.equal(typeof r.cy, 'number');
    assert.ok(r.shape === 'rect' || r.shape === 'round');
    assert.ok(r.name, 'room has a display name');
  }
  const entry = model.rooms.find(r => r.id === 'entry');
  assert.equal(entry.current, true, 'current room flagged');
  assert.ok(model.rooms.filter(r => r.current).length === 1, 'exactly one current room');
});

test('U95: door orientation derives from compass dir', () => {
  const fp = floorPlan(keepStructure());
  const model = floorPlanToSceneModel(fp, { currentRoomId: 'entry' });
  assert.equal(model.doors.length, fp.doors.length);
  for (const d of model.doors) assert.ok(d.orient === 'h' || d.orient === 'v');
});

test('U95: corridors become two-point polylines; tokens pass through', () => {
  const fp = floorPlan(keepStructure());
  const tokens = [{ type: 'player', ux: 1, uy: 1 }];
  const model = floorPlanToSceneModel(fp, { currentRoomId: 'entry', tokens });
  for (const c of model.corridors) { assert.equal(c.pts.length, 2); assert.ok(c.w > 0); }
  assert.deepEqual(model.tokens, tokens);
});

test('U95: deterministic', () => {
  const fp = floorPlan(keepStructure());
  assert.deepEqual(floorPlanToSceneModel(fp, { currentRoomId: 'hall' }), floorPlanToSceneModel(fp, { currentRoomId: 'hall' }));
});
