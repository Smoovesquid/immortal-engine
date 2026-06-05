/**
 * Race building styles — culturally distinct dwellings.
 *
 * Same plan format, themed per people: elves flow through round timber bowers,
 * dwarves cut axial stone halls, hobbits curl into round smials, orcs throw up
 * crude war-halls, wizards clutter a stone sanctum. The `race` field lets the
 * world pick a dwelling that matches who lives there.
 *
 * Pure data. Rendered by handDrawnInterior via planToSceneModel.
 */

const elf = {
  id: 'race_elf_bower', type: 'race', race: 'elf', name: 'Sylvan Bower', material: 'timber', tier: 2, entry: 'bower',
  rooms: [
    { id: 'bower', shape: 'round', cx: 5, cy: 6, r: 2.6, name: 'Bower', role: 'hall' },
    { id: 'study', shape: 'round', cx: 9.5, cy: 4.5, r: 1.6, name: 'Reading Nook', role: 'store' },
    { id: 'rest', shape: 'round', cx: 9.5, cy: 8, r: 1.6, name: 'Rest', role: 'bedroom' }
  ],
  corridors: [{ pts: [[7.4, 5.4], [8, 5]], w: 0.7 }, { pts: [[7.2, 6.8], [8.1, 7.4]], w: 0.7 }],
  mouths: [{ x: 5, y: 3.4, orient: 'h', len: 1 }],
  windows: [{ x: 2.4, y: 6, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'rug', ux: 3.6, uy: 5.4, uw: 2.8, uh: 1.4 }, { type: 'column', ux: 3.4, uy: 4.2, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 6.2, uy: 4.2, uw: 0.7, uh: 0.7 }, { type: 'altar', ux: 4.4, uy: 6.6, uw: 1.4, uh: 1 },
    { type: 'shelf', ux: 9, uy: 3.9, uw: 0.5, uh: 1.6 }, { type: 'table', ux: 9.4, uy: 4.6, uw: 1, uh: 0.9 },
    { type: 'bed', ux: 8.9, uy: 7.3, uw: 1.1, uh: 1.4 }
  ],
  tags: ['elf', 'sylvan'], hooks: []
};

const orc = {
  id: 'race_orc_camp', type: 'race', race: 'orc', name: 'War-Hall', material: 'fortified', tier: 2, entry: 'hall',
  rooms: [
    { id: 'hall', shape: 'rect', cx: 5, cy: 6, w: 6, h: 5, name: 'War Hall', role: 'hall' },
    { id: 'pens', shape: 'rect', cx: 9.5, cy: 4.5, w: 3, h: 3, name: 'Pens', role: 'cells' },
    { id: 'loot', shape: 'rect', cx: 9.5, cy: 8, w: 3, h: 2.5, name: 'Loot Pile', role: 'store' }
  ],
  doors: [{ x: 8, y: 4.5, orient: 'v' }, { x: 8, y: 8, orient: 'v' }],
  mouths: [{ x: 5, y: 3.5, orient: 'h', len: 1.4 }],
  windows: [{ x: 2, y: 6, orient: 'v', t: 'slit' }, { x: 5, y: 8.5, orient: 'h', t: 'slit' }],
  furniture: [
    { type: 'longtable', ux: 2.4, uy: 4.6, uw: 3.4, uh: 1 }, { type: 'throne', ux: 4.4, uy: 6.2, uw: 1.4, uh: 1.3 }, { type: 'brazier', ux: 2.6, uy: 7, uw: 0.9, uh: 0.9 }, { type: 'statue', ux: 7, uy: 4.4, uw: 0.9, uh: 1.4 },
    { type: 'bars', ux: 8.2, uy: 5.6, uw: 2.6, uh: 0.4 }, { type: 'bed', ux: 8.3, uy: 3.6, uw: 1, uh: 1.2 },
    { type: 'crate', ux: 8.4, uy: 7.5, uw: 0.9, uh: 0.9 }, { type: 'chest', ux: 9.6, uy: 7.6, uw: 1.2, uh: 0.8 }
  ],
  tags: ['orc', 'warband'], hooks: ['the_warchiefs_trophy']
};

const dwarf = {
  id: 'race_dwarf_hall', type: 'race', race: 'dwarf', name: 'Deep Hall', material: 'fortified', tier: 3, entry: 'hall',
  rooms: [
    { id: 'hall', shape: 'rect', cx: 5, cy: 6, w: 6, h: 6, name: 'Great Hall', role: 'hall' },
    { id: 'forge', shape: 'rect', cx: 9.5, cy: 4, w: 3, h: 3, name: 'Forge', role: 'kitchen' },
    { id: 'vault', shape: 'rect', cx: 9.5, cy: 8.5, w: 3, h: 3, name: 'Vault', role: 'vault' }
  ],
  doors: [{ x: 8, y: 4, orient: 'v' }, { x: 8, y: 8.5, orient: 'v' }],
  mouths: [{ x: 5, y: 3, orient: 'h', len: 1.2 }],
  windows: [{ x: 2, y: 5, orient: 'v', t: 'slit' }, { x: 2, y: 7, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'column', ux: 3, uy: 4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 6.2, uy: 4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 3, uy: 7.4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 6.2, uy: 7.4, uw: 0.8, uh: 0.8 },
    { type: 'longtable', ux: 3.2, uy: 5.4, uw: 3.6, uh: 1 }, { type: 'throne', ux: 4.3, uy: 7, uw: 1.4, uh: 1.2 },
    { type: 'hearth', ux: 8.6, uy: 2.8, uw: 1.4, uh: 0.6 }, { type: 'table', ux: 9, uy: 4, uw: 1.2, uh: 1 }, { type: 'barrel', ux: 10.4, uy: 4.2, uw: 0.8, uh: 0.8 },
    { type: 'chest', ux: 8.3, uy: 7.6, uw: 1.5, uh: 0.9 }, { type: 'chest', ux: 8.4, uy: 9, uw: 1.4, uh: 0.8 }
  ],
  tags: ['dwarf', 'underhall'], hooks: ['the_locked_vault']
};

const hobbit = {
  id: 'race_hobbit_smial', type: 'race', race: 'hobbit', name: 'Smial', material: 'timber', tier: 1, entry: 'door',
  rooms: [
    { id: 'door', shape: 'round', cx: 3.5, cy: 5.5, r: 1.6, name: 'Round Door', role: 'hall' },
    { id: 'parlour', shape: 'round', cx: 7, cy: 5.5, r: 2, name: 'Parlour', role: 'hall' },
    { id: 'pantry', shape: 'round', cx: 7, cy: 9, r: 1.5, name: 'Pantry', role: 'store' },
    { id: 'bed', shape: 'round', cx: 10.5, cy: 6.5, r: 1.5, name: 'Bedroom', role: 'bedroom' }
  ],
  corridors: [{ pts: [[4.9, 5.5], [5.2, 5.5]], w: 0.7 }, { pts: [[7, 7.3], [7, 7.6]], w: 0.7 }, { pts: [[8.8, 6], [9.2, 6.2]], w: 0.7 }],
  mouths: [{ x: 2, y: 5.5, orient: 'v', len: 0.9 }],
  windows: [{ x: 7, y: 3.6, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'rug', ux: 2.9, uy: 5.1, uw: 1.2, uh: 0.9 },
    { type: 'hearth', ux: 6.4, uy: 4, uw: 1.3, uh: 0.6 }, { type: 'table', ux: 6.4, uy: 5.2, uw: 1.2, uh: 1 }, { type: 'rug', ux: 6, uy: 6, uw: 2, uh: 0.9 },
    { type: 'shelf', ux: 6.3, uy: 8.2, uw: 1.4, uh: 0.5 }, { type: 'barrel', ux: 7.4, uy: 9, uw: 0.7, uh: 0.7 },
    { type: 'bed', ux: 10, uy: 5.9, uw: 1, uh: 1.2 }
  ],
  tags: ['hobbit', 'home'], hooks: []
};

const wizard = {
  id: 'race_wizard_sanctum', type: 'race', race: 'wizard', name: 'Sanctum', material: 'stone', tier: 3, entry: 'study',
  rooms: [
    { id: 'study', shape: 'rect', cx: 5, cy: 5, w: 5, h: 4, name: 'Study', role: 'store' },
    { id: 'lab', shape: 'rect', cx: 9.5, cy: 4, w: 4, h: 3, name: 'Laboratory', role: 'kitchen' },
    { id: 'library', shape: 'rect', cx: 5, cy: 9, w: 5, h: 3, name: 'Library', role: 'store' },
    { id: 'circle', shape: 'round', cx: 10, cy: 8.5, r: 1.8, name: 'Summoning Circle', role: 'vault' }
  ],
  doors: [{ x: 7.5, y: 4, orient: 'v' }, { x: 5, y: 7, orient: 'h' }],
  corridors: [{ pts: [[8.4, 8.5], [8.2, 8.5]], w: 0.8 }, { pts: [[9.5, 5.5], [10, 6.7]], w: 0.7 }],
  mouths: [{ x: 5, y: 3, orient: 'h', len: 1 }],
  windows: [{ x: 2.5, y: 5, orient: 'v', t: 'casement' }, { x: 11.5, y: 4, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'shelf', ux: 2.7, uy: 3.3, uw: 0.5, uh: 3.4 }, { type: 'table', ux: 4.2, uy: 4.4, uw: 1.6, uh: 1.2 }, { type: 'statue', ux: 6.4, uy: 3.6, uw: 0.9, uh: 1.3 }, { type: 'chest', ux: 6.2, uy: 5.6, uw: 1.2, uh: 0.8 },
    { type: 'brazier', ux: 8.4, uy: 3.2, uw: 0.9, uh: 0.9 }, { type: 'altar', ux: 9.4, uy: 3.9, uw: 1.4, uh: 1 }, { type: 'barrel', ux: 10.8, uy: 4.4, uw: 0.8, uh: 0.8 },
    { type: 'shelf', ux: 3, uy: 8, uw: 4, uh: 0.5 }, { type: 'shelf', ux: 3, uy: 9.6, uw: 4, uh: 0.5 }, { type: 'table', ux: 6, uy: 8.8, uw: 1.2, uh: 1 },
    { type: 'brazier', ux: 9.6, uy: 8.1, uw: 0.9, uh: 0.9 }
  ],
  tags: ['wizard', 'arcane'], hooks: ['the_bound_thing']
};

const gnome = {
  id: 'race_gnome_workshop', type: 'race', race: 'gnome', name: 'Tinker Workshop', material: 'timber', tier: 1, entry: 'shop',
  rooms: [
    { id: 'shop', shape: 'rect', cx: 5, cy: 5.5, w: 5, h: 4, name: 'Workshop', role: 'hall' },
    { id: 'store', shape: 'rect', cx: 9, cy: 4.5, w: 3, h: 2.5, name: 'Parts Store', role: 'store' },
    { id: 'quarters', shape: 'rect', cx: 9, cy: 7.5, w: 3, h: 2.5, name: 'Quarters', role: 'bedroom' }
  ],
  doors: [{ x: 7.5, y: 4.5, orient: 'v' }, { x: 7.5, y: 7.5, orient: 'v' }],
  mouths: [{ x: 5, y: 3.5, orient: 'h', len: 1 }],
  windows: [{ x: 2.5, y: 5.5, orient: 'v', t: 'casement' }, { x: 5, y: 3.5, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'table', ux: 3, uy: 4.2, uw: 1.6, uh: 1.1 }, { type: 'table', ux: 5.4, uy: 4.2, uw: 1.6, uh: 1.1 }, { type: 'crate', ux: 3.2, uy: 6, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 4.6, uy: 6.2, uw: 0.8, uh: 0.8 }, { type: 'shelf', ux: 6.6, uy: 5.6, uw: 0.5, uh: 1.6 },
    { type: 'shelf', ux: 7.7, uy: 3.4, uw: 0.5, uh: 2 }, { type: 'crate', ux: 8.8, uy: 4.2, uw: 0.9, uh: 0.9 },
    { type: 'bed', ux: 7.8, uy: 6.9, uw: 1, uh: 1.2 }, { type: 'table', ux: 9.4, uy: 7.4, uw: 1, uh: 0.9 }
  ],
  tags: ['gnome', 'craft'], hooks: []
};

const giant = {
  id: 'race_giant_steading', type: 'race', race: 'giant', name: 'Steading', material: 'timber', tier: 3, entry: 'hall',
  rooms: [
    { id: 'hall', shape: 'rect', cx: 6, cy: 6, w: 8, h: 6, name: 'Steading Hall', role: 'hall' },
    { id: 'larder', shape: 'rect', cx: 11, cy: 5, w: 3, h: 3, name: 'Larder', role: 'store' }
  ],
  doors: [{ x: 10, y: 5, orient: 'v' }],
  mouths: [{ x: 6, y: 3, orient: 'h', len: 2 }],
  windows: [{ x: 3, y: 3, orient: 'h', t: 'casement' }, { x: 2, y: 6, orient: 'v', t: 'casement' }, { x: 12.5, y: 5, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'hearth', ux: 2.6, uy: 3.4, uw: 2.2, uh: 0.9 }, { type: 'longtable', ux: 3, uy: 5, uw: 5, uh: 1.6 }, { type: 'throne', ux: 5, uy: 7, uw: 2, uh: 1.6 }, { type: 'bed', ux: 2.4, uy: 6.8, uw: 1.8, uh: 2 },
    { type: 'barrel', ux: 10.4, uy: 4.2, uw: 1, uh: 1 }, { type: 'crate', ux: 10.4, uy: 5.6, uw: 1.1, uh: 1.1 }, { type: 'chest', ux: 11.6, uy: 5, uw: 1.4, uh: 0.9 }
  ],
  tags: ['giant', 'steading'], hooks: ['the_giants_hoard']
};

const lizardfolk = {
  id: 'race_lizardfolk_lodge', type: 'race', race: 'lizardfolk', name: 'Stilt Lodge', material: 'timber', tier: 2, entry: 'platform',
  rooms: [
    { id: 'platform', shape: 'rect', cx: 5, cy: 6, w: 3, h: 3, name: 'Platform', role: 'hall' },
    { id: 'hut1', shape: 'round', cx: 8.5, cy: 4.5, r: 1.6, name: 'Hut', role: 'bedroom' },
    { id: 'hut2', shape: 'round', cx: 8.5, cy: 8, r: 1.6, name: 'Hut', role: 'bedroom' },
    { id: 'shrine', shape: 'round', cx: 2.5, cy: 8.5, r: 1.4, name: 'Mud Shrine', role: 'crypt' }
  ],
  corridors: [{ pts: [[6.5, 5.4], [7.1, 4.9]], w: 0.7 }, { pts: [[6.5, 6.6], [7.1, 7.5]], w: 0.7 }, { pts: [[4.2, 7], [3.3, 7.7]], w: 0.7 }],
  mouths: [{ x: 5, y: 4.5, orient: 'h', len: 1 }],
  windows: [],
  furniture: [
    { type: 'rug', ux: 3.8, uy: 5.2, uw: 2.4, uh: 1.6 }, { type: 'table', ux: 4.4, uy: 6, uw: 1.2, uh: 1 },
    { type: 'bed', ux: 7.9, uy: 4, uw: 1.1, uh: 1.1 }, { type: 'bed', ux: 7.9, uy: 7.5, uw: 1.1, uh: 1.1 },
    { type: 'altar', ux: 1.9, uy: 8.1, uw: 1.3, uh: 0.9 }, { type: 'statue', ux: 3, uy: 8.1, uw: 0.8, uh: 1.2 }
  ],
  tags: ['lizardfolk', 'swamp'], hooks: []
};

export const RACE_PLANS = [elf, orc, dwarf, hobbit, wizard, gnome, giant, lizardfolk];
export const RACES = RACE_PLANS.map(p => p.race);
export function getRacePlan(raceOrId) {
  const k = String(raceOrId || '');
  return RACE_PLANS.find(p => p.race === k) || RACE_PLANS.find(p => p.id === k) || null;
}
