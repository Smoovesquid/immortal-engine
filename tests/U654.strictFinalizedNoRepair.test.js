// U654 — the strict-finalized gate (BUILDING_CANON_CONTRACT §14, smallest cut).
//
// THE LAW: finalized authored canon is never repaired at load. A plan whose room
// graph needed pass-3 ORPHAN REPAIR (a connection the author never drew) must be
// REJECTED under { strictFinalized: true } — the fix belongs in the Builder (add a
// doorway, or mark the room sealed), never in runtime.
//
// Scope pins (v0):
//   • default (non-strict) load keeps today's tolerant behavior — repair still
//     happens, still flagged on __loaderInfo.repaired (U527's guarantee, unchanged);
//   • strict load of a clean, fully-doored plan succeeds byte-identically to the
//     non-strict load of the same plan (the option changes NOTHING but the gate);
//   • ABUTMENT fallback (pass 2 — the author drew the rooms touching, only the door
//     is missing) remains TOLERATED under strict at v0, visible on __loaderInfo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { normalizeTopology } from '../engine/structures/topology.js';

// A clean two-room plan: front door + a drawn interior door. No fallback needed.
const CLEAN = {
  kind: 'authored-structure', schema: 'house-builder/v7', name: 'Clean',
  rooms: [
    { id: 'hall', name: 'Hall', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'back', name: 'Back', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
  ],
  walls: [], openings: [
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },   // front (exterior)
    { kind: 'door', x: 16, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },   // hall↔back
  ],
  tunnels: [], corridors: [], furniture: [], secrets: [],
};

// A plan with a FLOATING room: no door to it, no shared wall — pass 3 must invent
// a connection (orphan repair). Same shape as U527's orphan fixture.
const ORPHANED = {
  kind: 'authored-structure', schema: 'house-builder/v7', name: 'Orphan',
  rooms: [
    { id: 'hall', name: 'Hall', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'attached', name: 'Attached', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
    { id: 'floater', name: 'Floater', role: 'pantry', shape: 'rect', material: 'timber', x: 40, y: 40, w: 4, h: 4 },
  ],
  walls: [], openings: [
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },
    { kind: 'door', x: 16, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },
  ],
  tunnels: [], corridors: [], furniture: [], secrets: [],
};

// Two rooms drawn ABUTTING with no interior door — pass-2 abutment fallback territory.
const ABUTTING = {
  kind: 'authored-structure', schema: 'house-builder/v7', name: 'Abut',
  rooms: [
    { id: 'a', name: 'A', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'b', name: 'B', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
  ],
  walls: [], openings: [{ kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'a' }],
  tunnels: [], corridors: [], furniture: [], secrets: [],
};

test('U654: non-strict load still tolerates + flags orphan repair (behavior unchanged)', () => {
  const st = loadAuthoredStructure(ORPHANED, { nodeId: 'n_654a' });
  const topo = normalizeTopology(st.topology);
  assert.equal(topo.rooms.length, 3, 'all three rooms present');
  assert.equal(st.__loaderInfo.repaired.length, 1, 'the repair still happens and is still flagged');
});

test('U654: strictFinalized REJECTS a plan that needed orphan repair, naming the room', () => {
  assert.throws(
    () => loadAuthoredStructure(ORPHANED, { nodeId: 'n_654b', strictFinalized: true }),
    /orphan repair.*'floater'.*never repaired at load/s,
    'throws the loader-style error, with the invented connection identified'
  );
});

test('U654: strictFinalized load of a clean plan succeeds, identical to non-strict', () => {
  const strict = loadAuthoredStructure(CLEAN, { nodeId: 'n_654c', strictFinalized: true });
  const loose = loadAuthoredStructure(CLEAN, { nodeId: 'n_654c' });
  assert.equal(strict.__loaderInfo.repaired.length, 0, 'no repair was needed');
  assert.deepEqual(strict, loose, 'the option changes nothing but the gate');
});

test('U654: strictFinalized still TOLERATES abutment fallback at v0 (flagged, not rejected)', () => {
  const st = loadAuthoredStructure(ABUTTING, { nodeId: 'n_654d', strictFinalized: true });
  assert.equal(st.__loaderInfo.abutted.length, 1, 'abutment connection made and recorded');
  assert.equal(st.__loaderInfo.repaired.length, 0, 'nothing was orphan-repaired');
});
