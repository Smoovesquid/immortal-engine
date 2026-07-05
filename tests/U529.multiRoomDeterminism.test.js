// U529 — LOAD-2: determinism — same export → identical structure, and worldHash is
// stable across a multi-room walk (docs/briefs/LOAD-2-multiroom-realnode.md §Tests).
//
// Authored content is FIXED data (like a pack): the loader is pure (no rng /
// Math.random / I/O), so the same house-builder export always yields a byte-identical
// structure, and a world carrying it hashes stably under an export/import round-trip.
// A walk through the building advances state deterministically — the SAME actions from
// the SAME seed reach the SAME worldHash. This is the determinism-by-seed invariant
// (U21 class) extended to the authored multi-room path.
//
// Siblings: U526 (all rooms load), U527 (door→adjacency), U528 (walk it), U530 (guardrails).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ensureWorld, newWorld } from '../engine/state.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { ensureStructures } from '../engine/structures/structuresState.js';
import { enterStructureInterior, moveWithinInterior } from '../engine/structures/interiors.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(join(__dirname, 'fixtures', 'loader', 'three_room.house.json'), 'utf8'));
const NODE = 'n_load2_det';

function worldWith(seed = 'load2det') {
  let w = ensureWorld(newWorld({ seed, campaignId: 'c' }));
  const nid = String(w.map?.currentNodeId || 'n_x');
  const st = loadAuthoredStructure(FIXTURE, { nodeId: nid });
  w = ensureWorld({ ...w, structures: ensureStructures({ byId: { [st.id]: st }, nextId: 1 }) });
  return { w, structId: st.id };
}

// A fixed room-to-room walk over the SAME structure (entry → each side room → back).
function walk(w0, structId) {
  let w = enterStructureInterior(w0, structId);
  const entry = w.scene.interior.roomId;
  const topo = normalizeTopology(w0.structures.byId[structId].topology);
  for (const r of topo.rooms.filter(r => r.id !== entry).map(r => r.id)) {
    w = moveWithinInterior(w, r);
    w = moveWithinInterior(w, entry);
  }
  return w;
}

test('U529: the loader is pure — same export in, byte-identical structure out, twice', () => {
  const a = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const b = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  assert.deepEqual(a, b);
  // And structurally stable across an ensureStructures round-trip.
  const back = ensureStructures({ byId: { [a.id]: a }, nextId: 1 }).byId[a.id];
  assert.deepEqual(normalizeTopology(back.topology), normalizeTopology(a.topology));
  assert.deepEqual(back.authoredPlan, a.authoredPlan);
});

test('U529: the loader introduces no ordering nondeterminism (room authoring order does not matter)', () => {
  const rev = { ...FIXTURE, rooms: [...FIXTURE.rooms].reverse() };
  const a = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const b = loadAuthoredStructure(rev, { nodeId: NODE });
  // normalizeTopology sorts rooms + edges, so the stored topology is identical
  // regardless of the order rooms appear in the export.
  assert.deepEqual(normalizeTopology(a.topology), normalizeTopology(b.topology));
});

test('U529: a world carrying the building hashes stably across an export/import round-trip', () => {
  const { w } = worldWith();
  const h1 = worldHash(w);
  const h2 = worldHash(ensureWorld(JSON.parse(JSON.stringify(w))));
  assert.equal(h1, h2, 'worldHash is stable under replay (the U21 invariant)');
});

test('U529: the SAME walk from the SAME seed reaches the SAME worldHash', () => {
  const a = worldWith('load2det');
  const b = worldWith('load2det');
  const wa = walk(a.w, a.structId);
  const wb = walk(b.w, b.structId);
  assert.equal(worldHash(wa), worldHash(wb), 'determinism-by-seed across a multi-room walk');
});
