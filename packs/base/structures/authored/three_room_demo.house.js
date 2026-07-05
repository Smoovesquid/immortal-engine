// LOAD-2 — the multi-room DEMO plan (docs/briefs/LOAD-2-multiroom-realnode.md).
//
// Data module (JSON-shaped, no logic) so the engine stays fs-free and this file loads
// identically in node and the browser — the SAME convention as loader_demo.house.js
// (LOAD-1) and wake_cottage.house.js (MR-2c). The body below is a minimal
// `house-builder/v7` document — EXACTLY the shape public/house-builder.html's "Export
// JSON" button writes — with THREE rooms: a Hall you enter through the front door, and
// two side rooms (a Bedchamber to one side, a Scullery to the other) each joined to the
// Hall by an interior door on the shared wall. It is the byte-for-byte twin of the test
// fixture tests/fixtures/loader/three_room.house.json (U518 asserts they agree), kept as
// a .js module here purely so the engine demo (applyGeneratedStructuresForNode, gated on
// the 'loaderDemo2' seed) can import it without touching the filesystem.
//
// The loader (engine/structures/authoredStructure.js, loadAuthoredStructure) turns it
// into a walkable three-room structure at boot: it recovers the door→room adjacency
// (each interior door sits on a wall two rooms share), builds the reciprocal-compass
// room graph the engine needs, and drops the player into the Hall — from which "go
// <dir>" walks through a doorway into a side room and back.

export default {
  kind: 'authored-structure',
  schema: 'house-builder/v7',
  name: "Warden's Cottage",
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'hall', name: 'Hall', role: 'hearthroom', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 6 },
    { id: 'west-room', name: 'West Bedchamber', role: 'bedchamber', shape: 'rect', material: 'timber', x: 4, y: 10, w: 6, h: 6 },
    { id: 'east-room', name: 'East Scullery', role: 'scullery', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 6 }
  ],
  walls: [],
  openings: [
    { kind: 'door', x: 13, y: 16, angle: 0, orient: 'h', len: 1, room: 'hall' },
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },
    { kind: 'door', x: 16, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall' },
    { kind: 'window', x: 4, y: 13, angle: 90, orient: 'v', len: 1, room: 'west-room' }
  ],
  tunnels: [],
  corridors: [],
  furniture: [
    { type: 'bed', x: 5, y: 11, w: 2, h: 3, rot: 0, room: 'west-room', ux: 0.3333, uy: 0.5 },
    { type: 'cookpot', x: 18, y: 13, w: 1, h: 1, rot: 0, room: 'east-room', ux: 0.5, uy: 0.5 }
  ],
  secrets: []
};
