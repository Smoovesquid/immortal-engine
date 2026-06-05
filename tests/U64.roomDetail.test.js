// U64 — furnished rooms (roomDetail).
//
// The structure generator hands us bare rooms ({id, tags}). roomDetail is the
// DM that furnishes them: archetype → room kind → laid-out furniture, all PURE
// and DETERMINISTIC from the room id. This is what the floor-plan render
// (LocalMap.js) and the cover mechanic (coverFeatures.js) both read, so it must
// be identical every call and add nothing to world shape.
//
//   • same room id → byte-identical detail (replays + map never drift),
//   • every furniture piece sits inside the room box (0..1),
//   • non-entry rooms always offer at least one piece of cover,
//   • all rooms in one building share an archetype,
//   • the entry room reads as an entry.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { roomDetail, COVER_BONUS } from '../engine/structures/roomDetail.js';

describe('U64 — furnished rooms', () => {
  it('is deterministic by room id', () => {
    const room = { id: 'room:keep1:3', tags: [] };
    const a = JSON.stringify(roomDetail(room));
    const b = JSON.stringify(roomDetail(room));
    assert.equal(a, b, 'same room id must yield identical detail');
  });

  it('gives every room a name and at least one furniture piece', () => {
    const det = roomDetail({ id: 'room:tav1:2', tags: [] });
    assert.ok(typeof det.name === 'string' && det.name.length > 0, 'rooms are named');
    assert.ok(Array.isArray(det.furniture) && det.furniture.length >= 1, 'rooms are furnished');
  });

  it('keeps furniture inside the room box', () => {
    for (let i = 0; i < 12; i++) {
      const det = roomDetail({ id: `room:s${i}:${i}`, tags: [] });
      for (const f of det.furniture) {
        assert.ok(f.fx >= 0 && f.fx <= 1, `fx in range (${f.fx})`);
        assert.ok(f.fy >= 0 && f.fy <= 1, `fy in range (${f.fy})`);
      }
    }
  });

  it('every non-entry room offers cover', () => {
    for (let i = 0; i < 20; i++) {
      const det = roomDetail({ id: `room:cov${i}:${i + 1}`, tags: [] });
      const hasCover = det.furniture.some(f => f.cover);
      assert.ok(hasCover, `non-entry room ${i} must have cover`);
    }
  });

  it('cover tiers map to D&D bonuses', () => {
    const det = roomDetail({ id: 'room:any1:2', tags: [] });
    for (const f of det.furniture) {
      if (!f.cover) continue;
      assert.ok(f.cover === 'half' || f.cover === 'three-quarter', 'known tier');
      assert.ok(COVER_BONUS[f.cover] >= 2, 'tier has a bonus');
    }
  });

  it('all rooms in one building share an archetype', () => {
    const a = roomDetail({ id: 'room:bld7:1', tags: ['entry'] });
    const b = roomDetail({ id: 'room:bld7:2', tags: [] });
    const c = roomDetail({ id: 'room:bld7:3', tags: [] });
    assert.ok(a.arch && a.arch.length, 'archetype is populated');
    assert.equal(a.arch, b.arch, 'same building → same archetype');
    assert.equal(b.arch, c.arch, 'same building → same archetype');
  });

  it('the entry room is flagged, named, and reads as a lit threshold', () => {
    // Across many buildings, every kind of entry (chapel narthex, tavern taproom,
    // cave maw, hive mouth…) must be marked as the entry and never a back-of-house
    // dark room — daylight spills in from outside the door.
    for (let i = 0; i < 24; i++) {
      const entry = roomDetail({ id: `room:bld${i}:1`, tags: ['entry'] });
      assert.equal(entry.entry, true, `entry ${i} is flagged`);
      assert.ok(typeof entry.name === 'string' && entry.name.length > 0, `entry ${i} is named`);
      assert.equal(entry.dark, 0, `entry ${i} reads as a lit threshold`);
    }
  });

  it('a building has one dominant room far larger than a closet', () => {
    // The silhouette is readable because one room (nave / market floor / great
    // hall / den) dwarfs the small service rooms. Check the spread is real.
    const areas = [];
    for (let n = 1; n <= 8; n++) {
      const d = roomDetail({ id: `room:bldX:${n}`, tags: n === 1 ? ['entry'] : [] });
      areas.push(d.sizeW * d.sizeH);
    }
    const max = Math.max(...areas), min = Math.min(...areas);
    assert.ok(max / min >= 1.5, `room sizes should vary (max ${max}, min ${min})`);
  });
});
