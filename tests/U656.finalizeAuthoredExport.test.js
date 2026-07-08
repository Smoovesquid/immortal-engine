// U656 — finalizeAuthoredExport + the Builder's Validate & Finalize wiring
// (BUILDING_CANON_CONTRACT §12 export pipeline / §14 repair policy; siblings:
// U654 = the runtime strict gate, U655 = the validation report).
//
// THE LAW: finalization is a GATE, never a repair. A clean draft becomes a finalized
// artifact carrying provenance/validation metadata; a dirty draft is BLOCKED with the
// unreachable room named. The finalized artifact must round-trip through the strict
// runtime loader (it is, by construction, what strict loading will accept), and
// finalization must be deterministic — no timestamps, byte-identical re-finalization —
// so finalized buildings stay stable data (worldHash/replay-safe).
//
// Also pins the Builder wiring: public/house-builder.html must import the ENGINE's
// validator (one algorithm) rather than duplicating the geometry pass in the tool.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  finalizeAuthoredExport,
  loadAuthoredStructure,
} from '../engine/structures/authoredStructure.js';

const CLEAN = {
  kind: 'authored-structure', schema: 'house-builder/v9', name: 'Clean',
  rooms: [
    { id: 'hall', name: 'Hall', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'back', name: 'Back', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
  ],
  walls: [], openings: [
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },
    { kind: 'door', x: 16, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },
  ],
  tunnels: [], corridors: [], furniture: [], secrets: [],
};

const ORPHANED = {
  ...CLEAN, name: 'Orphan',
  rooms: [
    ...CLEAN.rooms,
    { id: 'floater', name: 'Floater', role: 'pantry', shape: 'rect', material: 'timber', x: 40, y: 40, w: 4, h: 4 },
  ],
};

test('U656: finalizing a clean draft yields the provenance/validation block', () => {
  const fin = finalizeAuthoredExport(CLEAN);
  assert.equal(fin.provenance.finalized, true);
  assert.equal(fin.provenance.authoredBy, 'house-builder');
  assert.equal(fin.provenance.validation.ok, true);
  assert.deepEqual(fin.provenance.validation.repaired, [], 'a finalized artifact needed no repair, by definition');
  assert.equal(fin.provenance.validation.roomCount, 2);
  // Everything else is the draft, verbatim:
  assert.deepEqual(fin.rooms, CLEAN.rooms);
  assert.deepEqual(fin.openings, CLEAN.openings);
});

test('U656: the finalized artifact round-trips through the STRICT runtime loader', () => {
  const fin = finalizeAuthoredExport(CLEAN);
  const st = loadAuthoredStructure(fin, { nodeId: 'n_656a', strictFinalized: true });
  assert.equal(st.__loaderInfo.repaired.length, 0);
  // The additive provenance field changes nothing the loader reads:
  assert.deepEqual(st, loadAuthoredStructure(CLEAN, { nodeId: 'n_656a', strictFinalized: true }));
});

test('U656: finalizing a dirty draft is BLOCKED, naming the unreachable room', () => {
  assert.throws(
    () => finalizeAuthoredExport(ORPHANED),
    /cannot finalize.*'floater'.*unreachable.*doorway/is,
    'the author is told which room and what the fix is'
  );
});

test('U656: deterministic — byte-identical re-finalization, draft not mutated', () => {
  const before = JSON.stringify(CLEAN);
  const a = JSON.stringify(finalizeAuthoredExport(CLEAN));
  const b = JSON.stringify(finalizeAuthoredExport(CLEAN));
  assert.equal(a, b, 'no timestamps / per-run state in the artifact');
  assert.equal(JSON.stringify(CLEAN), before, 'finalization never mutates the draft');
  assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}T/, 'no ISO timestamps anywhere in the artifact');
});

test('U656: the Builder imports the ENGINE validator — one algorithm, never a duplicate', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(here, '..', 'public', 'house-builder.html'), 'utf8');
  assert.match(html, /id="btnFinalize"/, 'the Validate & Finalize button exists');
  assert.match(html, /import\('\/engine\/structures\/authoredStructure\.js'\)/, 'validation is the engine loader, imported');
  assert.match(html, /validateAuthoredExport/, 'the Builder calls the shared validator');
  assert.match(html, /finalizeAuthoredExport/, 'the Builder calls the shared finalizer');
});
