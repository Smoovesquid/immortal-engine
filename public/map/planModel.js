/**
 * planModel — the ONE plan-drawing brain (TT-DRAW-3, docs/briefs/
 * TT-DRAW-3-graphpaper-real-plans.md, docs/TABLETOP_MAP.md).
 *
 * A single pure derivation from the engine's floorPlan(structure) into the
 * shape geometry BOTH map surfaces need: rooms sized/shaped/named, corridors
 * bent into orthogonal dog-legs, doors oriented — in floorPlan's own
 * layout-unit space (no world/pixel coordinates, no DOM). Two callers consume
 * it:
 *   - handDrawnInterior.js's floorPlanToSceneModel() layers the interior
 *     view's dynamic overlay on top (current-room highlight, fog-of-war
 *     visited-filter, player/NPC tokens) — this file's extraction changes
 *     NOTHING about what that function returns (guarded by U418's
 *     before/after comparison), so the in-play interior keeps rendering
 *     byte-identically.
 *   - drawModel.js's drawnStructureModel() projects the SAME rooms/doors/
 *     corridors into world units for the outdoor sheet, so a doorway on the
 *     sheet opens onto the same connective tissue (the corridor strip that
 *     bridges floorPlan's own PAD gap between adjacent room boxes) the
 *     interior's hatch-the-rock-band trick already draws. Before this
 *     extraction, drawModel.js derived its OWN independent per-room walls and
 *     never drew corridors at all — since floorPlan() deliberately pads a gap
 *     between adjacent room boxes (the room graph's PAD, floorPlan.js) with a
 *     corridor filling that gap, a per-room-only wall derivation leaves that
 *     gap undrawn: two sealed boxes with dead space between them ("squares
 *     inside of squares"). Corridors are the fix, not a "shared wall" — the
 *     interior view never draws a literal shared wall segment either; it
 *     draws the corridor polygon as its own "void" alongside the rooms, which
 *     visually bridges the gap the same way stone/timber construction would.
 *
 * Pure, deterministic, no engine writes, no Math.random, never serialized or
 * hashed — same discipline as worldSpace.js/drawModel.js.
 */

const SHELL_TO_MATERIAL = { stone: 'stone', fortified: 'fortified', timber: 'timber', cave: 'cave', open: 'stone', round: 'stone', chitin: 'cave' };

/**
 * floorPlanToPlanModel(fp) -> {
 *   material: 'stone'|'fortified'|'timber'|'cave',
 *   rooms: [{ id, shape:'rect'|'round', cx, cy, w, h, r, name }],   // layout units
 *   doors: [{ x, y, orient:'h'|'v', a, b }],                         // layout units; a/b = room ids
 *   corridors: [{ pts:[[x,y]...], w, a, b }]                         // layout units; dog-legged
 * }
 *
 * The pure shape derivation: room sizing/naming, the material-from-shell
 * lookup, corridor dog-leg bending (straight center-to-center segments bent
 * into horizontal-then-vertical passages so hallways read as built, never
 * diagonal funnels), and door orientation. No dynamic overlay (current room,
 * fog, tokens) — callers layer that on top of THIS shape, never re-derive it.
 */
export function floorPlanToPlanModel(fp) {
  const f = fp || {};
  const rooms = (Array.isArray(f.rooms) ? f.rooms : []).map(r => ({
    id: String(r.id),
    shape: r.shape === 'round' ? 'round' : 'rect',
    cx: r.cx, cy: r.cy, w: r.w, h: r.h, r: Math.min(r.w, r.h) / 2,
    name: r.name || r.role || r.id
  }));
  // floorPlan corridors are straight center-to-center segments {ax,ay,bx,by},
  // pushed in lockstep with doors (one corridor + one door per compass edge,
  // same loop in floorPlan.js — corridors[i] and doors[i] always name the same
  // room pair, though the corridor object itself carries no a/b). Bend each
  // into an orthogonal dog-leg (horizontal then vertical) so hallways read as
  // built passages, never diagonal funnels. This strip is the ink that bridges
  // floorPlan's own PAD gap between adjacent room boxes — the connective
  // tissue a per-room-only wall derivation was missing.
  const rawCorridors = Array.isArray(f.corridors) ? f.corridors : [];
  const rawDoors = Array.isArray(f.doors) ? f.doors : [];
  const corridors = rawCorridors.map((c, i) => {
    const ax = c.ax, ay = c.ay, bx = c.bx, by = c.by;
    const pts = (Math.abs(ax - bx) < 0.02 || Math.abs(ay - by) < 0.02)
      ? [[ax, ay], [bx, by]]
      : [[ax, ay], [bx, ay], [bx, by]];
    const pair = rawDoors[i]; // same index, same compass edge (floorPlan.js's shared loop)
    return { pts, w: 0.7, a: pair ? String(pair.a) : undefined, b: pair ? String(pair.b) : undefined };
  });
  const doors = rawDoors.map(d => ({
    x: d.x, y: d.y, orient: (d.dir === 'east' || d.dir === 'west') ? 'v' : 'h', a: String(d.a), b: String(d.b)
  }));
  return {
    material: SHELL_TO_MATERIAL[f.shell] || 'stone',
    rooms, doors, corridors
  };
}
