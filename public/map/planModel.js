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
 *   - drawModel.js's drawnStructureModel() projects the SAME rooms/doors into
 *     world units for the outdoor sheet, so a doorway on the sheet is the same
 *     doorway the interior view draws.
 *
 * FP-1 (Tim's ruling 2026-07-04) changed the geometry this model carries: rooms
 * now TILE (floorPlan.js lays adjacent cells so they ABUT along a shared wall)
 * and a doorway is a gap IN that shared wall. Corridors are ABOLISHED — floorPlan()
 * emits an empty `corridors` array, so the corridor mapping below is a no-op kept
 * only so the shape stays stable for every consumer. The old model padded a void
 * between every pair of rooms and bridged it with an auto-generated corridor strip
 * (the "squares inside of squares" Tim saw, and a cluster of sheds joined by
 * breezeways); the geometry now matches the game's own words ("you step through
 * into the pantry"), a doorway opening one room directly into the next.
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
 *   corridors: []                                                    // FP-1: abolished (always empty)
 * }
 *
 * The pure shape derivation: room sizing/naming, the material-from-shell lookup,
 * and door orientation. The `corridors` output is retained (empty) for shape
 * stability — FP-1 abolished corridors (rooms tile and abut). No dynamic overlay
 * (current room, fog, tokens) — callers layer that on top of THIS shape, never
 * re-derive it.
 */
export function floorPlanToPlanModel(fp) {
  const f = fp || {};
  const rooms = (Array.isArray(f.rooms) ? f.rooms : []).map(r => ({
    id: String(r.id),
    shape: r.shape === 'round' ? 'round' : 'rect',
    cx: r.cx, cy: r.cy, w: r.w, h: r.h, r: Math.min(r.w, r.h) / 2,
    name: r.name || r.role || r.id
  }));
  // FP-1: floorPlan() emits no corridors (rooms abut and share walls), so this
  // maps over an empty array and yields []. Kept as a stable field so consumers
  // (handDrawnInterior/drawModel/oneMap) that read `.corridors` need no change;
  // the dog-leg bend below only ever runs if a future authored plan supplies
  // corridors again.
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
