// U658 — the sealed/secret room authoring marker (SEALED-1; BUILDING_CANON_CONTRACT
// §14 resolution flow: "add an opening … or mark this room sealed/secret" — the
// exported plan carries the CHOSEN answer as a `sealed: true` room field).
//
// THE FIELD: `sealed: true` — one explicit boolean on a room record of the
// house-builder export. Never inferred from name, role, darkness, missing doors, or
// geometry; a present-but-non-boolean value is malformed (loud).
//
// THE LAW pinned here:
//   • an unreachable UNSEALED room still blocks validation/finalization (U654–U656,
//     unchanged) — the author is told: add a doorway, or mark it sealed/secret;
//   • the SAME unreachable room marked sealed:true passes validation, finalization,
//     and the strict runtime gate — WITHOUT the loader inventing any traversable
//     edge to it (no pass-2 abutment, no pass-3 repair, no door record): the room is
//     present in the topology (tagged 'sealed') with ZERO edges — a wall in every
//     compass direction. Sealed ≠ silently-repaired-reachable.
//   • sealed-marker contradictions block finalized validation AND strict load (the
//     U655 ok ⇔ strict-load agreement holds with sealed rooms in play): a drawn
//     doorway reaching a sealed room, or a sealed entry room.
//   • draft/non-finalized loading of UNSEALED content is byte-identically tolerant.
//   • no discovery/secret-door gameplay here — sealed is authoring/canon metadata.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAuthoredStructure,
  validateAuthoredExport,
  finalizeAuthoredExport,
  isSealedAuthoredRoom,
} from '../engine/structures/authoredStructure.js';
import { adjacentRooms, interiorExitsFrom } from '../engine/structures/topology.js';

// Same geometry as U654/U655's ORPHANED fixture: hall (entry, front door) ↔ attached,
// plus a floating 'vault' with no door and no shared wall.
const mkPlan = (vaultExtra = {}, openingsExtra = []) => ({
  kind: 'authored-structure', schema: 'house-builder/v10', name: 'Sealed Test',
  rooms: [
    { id: 'hall', name: 'Hall', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'attached', name: 'Attached', role: 'bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 },
    { id: 'vault', name: 'Vault', role: 'vault', shape: 'rect', material: 'stone', x: 40, y: 40, w: 4, h: 4, ...vaultExtra },
  ],
  walls: [], openings: [
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },   // front (exterior)
    { kind: 'door', x: 16, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },   // hall↔attached
    ...openingsExtra,
  ],
  tunnels: [], corridors: [], furniture: [], secrets: [], traps: [],
});

const UNSEALED = mkPlan();                       // floating vault, NOT marked
const SEALED = mkPlan({ sealed: true });         // same vault, explicitly sealed

test('U658: unreachable UNSEALED room still blocks — and the error offers both fixes', () => {
  const report = validateAuthoredExport(UNSEALED);
  assert.equal(report.ok, false);
  assert.equal(report.repaired.length, 1);
  assert.match(report.errors[0], /'vault'.*unreachable.*doorway.*sealed\/secret/is,
    'the author-facing line names the room and BOTH fixes: add a doorway, or mark it sealed/secret');
  assert.throws(() => finalizeAuthoredExport(UNSEALED), /cannot finalize/i);
  assert.throws(() => loadAuthoredStructure(UNSEALED, { nodeId: 'n_658a', strictFinalized: true }), /orphan repair/);
});

test('U658: the SAME room marked sealed:true passes validation + finalization, visibly', () => {
  const report = validateAuthoredExport(SEALED);
  assert.equal(report.ok, true, `expected ok, got errors: ${JSON.stringify(report.errors)}`);
  assert.deepEqual(report.repaired, [], 'nothing was repaired — the room is exempt, not fixed');
  assert.deepEqual(report.sealed, ['vault'], 'the report EXPOSES the intentionally-sealed room');
  const fin = finalizeAuthoredExport(SEALED);
  assert.equal(fin.provenance.finalized, true);
  assert.deepEqual(fin.provenance.validation.sealed, ['vault'], 'provenance records the sealed room — visible intent, nothing hidden');
  assert.deepEqual(fin.provenance.validation.repaired, []);
});

test('U658: a sealed room is NEVER given a traversable edge — strict or default load', () => {
  for (const opts of [{ nodeId: 'n_658b', strictFinalized: true }, { nodeId: 'n_658b' }]) {
    const st = loadAuthoredStructure(SEALED, opts);
    // Canonical ids: entry hall = :1, then alpha (attached=:2, vault=:3).
    const vaultId = `room:authored:n_658b:3`;
    const vaultRoom = st.topology.rooms.find(r => r.id === vaultId);
    assert.ok(vaultRoom, 'the sealed room EXISTS in the topology (present, not deleted)');
    assert.ok(vaultRoom.tags.includes('sealed'), 'the topology room carries the sealed tag');
    assert.equal(st.__loaderInfo.repaired.length, 0, 'no pass-3 invented connection');
    assert.equal(st.__loaderInfo.abutted.length, 0, 'no pass-2 inferred connection');
    assert.ok(!st.topology.edges.some(e => e.a === vaultId || e.b === vaultId),
      'ZERO edges touch the sealed room — it is not traversable topology');
    assert.deepEqual(adjacentRooms(st.topology, vaultId), [], 'movement adjacency: none');
    assert.deepEqual(interiorExitsFrom(st.topology, vaultId),
      { north: null, east: null, south: null, west: null },
      'compass exits: a wall in every direction');
    assert.ok(!st.authoredPlan.doors.some(d => d.a === vaultId || d.b === vaultId),
      'no door record was fabricated for the sealed room');
  }
});

test('U658: strict and default load of the sealed plan are identical (gate-only option)', () => {
  const strict = loadAuthoredStructure(SEALED, { nodeId: 'n_658c', strictFinalized: true });
  const loose = loadAuthoredStructure(SEALED, { nodeId: 'n_658c' });
  assert.deepEqual(strict, loose);
});

test('U658: the finalized sealed artifact round-trips through the strict runtime loader', () => {
  const fin = finalizeAuthoredExport(SEALED);
  assert.doesNotThrow(() => loadAuthoredStructure(fin, { nodeId: 'n_658d', strictFinalized: true }));
});

test('U658: sealed contradictions block — a drawn doorway reaching a sealed room', () => {
  // Move the vault to abut+door onto the hall, keep it marked sealed: ink vs flag.
  const contradiction = mkPlan({ sealed: true, x: 10, y: 16, w: 6, h: 4 },
    [{ kind: 'door', x: 13, y: 16, angle: 0, orient: 'h', len: 1, room: 'vault' }]);
  const report = validateAuthoredExport(contradiction);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(' '), /'vault'.*sealed.*doorway reaches it/is);
  assert.throws(() => loadAuthoredStructure(contradiction, { nodeId: 'n_658e', strictFinalized: true }),
    /sealed-room contradictions/);
  // Draft load stays tolerant: the drawn door still connects (explicit ink wins at load).
  assert.doesNotThrow(() => loadAuthoredStructure(contradiction, { nodeId: 'n_658e' }));
});

test('U658: a sealed ENTRY room blocks finalized validation', () => {
  const entrySealed = JSON.parse(JSON.stringify(UNSEALED));
  entrySealed.rooms = entrySealed.rooms.filter(r => r.id !== 'vault'); // otherwise-clean plan
  entrySealed.rooms[0].sealed = true; // 'hall' — the front-door room
  const report = validateAuthoredExport(entrySealed);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(' '), /entry room 'hall'.*sealed/is);
  assert.throws(() => loadAuthoredStructure(entrySealed, { nodeId: 'n_658f', strictFinalized: true }),
    /sealed-room contradictions/);
});

test('U658: sealed is explicit — a non-boolean value is malformed, never coerced', () => {
  const bad = mkPlan({ sealed: 'yes' });
  assert.throws(() => loadAuthoredStructure(bad, { nodeId: 'n_658g' }), /non-boolean 'sealed'/);
  const report = validateAuthoredExport(bad);
  assert.equal(report.ok, false, 'validate reports it as an error, never throws');
  // And the helper is strictly ===true:
  assert.equal(isSealedAuthoredRoom(SEALED, 'vault'), true);
  assert.equal(isSealedAuthoredRoom(UNSEALED, 'vault'), false);
  assert.equal(isSealedAuthoredRoom(SEALED, 'hall'), false);
});

test('U658: deterministic + non-mutating — byte-identical re-finalization', () => {
  const before = JSON.stringify(SEALED);
  const a = JSON.stringify(finalizeAuthoredExport(SEALED));
  const b = JSON.stringify(finalizeAuthoredExport(SEALED));
  assert.equal(a, b);
  assert.equal(JSON.stringify(SEALED), before, 'the draft is never mutated');
  assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}T/, 'no timestamps in the finalized artifact');
});

test('U658: the Builder round-trips the sealed field (export writes it, import restores it)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(here, '..', 'public', 'house-builder.html'), 'utf8');
  assert.match(html, /id="roomSealed"/, 'the room-level Sealed / secret control exists');
  assert.match(html, /if\(r\.sealed===true\) rec\.sealed=true;/, 'export writes the explicit boolean');
  assert.match(html, /sealed:r\.sealed===true/, 'import restores it strictly (===true)');
  assert.match(html, /house-builder\/v10/, 'the export schema bumped for the new room field');
});
