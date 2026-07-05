// MR-2c — an authored house-builder plan (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c).
//
// Data module (JSON-shaped, no logic) so the loader stays fs-free and this file loads
// identically in node and the browser — same convention as content/arcs/*.arc.js and
// content/recipes/*.recipe.js (engine/story/registry.js's header explains why).
//
// The `export default` body below is EXACTLY the shape public/house-builder.html's
// "Export JSON" button writes (schema `house-builder/v5` — see its btnExport handler:
// rooms/walls/openings/tunnels/corridors/furniture). `structureId` is NOT part of the
// tool's export — it is the one field WE add so the loader (authoredPlans.js) knows
// which registered structure this plan overrides.
//
// `structureId` is a SYNTHETIC id (node `n99_mr2c_wake_cottage`) — deliberately NOT
// the shippable slice's actual boot structure (n0_2935788122). An earlier draft of
// this fixture pointed there; live-verifying it showed the position-probe harness
// (scripts/positionProbe.mjs, U497/U499) hardcodes a doorstep-distance assertion
// against THAT structure's specific procgen footprint, and this fixture's drawn
// geometry (a wider building, front door off-centre) tripped it — collateral damage
// on tests this packet didn't touch and must keep green. An authored plan is
// opt-in per structure id; it should never silently rewrite a node other tests
// already assert against. The `n99_` prefix is not arbitrary either: generateStructures.js
// only emits a procgen candidate at all when the node id matches `/^n\d+(?:_|$)/`
// (its "demo trigger" heuristic) — the SAME id shape every real slice node already
// has, so this costs nothing in realism while staying guaranteed collision-free with
// any real node. Wiring one of Tim's real houses onto a REAL slice node is a
// follow-up content decision for whoever picks the location (see the report for
// exactly how) — this fixture's job is proving the loader mechanism end to end.
//
// Shape: two rooms sharing one interior wall (a Hall you enter through the front
// door, and a Bedchamber beyond it), a front door on the Hall's outer wall, an
// interior door in the shared wall, and one window in the Bedchamber's far wall —
// exactly the "2-3 rooms, front door, a window, one interior door" MR-2c asks the
// fixture to prove the loader against.

export default {
  structureId: 'stgen:v27:n99_mr2c_wake_cottage:0',

  kind: 'authored-structure',
  schema: 'house-builder/v5',
  name: 'wake-cottage',
  grid: { cols: 120, rows: 90, cell: 28 },

  rooms: [
    { id: 'hall', name: 'Hall', shape: 'rect', material: 'timber', x: 10, y: 10, w: 6, h: 5 },
    { id: 'bedchamber', name: 'Bedchamber', shape: 'rect', material: 'timber', x: 16, y: 10, w: 5, h: 5 }
  ],

  walls: [],

  // orient is redundant with angle (the tool derives it — see orientOf in
  // house-builder.html) but the export always includes it, so the fixture does too.
  openings: [
    // Front door — Hall's west (outer) wall, angle 90 = a vertical wall (orient 'v').
    { kind: 'door', x: 10, y: 12.5, angle: 90, orient: 'v', len: 1, room: 'hall' },
    // Interior door — the shared wall between Hall and Bedchamber (x=16), vertical.
    { kind: 'door', x: 16, y: 12.5, angle: 90, orient: 'v', len: 1, room: 'hall' },
    // A window in the Bedchamber's east (outer) wall, vertical.
    { kind: 'window', x: 21, y: 12.5, angle: 90, orient: 'v', len: 1, room: 'bedchamber' }
  ],

  tunnels: [],
  corridors: [],
  furniture: []
};
