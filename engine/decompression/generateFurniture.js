// Furniture Generator — deterministic per-node furniture for physical interaction.
// Same node + same seed = same furniture. Used by decompression and the playloop
// so that "examine the table" and "break the chair" have something to act on.

import { seedFromString, makeRng } from '../rng.js';

// Templates: each entry seeds the basic shape; the generator picks a few per node.
// bulk/weight are 0..5; bulk > 2 means too heavy to take.
//
// material: the primary substance — drives destruction outcomes and DM behavior inference.
//   wood→planks+splinters (flammable, medium resistance)
//   iron→immovable, dents only (non-flammable, high resistance)
//   stone→immovable (non-flammable, extreme resistance)
//   glass→shards+loud noise (very fragile)
//   cloth→tears (very flammable, no resistance)
//
// category: interaction class — tells the DM what actions make sense.
//   furniture    → obstacle, can be used as cover or improvised weapon material
//   container    → can hold items, can be opened/searched/broken into
//   light-source → affects env.light when lit; fire/oil hazard
//   storage      → holds tools/goods; breaking reveals contents
//
// hardness: resistance to force (0..5). Feeds DC for "smash"/"break" checks.
//   0=cloth/straw, 1=thin wood/glass, 2=medium wood, 3=reinforced wood,
//   4=iron, 5=stone
const TEMPLATES = [
  {
    name: 'wooden table',
    parts: ['leg', 'plank', 'edge'],
    bulk: 4, weight: 3,
    tags: ['wood', 'furniture'],
    notes: 'rough planks pinned with iron nails',
    material: 'wood', category: 'furniture', hardness: 2
  },
  {
    name: 'wooden chair',
    parts: ['leg', 'seat', 'back'],
    bulk: 2, weight: 2,
    tags: ['wood', 'furniture'],
    notes: 'a worn farmhand chair',
    material: 'wood', category: 'furniture', hardness: 1
  },
  {
    name: 'iron-bound chest',
    parts: ['lid', 'hinge', 'lock'],
    bulk: 3, weight: 4,
    tags: ['wood', 'iron', 'furniture'],
    notes: 'banded with rusted iron',
    material: 'wood', category: 'container', hardness: 3
  },
  {
    name: 'oil lantern',
    parts: ['glass', 'wick', 'reservoir'],
    bulk: 1, weight: 1,
    tags: ['light', 'tool'],
    notes: 'half-full of cheap oil',
    material: 'glass', category: 'light-source', hardness: 1
  },
  {
    name: 'stone basin',
    parts: ['rim', 'bowl'],
    bulk: 5, weight: 5,
    tags: ['stone', 'furniture'],
    notes: 'water sits cold and still',
    material: 'stone', category: 'furniture', hardness: 5
  },
  {
    name: 'wooden crate',
    parts: ['plank', 'lid', 'rope handle'],
    bulk: 2, weight: 2,
    tags: ['wood', 'container'],
    notes: 'stamped with a faded merchant\'s mark',
    material: 'wood', category: 'container', hardness: 1
  },
  {
    name: 'iron brazier',
    parts: ['bowl', 'tripod'],
    bulk: 3, weight: 3,
    tags: ['iron', 'fire'],
    notes: 'cold ash crusts the bottom',
    material: 'iron', category: 'light-source', hardness: 4
  },
  {
    name: 'straw pallet',
    parts: ['ticking', 'straw'],
    bulk: 2, weight: 1,
    tags: ['cloth', 'furniture'],
    notes: 'flat from many sleepers',
    material: 'cloth', category: 'furniture', hardness: 0
  },
  {
    name: 'tool rack',
    parts: ['peg', 'plank'],
    bulk: 3, weight: 2,
    tags: ['wood', 'storage'],
    notes: 'hooks empty save for one frayed strap',
    material: 'wood', category: 'storage', hardness: 2
  }
];

// ── Container contents — the loot a container/storage piece holds ─────────────
// THE_TABLE_TEST: open a chest → the DM states what is inside, or that it is empty
// — never a survey, a roll, or a tease. Contents are derived PURELY from canon
// (seed + nodeId + the piece's name), so a look-inside is stable across re-looks
// and a save/load round-trip WITHOUT adding any hashed world state. The name is a
// per-node-unique key (generateNodeFurniture never repeats a template within a
// node), so the derivation survives furniture-index shifts (e.g. a piece taken or
// broken before the chest is opened). Many containers sit honestly empty.
const CONTAINER_LOOT = [
  'a handful of copper coins', 'a tarnished brass key', 'a stub of tallow candle',
  'a flint-and-steel tinderbox', 'a coil of hempen rope', 'a waxed-leather waterskin',
  'a cloth bundle of hardtack', 'a folded letter, its seal broken', 'a worn whetstone',
  'a bone needle wound with thread', 'a clay vial of lamp-oil', 'a moth-eaten wool blanket',
  'a spare pair of patched boots', 'a carved wooden luck-token', 'a length of waxed twine',
  'a nub of red chalk', 'a horn comb missing two teeth', 'a small mirror of polished tin',
  'a drawstring pouch of dried herbs', 'a fishhook and a hank of line',
];
const STORAGE_LOOT = [
  'a short hand-axe', 'a wooden mallet', 'a flat-bladed chisel', 'a coil of binding wire',
  'a worn rasp', 'a pair of iron tongs', 'a spool of waxed thread', 'a notched wood-plane',
  'a leather-handled awl', 'a whetstone gone smooth with use',
];

/**
 * containerContents(seed, nodeId, name, category) → string[]
 * Deterministic. Returns the named contents of a container/storage piece (1–3
 * items), or [] for an empty one or a non-container. Pure: no state, no RNG leak.
 */
export function containerContents(seed, nodeId, name, category) {
  const cat = String(category || '');
  if (cat !== 'container' && cat !== 'storage') return [];
  const rng = makeRng(seedFromString(`${String(seed || 'seed')}|${String(nodeId || '')}|${String(name || '')}|contents`));
  if (rng.nextFloat() < 0.28) return []; // a fair share of containers are empty
  const pool = cat === 'storage' ? STORAGE_LOOT : CONTAINER_LOOT;
  const n = 1 + rng.int(0, 2); // 1–3 distinct items
  const out = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let idx = rng.int(0, pool.length - 1);
    let tries = 0;
    while (used.has(idx) && tries < pool.length) { idx = (idx + 1) % pool.length; tries++; }
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

/**
 * generateNodeFurniture(nodeId, seed) → furniture[]
 * Deterministic. Returns 2-4 furniture items per node.
 */
export function generateNodeFurniture(nodeId, seed) {
  const nid = String(nodeId || '');
  const s = String(seed || 'seed');
  const rng = makeRng(seedFromString(`${s}|${nid}|furniture`));
  const count = 2 + rng.int(0, 2); // 2-4 items
  const picked = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let idx = rng.int(0, TEMPLATES.length - 1);
    let attempts = 0;
    while (used.has(idx) && attempts < 8) {
      idx = (idx + 1) % TEMPLATES.length;
      attempts++;
    }
    used.add(idx);
    const t = TEMPLATES[idx];
    picked.push({
      name: t.name,
      parts: [...t.parts],
      state: 'intact',
      bulk: t.bulk,
      weight: t.weight,
      tags: [...t.tags],
      notes: t.notes,
      material: t.material,
      category: t.category,
      hardness: t.hardness
    });
  }
  return picked;
}
