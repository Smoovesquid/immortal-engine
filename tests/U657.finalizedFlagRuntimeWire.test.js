// U657 — the finalized stamp is HONORED at runtime (BUILDING_CANON_CONTRACT §14,
// the wire-in packet). U654 proved the strict gate works when a caller explicitly
// passes { strictFinalized: true }; THIS test proves the runtime materialization
// helper the authored registry and demo injections use selects strictness FROM THE
// EXPORT ITSELF — `provenance.finalized === true` — with no test-only option.
//
// THE LAW: finished authored canon is loaded as the author's final word (a finalized
// export that would need orphan repair is REJECTED, never silently repaired); draft
// authored content remains forgiving while it is still being worked on.
//
// Scope pins (v0):
//   • strictness comes ONLY from provenance.finalized === true — never inferred from
//     filename, schema, directory, or shape (truthy-but-not-true values do NOT arm it);
//   • a NON-finalized orphan draft still loads tolerantly and still flags the repair
//     on __loaderInfo.repaired (U527/U654 behavior, unchanged);
//   • a finalized CLEAN export loads normally, __loaderInfo.repaired empty;
//   • every builtin registry plan is non-finalized today, so no existing authored
//     fixture becomes strict by this packet (world shape unchanged).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAuthoredStructure,
  materializeAuthoredExport,
  isFinalizedAuthoredExport,
  finalizeAuthoredExport,
  authoredStructureIds,
  authoredRawFor,
  makeAuthoredStructure,
} from '../engine/structures/authoredStructure.js';
import { normalizeTopology } from '../engine/structures/topology.js';

// A clean two-room plan: front door + a drawn interior door (U654's CLEAN shape).
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

// A plan with a FLOATING room — pass-3 orphan repair territory (U654's ORPHANED shape).
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

// Stamp an export finalized WITHOUT the Builder gate — simulating a finalized artifact
// whose plan was corrupted/edited after finalization (the exact case the runtime gate
// exists to catch; finalizeAuthoredExport itself would refuse to produce this).
function stampFinalized(raw) {
  const out = JSON.parse(JSON.stringify(raw));
  out.provenance = { finalized: true, authoredBy: 'house-builder' };
  return out;
}

test('U657: a finalized orphan export is REJECTED by the runtime materialization helper — from the stamp alone', () => {
  const bad = stampFinalized(ORPHANED);
  assert.throws(
    () => materializeAuthoredExport(bad, { nodeId: 'n_657a' }),
    /orphan repair.*'floater'.*never repaired at load/s,
    'strictness came from provenance.finalized === true, not from an explicit option'
  );
});

test('U657: a non-finalized orphan DRAFT still loads tolerantly, repair flagged', () => {
  const st = materializeAuthoredExport(ORPHANED, { nodeId: 'n_657b' });
  const topo = normalizeTopology(st.topology);
  assert.equal(topo.rooms.length, 3, 'all three rooms present (repair connected the floater)');
  assert.equal(st.__loaderInfo.repaired.length, 1, 'the repair happened and is flagged');
});

test('U657: a finalized CLEAN export loads normally — genuinely via the Builder gate', () => {
  const finalized = finalizeAuthoredExport(CLEAN, { structureId: 'u657:clean' });
  assert.equal(isFinalizedAuthoredExport(finalized), true, 'the Builder stamp is present');
  const st = materializeAuthoredExport(finalized, { nodeId: 'n_657c' });
  assert.equal(st.__loaderInfo.repaired.length, 0, 'no repair was needed');
  // The stamp changes NOTHING but the gate: same structure as the unstamped draft.
  const loose = materializeAuthoredExport(CLEAN, { nodeId: 'n_657c' });
  assert.deepEqual(st, loose, 'finalized clean load is byte-identical to the draft load');
});

test('U657: the stamp is EXACTLY provenance.finalized === true — never inferred', () => {
  assert.equal(isFinalizedAuthoredExport(stampFinalized(CLEAN)), true);
  assert.equal(isFinalizedAuthoredExport(CLEAN), false, 'no provenance → draft');
  assert.equal(isFinalizedAuthoredExport({ ...CLEAN, provenance: { finalized: 'true' } }), false, 'string "true" does not arm strict');
  assert.equal(isFinalizedAuthoredExport({ ...CLEAN, provenance: { finalized: 1 } }), false, 'truthy 1 does not arm strict');
  assert.equal(isFinalizedAuthoredExport({ ...CLEAN, provenance: {} }), false);
  assert.equal(isFinalizedAuthoredExport(null), false);
  // And the loader honors the non-flag: a truthy-but-not-true stamp on an orphan
  // still loads tolerantly (drafts stay forgiving).
  const notQuite = { ...JSON.parse(JSON.stringify(ORPHANED)), provenance: { finalized: 'true' } };
  const st = materializeAuthoredExport(notQuite, { nodeId: 'n_657d' });
  assert.equal(st.__loaderInfo.repaired.length, 1, 'still tolerant');
});

test('U657: direct loadAuthoredStructure stays tolerant even for a stamped export (opt-in only at the materialization path)', () => {
  const bad = stampFinalized(ORPHANED);
  const st = loadAuthoredStructure(bad, { nodeId: 'n_657e' });
  assert.equal(st.__loaderInfo.repaired.length, 1, 'direct calls keep default tolerance unless the caller passes strictFinalized');
});

test('U657: no builtin registry plan is finalized today — nothing existing became strict', () => {
  const ids = authoredStructureIds();
  assert.ok(ids.length >= 1, 'registry has at least the wake cottage');
  for (const id of ids) {
    const raw = authoredRawFor(id);
    assert.equal(isFinalizedAuthoredExport(raw), false, `registered plan '${id}' is a draft — behavior unchanged`);
    const st = makeAuthoredStructure(id, 'n_657f');
    assert.ok(st && st.id === id, `registry materialization for '${id}' still loads`);
  }
});
