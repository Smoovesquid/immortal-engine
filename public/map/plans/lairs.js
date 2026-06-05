/**
 * Lair archetype catalog — the homes creatures build.
 *
 * Same plan format as the building catalog, but organic: chambers carved or grown
 * rather than constructed, connected by tunnels (corridors), almost no straight
 * walls or windows. Each carries an `archetype` the creature->home mapping keys on
 * (lairProfileFor), so a spider lands in a web-nest, a wolf in a cave-den, a
 * wraith in a ruin-haunt. The dresser themes contents + tier per creature.
 *
 * Pure data. Rendered by handDrawnInterior via planToSceneModel.
 */

// helper note: round rooms use { shape:'round', cx, cy, r }; tunnels are corridors.

const burrow = {
  id: 'lair_burrow', type: 'lair', archetype: 'burrow', name: 'Burrow', material: 'cave', tier: 1, entry: 'den',
  rooms: [
    { id: 'den', shape: 'round', cx: 5, cy: 6, r: 2.4, name: 'Den', role: 'den' },
    { id: 'nook', shape: 'round', cx: 9, cy: 5, r: 1.4, name: 'Nook', role: 'store' }
  ],
  corridors: [{ pts: [[7.2, 5.6], [7.8, 5.2]], w: 0.7 }],
  mouths: [{ x: 2.7, y: 6, orient: 'v', len: 1 }],
  windows: [],
  furniture: [{ type: 'bed', ux: 3.8, uy: 5.2, uw: 1.6, uh: 1.6 }, { type: 'crate', ux: 8.6, uy: 4.6, uw: 0.8, uh: 0.8 }],
  tags: ['burrow'], hooks: []
};

const warren = {
  id: 'lair_warren', type: 'lair', archetype: 'warren', name: 'Warren', material: 'cave', tier: 2, entry: 'hub',
  rooms: [
    { id: 'hub', shape: 'round', cx: 6, cy: 6, r: 2.2, name: 'Common Burrow', role: 'den' },
    { id: 'c1', shape: 'round', cx: 10, cy: 4, r: 1.3, name: 'Bolt-hole', role: 'den' },
    { id: 'c2', shape: 'round', cx: 10, cy: 8, r: 1.3, name: 'Bolt-hole', role: 'den' },
    { id: 'c3', shape: 'round', cx: 2.5, cy: 9, r: 1.3, name: 'Nest', role: 'den' }
  ],
  corridors: [{ pts: [[8, 5.2], [8.9, 4.4]], w: 0.6 }, { pts: [[7.8, 6.8], [8.9, 7.6]], w: 0.6 }, { pts: [[4.4, 7.4], [3.4, 8.2]], w: 0.6 }],
  mouths: [{ x: 6, y: 3.9, orient: 'h', len: 0.9 }],
  windows: [],
  furniture: [{ type: 'barrel', ux: 5.4, uy: 5.6, uw: 0.8, uh: 0.8 }, { type: 'crate', ux: 6.4, uy: 6.2, uw: 0.8, uh: 0.8 }, { type: 'bed', ux: 9.4, uy: 3.6, uw: 1, uh: 1 }, { type: 'bed', ux: 9.4, uy: 7.6, uw: 1, uh: 1 }],
  tags: ['warren'], hooks: ['warren_overrun']
};

const cave_den = {
  id: 'lair_cave_den', type: 'lair', archetype: 'cave_den', name: 'Cave Den', material: 'cave', tier: 2, entry: 'cave',
  rooms: [
    { id: 'cave', shape: 'round', cx: 5, cy: 6, r: 3, name: 'Den', role: 'den' },
    { id: 'gnaw', shape: 'round', cx: 10, cy: 7, r: 1.8, name: 'Gnaw Hollow', role: 'store' }
  ],
  corridors: [{ pts: [[7.7, 6.4], [8.6, 6.8]], w: 0.9 }],
  mouths: [{ x: 2.2, y: 6, orient: 'v', len: 1.3 }],
  windows: [],
  furniture: [{ type: 'bed', ux: 3.6, uy: 5, uw: 1.8, uh: 1.8 }, { type: 'barrel', ux: 5.6, uy: 4.2, uw: 0.8, uh: 0.8 }, { type: 'crate', ux: 9.4, uy: 6.6, uw: 0.9, uh: 0.9 }],
  tags: ['den'], hooks: []
};

const web_nest = {
  id: 'lair_web_nest', type: 'lair', archetype: 'web_nest', name: 'Web Nest', material: 'cave', tier: 2, entry: 'web',
  rooms: [
    { id: 'web', shape: 'round', cx: 5.5, cy: 6, r: 2.8, name: 'Web Chamber', role: 'den' },
    { id: 'eggs', shape: 'round', cx: 9.5, cy: 8, r: 1.6, name: 'Egg Sac', role: 'store' }
  ],
  corridors: [{ pts: [[7.8, 6.8], [8.4, 7.4]], w: 0.7 }],
  mouths: [{ x: 5.5, y: 3.4, orient: 'h', len: 1 }],
  windows: [],
  furniture: [{ type: 'barrel', ux: 8.9, uy: 7.4, uw: 1.2, uh: 1.2 }, { type: 'chest', ux: 4.4, uy: 6.6, uw: 1.4, uh: 0.9 }],
  tags: ['web'], hooks: ['the_cocoon']
};

const hive_lair = {
  id: 'lair_hive', type: 'lair', archetype: 'hive', name: 'Insect Hive', material: 'cave', tier: 3, entry: 'brood',
  rooms: [
    { id: 'brood', shape: 'round', cx: 6, cy: 6.5, r: 2.6, name: 'Brood Chamber', role: 'den' },
    { id: 'cell1', shape: 'round', cx: 10, cy: 4.2, r: 1.5, name: 'Cell', role: 'store' },
    { id: 'cell2', shape: 'round', cx: 10.5, cy: 8.4, r: 1.6, name: 'Cell', role: 'store' }
  ],
  corridors: [{ pts: [[8.1, 5.6], [8.8, 4.8]], w: 0.7 }, { pts: [[7.9, 7.6], [9.2, 8.1]], w: 0.7 }],
  mouths: [{ x: 6, y: 4, orient: 'h', len: 0.9 }],
  windows: [],
  furniture: [{ type: 'barrel', ux: 5.2, uy: 5.6, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 6.4, uy: 6.4, uw: 0.9, uh: 0.9 }, { type: 'chest', ux: 9.8, uy: 8.1, uw: 1.2, uh: 0.8 }],
  tags: ['hive', 'swarm'], hooks: []
};

const aerie = {
  id: 'lair_aerie', type: 'lair', archetype: 'aerie', name: 'Aerie', material: 'stone', tier: 2, entry: 'perch',
  rooms: [
    { id: 'perch', shape: 'round', cx: 5, cy: 5.5, r: 2.6, name: 'Perch', role: 'den' },
    { id: 'nest', shape: 'round', cx: 9, cy: 7, r: 1.6, name: 'Nest', role: 'store' }
  ],
  corridors: [{ pts: [[7.4, 6], [7.6, 6.6]], w: 0.8 }],
  mouths: [{ x: 5, y: 2.9, orient: 'h', len: 1.6 }],
  windows: [{ x: 2.4, y: 5.5, orient: 'v', t: 'slit' }],
  furniture: [{ type: 'barrel', ux: 8.4, uy: 6.4, uw: 1.2, uh: 1.2 }, { type: 'chest', ux: 4, uy: 5.2, uw: 1.4, uh: 0.9 }, { type: 'crate', ux: 6, uy: 4.4, uw: 0.8, uh: 0.8 }],
  tags: ['aerie', 'flyer'], hooks: []
};

const bog_lair = {
  id: 'lair_bog', type: 'lair', archetype: 'bog_lair', name: 'Bog Lair', material: 'cave', tier: 2, entry: 'sink',
  rooms: [
    { id: 'sink', shape: 'round', cx: 5, cy: 6, r: 2.6, name: 'Mire', role: 'den' },
    { id: 'pool', shape: 'round', cx: 9.5, cy: 5.5, r: 1.8, name: 'Pool', role: 'pool' }
  ],
  corridors: [{ pts: [[7.6, 5.8], [7.9, 5.6]], w: 1 }],
  mouths: [{ x: 5, y: 3.4, orient: 'h', len: 1.2 }],
  windows: [],
  furniture: [{ type: 'crate', ux: 3.8, uy: 5.4, uw: 0.9, uh: 0.9 }, { type: 'chest', ux: 9, uy: 5.1, uw: 1.2, uh: 0.8 }],
  tags: ['bog', 'wet'], hooks: ['the_drowned_cache']
};

const bone_pit = {
  id: 'lair_bone_pit', type: 'lair', archetype: 'bone_pit', name: 'Bone Pit', material: 'cave', tier: 3, entry: 'rim',
  rooms: [
    { id: 'rim', shape: 'round', cx: 5, cy: 5, r: 2, name: 'Rim', role: 'den' },
    { id: 'pit', shape: 'round', cx: 7, cy: 8.5, r: 2.6, name: 'The Pit', role: 'vault' }
  ],
  corridors: [{ pts: [[5.6, 6.7], [6.4, 6.6]], w: 0.9 }],
  mouths: [{ x: 3.1, y: 5, orient: 'v', len: 1 }],
  windows: [],
  furniture: [{ type: 'chest', ux: 6, uy: 8, uw: 1.6, uh: 0.9 }, { type: 'statue', ux: 7.6, uy: 8.2, uw: 1, uh: 1.4 }, { type: 'crate', ux: 4.4, uy: 4.6, uw: 0.8, uh: 0.8 }],
  tags: ['bones', 'undead'], hooks: ['the_charnel_hoard']
};

const ruin_haunt = {
  id: 'lair_ruin', type: 'lair', archetype: 'ruin_haunt', name: 'Ruined Haunt', material: 'stone', tier: 3, entry: 'court',
  rooms: [
    { id: 'court', shape: 'rect', cx: 4, cy: 5, w: 4, h: 4, name: 'Broken Hall', role: 'nave' },
    { id: 'cell', shape: 'rect', cx: 8, cy: 4, w: 2.5, h: 2.5, name: 'Collapsed Room', role: 'crypt' },
    { id: 'undercroft', shape: 'round', cx: 8, cy: 8, r: 1.8, name: 'Undercroft', role: 'vault' }
  ],
  doors: [{ x: 6, y: 4, orient: 'v' }],
  corridors: [{ pts: [[5, 7], [6.6, 7.6]], w: 0.8 }],
  mouths: [{ x: 4, y: 3, orient: 'h', len: 1 }],
  windows: [{ x: 2, y: 5, orient: 'v', t: 'slit' }],
  furniture: [{ type: 'statue', ux: 3, uy: 3.6, uw: 1, uh: 1.4 }, { type: 'altar', ux: 3.4, uy: 5.4, uw: 1.4, uh: 1 }, { type: 'chest', ux: 7.4, uy: 7.6, uw: 1.2, uh: 0.8 }, { type: 'shelf', ux: 7.2, uy: 3, uw: 0.5, uh: 1.8 }],
  tags: ['ruin', 'haunt'], hooks: ['who_haunts_here']
};

const barrow = {
  id: 'lair_barrow', type: 'lair', archetype: 'barrow', name: 'Barrow Mound', material: 'stone', tier: 3, entry: 'passage',
  rooms: [
    { id: 'passage', shape: 'rect', cx: 3.5, cy: 5, w: 2, h: 5, name: 'Passage', role: 'nave' },
    { id: 'chamber', shape: 'round', cx: 7.5, cy: 5, r: 2.4, name: 'Burial Chamber', role: 'vault' }
  ],
  corridors: [{ pts: [[4.5, 5], [5.3, 5]], w: 0.8 }],
  mouths: [{ x: 3.5, y: 7.4, orient: 'h', len: 1 }],
  windows: [],
  furniture: [{ type: 'altar', ux: 6.6, uy: 4.4, uw: 1.6, uh: 1.1 }, { type: 'chest', ux: 7.2, uy: 5.8, uw: 1.4, uh: 0.9 }, { type: 'statue', ux: 8.4, uy: 4.6, uw: 0.9, uh: 1.3 }, { type: 'brazier', ux: 3.2, uy: 3.4, uw: 0.7, uh: 0.7 }],
  tags: ['tomb', 'undead'], hooks: ['the_barrow_wight']
};

const spawning_pool = {
  id: 'lair_spawning_pool', type: 'lair', archetype: 'spawning_pool', name: 'Spawning Pool', material: 'cave', tier: 3, entry: 'shore',
  rooms: [
    { id: 'shore', shape: 'round', cx: 4.5, cy: 5.5, r: 2.2, name: 'Shore', role: 'den' },
    { id: 'pool', shape: 'round', cx: 8.5, cy: 6.5, r: 2.4, name: 'The Pool', role: 'pool' }
  ],
  corridors: [{ pts: [[6.5, 5.9], [6.6, 6.1]], w: 1.1 }],
  mouths: [{ x: 4.5, y: 3.5, orient: 'h', len: 1 }],
  windows: [],
  furniture: [{ type: 'altar', ux: 3.8, uy: 4.9, uw: 1.4, uh: 1 }, { type: 'barrel', ux: 8, uy: 6, uw: 1, uh: 1 }],
  tags: ['spawn', 'aberration'], hooks: ['what_breeds_below']
};

const thicket_den = {
  id: 'lair_thicket', type: 'lair', archetype: 'thicket_den', name: 'Thicket Den', material: 'timber', tier: 1, entry: 'hollow',
  rooms: [
    { id: 'hollow', shape: 'round', cx: 5, cy: 6, r: 2.4, name: 'Hollow', role: 'den' },
    { id: 'cache', shape: 'round', cx: 8.6, cy: 5, r: 1.3, name: 'Cache', role: 'store' }
  ],
  corridors: [{ pts: [[7.1, 5.6], [7.6, 5.3]], w: 0.7 }],
  mouths: [{ x: 5, y: 3.7, orient: 'h', len: 0.9 }],
  windows: [],
  furniture: [{ type: 'bed', ux: 3.9, uy: 5.3, uw: 1.5, uh: 1.5 }, { type: 'chest', ux: 8, uy: 4.6, uw: 1.1, uh: 0.8 }],
  tags: ['thicket', 'fey'], hooks: []
};

const lakebed = {
  id: 'lair_lakebed', type: 'lair', archetype: 'lakebed', name: 'Sunken Lair', material: 'cave', tier: 3, entry: 'mouth',
  rooms: [
    { id: 'mouth', shape: 'round', cx: 4.5, cy: 5, r: 1.8, name: 'Mouth', role: 'den' },
    { id: 'hall', shape: 'round', cx: 8.5, cy: 6.5, r: 2.6, name: 'Drowned Hall', role: 'vault' }
  ],
  corridors: [{ pts: [[6, 5.4], [6.5, 5.9]], w: 1.1 }],
  mouths: [{ x: 4.5, y: 3.4, orient: 'h', len: 1 }],
  windows: [],
  furniture: [{ type: 'chest', ux: 8, uy: 6, uw: 1.4, uh: 0.9 }, { type: 'statue', ux: 9.4, uy: 6.2, uw: 0.9, uh: 1.3 }, { type: 'barrel', ux: 4, uy: 4.6, uw: 0.8, uh: 0.8 }],
  tags: ['sunken', 'wet'], hooks: []
};

const ember_vent = {
  id: 'lair_ember_vent', type: 'lair', archetype: 'ember_vent', name: 'Ember Vent', material: 'cave', tier: 3, entry: 'mouth',
  rooms: [
    { id: 'mouth', shape: 'round', cx: 4.5, cy: 6, r: 2, name: 'Ash Mouth', role: 'den' },
    { id: 'core', shape: 'round', cx: 8.5, cy: 6, r: 2.2, name: 'Magma Core', role: 'vault' }
  ],
  corridors: [{ pts: [[6.3, 6], [6.5, 6]], w: 0.9 }],
  mouths: [{ x: 4.5, y: 4.2, orient: 'h', len: 1 }],
  windows: [],
  furniture: [{ type: 'brazier', ux: 3.9, uy: 5.4, uw: 1, uh: 1 }, { type: 'brazier', ux: 8, uy: 5.4, uw: 1, uh: 1 }, { type: 'chest', ux: 8.2, uy: 6.6, uw: 1.2, uh: 0.8 }],
  tags: ['fire', 'elemental'], hooks: []
};

const crystal_geode = {
  id: 'lair_geode', type: 'lair', archetype: 'crystal_geode', name: 'Crystal Geode', material: 'stone', tier: 3, entry: 'fissure',
  rooms: [
    { id: 'fissure', shape: 'rect', cx: 3.5, cy: 5, w: 2, h: 3, name: 'Fissure', role: 'nave' },
    { id: 'geode', shape: 'round', cx: 7.5, cy: 5.5, r: 2.6, name: 'Geode', role: 'vault' }
  ],
  corridors: [{ pts: [[4.5, 5], [5.1, 5.2]], w: 0.8 }],
  mouths: [{ x: 3.5, y: 3.5, orient: 'h', len: 1 }],
  windows: [],
  furniture: [{ type: 'statue', ux: 7, uy: 4.6, uw: 1, uh: 1.4 }, { type: 'chest', ux: 7, uy: 6, uw: 1.3, uh: 0.8 }, { type: 'column', ux: 8.6, uy: 5, uw: 0.7, uh: 0.7 }],
  tags: ['crystal', 'construct'], hooks: []
};

const nest_cluster = {
  id: 'lair_nest', type: 'lair', archetype: 'nest_cluster', name: 'Nesting Ground', material: 'cave', tier: 2, entry: 'scrape',
  rooms: [
    { id: 'scrape', shape: 'round', cx: 5.5, cy: 6, r: 2.6, name: 'Scrape', role: 'den' },
    { id: 'clutch', shape: 'round', cx: 9.5, cy: 5, r: 1.5, name: 'Clutch', role: 'store' }
  ],
  corridors: [{ pts: [[7.9, 5.6], [8.3, 5.3]], w: 0.8 }],
  mouths: [{ x: 5.5, y: 3.4, orient: 'h', len: 1.2 }],
  windows: [],
  furniture: [{ type: 'barrel', ux: 5, uy: 5.4, uw: 1, uh: 1 }, { type: 'barrel', ux: 9, uy: 4.6, uw: 0.9, uh: 0.9 }, { type: 'chest', ux: 4.4, uy: 6.6, uw: 1.2, uh: 0.8 }],
  tags: ['nest', 'reptile'], hooks: []
};

export const LAIRS = [
  burrow, warren, cave_den, web_nest, hive_lair, aerie, bog_lair, bone_pit,
  ruin_haunt, barrow, spawning_pool, thicket_den, lakebed, ember_vent, crystal_geode, nest_cluster
];
export const LAIR_ARCHETYPES = LAIRS.map(l => l.archetype);
export function getLair(archetypeOrId) {
  const k = String(archetypeOrId || '');
  return LAIRS.find(l => l.archetype === k) || LAIRS.find(l => l.id === k) || null;
}
