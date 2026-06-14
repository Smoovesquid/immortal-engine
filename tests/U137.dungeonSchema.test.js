// U137 — the Underworld: dungeon schema + generator (docs/WORLD_AND_DUNGEONS.md
// Part B). The schema is the contract for the generator AND the future canvas;
// the generator is deterministic (seed+id+biome → the same place forever) and
// projects cleanly onto the existing interior-crawl topology.

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDungeon, validateDungeon, DUNGEON_SCALES } from '../engine/dungeon/schema.js';
import { generateDungeon, dungeonLevelToStructure, dungeonStructureId, isDungeonStructureId, dungeonRoomAt } from '../engine/dungeon/generate.js';
import { normalizeTopology, adjacentRooms } from '../engine/structures/topology.js';

test('U137-01: normalizeDungeon fills the canonical shape with safe defaults', () => {
  const d = normalizeDungeon({ entranceNodeId: 'n1', levels: [{ rooms: { a: { id: 'a', exits: ['ghost'] } } }] });
  assert.equal(d.scale, 'shrine');           // default
  assert.ok(DUNGEON_SCALES.includes(d.scale));
  assert.equal(d.levels.length, 1);
  assert.equal(d.levels[0].entryRoomId, 'a'); // first room becomes entry
  assert.equal(d.levels[0].rooms.a.role, 'chamber');
  assert.equal(d.levels[0].rooms.a.light, 'dark');
});

test('U137-02: validateDungeon passes a good dungeon and catches dangling exits', () => {
  const good = generateDungeon('mira', 'n1', { biome: 'forest' });
  assert.deepEqual(validateDungeon(good), { ok: true, errors: [] });
  const bad = normalizeDungeon({ entranceNodeId: 'n1', scale: 'shrine', levels: [{ entryRoomId: 'a', rooms: { a: { id: 'a', exits: ['nope'] } } }] });
  const v = validateDungeon(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => /exit "nope"/.test(e)));
});

test('U137-03: generateDungeon is deterministic for the same seed + node + biome', () => {
  const a = generateDungeon('mira', 'n7', { biome: 'mountains' });
  const b = generateDungeon('mira', 'n7', { biome: 'mountains' });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // a different node yields a different dungeon (id + likely theme)
  const c = generateDungeon('mira', 'n8', { biome: 'mountains' });
  assert.notEqual(a.entranceNodeId, c.entranceNodeId);
});

test('U137-04: the shrine is the smallest valid dungeon — one level, one room, one feature', () => {
  const d = generateDungeon('blackvale', 'nShrine', { biome: 'forest', scale: 'shrine' });
  assert.equal(d.scale, 'shrine');
  assert.equal(d.levels.length, 1);
  const rooms = Object.values(d.levels[0].rooms);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].role, 'shrine');
  assert.equal(rooms[0].light, 'dark');
  const feat = rooms[0].contents.find(c => c.kind === 'feature');
  assert.ok(feat && feat.name && feat.look, 'the shrine holds a described feature');
});

test('U137-05: theme tracks the surface biome deterministically', () => {
  // mountains beget mines/holds; the cold keeps crypts — and the same biome
  // always yields the same theme for a given node.
  const m1 = generateDungeon('mira', 'nA', { biome: 'mountains' }).theme;
  const m2 = generateDungeon('mira', 'nA', { biome: 'mountains' }).theme;
  assert.equal(m1, m2);
  assert.ok(['mine', 'hold'].includes(m1), `mountain dungeon theme should be mine/hold, got ${m1}`);
  const marsh = generateDungeon('mira', 'nA', { biome: 'marsh' }).theme;
  assert.ok(['sewer', 'crypt'].includes(marsh), `marsh dungeon theme should be sewer/crypt, got ${marsh}`);
});

test('U137-06: dungeonLevelToStructure projects a navigable structure the crawl accepts', () => {
  const d = generateDungeon('mira', 'n3', { biome: 'desert', scale: 'shrine' });
  const st = dungeonLevelToStructure(d, 0);
  assert.equal(st.kind, 'dungeon');
  assert.equal(st.nodeId, 'n3');
  assert.equal(st.id, dungeonStructureId('n3', 0));
  assert.ok(isDungeonStructureId(st.id));
  // the topology survives the engine's normalizer (the crawl's contract)
  const topo = normalizeTopology(st.topology);
  assert.ok(topo && topo.rooms.length === 1);
  assert.ok(topo.rooms[0].tags.includes('shrine') && topo.rooms[0].tags.includes('entry'));
  assert.deepEqual(adjacentRooms(topo, topo.rooms[0].id), []); // a lone chamber
});

test('U137-07: dungeonRoomAt re-derives the room\'s rich data on demand (never persisted)', () => {
  const room = dungeonRoomAt('blackvale', 'nShrine', 'r:shrine', { biome: 'forest', scale: 'shrine' });
  assert.ok(room, 'room re-derived from seed+node+roomId');
  assert.equal(room.role, 'shrine');
  assert.ok(room.contents.some(c => c.kind === 'feature'));
  // a roomId that does not exist returns null (no throw)
  assert.equal(dungeonRoomAt('blackvale', 'nShrine', 'r:nope', { biome: 'forest', scale: 'shrine' }), null);
});
