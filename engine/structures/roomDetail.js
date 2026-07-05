/**
 * Room detail — the DM that turns a bare topology room into a real place.
 *
 * The structure generator only hands us `{ id, tags }` per room. This module
 * decides what that room IS: it picks a BUILDING TYPE for the whole structure
 * (chapel, tavern, market, keep, cottage, lair, tower, longhouse, hive), then
 * assigns each room a ROLE from that building's blueprint (a chapel has a
 * narthex, a long nave, a crossing, an apse, side chapels; a tavern has a
 * taproom, kitchen, cellar, guest rooms), and furnishes it with recognizable,
 * role-appropriate furniture laid out the way a real room is laid out (altar at
 * the head of the apse, beds along the walls with a nightstand, the bar counter
 * facing the floor, pews in rows down a center-aisle runner, a firepit in the
 * middle of a longhouse, egg sacs clustered in a hive brood cell).
 *
 * Every room also carries a SHAPE (rect / round / oval / apse / octagon / cross
 * / ell / blob) and a SIZE WEIGHT (w,h). A nave is long and narrow; a market
 * floor is a huge octagon; a tower room is round; a cave den is an organic blob.
 * floorPlan.js reads those to draw a floor plan with irregular rooms and curved
 * walls — so a church looks nothing like a market and a hive looks nothing like
 * a cottage. You should be able to guess the building from the silhouette alone.
 *
 * SINGLE SOURCE OF TRUTH + PURE + DETERMINISTIC. Everything derives from the
 * room id alone (the building type from the structure id, the role from the
 * room's index within the building), so it adds nothing to world shape, never
 * touches worldHash, and works on existing saves. The combat resolver
 * (escapeCombat via coverFeatures), the floor-plan render (LocalMap via
 * floorPlan), and DM narration all read the SAME room from here.
 *
 * Cover is the furniture: a heavy table is half cover (+2 AC); an altar, a stone
 * pillar, a sarcophagus, a throne are three-quarter (+5 AC). The glyph on the
 * map and the thing you "take cover" behind are one object.
 */

import { seedFromString } from '../rng.js';

export const COVER_BONUS = { half: 2, 'three-quarter': 5 };

// ── Furniture catalog ────────────────────────────────────────────────────
// shape/material drive the glyph; light marks a light source (warm pool on the
// floor); cover marks the D&D tier; loot marks a searchable container; flat
// marks a floor covering (a rug) drawn under everything else. Sizes are
// normalized 0..1 of the room box.
//   shapes: 'rect' (w,h) | 'circle' (r) | 'lshape' (w,h) | 'bed' (w,h) | 'rug' (w,h)
const FURN = {
  hearth:    { label: 'hearth',         shape: 'rect',   material: 'fire',  light: 2, cover: null,            w: 0.34, h: 0.13 },
  firepit:   { label: 'fire pit',       shape: 'circle', material: 'fire',  light: 2, cover: null,            r: 0.09 },
  brazier:   { label: 'brazier',        shape: 'circle', material: 'fire',  light: 1, cover: null,            r: 0.06 },
  lantern:   { label: 'lantern',        shape: 'circle', material: 'fire',  light: 1, cover: null,            r: 0.045 },
  candles:   { label: 'candles',        shape: 'circle', material: 'fire',  light: 1, cover: null,            r: 0.035 },
  longtable: { label: 'long table',     shape: 'rect',   material: 'wood',  light: 0, cover: 'half',          w: 0.42, h: 0.14 },
  table:     { label: 'table',          shape: 'rect',   material: 'wood',  light: 0, cover: 'half',          w: 0.22, h: 0.16 },
  nightstand:{ label: 'nightstand',     shape: 'rect',   material: 'wood',  light: 0, cover: null,            w: 0.08, h: 0.08 },
  counter:   { label: 'counter',        shape: 'lshape', material: 'wood',  light: 0, cover: 'half',          w: 0.42, h: 0.12 },
  stall:     { label: 'market stall',   shape: 'rect',   material: 'cloth', light: 0, cover: 'half',          w: 0.24, h: 0.12 },
  loom:      { label: 'loom',           shape: 'rect',   material: 'wood',  light: 0, cover: 'half',          w: 0.10, h: 0.16 },
  anvil:     { label: 'anvil',          shape: 'rect',   material: 'iron',  light: 0, cover: 'half',          w: 0.12, h: 0.08 },
  barrel:    { label: 'barrel',         shape: 'circle', material: 'wood',  light: 0, cover: 'half',          r: 0.065 },
  crate:     { label: 'crate',          shape: 'rect',   material: 'wood',  light: 0, cover: 'half',          w: 0.15, h: 0.15 },
  bed:       { label: 'bed',            shape: 'bed',    material: 'cloth', light: 0, cover: null,            w: 0.16, h: 0.26 },
  bedding:   { label: 'straw bedding',  shape: 'bed',    material: 'cloth', light: 0, cover: null,            w: 0.18, h: 0.22 },
  chest:     { label: 'chest',          shape: 'rect',   material: 'iron',  light: 0, cover: null, loot: 1,   w: 0.14, h: 0.10 },
  wardrobe:  { label: 'wardrobe',       shape: 'rect',   material: 'wood',  light: 0, cover: 'half',          w: 0.12, h: 0.16 },
  chair:     { label: 'chair',          shape: 'rect',   material: 'wood',  light: 0, cover: null,            w: 0.07, h: 0.07 },
  basin:     { label: 'stone basin',    shape: 'circle', material: 'stone', light: 0, cover: 'half',          r: 0.075 },
  font:      { label: 'font',           shape: 'circle', material: 'stone', light: 0, cover: 'half',          r: 0.06 },
  well:      { label: 'well',           shape: 'circle', material: 'stone', light: 0, cover: 'half',          r: 0.085 },
  fountain:  { label: 'fountain',       shape: 'circle', material: 'stone', light: 0, cover: 'half',          r: 0.10 },
  altar:     { label: 'altar',          shape: 'rect',   material: 'stone', light: 0, cover: 'three-quarter', w: 0.30, h: 0.15 },
  throne:    { label: 'throne',         shape: 'rect',   material: 'stone', light: 0, cover: 'three-quarter', w: 0.14, h: 0.16 },
  lectern:   { label: 'lectern',        shape: 'rect',   material: 'wood',  light: 0, cover: null,            w: 0.08, h: 0.08 },
  sarcoph:   { label: 'sarcophagus',    shape: 'rect',   material: 'stone', light: 0, cover: 'three-quarter', w: 0.24, h: 0.12 },
  pillar:    { label: 'stone pillar',   shape: 'circle', material: 'stone', light: 0, cover: 'three-quarter', r: 0.055 },
  statue:    { label: 'statue',         shape: 'circle', material: 'stone', light: 0, cover: 'three-quarter', r: 0.06 },
  bones:     { label: 'bone pile',      shape: 'circle', material: 'bone',  light: 0, cover: 'half',          r: 0.07 },
  rubble:    { label: 'rubble',         shape: 'circle', material: 'stone', light: 0, cover: 'half',          r: 0.06 },
  web:       { label: 'web mass',       shape: 'circle', material: 'web',   light: 0, cover: 'half',          r: 0.09 },
  eggsac:    { label: 'egg sac',        shape: 'circle', material: 'web',   light: 0, cover: 'half',          r: 0.075 },
  bench:     { label: 'bench',          shape: 'rect',   material: 'wood',  light: 0, cover: null,            w: 0.20, h: 0.06 },
  pew:       { label: 'pew',            shape: 'rect',   material: 'wood',  light: 0, cover: null,            w: 0.30, h: 0.05 },
  shelf:     { label: 'shelves',        shape: 'rect',   material: 'wood',  light: 0, cover: null,            w: 0.22, h: 0.06 },
  rack:      { label: 'weapon rack',    shape: 'rect',   material: 'iron',  light: 0, cover: null,            w: 0.18, h: 0.06 },
  rug:       { label: 'rug',            shape: 'rug',    material: 'cloth', light: 0, cover: null, flat: 1,    w: 0.52, h: 0.40 },
  runner:    { label: 'aisle runner',   shape: 'rug',    material: 'cloth', light: 0, cover: null, flat: 1,    w: 0.16, h: 0.74 }
};

// ── Room roles ───────────────────────────────────────────────────────────
// Each role = a display name + furniture loadout + a SHAPE + a SIZE WEIGHT
// (w,h, where 1 = a standard room; >1 is bigger along that axis, and the
// contrast is deliberately large so the dominant room of a building — the nave,
// the market floor, the great hall, the den — reads at a glance). `dark` rooms
// have no daylight, so they read shadowed unless a furniture light source burns.
//   shapes: 'rect' | 'round' | 'oval' | 'apse' | 'octagon' | 'cross' | 'ell' | 'blob'
const ROLES = {
  // — chapel / church (axial: narthex → long nave → crossing → apse) —
  narthex:  { name: 'Narthex',       items: ['bench', 'bench', 'brazier', 'rug'],                                              shape: 'rect',    w: 1.4, h: 0.7 },
  nave:     { name: 'Nave',          items: ['pillar', 'pillar', 'pillar', 'pillar', 'pillar', 'pillar', 'pew', 'pew', 'pew', 'pew', 'runner', 'brazier', 'brazier'], shape: 'rect', w: 1.0, h: 3.0 },
  crossing: { name: 'Crossing',      items: ['pillar', 'pillar', 'pillar', 'pillar', 'candles'],                               shape: 'cross',   w: 1.7, h: 1.6 },
  apse:     { name: 'Apse',          items: ['altar', 'candles', 'candles', 'statue'],                                         shape: 'apse',    w: 1.5, h: 1.1 },
  chapel:   { name: 'Side Chapel',   items: ['altar', 'candles', 'pew'],                                                       shape: 'rect',    w: 0.6, h: 0.9 },
  vestry:   { name: 'Vestry',        items: ['wardrobe', 'chest', 'shelf', 'lantern'],                                        shape: 'rect',    w: 0.6, h: 0.6 },
  crypt:    { name: 'Crypt',         items: ['sarcoph', 'sarcoph', 'statue', 'chest'],                                         shape: 'rect',    w: 1.0, h: 1.0, dark: 1 },
  belltower:{ name: 'Bell Tower',    items: ['lantern'],                                                                       shape: 'round',   w: 0.7, h: 0.7 },

  // — tavern / inn —
  taproom:  { name: 'Taproom',       items: ['counter', 'longtable', 'chair', 'chair', 'chair', 'hearth', 'barrel', 'rug'],   shape: 'rect',    w: 1.6, h: 1.3 },
  kitchen:  { name: 'Kitchen',       items: ['hearth', 'counter', 'table', 'basin', 'shelf', 'barrel'],                       shape: 'rect',    w: 1.1, h: 1.0 },
  cellar:   { name: 'Cellar',        items: ['barrel', 'barrel', 'barrel', 'crate', 'crate'],                                 shape: 'rect',    w: 0.9, h: 0.8, dark: 1 },
  quarters: { name: 'Guest Room',    items: ['bed', 'bed', 'nightstand', 'chest', 'lantern', 'rug'],                          shape: 'rect',    w: 0.8, h: 0.8 },
  pantry:   { name: 'Pantry',        items: ['shelf', 'crate', 'barrel'],                                                     shape: 'rect',    w: 0.5, h: 0.5, dark: 1 },
  privy:    { name: 'Privy',         items: ['basin'],                                                                        shape: 'rect',    w: 0.4, h: 0.4, dark: 1 },

  // — market hall (huge central floor, stall rows around it) —
  plaza:    { name: 'Market Floor',  items: ['fountain', 'stall', 'stall', 'stall', 'crate', 'brazier', 'brazier'],          shape: 'octagon', w: 2.2, h: 2.2 },
  stallrow: { name: 'Stall Row',     items: ['stall', 'stall', 'crate'],                                                      shape: 'rect',    w: 0.8, h: 0.6 },
  counting: { name: 'Counting House', items: ['table', 'chest', 'chest', 'chair', 'lantern'],                                 shape: 'rect',    w: 0.7, h: 0.7 },
  storeroom:{ name: 'Storeroom',     items: ['crate', 'crate', 'barrel', 'shelf'],                                            shape: 'rect',    w: 0.9, h: 0.8, dark: 1 },

  // — keep / castle —
  greathall:{ name: 'Great Hall',    items: ['throne', 'longtable', 'longtable', 'pillar', 'pillar', 'hearth', 'bench', 'bench', 'rug'], shape: 'rect', w: 2.0, h: 1.7 },
  tower:    { name: 'Tower',         items: ['rack', 'chest', 'lantern'],                                                     shape: 'round',   w: 0.8, h: 0.8 },
  armory:   { name: 'Armory',        items: ['rack', 'rack', 'crate', 'chest'],                                               shape: 'rect',    w: 0.9, h: 0.8 },
  barracks: { name: 'Barracks',      items: ['bed', 'bed', 'bed', 'bed', 'rack', 'chest'],                                    shape: 'rect',    w: 1.1, h: 0.9 },
  solar:    { name: 'Solar',         items: ['bed', 'wardrobe', 'table', 'chair', 'lantern', 'rug'],                          shape: 'rect',    w: 0.9, h: 0.8 },
  dungeon:  { name: 'Dungeon',       items: ['bones', 'chest', 'rubble'],                                                     shape: 'rect',    w: 0.7, h: 0.7, dark: 1 },

  // — cottage / house —
  hearthroom:{name: 'Hearth Room',   items: ['hearth', 'table', 'chair', 'chair', 'bench', 'shelf', 'rug'],                   shape: 'rect',    w: 1.2, h: 1.0 },
  bedchamber:{name: 'Bedchamber',    items: ['bed', 'nightstand', 'chest', 'wardrobe', 'lantern', 'rug'],                     shape: 'rect',    w: 0.8, h: 0.8 },
  scullery: { name: 'Scullery',      items: ['basin', 'counter', 'shelf', 'barrel'],                                         shape: 'rect',    w: 0.6, h: 0.6 },

  // — longhouse (one long communal hall, sleeping bays off the sides) —
  mead:     { name: 'Mead Hall',     items: ['firepit', 'longtable', 'longtable', 'bench', 'bench', 'bench', 'bench', 'rug'], shape: 'rect',    w: 1.4, h: 2.6 },
  hearthrow:{ name: 'Hearth Row',    items: ['firepit', 'bench', 'bench', 'shelf'],                                          shape: 'rect',    w: 1.0, h: 1.0 },
  sleeping: { name: 'Sleeping Bay',  items: ['bedding', 'bedding', 'chest', 'rug'],                                          shape: 'rect',    w: 0.8, h: 0.7 },
  larder:   { name: 'Larder',        items: ['barrel', 'crate', 'shelf'],                                                    shape: 'rect',    w: 0.6, h: 0.6, dark: 1 },
  loomroom: { name: 'Weaving Room',  items: ['loom', 'loom', 'shelf', 'chair'],                                              shape: 'rect',    w: 0.8, h: 0.7 },

  // — lair / cave (organic, round/blob, dark) —
  maw:      { name: 'Cave Mouth',    items: ['rubble', 'rubble', 'bones'],                                                    shape: 'blob',    w: 1.2, h: 1.0, dark: 1 },
  tunnel:   { name: 'Tunnel',        items: ['rubble', 'bones'],                                                             shape: 'blob',    w: 0.5, h: 1.5, dark: 1 },
  den:      { name: 'Den',           items: ['firepit', 'bones', 'bones', 'bedding'],                                        shape: 'blob',    w: 1.6, h: 1.5, dark: 1 },
  hoard:    { name: 'Hoard',         items: ['chest', 'chest', 'crate', 'bones', 'statue'],                                  shape: 'blob',    w: 1.0, h: 1.0, dark: 1 },
  warren:   { name: 'Warren',        items: ['bones', 'rubble', 'web'],                                                       shape: 'blob',    w: 0.7, h: 0.7, dark: 1 },
  pit:      { name: 'Pit',           items: ['rubble', 'bones'],                                                             shape: 'round',   w: 0.9, h: 0.9, dark: 1 },
  nest:     { name: 'Nest',          items: ['bedding', 'eggsac', 'bones'],                                                  shape: 'blob',    w: 1.0, h: 0.9, dark: 1 },

  // — arcane tower (round / oval rooms stacked up a spine) —
  foyer:    { name: 'Foyer',         items: ['lantern', 'bench', 'rug'],                                                      shape: 'round',   w: 0.9, h: 0.9 },
  study:    { name: 'Study',         items: ['table', 'shelf', 'chair', 'lantern'],                                          shape: 'round',   w: 0.9, h: 0.9 },
  library:  { name: 'Library',       items: ['shelf', 'shelf', 'shelf', 'table', 'lantern'],                                 shape: 'round',   w: 1.1, h: 1.1 },
  lab:      { name: 'Laboratory',    items: ['table', 'basin', 'shelf', 'brazier'],                                          shape: 'round',   w: 0.95, h: 0.95 },
  observ:   { name: 'Observatory',   items: ['lectern', 'statue', 'lantern'],                                                shape: 'oval',    w: 0.9, h: 1.1 },
  vault:    { name: 'Vault',         items: ['chest', 'chest', 'statue'],                                                    shape: 'round',   w: 0.7, h: 0.7, dark: 1 },

  // — hive (insectoid creature: organic chambers, brood cells, a great queen's hall) —
  mouth:    { name: 'Hive Mouth',    items: ['web', 'web', 'rubble'],                                                        shape: 'blob',    w: 1.2, h: 1.0, dark: 1 },
  gallery:  { name: 'Gallery',       items: ['web', 'web', 'eggsac'],                                                        shape: 'blob',    w: 1.0, h: 1.7, dark: 1 },
  broodcell:{ name: 'Brood Cell',    items: ['eggsac', 'eggsac', 'web'],                                                     shape: 'blob',    w: 0.7, h: 0.7, dark: 1 },
  royalchamber:{ name: 'Royal Chamber', items: ['eggsac', 'eggsac', 'eggsac', 'bones', 'web'],                              shape: 'blob',    w: 1.6, h: 1.5, dark: 1 },
  cocoonstore:{ name: 'Cocoon Store', items: ['web', 'eggsac', 'bones'],                                                     shape: 'blob',    w: 0.7, h: 0.7, dark: 1 }
};

// ── Building blueprints ──────────────────────────────────────────────────
// entry = the role of the room you walk in through. plan = the ordered roles the
// remaining rooms take (by their index within the building). fill = the role used
// once the plan runs out (so a 12-room market is mostly stalls, a big chapel adds
// more side chapels). shell = how floorPlan draws the outer wall.
const BUILDINGS = {
  chapel:    { name: 'Chapel',      entry: 'narthex',    plan: ['nave', 'crossing', 'apse', 'chapel', 'chapel', 'vestry', 'crypt', 'belltower'], fill: 'chapel',   shell: 'stone' },
  tavern:    { name: 'Tavern',      entry: 'taproom',    plan: ['kitchen', 'cellar', 'quarters', 'quarters', 'pantry', 'privy'],                  fill: 'quarters', shell: 'timber' },
  market:    { name: 'Market Hall', entry: 'plaza',      plan: ['stallrow', 'stallrow', 'stallrow', 'counting', 'storeroom', 'stallrow'],         fill: 'stallrow', shell: 'open' },
  keep:      { name: 'Keep',        entry: 'greathall',  plan: ['tower', 'armory', 'barracks', 'kitchen', 'tower', 'solar', 'dungeon'],           fill: 'barracks', shell: 'fortified' },
  cottage:   { name: 'Cottage',     entry: 'hearthroom', plan: ['bedchamber', 'pantry', 'scullery', 'bedchamber'],                                fill: 'bedchamber',shell: 'timber' },
  longhouse: { name: 'Longhouse',   entry: 'mead',       plan: ['hearthrow', 'sleeping', 'sleeping', 'larder', 'loomroom', 'sleeping'],           fill: 'sleeping', shell: 'timber' },
  lair:      { name: 'Lair',        entry: 'maw',        plan: ['tunnel', 'den', 'hoard', 'warren', 'pit', 'nest'],                               fill: 'warren',   shell: 'cave' },
  tower:     { name: 'Arcane Tower',entry: 'foyer',      plan: ['study', 'library', 'lab', 'observ', 'vault'],                                    fill: 'study',    shell: 'round' },
  hive:      { name: 'Hive',        entry: 'mouth',      plan: ['gallery', 'broodcell', 'broodcell', 'royalchamber', 'cocoonstore', 'broodcell'], fill: 'broodcell',shell: 'chitin' }
};
const BUILDING_LIST = ['chapel', 'tavern', 'market', 'keep', 'cottage', 'longhouse', 'lair', 'tower', 'hive'];

// room id is "room:<structureId>:<n>" — pull the structure id (every room in one
// building shares it → shares a building type) and the trailing index <n>.
function structIdFromRoom(room) {
  const id = String(room?.id || '');
  const m = id.match(/^room:(.+):[^:]+$/);
  return m ? m[1] : id;
}
function roomIndexFromId(id) {
  const m = String(id || '').match(/:([^:]+)$/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : null;
}

/** buildingTypeFor(structId) -> one of BUILDING_LIST. Deterministic. */
export function buildingTypeFor(structId) {
  return BUILDING_LIST[seedFromString('bld|' + String(structId || '')) % BUILDING_LIST.length];
}

function frac(seed) { return (seed % 100000) / 100000; }

// ── Furniture layout ─────────────────────────────────────────────────────
// Place each piece where it actually belongs in a room of this role/shape. We
// track how many of certain kinds we've placed so pillars march in two rows,
// pews line up with a center aisle, beds line alternating walls each with a
// nightstand, light sources take the corners, stalls line the perimeter, etc.
// All offsets stay inside [0.12, 0.88] so nothing clips the wall (U64 stays
// green) — except flat floor coverings (rugs), which may run to the edges.
function layoutFurniture(role, items, shape, idBase) {
  const out = [];
  const clamp = (v) => Math.max(0.12, Math.min(0.88, v));
  const cnt = {};
  const next = (k) => (cnt[k] = (cnt[k] || 0) + 1) - 1; // 0-based occurrence
  const corners = [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]];

  items.forEach((fk, i) => {
    const base = FURN[fk];
    if (!base) return;
    let fx = 0.5, fy = 0.5;
    const n = next(fk);
    const flat = base.flat ? 1 : 0;

    if (fk === 'rug') { fx = 0.5; fy = 0.55; }
    else if (fk === 'runner') { fx = 0.5; fy = 0.5; }                       // center aisle down a nave
    else if (fk === 'hearth') { fx = 0.5; fy = 0.13; }                      // built into the far wall
    else if (fk === 'firepit') { fx = 0.5; fy = 0.5; }                      // communal, dead center
    else if (fk === 'altar' || fk === 'throne') { fx = 0.5; fy = shape === 'apse' ? 0.24 : 0.20; } // the head of the room
    else if (fk === 'lectern') { fx = 0.32; fy = 0.30; }
    else if (fk === 'fountain' || fk === 'well') { fx = 0.5; fy = 0.5; }
    else if (fk === 'font') { fx = 0.5; fy = 0.72; }
    else if (fk === 'sarcoph') { fx = n === 0 ? 0.30 : 0.70; fy = 0.34 + Math.floor(n / 2) * 0.26; }
    else if (fk === 'pillar') { fx = (n % 2) ? 0.76 : 0.24; fy = 0.26 + Math.floor(n / 2) * 0.24; } // two colonnade rows
    else if (fk === 'pew' || fk === 'bench') { fx = 0.5; fy = 0.26 + n * 0.16; }                    // rows toward the head
    else if (fk === 'bed' || fk === 'bedding') { fx = (n % 2) ? 0.74 : 0.26; fy = 0.30 + Math.floor(n / 2) * 0.32; }
    else if (fk === 'nightstand') { fx = (n % 2) ? 0.60 : 0.40; fy = 0.18; }                        // beside the headboard
    else if (fk === 'counter') { fx = 0.26; fy = 0.5; }                                             // L-counter along the wall
    else if (fk === 'stall') { fx = (n % 2) ? 0.80 : 0.20; fy = 0.28 + Math.floor(n / 2) * 0.30; }  // line the perimeter
    else if (fk === 'shelf' || fk === 'rack' || fk === 'wardrobe' || fk === 'loom') { fx = (n % 2) ? 0.82 : 0.18; fy = 0.30 + Math.floor(n / 2) * 0.30; }
    else if (fk === 'longtable') { fx = 0.5; fy = 0.42 + n * 0.22; }                                // long tables run the hall
    else if (fk === 'table') { fx = 0.5; fy = 0.52; }
    else if (fk === 'anvil') { fx = 0.78; fy = 0.62; }
    else if (fk === 'brazier' || fk === 'candles' || fk === 'lantern') { const c = corners[n % 4]; fx = c[0]; fy = c[1]; }
    else if (fk === 'statue') { const c = corners[n % 4]; fx = c[0]; fy = c[1] < 0.5 ? c[1] + 0.06 : c[1]; }
    else if (fk === 'web') { const c = corners[n % 4]; fx = c[0]; fy = c[1]; }                       // cobwebs in the corners
    else if (fk === 'eggsac' || fk === 'chair') {
      // clustered/scattered in the free interior, deterministic per slot
      fx = 0.24 + frac(seedFromString('fx|' + idBase + '|' + i)) * 0.52;
      fy = 0.40 + frac(seedFromString('fy|' + idBase + '|' + i)) * 0.40;
    }
    else {
      // barrels, crates, chests, bones, rubble: scatter in the lower/free area.
      fx = 0.22 + frac(seedFromString('fx|' + idBase + '|' + i)) * 0.56;
      fy = 0.40 + frac(seedFromString('fy|' + idBase + '|' + i)) * 0.42;
    }

    out.push({
      kind: fk, label: base.label, shape: base.shape, material: base.material,
      light: base.light || 0, cover: base.cover || null, loot: base.loot || 0, flat,
      fx: flat ? fx : clamp(fx), fy: flat ? fy : clamp(fy), w: base.w || 0, h: base.h || 0, r: base.r || 0
    });
  });
  return out;
}

/**
 * roomDetail(room) -> {
 *   buildingType, arch, role, kind, name, entry, dark, shape, sizeW, sizeH, furniture:[...]
 * }
 * furniture item: { id, kind, label, shape, material, light, cover, loot, flat, fx, fy, w, h, r }
 * fx/fy are the normalized center (0..1) inside the room box.
 */
export function roomDetail(room, forcedType = null) {
  const id = String(room?.id || '');
  if (!id) return { buildingType: 'tavern', arch: 'tavern', role: 'taproom', kind: 'taproom', name: 'Room', entry: false, dark: 0, shape: 'rect', sizeW: 1, sizeH: 1, furniture: [] };

  const tags = (Array.isArray(room?.tags) ? room.tags : []).map(t => String(t).toLowerCase());
  const isEntry = tags.includes('entry');
  const structId = structIdFromRoom(room);
  // forcedType lets a structure declare its kind (e.g. the player's home cottage)
  // instead of the id-hash default.
  const buildingType = (forcedType && BUILDINGS[forcedType]) ? forcedType : buildingTypeFor(structId);
  const B = BUILDINGS[buildingType];

  // LOAD-1 — an AUTHORED room may declare its own role via a `role:<name>` tag
  // (house-builder's room.role, carried onto the topology room by the loader). It
  // wins over the building-blueprint default ONLY when it names a KNOWN role — so a
  // single hand-drawn room Tim marked 'quarters' reads as quarters (with a bed),
  // not the cottage entry's hearth room. This is ADDITIVE: every procgen room carries
  // no such tag, so its role selection below is byte-identical to before.
  const authoredRoleTag = tags.map(t => (t.startsWith('role:') ? t.slice(5) : '')).find(t => t && ROLES[t]) || '';

  let role;
  if (authoredRoleTag) {
    role = authoredRoleTag;
  } else if (isEntry) {
    role = B.entry;
  } else {
    const idx = roomIndexFromId(id);
    // Entry usually occupies index 1; the first non-entry room (index 2) takes
    // plan[0]. If the index is missing/odd, fall back to a hashed slot.
    let slot;
    if (idx !== null) slot = Math.max(0, idx - 2);
    else slot = seedFromString('slot|' + id) % B.plan.length;
    role = slot < B.plan.length ? B.plan[slot] : B.fill;
  }
  const R = ROLES[role] || ROLES.storeroom;

  const furniture = layoutFurniture(role, R.items, R.shape, id).map((f, i) => ({
    id: `${id}#f${i}`, ...f
  }));

  // Every non-entry room must offer at least one piece of cover — tactics live
  // in the surroundings, and an empty room is a dead room.
  if (!isEntry && !furniture.some(f => f.cover)) {
    const b = FURN.crate;
    furniture.push({
      id: `${id}#fc`, kind: 'crate', label: b.label, shape: b.shape, material: b.material,
      light: 0, cover: b.cover, loot: 0, flat: 0, fx: 0.72, fy: 0.7, w: b.w, h: b.h, r: 0
    });
  }

  return {
    buildingType, arch: buildingType, role, kind: role, name: R.name,
    entry: isEntry,
    // The threshold you enter through always reads as lit — daylight spills in
    // from outside even at a cave mouth or a hive maw.
    dark: isEntry ? 0 : (R.dark || 0),
    shape: R.shape || 'rect',
    sizeW: R.w || 1, sizeH: R.h || 1,
    furniture
  };
}
