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
