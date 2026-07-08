// U655 — validateAuthoredExport: the Builder-side half of the strict-finalized gate
// (BUILDING_CANON_CONTRACT §13–§14; runtime half pinned by U654).
//
// THE LAW: the Builder judges a draft with the ENGINE'S OWN loader (one algorithm),
// and its verdict must AGREE with the runtime gate by construction:
//   validateAuthoredExport(json).ok  ⇔  loadAuthoredStructure(json, {strictFinalized:true}) loads.
//
// Scope pins (v0):
//   • orphan-repaired room → ok:false, with an author-facing error NAMING the
//     unreachable room and the invented connection ("add a doorway" — contract §14
//     first slice: block + tell; sealed/secret flag is a later packet);
//   • abutment fallback (pass 2) stays TOLERATED — ok:true, but reported on .abutted;
//   • malformed input NEVER throws from validate — it becomes errors[] (the report is
//     the author-facing interface);
//   • pure + deterministic: same input → deep-equal report, input not mutated.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAuthoredExport,
  loadAuthoredStructure,
} from '../engine/structures/authoredStructure.js';

// Fixtures mirror U654's (same shapes, so the two halves are pinned against the
// same geometry).
const CLEAN = {
  kind: 'authored-structure', schema: 'house-builder/v9', name: 'Clean',
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

const ORPHANED = {
  kind: 'authored-structure', schema: 'house-builder/v9', name: 'Orphan',
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

const ABUTTING = {
  kind: 'authored-structure', schema: 'house-builder/v9', name: 'Abut',
  rooms: [
    { id: 'a', name: 'A', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'b', name: 'B', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
  ],
  walls: [], openings: [{ kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'a' }],
  tunnels: [], corridors: [], furniture: [], secrets: [],
};

test('U655: clean plan validates ok — and the strict runtime gate agrees', () => {
  const report = validateAuthoredExport(CLEAN);
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.repaired, []);
  assert.equal(report.roomCount, 2);
  // The two halves of the contract agree by construction:
  assert.doesNotThrow(() => loadAuthoredStructure(CLEAN, { nodeId: 'n_655a', strictFinalized: true }));
});

test('U655: orphaned room → ok:false, error NAMES the unreachable room — and strict load rejects', () => {
  const report = validateAuthoredExport(ORPHANED);
  assert.equal(report.ok, false);
  assert.equal(report.repaired.length, 1);
  assert.equal(report.repaired[0].a, 'floater', 'repaired list is in ORIGINAL room-id space (the Builder maps ids to names)');
  assert.match(report.errors[0], /'floater'.*unreachable.*doorway/is, 'the author-facing line names the room and the fix');
  assert.throws(() => loadAuthoredStructure(ORPHANED, { nodeId: 'n_655b', strictFinalized: true }), /orphan repair/);
});

test('U655: abutment fallback is tolerated at v0 — ok:true, but reported', () => {
  const report = validateAuthoredExport(ABUTTING);
  assert.equal(report.ok, true);
  assert.equal(report.abutted.length, 1, 'the inferred shared-wall connection is visible to the author');
  assert.deepEqual(report.repaired, []);
});

test('U655: malformed input never throws — it becomes errors[]', () => {
  let report;
  assert.doesNotThrow(() => { report = validateAuthoredExport({ schema: 'house-builder/v3', rooms: [] }); });
  assert.equal(report.ok, false);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /unsupported schema|no rooms/);
});

test('U655: pure + deterministic — same input, deep-equal report, input not mutated', () => {
  const before = JSON.stringify(ORPHANED);
  const r1 = validateAuthoredExport(ORPHANED);
  const r2 = validateAuthoredExport(ORPHANED);
  assert.deepEqual(r1, r2);
  assert.equal(JSON.stringify(ORPHANED), before, 'validation never mutates the draft');
});
