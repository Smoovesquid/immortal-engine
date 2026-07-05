// U519 — LOAD-2: doors become reciprocal-compass doorways (the crux)
// (docs/briefs/LOAD-2-multiroom-realnode.md §2).
//
// The house-builder tool records a door as `{kind:'door', x, y, room}` — a SINGLE
// room tag (its nearest-wall sample). The loader must recover the OTHER room the door
// joins (the abutting room across that shared wall) to build the room graph the
// engine's reciprocal-compass topology needs. This file asserts that crux:
//   • a door on a wall two rooms share → a topology EDGE (the doorway you go through);
//   • the reciprocal compass holds — leaving A "north" reaches B ⇒ leaving B "south"
//     returns to A (no "walk south forever");
//   • the plan's door DIRECTION agrees with the compass exit (so the drawn door and
//     the direction movement resolves name the same exit);
//   • no room is orphaned; where the drawn doors are ambiguous the loader falls back
//     to abutment, and any still-unreachable room is repaired to connected.
//
// Siblings: U518 (all rooms load), U520 (walk it), U521 (determinism), U522 (guardrails).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { normalizeTopology, interiorCompassLayout, interiorExitsFrom } from '../engine/structures/topology.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { reachableRooms } from '../engine/movement/interiorMovement.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(join(__dirname, 'fixtures', 'loader', 'three_room.house.json'), 'utf8'));
const NODE = 'n_load2_adj';
const DIRS = ['north', 'east', 'south', 'west'];
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };

// ── doors → edges ──────────────────────────────────────────────────────────────

test('U519: an interior door on a shared wall becomes a topology edge', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  // Two interior doors (hall↔west, hall↔east) → two edges. Both edges touch the entry.
  assert.equal(topo.edges.length, 2, 'the two interior doors are the two doorways');
  const entry = topo.rooms.find(r => r.tags.includes('entry')).id;
  for (const e of topo.edges) {
    assert.ok(e.a === entry || e.b === entry, 'each side room connects to the hall');
  }
  // These edges came from DOORS, not the fallback (the fixture draws both interior doors).
  assert.equal(st.__loaderInfo.abutted.length, 0, 'no abutment fallback needed');
  assert.equal(st.__loaderInfo.repaired.length, 0, 'no orphan repair needed');
});

// ── reciprocal compass ───────────────────────────────────────────────────────────

test('U519: the interior compass is reciprocal (A north→B ⇒ B south→A)', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  const exits = interiorCompassLayout(topo);
  for (const r of topo.rooms) {
    const ex = exits.get(r.id);
    for (const d of DIRS) {
      const nb = ex[d];
      if (!nb) continue;
      assert.equal(exits.get(nb)[OPP[d]], r.id,
        `${r.id} ${d}→${nb} must imply ${nb} ${OPP[d]}→${r.id}`);
    }
  }
});

test('U519: a direction with no doorway is a wall (no fold-onto-another-door)', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  // Each side room has exactly ONE doorway (back to the hall) — its other three
  // directions are genuinely walls (null), never an alias of the one real exit.
  for (const r of topo.rooms.filter(r => !r.tags.includes('entry'))) {
    const ex = interiorExitsFrom(topo, r.id);
    const open = DIRS.filter(d => ex[d]);
    assert.equal(open.length, 1, `${r.id} has exactly one doorway`);
  }
});

// ── plan door direction agrees with the compass ─────────────────────────────────

test('U519: each plan door direction matches the compass exit it represents', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  const plan = floorPlan(st);
  const exits = interiorCompassLayout(topo);
  for (const d of plan.doors) {
    if (!d.b) continue; // exterior/front door — direction is outward, not an interior exit
    const compassDir = DIRS.find(dir => (exits.get(d.a) || {})[dir] === d.b);
    assert.ok(compassDir, `door ${d.a}→${d.b} corresponds to a compass exit`);
    assert.equal(d.dir, compassDir, `plan door dir (${d.dir}) must equal the compass exit (${compassDir})`);
  }
});

// ── connectivity — no orphan ─────────────────────────────────────────────────────

test('U519: every room is reachable from the entry (no orphan / soft-lock)', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  const entry = topo.rooms.find(r => r.tags.includes('entry')).id;
  const { dist } = reachableRooms(topo, entry);
  for (const r of topo.rooms) {
    assert.ok(dist.has(r.id), `${r.id} is reachable from the entry`);
  }
});

test('U519: an ambiguous export (abutting rooms, no interior door) falls back to abutment', () => {
  // Two rooms drawn ABUTTING with only a front door — no interior door between them.
  const abut = {
    kind: 'authored-structure', schema: 'house-builder/v7', name: 'Abut',
    rooms: [
      { id: 'a', name: 'A', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
      { id: 'b', name: 'B', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
    ],
    walls: [], openings: [{ kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'a' }],
    tunnels: [], corridors: [], furniture: [], secrets: [],
  };
  const st = loadAuthoredStructure(abut, { nodeId: 'n_abut' });
  const topo = normalizeTopology(st.topology);
  assert.equal(topo.edges.length, 1, 'the abutment fallback connects the two rooms');
  assert.equal(st.__loaderInfo.abutted.length, 1, 'the connection is recorded as an abutment');
  const entry = topo.rooms.find(r => r.tags.includes('entry')).id;
  const { dist } = reachableRooms(topo, entry);
  assert.equal(dist.size, 2, 'both rooms reachable');
});

test('U519: a floating room (no door, no abutment) is REPAIRED to connected, never orphaned', () => {
  // Three rooms; the third floats far away with no door and no shared wall.
  const orphaned = {
    kind: 'authored-structure', schema: 'house-builder/v7', name: 'Orphan',
    rooms: [
      { id: 'hall', name: 'Hall', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
      { id: 'attached', name: 'Attached', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
      { id: 'floater', name: 'Floater', role: 'pantry', shape: 'rect', material: 'timber', x: 40, y: 40, w: 4, h: 4 },
    ],
    walls: [], openings: [
      { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },     // front
      { kind: 'door', x: 16, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },     // hall↔attached
    ],
    tunnels: [], corridors: [], furniture: [], secrets: [],
  };
  const st = loadAuthoredStructure(orphaned, { nodeId: 'n_orphan' });
  const topo = normalizeTopology(st.topology);
  const entry = topo.rooms.find(r => r.tags.includes('entry')).id;
  const { dist } = reachableRooms(topo, entry);
  assert.equal(dist.size, 3, 'ALL three rooms reachable — the floater was repaired in');
  assert.equal(st.__loaderInfo.repaired.length, 1, 'the repair is recorded (flagged, never hidden)');
});
