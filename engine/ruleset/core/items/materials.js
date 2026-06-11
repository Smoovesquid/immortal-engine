// Material definitions — P-70, the first rung of docs/SALVAGE_AND_BUILD.md.
// Destruction yields these; crafting (P-71) and building (P-72) consume them.
// Stackable (instances carry qty). Some swing: `improvised` marks a material
// usable as a weapon — RAW improvised rules, 1d4-ish, no proficiency bonus.

function mat(defRef, name, weight, basePrice, extra = {}) {
  return { defRef, name, kind: 'material', slot: null, weight, rarity: 'common', basePrice, ...extra };
}

export const board = mat('board', 'Board', 3, 0.05, {
  slot: 'main_hand',
  improvised: { dice: '1d4', type: 'bludgeoning' }
});

export const timber = mat('timber', 'Timber Beam', 12, 0.3);

export const stone_chunk = mat('stone_chunk', 'Stone Chunk', 5, 0.02, {
  slot: 'main_hand',
  improvised: { dice: '1d4', type: 'bludgeoning' }
});

export const iron_fitting = mat('iron_fitting', 'Iron Fitting', 1, 0.2);
export const nails = mat('nails', 'Handful of Nails', 0.25, 0.05);
export const hide_scrap = mat('hide_scrap', 'Hide Scrap', 1, 0.1);
export const cordage = mat('cordage', 'Cordage', 0.5, 0.1);
export const cloth_scrap = mat('cloth_scrap', 'Cloth Scrap', 0.5, 0.02);
export const straw_bundle = mat('straw_bundle', 'Straw Bundle', 1, 0.01);
export const glass_shard = mat('glass_shard', 'Glass Shard', 0.1, 0.01, {
  slot: 'main_hand',
  improvised: { dice: '1d4', type: 'slashing' }
});
export const oil_flask_salvaged = mat('oil_flask_salvaged', 'Flask of Lamp Oil', 1, 0.1);

// ── salvage yields ───────────────────────────────────────────────────────────
// What a destroyed object gives up, derived from its TAGS (so every piece of
// furniture ever generated — including ones in old saves — salvages without a
// data migration). Counts scale with bulk; rng is the caller's seeded stream.

const TAG_YIELDS = {
  wood: (bulk, rng) => [
    { defRef: 'board', qty: Math.max(1, rng.int(1, Math.max(1, Math.ceil(bulk / 1.5)))) },
    ...(rng.nextFloat() < 0.4 ? [{ defRef: 'nails', qty: 1 }] : [])
  ],
  iron: (bulk, rng) => [{ defRef: 'iron_fitting', qty: rng.int(1, Math.max(1, Math.ceil(bulk / 2))) }],
  stone: (bulk, rng) => [{ defRef: 'stone_chunk', qty: rng.int(1, Math.max(1, Math.ceil(bulk / 2))) }],
  cloth: (bulk, rng) => [{ defRef: 'cloth_scrap', qty: rng.int(1, 2) }],
  straw: (_bulk, _rng) => [{ defRef: 'straw_bundle', qty: 1 }],
  light: (_bulk, rng) => [
    { defRef: 'glass_shard', qty: 1 },
    ...(rng.nextFloat() < 0.6 ? [{ defRef: 'oil_flask_salvaged', qty: 1 }] : [])
  ],
  rope: (_bulk, _rng) => [{ defRef: 'cordage', qty: 1 }],
  leather: (_bulk, rng) => [{ defRef: 'hide_scrap', qty: rng.int(1, 2) }]
};

/**
 * salvageYield(furniture, rng) -> [{defRef, qty}] (merged by defRef).
 * Deterministic given the caller's seeded rng. Untagged objects still give
 * one board's worth of wreckage — destruction is never a dead end.
 */
export function salvageYield(furniture, rng) {
  const tags = Array.isArray(furniture?.tags) ? furniture.tags.map(t => String(t).toLowerCase()) : [];
  const bulk = Math.max(1, Number(furniture?.bulk) || 2);
  const out = {};
  let any = false;
  for (const tag of tags) {
    const fn = TAG_YIELDS[tag];
    if (!fn) continue;
    any = true;
    for (const y of fn(bulk, rng)) out[y.defRef] = (out[y.defRef] || 0) + y.qty;
  }
  if (!any) out.board = 1;
  return Object.entries(out).map(([defRef, qty]) => ({ defRef, qty }));
}
