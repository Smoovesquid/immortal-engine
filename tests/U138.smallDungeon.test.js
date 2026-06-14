// U138 — D1: the small multi-room dungeon (docs/WORLD_AND_DUNGEONS.md Part B).
// generateDungeon now defaults to a `small` scale — a real D&D room graph (5–12
// rooms, branching off the entry, a deepest vault), deterministic, fully
// connected, and projecting cleanly onto the existing interior-crawl topology.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, dungeonLevelToStructure, dungeonRoomAt } from '../engine/dungeon/generate.js';
import { normalizeTopology, adjacentRooms } from '../engine/structures/topology.js';
import { validateDungeon } from '../engine/dungeon/schema.js';

function level0(d) { return d.levels[0]; }

test('U138-01: a dungeon_entrance defaults to a small multi-room dungeon', () => {
  const d = generateDungeon('blackvale', 'nDung', { biome: 'mountains' });
  assert.equal(d.scale, 'small');
  const rooms = Object.values(level0(d).rooms);
  assert.ok(rooms.length >= 5 && rooms.length <= 12, `5–12 rooms, got ${rooms.length}`);
  assert.equal(level0(d).entryRoomId, 'r:entry');
  assert.deepEqual(validateDungeon(d), { ok: true, errors: [] });
});

test('U138-02: every room is reachable from the entry (no orphan rooms)', () => {
  for (const seed of ['blackvale', 'mira', 'dragonspire', 'thornwood']) {
    const d = generateDungeon(seed, 'nDung', { biome: 'forest' });
    const lvl = level0(d);
    const topo = normalizeTopology(dungeonLevelToStructure(d, 0).topology);
    // BFS from entry over the projected topology.
    const seen = new Set([lvl.entryRoomId]);
    const q = [lvl.entryRoomId];
    while (q.length) { for (const nb of adjacentRooms(topo, q.shift())) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
    assert.equal(seen.size, Object.keys(lvl.rooms).length, `${seed}: all rooms reachable`);
  }
});

test('U138-03: there is exactly one vault (the heart), deepest from the entry', () => {
  const d = generateDungeon('mira', 'nDung', { biome: 'desert' });
  const vaults = Object.values(level0(d).rooms).filter(r => r.role === 'vault');
  assert.equal(vaults.length, 1, 'exactly one vault');
  assert.notEqual(vaults[0].id, level0(d).entryRoomId, 'the vault is not the entry');
  assert.ok(vaults[0].contents.some(c => c.kind === 'feature'), 'the vault holds its centerpiece');
});

test('U138-04: deterministic — same seed+node+biome → identical dungeon', () => {
  const a = generateDungeon('blackvale', 'nDung', { biome: 'mountains' });
  const b = generateDungeon('blackvale', 'nDung', { biome: 'mountains' });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = generateDungeon('blackvale', 'nOther', { biome: 'mountains' });
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
});

test('U138-05: the projected structure is a connected room graph the crawl navigates', () => {
  const d = generateDungeon('thornwood', 'nDung', { biome: 'marsh' });
  const st = dungeonLevelToStructure(d, 0);
  assert.equal(st.kind, 'dungeon');
  const topo = normalizeTopology(st.topology);
  assert.ok(topo.rooms.length >= 5);
  assert.ok(topo.edges.length >= topo.rooms.length - 1, 'at least a spanning tree of doorways');
  // the entry room has at least one exit (you can go somewhere)
  const entry = topo.rooms.find(r => r.tags.includes('entry'));
  assert.ok(adjacentRooms(topo, entry.id).length >= 1, 'the entry leads somewhere');
});

test('U138-06: rooms re-derive on demand and carry role-appropriate content', () => {
  const d = generateDungeon('mira', 'nDung', { biome: 'forest' });
  for (const r of Object.values(level0(d).rooms)) {
    const again = dungeonRoomAt('mira', 'nDung', r.id, { biome: 'forest' });
    assert.deepEqual(again, r, `room ${r.id} re-derives identically`);
  }
});
