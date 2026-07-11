// PROP ART REGISTRY — which engine furniture kinds have CONFIRMED single-object
// GLB art, and whether any render path draws a PLACED piece with that art yet.
//
// Consumed by the Building Builder's palette status chips (house-builder.html)
// and, when it lands, by the placed-piece GLB render path. Rendering stays a
// projection of engine truth (the FUNC-MINIS law): nothing in this file creates
// an object — engine/structures/roomDetail.js FURN is the only object catalog,
// and a kind absent from this file still places fine and renders as ink /
// procedural token. This registry only upgrades the LOOK, never the existence.
//
// Rules of entry (Tim's multi-object rule, 2026-07-10/11):
//   - keys are engine FURN kinds — tests/U685 enforces it;
//   - only ISLAND-CHECKED single-object GLBs. A multi-object catalog sheet
//     NEVER enters here; it stays in miniLibrary.js flagged `sheet: true`
//     until the split pass re-cuts it into per-piece GLBs;
//   - `wired: false` = no render path consumes this GLB for PLACED pieces yet
//     (the Builder shows "has art — needs wiring"). Flip a kind to true only
//     when a placed piece of that kind actually renders with its GLB, and
//     update U685's expectation in the same change;
//   - `source` = where the asset is consumed/registered today:
//     'treeAssets' entries already load live in the 3-D map layer (the canned
//     cottage-interior arrangement in worldAssets — NOT placement-driven);
//     'miniLibrary' entries exist only in the lazy manifest.

// BUILDER-OBJ-2 (2026-07-11): the placed-piece GLB render path now exists
// (figures3d.js buildPropMini prefers glbPropMini, gated on THIS FLAG, before
// falling back to the procedural box) — every `treeAssets`-sourced kind below
// is wired. `rack`'s art lives on the lazy `miniLibrary` loader, which
// buildPropMini does not consume yet (a second, async loading path — parked,
// not a rewrite), so it stays unwired until that follow-up lands.
export const PROP_ART = {
  barrel: { wired: true, minis: [
    { url: '/map/assets/barrel_rustic.glb', source: 'treeAssets' },
    { url: '/map/assets/barrel_wood.glb', source: 'treeAssets' },
  ] },
  bed: { wired: true, minis: [
    { url: '/map/assets/bed_rustic.glb', source: 'treeAssets' },
  ] },
  chest: { wired: true, minis: [
    { url: '/map/assets/chest_iron_a.glb', source: 'treeAssets' },
    { url: '/map/assets/chest_iron_b.glb', source: 'treeAssets' },
  ] },
  hearth: { wired: true, minis: [
    { url: '/map/assets/hearth.glb', source: 'treeAssets' },
  ] },
  table: { wired: true, minis: [
    { url: '/map/assets/table_rustic.glb', source: 'treeAssets' },
  ] },
  chair: { wired: true, minis: [
    { url: '/map/assets/chair_wood.glb', source: 'treeAssets' },
  ] },
  dresser: { wired: true, minis: [
    { url: '/map/assets/dresser_wood.glb', source: 'treeAssets' },
  ] },
  // the cauldron GLB is the cookpot kind's visual — the engine object is and
  // stays 'cookpot' (a GLB never names an object; FUNC-MINIS architecture note).
  // figures3d.js's GLB_KIND_ALIAS maps this kind to treeAssets' 'cauldron' REG entry.
  cookpot: { wired: true, minis: [
    { url: '/map/assets/cauldron.glb', source: 'treeAssets' },
  ] },
  rug: { wired: true, minis: [
    { url: '/map/assets/rug_crimson.glb', source: 'treeAssets' },
  ] },
  rack: { wired: false, minis: [
    { url: '/map/assets/armory_iron.glb', source: 'miniLibrary' },
    { url: '/map/assets/wall_of_blades.glb', source: 'miniLibrary' },
    { url: '/map/assets/armory_arcane.glb', source: 'miniLibrary' },
  ] },
};

export const artForKind = (kind) => PROP_ART[String(kind)] || null;
