// U522 — LOAD-2: malformed/disconnected fails loudly or auto-repairs, and the DEFAULT
// game boot is byte-identical (docs/briefs/LOAD-2-multiroom-realnode.md §Tests).
//
// Two guardrails:
//   1. A malformed export THROWS a clear error (never silently corrupts state); a
//      DISCONNECTED building is auto-repaired to connected (never a soft-lock). The
//      demo wire-in catches a throw and degrades to procgen (asserted via the seam).
//   2. The default game is untouched: the LOAD-2 attach is gated ENTIRELY on the
//      'loaderDemo2' seed, so a normal boot (slice seed, tallow demo, any other seed)
//      carries NO 'authored:' structure and hashes exactly as before this packet.
//
// Siblings: U518 (all rooms load), U519 (door→adjacency), U520 (walk it), U521 (determinism).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { applyGeneratedStructuresForNode, authoredHouseForNode } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { ensureWorld, newWorld } from '../engine/state.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { reachableRooms } from '../engine/movement/interiorMovement.js';

// ── 1. malformed fails loudly ────────────────────────────────────────────────────

test('U522: an unsupported schema fails loudly', () => {
  assert.throws(
    () => loadAuthoredStructure({ schema: 'house-builder/v4', rooms: [{ id: 'x', w: 1, h: 1 }] }, { nodeId: 'n' }),
    /unsupported schema/i);
});

test('U522: no rooms fails loudly', () => {
  assert.throws(() => loadAuthoredStructure({ schema: 'house-builder/v7', rooms: [] }, { nodeId: 'n' }), /no rooms/i);
});

test('U522: a room with a non-positive footprint fails loudly', () => {
  assert.throws(
    () => loadAuthoredStructure({ schema: 'house-builder/v7', rooms: [{ id: 'x', w: 0, h: 5 }] }, { nodeId: 'n' }),
    /w>0 and h>0/i);
});

test('U522: a duplicate room id fails loudly', () => {
  assert.throws(() => loadAuthoredStructure({
    schema: 'house-builder/v7',
    rooms: [{ id: 'dup', w: 3, h: 3 }, { id: 'dup', w: 3, h: 3 }],
  }, { nodeId: 'n' }), /duplicate room id/i);
});

test('U522: an opening with an unknown kind fails loudly', () => {
  assert.throws(() => loadAuthoredStructure({
    schema: 'house-builder/v7',
    rooms: [{ id: 'a', w: 3, h: 3 }],
    openings: [{ kind: 'trapdoor', x: 1, y: 1 }],
  }, { nodeId: 'n' }), /unknown kind/i);
});

test('U522: a bad structureId derivation fails loudly (no nodeId, no structureId)', () => {
  assert.throws(() => loadAuthoredStructure({
    schema: 'house-builder/v7', rooms: [{ id: 'a', w: 3, h: 3 }],
  }, {}), /cannot derive a structureId/i);
});

// ── 1b. disconnected auto-repairs (never soft-locks) ─────────────────────────────

test('U522: a fully-disconnected multi-room export is repaired to connected', () => {
  // Three rooms, NO openings at all, none abutting — every room would be an island.
  const scattered = {
    schema: 'house-builder/v7', name: 'Scattered',
    rooms: [
      { id: 'a', name: 'A', role: 'hearthroom', shape: 'rect', material: 'timber', x: 0, y: 0, w: 4, h: 4 },
      { id: 'b', name: 'B', role: 'bedchamber', shape: 'rect', material: 'timber', x: 20, y: 0, w: 4, h: 4 },
      { id: 'c', name: 'C', role: 'pantry', shape: 'rect', material: 'timber', x: 40, y: 0, w: 4, h: 4 },
    ],
    walls: [], openings: [], tunnels: [], corridors: [], furniture: [], secrets: [],
  };
  const st = loadAuthoredStructure(scattered, { nodeId: 'n_scattered' });
  const topo = normalizeTopology(st.topology);
  const entry = topo.rooms.find(r => r.tags.includes('entry'))?.id || topo.rooms[0].id;
  const { dist } = reachableRooms(topo, entry);
  assert.equal(dist.size, 3, 'all three islands were repaired into one connected building');
  assert.equal(st.__loaderInfo.repaired.length, 2, 'two repairs joined the three islands');
});

// ── 2. the DEFAULT boot is byte-identical ────────────────────────────────────────

test('U522: a non-demo node gets NO authored building (default game untouched)', () => {
  // A normal world at a normal node — applyGeneratedStructuresForNode must not inject
  // any 'authored:' structure (the LOAD-2 attach is seed-gated).
  let w = ensureWorld(newWorld({ seed: 'tallow', campaignId: 'c' }));
  // Give it a node to attach at.
  w = ensureWorld({ ...w, map: { ...w.map, nodes: [{ id: 'n5_demo', name: 'Some Place', nodeType: 'settlement', tags: [] }], currentNodeId: 'n5_demo' } });
  const out = applyGeneratedStructuresForNode(w, 'n5_demo');
  const authored = Object.keys(out.structures?.byId || {}).filter(id => id.startsWith('authored:'));
  assert.equal(authored.length, 0, 'no authored building on a non-demo seed');
});

test('U522: applyGeneratedStructuresForNode is a no-op for the default seed at a bare node', () => {
  // At a node procgen skips (id not matching /^n\d+/) with a non-demo seed, the seam
  // returns the world unchanged — the exact byte-identical early-out.
  let w = ensureWorld(newWorld({ seed: 'tallow', campaignId: 'c' }));
  w = ensureWorld({ ...w, map: { ...w.map, nodes: [{ id: 'placeX', name: 'X', nodeType: 'settlement', tags: [] }], currentNodeId: 'placeX' } });
  const before = JSON.stringify(w.structures);
  const out = applyGeneratedStructuresForNode(w, 'placeX');
  assert.equal(JSON.stringify(out.structures), before, 'structures untouched for the default game');
});

// ── 3. the node-keyed registry resolves a real place ─────────────────────────────

test('U522: the node-keyed registry maps Crowfoot Camp → the authored house (brief §3)', () => {
  // The registry keys by node predicate (name), so it lands on the real slice node
  // regardless of its seed-derived id. A non-registered node returns null.
  assert.ok(authoredHouseForNode({ name: 'Crowfoot Camp', tags: ['camp'] }), 'Crowfoot Camp has a registered house');
  assert.equal(authoredHouseForNode({ name: 'Aldermere' }), null, 'the town has none');
  assert.equal(authoredHouseForNode(null), null, 'a missing node is safe');
});

test('U522: the LOAD-2 demo seed attaches the multi-room building at its node', () => {
  // Under the demo seed, a settlement node gets the authored three-room cottage.
  let w = ensureWorld(newWorld({ seed: 'loaderDemo2', campaignId: 'c' }));
  w = ensureWorld({ ...w, map: { ...w.map, nodes: [{ id: 'n3_demo', name: 'Trailside', nodeType: 'settlement', tags: [] }], currentNodeId: 'n3_demo' } });
  const out = applyGeneratedStructuresForNode(w, 'n3_demo');
  const st = out.structures.byId['authored:n3_demo'];
  assert.ok(st, 'the demo building attached');
  assert.equal(normalizeTopology(st.topology).rooms.length, 3, 'all three rooms');
});
