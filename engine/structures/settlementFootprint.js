/**
 * settlementFootprint — the ONE true footprint source for DECORATIVE settlement
 * buildings (DEC-1, docs/briefs/DEC-1-structure-back-decoratives.md).
 *
 * The problem this closes: a settlement's DECORATIVE buildings (tallow's
 * well / workshop / smithy — `node.settlement.buildings[]` entries with NO
 * `world.structures.byId` record) had no `structureWorldRect` to size against,
 * so the outdoor sheet drew them at the OLD catalog-art scale — the catalog
 * plans' ROOM bounding box (≈9×5 place-units for a cottage plan) rather than a
 * building's true footprint (a real structure's `floorPlan().footprint` is
 * ≈1.7×1.8 LAYOUT UNITS). That is a ~5× per-axis / ~15× area inflation: a WELL,
 * mapped by name to a fallback cottage plan, drew as a whole house (36×20 wu)
 * beside the true-scale cottage (≈6.8×7.2 wu). The last visible root of the
 * "parade-balloon neighbour" class (Tim flagged it three times, 2026-07-04).
 *
 * The fix (option (a) — a canonical per-type footprint TABLE, no new structure
 * records, no STRUCTURE_SCHEMA_VERSION implications, no world-state writes, so
 * worldHash is untouched): every settlement building name resolves to exactly
 * one finite footprint {w,h} in LAYOUT UNITS — the SAME unit `floorPlan().foot-
 * print` uses, so `structureWorldRect(node, frame, anchor, {footprint})` yields
 * a wu rect at the identical scale a real structure of that type would. This one
 * table is consumed two ways, and they agree by construction:
 *   - `syntheticPlanForBuilding(name)` → a minimal, correctly-sized plan the
 *     village layout (placeFromNode.js) seats and the outdoor sheet draws, so a
 *     decorative building's DRAWN art is its true footprint (a room `w` in place-
 *     units draws `w × PLACE_WU` wu; the room's place-unit w/h are numerically
 *     the footprint's layout-unit w/h — one identity, both scale by PLACE_WU).
 *   - drawnStructureModel (drawModel.js) reads the same footprint to emit a true
 *     `rect` for every decorative building, so the drawn MODEL carries a real
 *     rect for EVERY building, never a catalog-scale one.
 *
 * Pure + deterministic: a name string in, a fixed footprint out — no rng, no
 * state, no I/O. Units are LAYOUT UNITS throughout (× worldSpace.PLACE_WU = wu;
 * and 1 wu = one 5-ft tactical cell, drawModel.wuToFt). Nothing here is ever
 * serialized or hashed.
 */

// ── The canonical per-type footprint table (LAYOUT UNITS) ────────────────────
// Sizes are chosen against the live true scale a real structure draws at:
// a real cottage's floorPlan().footprint is ≈1.7×1.8 lu (≈6.8×7.2 wu ≈ 34×36
// ft). Decorative buildings size RELATIVE to that so the village reads to one
// consistent scale:
//   - a WELL is a small feature (0.5×0.5 lu = 2×2 wu = 2×2 cells = 10×10 ft) —
//     the ≤~2×2-cells bound DEC-1/U434 pins; the settlement already carries a
//     proper well-head terrain prop, so the "well" building is just its plot.
//   - a workshop / smithy is a small craft building, a touch larger than a
//     cottage's core (2.0×1.75 lu = 8×7 wu = 40×35 ft).
//   - other named types get plausible small-village dimensions; anything
//     unrecognised falls back to a cottage-ish footprint (DEFAULT), never the
//     inflated catalog room-bbox.
// Keys are lowercase TYPE names (the same vocabulary placeFromNode's NAME_TO_TYPE
// resolves settlement building names into); resolution is substring-based below
// so descriptive names ("meeting hall", "grain store") still land on a type.
export const SETTLEMENT_FOOTPRINTS = Object.freeze({
  well:      { w: 0.5, h: 0.5 },  // 2×2 wu — a small feature, never a house
  smithy:    { w: 2.0, h: 1.75 }, // 8×7 wu — forge + storeroom
  workshop:  { w: 2.0, h: 1.75 }, // 8×7 wu — a craft building (== smithy scale)
  shed:      { w: 1.0, h: 0.9 },  // 4×3.6 wu — an outbuilding
  barn:      { w: 2.6, h: 2.0 },  // stable / granary / warehouse — bigger store
  stable:    { w: 2.6, h: 2.0 },
  cottage:   { w: 1.7, h: 1.8 },  // matches a real cottage's footprint exactly
  farm:      { w: 2.2, h: 1.9 },
  mill:      { w: 2.0, h: 2.2 },
  tavern:    { w: 2.6, h: 2.2 },
  inn:       { w: 2.8, h: 2.4 },
  market:    { w: 2.4, h: 2.0 },
  longhouse: { w: 3.2, h: 1.8 },  // meeting / moot hall — long, low
  hall:      { w: 3.2, h: 1.8 },
  chapel:    { w: 2.0, h: 2.6 },  // shrine / temple — narrow, deep nave
  bathhouse: { w: 2.2, h: 2.0 },
  manor:     { w: 3.4, h: 2.8 },
  tower:     { w: 1.4, h: 1.4 },  // round-ish, compact
  keep:      { w: 3.0, h: 3.0 }
});

// The fallback footprint for any name that resolves to no known type — a small
// cottage-sized building, so an unrecognised settlement building is still true-
// scale, never the catalog room-bbox.
export const DEFAULT_FOOTPRINT = Object.freeze({ w: 1.7, h: 1.6 });

// Name → type resolution, mirroring placeFromNode.js's NAME_TO_TYPE vocabulary
// (settlement building names are descriptive: "meeting hall", "grain store").
// Ordered longest/most-specific-first so "workshop" beats a bare "shop", etc.
const NAME_TO_TYPE = [
  ['well', 'well'],
  ['smith', 'smithy'], ['forge', 'smithy'], ['workshop', 'workshop'], ['work', 'workshop'],
  ['stable', 'stable'], ['granary', 'barn'], ['barn', 'barn'], ['warehouse', 'barn'],
  ['meeting', 'longhouse'], ['moot', 'longhouse'], ['hall', 'hall'],
  ['tavern', 'tavern'], ['alehouse', 'tavern'], ['brew', 'tavern'], ['inn', 'inn'],
  ['temple', 'chapel'], ['shrine', 'chapel'], ['church', 'chapel'], ['chapel', 'chapel'],
  ['market', 'market'], ['store', 'market'], ['stall', 'market'], ['shop', 'market'],
  ['mill', 'mill'], ['manor', 'manor'], ['bath', 'bathhouse'], ['keep', 'keep'],
  ['tower', 'tower'], ['shack', 'shed'], ['shed', 'shed'], ['farm', 'farm'],
  ['cottage', 'cottage'], ['cabin', 'cottage'], ['hut', 'cottage'], ['house', 'cottage']
];

/**
 * settlementBuildingType(name) -> a canonical type key in SETTLEMENT_FOOTPRINTS
 * (or 'cottage' when nothing matches — the DEFAULT_FOOTPRINT case is only for a
 * name that doesn't resolve here at all; callers that want the default use
 * settlementBuildingFootprint, which handles it).
 */
export function settlementBuildingType(name) {
  const nm = String(name || '').toLowerCase();
  for (const [k, t] of NAME_TO_TYPE) if (nm.includes(k)) return t;
  return null;
}

/**
 * settlementBuildingFootprint(name) -> { w, h }  (LAYOUT UNITS, always finite,
 * always positive). The ONE true footprint for a settlement building of this
 * name. Deterministic: same name in, same footprint out, forever.
 */
export function settlementBuildingFootprint(name) {
  const type = settlementBuildingType(name);
  const fp = (type && SETTLEMENT_FOOTPRINTS[type]) || DEFAULT_FOOTPRINT;
  // Defensive clone so callers can never mutate the frozen table entry.
  return { w: Number(fp.w) || DEFAULT_FOOTPRINT.w, h: Number(fp.h) || DEFAULT_FOOTPRINT.h };
}

/**
 * syntheticPlanForBuilding(name) -> a minimal, correctly-sized plan for a
 * DECORATIVE settlement building (placeFromNode.js seats this instead of the
 * inflated catalog plan). Shape matches the subset placeFromNode / worldSpace /
 * oneMap read from a `place.buildings[].plan`:
 *   { id, type, name, material, footprint:{w,h}, rooms:[{ id, shape, cx, cy, w, h }], furniture:[] }
 *
 * ONE room, its box exactly the footprint, centered so the plan's own extent IS
 * the footprint: a room `w`/`h` in PLACE-UNITS draws `w × PLACE_WU` wu on the
 * sheet, and those place-unit numbers are the footprint's LAYOUT-UNIT numbers —
 * so the drawn art is the true footprint, the SAME rect structureWorldRect gives
 * from `{footprint}`. No furniture (a well/shed has no authored interior to
 * spill outside its footprint), so the "no art outside its rect" property holds
 * trivially for the decorative set. `material` picks a plausible roof tone
 * (stone for a smithy/forge, timber otherwise) — cosmetic only.
 */
export function syntheticPlanForBuilding(name) {
  const fp = settlementBuildingFootprint(name);
  const type = settlementBuildingType(name) || 'cottage';
  const material = (type === 'smithy' || type === 'forge' || type === 'keep' || type === 'tower' || type === 'chapel') ? 'stone' : 'timber';
  return {
    id: `deco_${type}`, type, name: String(name || type), material,
    footprint: { w: fp.w, h: fp.h },
    rooms: [{ id: 'main', shape: 'rect', cx: fp.w / 2, cy: fp.h / 2, w: fp.w, h: fp.h }],
    furniture: [],
    decorative: true
  };
}
