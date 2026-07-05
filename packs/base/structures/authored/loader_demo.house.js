// LOAD-1 — the smallest-loader DEMO plan (docs/briefs/LOAD-1-smallest-loader.md).
//
// Data module (JSON-shaped, no logic) so the engine stays fs-free and this file loads
// identically in node and the browser — the SAME convention as wake_cottage.house.js
// (MR-2c) and content/arcs/*.arc.js (engine/story/registry.js's header explains why a
// pure engine path can't fs.readFile / fetch a .json without breaking the browser).
//
// The body below is a minimal `house-builder/v6` document — EXACTLY the shape
// public/house-builder.html's "Export JSON" button writes (see its btnExport handler)
// — with ONE room (a rectangular timber Hut with a bed and a barrel) and one front
// door. It is the byte-for-byte twin of the test fixture
// tests/fixtures/loader/one_room.house.json (U513 asserts they agree), kept as a .js
// module here purely so the engine demo (applyGeneratedStructuresForNode, gated on
// the 'loaderDemo' seed) can import it without touching the filesystem. The loader
// (engine/structures/authoredStructure.js, loadAuthoredStructure) turns it into a
// walkable one-room structure at boot.

export default {
  kind: 'authored-structure',
  schema: 'house-builder/v6',
  name: "Woodcutter's Hut",
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'hut', name: 'Hut', role: 'quarters', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 5 }
  ],
  walls: [],
  openings: [
    { kind: 'door', x: 10, y: 12.5, angle: 90, orient: 'v', len: 1, room: 'hut' }
  ],
  tunnels: [],
  corridors: [],
  furniture: [
    { type: 'bed', x: 11, y: 11, w: 2, h: 3, rot: 0, room: 'hut', ux: 0.3333, uy: 0.5 },
    { type: 'barrel', x: 14, y: 13, w: 1, h: 1, rot: 0, room: 'hut', ux: 0.75, uy: 0.7 }
  ],
  secrets: []
};
