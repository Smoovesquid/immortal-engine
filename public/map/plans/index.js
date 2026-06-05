/**
 * Structure plan catalog — hand-authored floor plans, one per building style.
 *
 * Like the bestiary, these are AUTHORED content: a person designed each as a
 * building you'd recognize, with rooms that butt together and doors on the
 * shared walls (corridors only where rooms genuinely can't touch). The renderer
 * (handDrawnInterior.js) is the authoring tool — every plan is visible in
 * /__preview/buildings.html as you write it.
 *
 * A plan is scene-model-shaped plus metadata:
 * {
 *   id, type, name, material, tier, entry,
 *   rooms:[{ id, shape:'rect'|'round', cx, cy, w, h | r, name, role }],
 *   doors:[{ x, y, orient:'h'|'v' }],     // on shared walls between butting rooms
 *   corridors:[{ pts:[[x,y]...], w }],    // bent passages for non-adjacent links
 *   mouths:[{ x, y, orient, len }],       // the way in (gap in the outer wall)
 *   windows:[{ x, y, orient, t }],        // exterior walls only
 *   furniture:[{ type, ux, uy, uw, uh }], // authored anchors, dressed by role
 *   tags, hooks                           // future: rumor/encounter seeds
 * }
 *
 * tier is the base danger/reward rung (1..4, 1:1 with bestiary trivial/minor/
 * standard/elite). The world applies a geographic multiplier (further from home
 * = higher), and a structure can deceive (low apparent tier, high real one).
 *
 * Not stopping at 100 — this is one-of-each to prove the pipeline.
 */

// ── 1. COTTAGE — timber, tier 1 ─────────────────────────────────────────────
const cottage = {
  id: 'cottage_wattle', type: 'cottage', name: 'Wattle Cottage', material: 'timber', tier: 1, entry: 'main',
  rooms: [
    { id: 'main', shape: 'rect', cx: 5, cy: 5, w: 6, h: 5, name: 'Hearth Room', role: 'hall' },
    { id: 'bed', shape: 'rect', cx: 9.5, cy: 6.5, w: 3, h: 2, name: 'Bedroom', role: 'bedroom' },
    { id: 'larder', shape: 'rect', cx: 9.5, cy: 3.5, w: 3, h: 2, name: 'Larder', role: 'store' }
  ],
  doors: [{ x: 8, y: 3.5, orient: 'v' }, { x: 8, y: 6.5, orient: 'v' }],
  mouths: [{ x: 5, y: 7.5, orient: 'h', len: 1 }],
  windows: [{ x: 3.5, y: 2.5, orient: 'h', t: 'casement' }, { x: 6.5, y: 2.5, orient: 'h', t: 'casement' }, { x: 2, y: 5, orient: 'v', t: 'casement' }, { x: 11, y: 3.5, orient: 'v', t: 'casement' }, { x: 11, y: 6.5, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'hearth', ux: 3.2, uy: 2.7, uw: 1.5, uh: 0.7 }, { type: 'table', ux: 4.4, uy: 4.4, uw: 1.6, uh: 1.4 }, { type: 'rug', ux: 3.4, uy: 6.2, uw: 3.2, uh: 1 },
    { type: 'shelf', ux: 8.2, uy: 2.7, uw: 0.6, uh: 1.6 }, { type: 'barrel', ux: 10.2, uy: 2.8, uw: 0.7, uh: 0.7 },
    { type: 'bed', ux: 8.3, uy: 5.7, uw: 1.2, uh: 1.6 }
  ],
  tags: ['rural', 'home'], hooks: []
};

// ── 2. TAVERN — timber, tier 1 ──────────────────────────────────────────────
const tavern = {
  id: 'tavern_tankard', type: 'tavern', name: 'The Black Tankard', material: 'timber', tier: 1, entry: 'common',
  rooms: [
    { id: 'common', shape: 'rect', cx: 5, cy: 6, w: 8, h: 6, name: 'Common Room', role: 'hall' },
    { id: 'kitchen', shape: 'rect', cx: 10.5, cy: 4.5, w: 3, h: 3, name: 'Kitchen', role: 'kitchen' },
    { id: 'cellar', shape: 'rect', cx: 10.5, cy: 8, w: 3, h: 2.5, name: 'Cellar', role: 'store' }
  ],
  doors: [{ x: 9, y: 4.5, orient: 'v' }, { x: 9, y: 8, orient: 'v' }],
  mouths: [{ x: 5, y: 9, orient: 'h', len: 1.2 }],
  windows: [{ x: 3.5, y: 3, orient: 'h', t: 'casement' }, { x: 6.5, y: 3, orient: 'h', t: 'casement' }, { x: 1, y: 5, orient: 'v', t: 'casement' }, { x: 1, y: 7, orient: 'v', t: 'casement' }, { x: 12, y: 4.5, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'longtable', ux: 1.4, uy: 3.4, uw: 1, uh: 3.2 }, { type: 'hearth', ux: 3.2, uy: 3.2, uw: 1.5, uh: 0.7 }, { type: 'brazier', ux: 7.6, uy: 3.4, uw: 0.8, uh: 0.8 },
    { type: 'longtable', ux: 3, uy: 5, uw: 3.4, uh: 1 }, { type: 'longtable', ux: 3, uy: 6.8, uw: 3.4, uh: 1 }, { type: 'barrel', ux: 7.2, uy: 7.6, uw: 0.8, uh: 0.8 },
    { type: 'hearth', ux: 9.4, uy: 3.4, uw: 1.3, uh: 0.6 }, { type: 'table', ux: 10, uy: 4.6, uw: 1.4, uh: 1.2 },
    { type: 'barrel', ux: 9.4, uy: 7.4, uw: 0.8, uh: 0.8 }, { type: 'crate', ux: 10.7, uy: 7.5, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 10, uy: 8.6, uw: 0.8, uh: 0.8 }
  ],
  tags: ['social', 'town'], hooks: ['smuggler_cellar']
};

// ── 3. CHAPEL — stone, tier 2 ───────────────────────────────────────────────
const chapel = {
  id: 'chapel_wayside', type: 'chapel', name: 'Wayside Chapel', material: 'stone', tier: 2, entry: 'nave',
  rooms: [
    { id: 'nave', shape: 'rect', cx: 5, cy: 7, w: 5, h: 10, name: 'Nave', role: 'nave' },
    { id: 'vestry', shape: 'rect', cx: 9, cy: 4, w: 3, h: 3, name: 'Vestry', role: 'store' },
    { id: 'crypt', shape: 'rect', cx: 9, cy: 10, w: 3, h: 3, name: 'Crypt', role: 'crypt' }
  ],
  doors: [{ x: 7.5, y: 4, orient: 'v' }, { x: 7.5, y: 10, orient: 'v' }],
  mouths: [{ x: 5, y: 12, orient: 'h', len: 1.2 }],
  windows: [{ x: 2.5, y: 4, orient: 'v', t: 'casement' }, { x: 2.5, y: 7, orient: 'v', t: 'casement' }, { x: 2.5, y: 10, orient: 'v', t: 'casement' }, { x: 5, y: 2, orient: 'h', t: 'casement' }, { x: 10.5, y: 4, orient: 'v', t: 'slit' }, { x: 10.5, y: 10, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'altar', ux: 4.1, uy: 2.5, uw: 1.8, uh: 1.4 }, { type: 'column', ux: 3, uy: 5, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 6.3, uy: 5, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 3, uy: 9, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 6.3, uy: 9, uw: 0.7, uh: 0.7 },
    { type: 'longtable', ux: 3.4, uy: 6, uw: 3.2, uh: 0.7 }, { type: 'longtable', ux: 3.4, uy: 7.4, uw: 3.2, uh: 0.7 }, { type: 'longtable', ux: 3.4, uy: 8.8, uw: 3.2, uh: 0.7 }, { type: 'brazier', ux: 4.6, uy: 4, uw: 0.8, uh: 0.8 },
    { type: 'shelf', ux: 7.8, uy: 2.8, uw: 0.6, uh: 2.2 }, { type: 'table', ux: 9.2, uy: 3.6, uw: 1.2, uh: 1 },
    { type: 'chest', ux: 8.2, uy: 9.4, uw: 1.4, uh: 0.9 }, { type: 'statue', ux: 9.6, uy: 9.2, uw: 1, uh: 1.4 }
  ],
  tags: ['sacred'], hooks: ['bricked_crypt']
};

// ── 4. KEEP — fortified, tier 3 ─────────────────────────────────────────────
const keep = {
  id: 'keep_sunken', type: 'keep', name: 'Old Keep', material: 'fortified', tier: 3, entry: 'gate',
  rooms: [
    { id: 'gate', shape: 'rect', cx: 4, cy: 4, w: 5, h: 3, name: 'Gatehouse', role: 'hall' },
    { id: 'hall', shape: 'rect', cx: 4, cy: 8.5, w: 5, h: 6, name: 'Great Hall', role: 'hall' },
    { id: 'kitchen', shape: 'rect', cx: 8, cy: 4, w: 3, h: 3, name: 'Kitchen', role: 'kitchen' },
    { id: 'cells', shape: 'rect', cx: 8, cy: 8.5, w: 3, h: 6, name: 'Cells', role: 'cells' },
    { id: 'tower', shape: 'round', cx: 13, cy: 4, r: 2.2, name: 'Tower', role: 'tower' },
    { id: 'vault', shape: 'round', cx: 13, cy: 9.5, r: 1.8, name: 'Vault', role: 'vault' }
  ],
  doors: [{ x: 4, y: 5.5, orient: 'h' }, { x: 6.5, y: 4, orient: 'v' }, { x: 6.5, y: 8.5, orient: 'v' }],
  corridors: [{ pts: [[9.5, 4], [10.8, 4]], w: 0.8 }, { pts: [[13, 6.2], [13, 7.7]], w: 0.8 }],
  mouths: [{ x: 1.5, y: 4, orient: 'v', len: 1 }, { x: 9.5, y: 4, orient: 'v', len: 0.8 }, { x: 10.8, y: 4, orient: 'v', len: 0.8 }, { x: 13, y: 6.2, orient: 'h', len: 0.8 }, { x: 13, y: 7.7, orient: 'h', len: 0.8 }],
  windows: [{ x: 4, y: 2.5, orient: 'h', t: 'slit' }, { x: 1.5, y: 8.5, orient: 'v', t: 'slit' }, { x: 4, y: 11.5, orient: 'h', t: 'slit' }, { x: 9.5, y: 11, orient: 'v', t: 'barred' }, { x: 6.5, y: 11, orient: 'v', t: 'barred' }],
  furniture: [
    { type: 'brazier', ux: 2.2, uy: 3.6, uw: 0.8, uh: 0.8 }, { type: 'brazier', ux: 5, uy: 3.6, uw: 0.8, uh: 0.8 },
    { type: 'longtable', ux: 2.2, uy: 6.4, uw: 3.6, uh: 1 }, { type: 'longtable', ux: 2.2, uy: 8.2, uw: 3.6, uh: 1 }, { type: 'throne', ux: 3.3, uy: 9.8, uw: 1.4, uh: 1.2 },
    { type: 'hearth', ux: 6.8, uy: 2.8, uw: 1.4, uh: 0.6 }, { type: 'table', ux: 7.4, uy: 4, uw: 1.2, uh: 1.1 },
    { type: 'bed', ux: 6.8, uy: 6.2, uw: 1.1, uh: 1.6 }, { type: 'bars', ux: 6.6, uy: 10.6, uw: 2.8, uh: 0.4 },
    { type: 'shelf', ux: 11.4, uy: 3.4, uw: 0.6, uh: 1.6 }, { type: 'statue', ux: 13.3, uy: 3.2, uw: 1, uh: 1.4 },
    { type: 'chest', ux: 12.1, uy: 9.1, uw: 1.6, uh: 0.9 }
  ],
  tags: ['fortified', 'ruin'], hooks: ['sealed_vault']
};

// ── 5. MARKET — open/stone, tier 1 ──────────────────────────────────────────
const market = {
  id: 'market_hall', type: 'market', name: 'Market Hall', material: 'stone', tier: 1, entry: 'floor',
  rooms: [
    { id: 'floor', shape: 'rect', cx: 6, cy: 6, w: 10, h: 8, name: 'Market Floor', role: 'hall' },
    { id: 'counting', shape: 'rect', cx: 12.25, cy: 4, w: 2.5, h: 3, name: 'Counting House', role: 'store' }
  ],
  doors: [{ x: 11, y: 4, orient: 'v' }],
  mouths: [{ x: 6, y: 10, orient: 'h', len: 2 }],
  windows: [{ x: 3, y: 2, orient: 'h', t: 'casement' }, { x: 9, y: 2, orient: 'h', t: 'casement' }, { x: 1, y: 6, orient: 'v', t: 'casement' }, { x: 13.5, y: 4, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'column', ux: 3, uy: 4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 8, uy: 4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 3, uy: 8, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 8, uy: 8, uw: 0.8, uh: 0.8 },
    { type: 'table', ux: 2, uy: 5.4, uw: 1.5, uh: 1.2 }, { type: 'crate', ux: 2.2, uy: 7, uw: 0.9, uh: 0.9 }, { type: 'table', ux: 5, uy: 5.4, uw: 1.5, uh: 1.2 }, { type: 'barrel', ux: 5.4, uy: 7, uw: 0.8, uh: 0.8 },
    { type: 'crate', ux: 6.6, uy: 7, uw: 0.9, uh: 0.9 }, { type: 'table', ux: 8, uy: 5.4, uw: 1.5, uh: 1.2 },
    { type: 'shelf', ux: 11.2, uy: 3, uw: 0.6, uh: 2 }, { type: 'chest', ux: 12.2, uy: 4.2, uw: 1.2, uh: 0.8 }
  ],
  tags: ['town', 'commerce'], hooks: []
};

// ── 6. LONGHOUSE — timber, tier 2 ───────────────────────────────────────────
const longhouse = {
  id: 'longhouse_mead', type: 'longhouse', name: 'Mead Longhouse', material: 'timber', tier: 2, entry: 'hall',
  rooms: [
    { id: 'hall', shape: 'rect', cx: 7, cy: 5, w: 12, h: 5, name: 'Long Hall', role: 'hall' },
    { id: 'bay1', shape: 'rect', cx: 3, cy: 8.5, w: 3, h: 2, name: 'Sleeping Bay', role: 'bedroom' },
    { id: 'bay2', shape: 'rect', cx: 7, cy: 8.5, w: 3, h: 2, name: 'Sleeping Bay', role: 'bedroom' },
    { id: 'bay3', shape: 'rect', cx: 11, cy: 8.5, w: 3, h: 2, name: 'Sleeping Bay', role: 'bedroom' }
  ],
  doors: [{ x: 3, y: 7.5, orient: 'h' }, { x: 7, y: 7.5, orient: 'h' }, { x: 11, y: 7.5, orient: 'h' }],
  mouths: [{ x: 1, y: 5, orient: 'v', len: 1 }],
  windows: [{ x: 4, y: 2.5, orient: 'h', t: 'slit' }, { x: 10, y: 2.5, orient: 'h', t: 'slit' }, { x: 13, y: 5, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'throne', ux: 12, uy: 4.4, uw: 1.2, uh: 1.2 },
    { type: 'hearth', ux: 4.6, uy: 4.6, uw: 1.4, uh: 0.7 }, { type: 'hearth', ux: 7.6, uy: 4.6, uw: 1.4, uh: 0.7 },
    { type: 'longtable', ux: 2, uy: 3.2, uw: 8, uh: 0.9 }, { type: 'longtable', ux: 2, uy: 6, uw: 8, uh: 0.9 },
    { type: 'bed', ux: 2.1, uy: 7.7, uw: 1.1, uh: 1.5 }, { type: 'bed', ux: 6.1, uy: 7.7, uw: 1.1, uh: 1.5 }, { type: 'bed', ux: 10.1, uy: 7.7, uw: 1.1, uh: 1.5 }
  ],
  tags: ['rural', 'clan'], hooks: []
};

// ── 7. LAIR — cave, tier 3 ──────────────────────────────────────────────────
const lair = {
  id: 'lair_den', type: 'lair', name: 'Beast Lair', material: 'cave', tier: 3, entry: 'den',
  rooms: [
    { id: 'den', shape: 'round', cx: 5, cy: 6, r: 3, name: 'Den', role: 'den' },
    { id: 'hollow', shape: 'round', cx: 11, cy: 5, r: 2, name: 'Gnaw Hollow', role: 'den' },
    { id: 'hoard', shape: 'round', cx: 11.5, cy: 10, r: 2.4, name: 'Hoard', role: 'vault' }
  ],
  corridors: [{ pts: [[7.8, 5.4], [9.1, 5]], w: 0.9 }, { pts: [[6.5, 8], [9.5, 9.6]], w: 0.9 }],
  mouths: [{ x: 2.2, y: 6, orient: 'v', len: 1.2 }, { x: 7.8, y: 5.4, orient: 'h', len: 0.9 }, { x: 9.1, y: 5, orient: 'h', len: 0.9 }],
  windows: [],
  furniture: [
    { type: 'bed', ux: 3.6, uy: 5.2, uw: 1.6, uh: 1.6 }, { type: 'barrel', ux: 5.6, uy: 4.2, uw: 0.8, uh: 0.8 }, { type: 'crate', ux: 5.4, uy: 6.6, uw: 0.9, uh: 0.9 },
    { type: 'barrel', ux: 10.4, uy: 4.4, uw: 0.8, uh: 0.8 },
    { type: 'chest', ux: 10.2, uy: 9.4, uw: 1.6, uh: 0.9 }, { type: 'statue', ux: 12, uy: 9.4, uw: 1, uh: 1.4 }
  ],
  tags: ['wild', 'beast'], hooks: ['the_hoard']
};

// ── 8. TOWER — stone round, tier 3 ──────────────────────────────────────────
const tower = {
  id: 'tower_arcane', type: 'tower', name: 'Arcane Tower', material: 'stone', tier: 3, entry: 'base',
  rooms: [
    { id: 'base', shape: 'round', cx: 5, cy: 6, r: 3, name: 'Tower Base', role: 'hall' },
    { id: 'study', shape: 'round', cx: 10.5, cy: 5.5, r: 2, name: 'Study', role: 'store' }
  ],
  corridors: [{ pts: [[7.9, 5.7], [8.6, 5.5]], w: 0.8 }],
  mouths: [{ x: 5, y: 9, orient: 'h', len: 1 }, { x: 7.9, y: 5.7, orient: 'h', len: 0.8 }, { x: 8.6, y: 5.5, orient: 'h', len: 0.8 }],
  windows: [{ x: 5, y: 3, orient: 'h', t: 'slit' }, { x: 2, y: 6, orient: 'v', t: 'slit' }, { x: 8, y: 6, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'column', ux: 3.4, uy: 4.4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 6, uy: 4.4, uw: 0.8, uh: 0.8 }, { type: 'brazier', ux: 4.6, uy: 6, uw: 0.9, uh: 0.9 }, { type: 'statue', ux: 4.5, uy: 7.4, uw: 1, uh: 1.4 },
    { type: 'shelf', ux: 9.2, uy: 4.3, uw: 0.6, uh: 2.2 }, { type: 'table', ux: 10.2, uy: 5.1, uw: 1.2, uh: 1 }, { type: 'chest', ux: 10.3, uy: 6.4, uw: 1.2, uh: 0.8 }
  ],
  tags: ['arcane'], hooks: []
};

// ── 9. HIVE — chitin/cave, tier 4 ───────────────────────────────────────────
const hive = {
  id: 'hive_chitin', type: 'hive', name: 'Chitin Hive', material: 'cave', tier: 4, entry: 'brood',
  rooms: [
    { id: 'brood', shape: 'round', cx: 6, cy: 6.5, r: 2.6, name: 'Brood Chamber', role: 'den' },
    { id: 'cell1', shape: 'round', cx: 10, cy: 4, r: 1.6, name: 'Cell', role: 'den' },
    { id: 'cell2', shape: 'round', cx: 10.5, cy: 8.5, r: 1.7, name: 'Cell', role: 'den' },
    { id: 'cell3', shape: 'round', cx: 2.6, cy: 10, r: 1.5, name: 'Cell', role: 'den' }
  ],
  corridors: [{ pts: [[8.1, 5.6], [8.7, 4.6]], w: 0.8 }, { pts: [[7.8, 7.6], [9.2, 8.2]], w: 0.8 }, { pts: [[4.4, 7.7], [3.2, 8.8]], w: 0.8 }],
  mouths: [{ x: 6, y: 3.9, orient: 'h', len: 1 }],
  windows: [],
  furniture: [
    { type: 'barrel', ux: 5.2, uy: 5.6, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 6.4, uy: 6.4, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 5.6, uy: 7.2, uw: 0.8, uh: 0.8 },
    { type: 'chest', ux: 9.8, uy: 8.2, uw: 1.3, uh: 0.8 }, { type: 'barrel', ux: 9.6, uy: 3.6, uw: 0.8, uh: 0.8 }
  ],
  tags: ['wild', 'swarm'], hooks: []
};

// ── 10. PRISON — fortified, tier 2 ──────────────────────────────────────────
const prison = {
  id: 'prison_gaol', type: 'prison', name: 'Town Gaol', material: 'fortified', tier: 2, entry: 'guard',
  rooms: [
    { id: 'guard', shape: 'rect', cx: 4, cy: 4, w: 5, h: 3, name: 'Guard Room', role: 'hall' },
    { id: 'warden', shape: 'rect', cx: 8, cy: 4, w: 3, h: 3, name: "Warden's Office", role: 'store' },
    { id: 'block', shape: 'rect', cx: 4, cy: 9, w: 5, h: 6, name: 'Cell Block', role: 'cells' }
  ],
  doors: [{ x: 6.5, y: 4, orient: 'v' }, { x: 4, y: 6, orient: 'h' }],
  mouths: [{ x: 1.5, y: 4, orient: 'v', len: 1 }],
  windows: [{ x: 4, y: 2.5, orient: 'h', t: 'slit' }, { x: 1.5, y: 8, orient: 'v', t: 'barred' }, { x: 1.5, y: 10, orient: 'v', t: 'barred' }, { x: 6.5, y: 8, orient: 'v', t: 'barred' }, { x: 6.5, y: 10, orient: 'v', t: 'barred' }, { x: 9.5, y: 4, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'table', ux: 2.2, uy: 3.4, uw: 1.4, uh: 1.1 }, { type: 'brazier', ux: 5.4, uy: 3.4, uw: 0.8, uh: 0.8 },
    { type: 'shelf', ux: 7.2, uy: 2.8, uw: 0.6, uh: 2 }, { type: 'chest', ux: 8.2, uy: 4, uw: 1.3, uh: 0.8 },
    { type: 'bars', ux: 1.8, uy: 7.6, uw: 4.4, uh: 0.4 }, { type: 'bed', ux: 1.9, uy: 8.4, uw: 1, uh: 1.4 }, { type: 'bed', ux: 5, uy: 8.4, uw: 1, uh: 1.4 },
    { type: 'bars', ux: 1.8, uy: 11, uw: 4.4, uh: 0.4 }, { type: 'bed', ux: 1.9, uy: 11.6, uw: 1, uh: 1.4 }, { type: 'bed', ux: 5, uy: 11.6, uw: 1, uh: 1.4 }
  ],
  tags: ['fortified', 'town'], hooks: ['wrongful_prisoner']
};

// ── 11. CASTLE — fortified, tier 3 ──────────────────────────────────────────
const castle = {
  id: 'castle_courtyard', type: 'castle', name: 'Castle', material: 'fortified', tier: 3, entry: 'gate',
  rooms: [
    { id: 'court', shape: 'rect', cx: 7, cy: 7, w: 5, h: 5, name: 'Courtyard', role: 'hall' },
    { id: 'gate', shape: 'rect', cx: 7, cy: 3, w: 4, h: 3, name: 'Gatehouse', role: 'hall' },
    { id: 'hall', shape: 'rect', cx: 11.5, cy: 7, w: 4, h: 5, name: 'Great Hall', role: 'hall' },
    { id: 'barracks', shape: 'rect', cx: 2.5, cy: 7, w: 4, h: 5, name: 'Barracks', role: 'cells' },
    { id: 'kitchen', shape: 'rect', cx: 7, cy: 11, w: 4, h: 3, name: 'Kitchen', role: 'kitchen' },
    { id: 'keep', shape: 'round', cx: 12.5, cy: 12, r: 2, name: 'Keep', role: 'vault' }
  ],
  doors: [{ x: 7, y: 4.5, orient: 'h' }, { x: 9.5, y: 7, orient: 'v' }, { x: 4.5, y: 7, orient: 'v' }, { x: 7, y: 9.5, orient: 'h' }],
  corridors: [{ pts: [[11.5, 9.5], [12.5, 10.2]], w: 0.8 }],
  mouths: [{ x: 7, y: 1.5, orient: 'h', len: 1.2 }, { x: 11.5, y: 9.5, orient: 'h', len: 0.8 }],
  windows: [{ x: 5.5, y: 3, orient: 'h', t: 'slit' }, { x: 8.5, y: 3, orient: 'h', t: 'slit' }, { x: 0.5, y: 6, orient: 'v', t: 'slit' }, { x: 0.5, y: 8, orient: 'v', t: 'slit' }, { x: 13.5, y: 6, orient: 'v', t: 'slit' }, { x: 13.5, y: 8, orient: 'v', t: 'slit' }, { x: 7, y: 12.5, orient: 'h', t: 'slit' }],
  furniture: [
    { type: 'brazier', ux: 5.4, uy: 2.4, uw: 0.8, uh: 0.8 }, { type: 'brazier', ux: 8.2, uy: 2.4, uw: 0.8, uh: 0.8 },
    { type: 'statue', ux: 6.5, uy: 6.3, uw: 1, uh: 1.4 }, { type: 'barrel', ux: 8, uy: 6.4, uw: 0.8, uh: 0.8 },
    { type: 'longtable', ux: 9.8, uy: 5.4, uw: 3.4, uh: 1 }, { type: 'throne', ux: 10.8, uy: 7.2, uw: 1.4, uh: 1.2 }, { type: 'hearth', ux: 12.8, uy: 4.8, uw: 1.4, uh: 0.6 },
    { type: 'bed', ux: 0.9, uy: 5.2, uw: 1, uh: 1.4 }, { type: 'bed', ux: 0.9, uy: 7.4, uw: 1, uh: 1.4 }, { type: 'bars', ux: 0.7, uy: 9, uw: 3.6, uh: 0.4 },
    { type: 'hearth', ux: 5.4, uy: 9.9, uw: 1.4, uh: 0.6 }, { type: 'table', ux: 7, uy: 10.6, uw: 1.4, uh: 1.1 }, { type: 'barrel', ux: 8.6, uy: 10.6, uw: 0.8, uh: 0.8 },
    { type: 'chest', ux: 11.7, uy: 11.6, uw: 1.6, uh: 0.9 }
  ],
  tags: ['fortified', 'seat'], hooks: ['the_keep_treasury']
};

// ── 12. FARM — timber, tier 1 ───────────────────────────────────────────────
const farm = {
  id: 'farm_stead', type: 'farm', name: 'Farmstead', material: 'timber', tier: 1, entry: 'house',
  rooms: [
    { id: 'house', shape: 'rect', cx: 4, cy: 5, w: 5, h: 4, name: 'Farmhouse', role: 'hall' },
    { id: 'larder', shape: 'rect', cx: 7.5, cy: 3.5, w: 2, h: 2, name: 'Larder', role: 'store' },
    { id: 'pen', shape: 'rect', cx: 9, cy: 6.5, w: 4, h: 3, name: 'Stock Pen', role: 'store' }
  ],
  doors: [{ x: 6.5, y: 3.5, orient: 'v' }, { x: 6.5, y: 6.5, orient: 'v' }],
  mouths: [{ x: 4, y: 7, orient: 'h', len: 1 }],
  windows: [{ x: 3, y: 3, orient: 'h', t: 'casement' }, { x: 2, y: 5, orient: 'v', t: 'casement' }, { x: 8, y: 4.5, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'hearth', ux: 2.2, uy: 3.3, uw: 1.4, uh: 0.7 }, { type: 'table', ux: 3.4, uy: 4.6, uw: 1.4, uh: 1.1 }, { type: 'bed', ux: 2, uy: 5.6, uw: 1, uh: 1.2 },
    { type: 'shelf', ux: 6.7, uy: 2.8, uw: 0.5, uh: 1.4 }, { type: 'barrel', ux: 7.6, uy: 3, uw: 0.7, uh: 0.7 },
    { type: 'crate', ux: 7.6, uy: 5.6, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 9, uy: 5.6, uw: 0.8, uh: 0.8 }, { type: 'crate', ux: 10, uy: 6.6, uw: 0.9, uh: 0.9 }
  ],
  tags: ['rural', 'home'], hooks: []
};

// ── 13. BARN — timber, tier 1 ───────────────────────────────────────────────
const barn = {
  id: 'barn_hay', type: 'barn', name: 'Barn', material: 'timber', tier: 1, entry: 'floor',
  rooms: [
    { id: 'floor', shape: 'rect', cx: 6, cy: 6, w: 8, h: 7, name: 'Barn Floor', role: 'hall' },
    { id: 'tack', shape: 'rect', cx: 11.5, cy: 4, w: 3, h: 3, name: 'Tack Room', role: 'store' }
  ],
  doors: [{ x: 10, y: 4, orient: 'v' }],
  mouths: [{ x: 6, y: 9.5, orient: 'h', len: 2.2 }],
  windows: [{ x: 3, y: 2.5, orient: 'h', t: 'casement' }, { x: 9, y: 2.5, orient: 'h', t: 'casement' }, { x: 2, y: 6, orient: 'v', t: 'casement' }, { x: 13, y: 4, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'bars', ux: 2.4, uy: 3.4, uw: 0.4, uh: 4.8 }, { type: 'bars', ux: 4.4, uy: 3.4, uw: 0.4, uh: 4.8 },
    { type: 'crate', ux: 2.8, uy: 3.6, uw: 1, uh: 1 }, { type: 'crate', ux: 2.8, uy: 6.4, uw: 1, uh: 1 },
    { type: 'barrel', ux: 6.4, uy: 4, uw: 0.9, uh: 0.9 }, { type: 'crate', ux: 7.6, uy: 4, uw: 1, uh: 1 }, { type: 'crate', ux: 6.6, uy: 7, uw: 1, uh: 1 }, { type: 'barrel', ux: 8, uy: 7.2, uw: 0.9, uh: 0.9 },
    { type: 'shelf', ux: 10.2, uy: 2.8, uw: 0.6, uh: 2 }, { type: 'chest', ux: 11.2, uy: 4, uw: 1.3, uh: 0.8 }
  ],
  tags: ['rural'], hooks: []
};

// ── 14. SHED — timber, tier 1 ───────────────────────────────────────────────
const shed = {
  id: 'shed_tool', type: 'shed', name: 'Tool Shed', material: 'timber', tier: 1, entry: 'shed',
  rooms: [
    { id: 'shed', shape: 'rect', cx: 4, cy: 4, w: 4, h: 3.5, name: 'Shed', role: 'store' },
    { id: 'lean', shape: 'rect', cx: 7, cy: 4, w: 2, h: 2.5, name: 'Lean-to', role: 'store' }
  ],
  doors: [{ x: 6, y: 4, orient: 'v' }],
  mouths: [{ x: 4, y: 5.75, orient: 'h', len: 1 }],
  windows: [{ x: 4, y: 2.25, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'shelf', ux: 2.2, uy: 2.5, uw: 0.5, uh: 2.4 }, { type: 'table', ux: 3.2, uy: 3.4, uw: 1.4, uh: 1 }, { type: 'crate', ux: 4.8, uy: 4.2, uw: 0.9, uh: 0.9 },
    { type: 'barrel', ux: 6.6, uy: 3.4, uw: 0.7, uh: 0.7 }
  ],
  tags: ['rural'], hooks: []
};

// ── 15. CAPITAL — stone, tier 2 ─────────────────────────────────────────────
const capital = {
  id: 'capital_rotunda', type: 'capital', name: 'Capitol', material: 'stone', tier: 2, entry: 'rotunda',
  rooms: [
    { id: 'rotunda', shape: 'round', cx: 7, cy: 6, r: 3.2, name: 'Rotunda', role: 'hall' },
    { id: 'west', shape: 'rect', cx: 2, cy: 6, w: 3, h: 3, name: 'West Offices', role: 'store' },
    { id: 'east', shape: 'rect', cx: 12, cy: 6, w: 3, h: 3, name: 'East Offices', role: 'store' },
    { id: 'archive', shape: 'rect', cx: 7, cy: 11.5, w: 5, h: 3, name: 'Archives', role: 'store' }
  ],
  corridors: [{ pts: [[3.5, 6], [3.8, 6]], w: 0.8 }, { pts: [[10.2, 6], [10.5, 6]], w: 0.8 }, { pts: [[7, 9.2], [7, 10]], w: 0.9 }],
  mouths: [{ x: 7, y: 2.8, orient: 'h', len: 1.4 }],
  windows: [{ x: 0.5, y: 6, orient: 'v', t: 'casement' }, { x: 13.5, y: 6, orient: 'v', t: 'casement' }, { x: 5, y: 11.5, orient: 'h', t: 'casement' }, { x: 9, y: 11.5, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'throne', ux: 6.3, uy: 4.4, uw: 1.4, uh: 1.3 }, { type: 'column', ux: 4.6, uy: 4.4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 8.6, uy: 4.4, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 4.6, uy: 7.2, uw: 0.8, uh: 0.8 }, { type: 'column', ux: 8.6, uy: 7.2, uw: 0.8, uh: 0.8 },
    { type: 'longtable', ux: 5.2, uy: 7.6, uw: 3.6, uh: 0.9 },
    { type: 'shelf', ux: 1.2, uy: 5, uw: 0.5, uh: 2 }, { type: 'table', ux: 2, uy: 5.6, uw: 1.2, uh: 1 },
    { type: 'shelf', ux: 12.4, uy: 5, uw: 0.5, uh: 2 }, { type: 'chest', ux: 11.4, uy: 6, uw: 1.2, uh: 0.8 },
    { type: 'shelf', ux: 5, uy: 10.4, uw: 4, uh: 0.5 }, { type: 'chest', ux: 6.4, uy: 11.4, uw: 1.3, uh: 0.8 }
  ],
  tags: ['civic', 'seat'], hooks: ['sealed_archive']
};

// ── 16. COURTHOUSE — stone, tier 2 ──────────────────────────────────────────
const courthouse = {
  id: 'courthouse_assize', type: 'courthouse', name: 'Courthouse', material: 'stone', tier: 2, entry: 'court',
  rooms: [
    { id: 'court', shape: 'rect', cx: 5, cy: 6.5, w: 6, h: 7, name: 'Courtroom', role: 'nave' },
    { id: 'chambers', shape: 'rect', cx: 9.5, cy: 4, w: 3, h: 3, name: "Judge's Chambers", role: 'store' },
    { id: 'holding', shape: 'rect', cx: 9.5, cy: 9, w: 3, h: 3, name: 'Holding Cell', role: 'cells' }
  ],
  doors: [{ x: 8, y: 4, orient: 'v' }, { x: 8, y: 9, orient: 'v' }],
  mouths: [{ x: 5, y: 10, orient: 'h', len: 1.4 }],
  windows: [{ x: 3, y: 3, orient: 'h', t: 'casement' }, { x: 7, y: 3, orient: 'h', t: 'casement' }, { x: 2, y: 6, orient: 'v', t: 'casement' }, { x: 11, y: 4, orient: 'v', t: 'casement' }, { x: 11, y: 9, orient: 'v', t: 'barred' }],
  furniture: [
    { type: 'throne', ux: 4.3, uy: 3.4, uw: 1.4, uh: 1.2 }, { type: 'column', ux: 2.6, uy: 5, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 6.7, uy: 5, uw: 0.7, uh: 0.7 },
    { type: 'longtable', ux: 3, uy: 6.4, uw: 4, uh: 0.8 }, { type: 'longtable', ux: 3, uy: 8, uw: 4, uh: 0.8 },
    { type: 'shelf', ux: 8.2, uy: 2.8, uw: 0.6, uh: 2 }, { type: 'table', ux: 9.2, uy: 3.6, uw: 1.2, uh: 1 },
    { type: 'bars', ux: 8.2, uy: 10.6, uw: 2.6, uh: 0.4 }, { type: 'bed', ux: 8.3, uy: 8.2, uw: 1, uh: 1.4 }
  ],
  tags: ['civic'], hooks: ['the_sealed_verdict']
};

// ── 17. WATERMILL — timber, tier 1 (invented) ───────────────────────────────
const mill = {
  id: 'mill_water', type: 'mill', name: 'Watermill', material: 'timber', tier: 1, entry: 'mill',
  rooms: [
    { id: 'mill', shape: 'rect', cx: 4, cy: 5, w: 5, h: 5, name: 'Mill Room', role: 'hall' },
    { id: 'store', shape: 'rect', cx: 8, cy: 3.5, w: 3, h: 2, name: 'Grain Store', role: 'store' },
    { id: 'quarters', shape: 'rect', cx: 8, cy: 6.5, w: 3, h: 2, name: "Miller's Room", role: 'bedroom' }
  ],
  doors: [{ x: 6.5, y: 3.5, orient: 'v' }, { x: 6.5, y: 6.5, orient: 'v' }],
  mouths: [{ x: 4, y: 7.5, orient: 'h', len: 1 }],
  windows: [{ x: 2, y: 4, orient: 'v', t: 'casement' }, { x: 4, y: 2.5, orient: 'h', t: 'casement' }, { x: 9.5, y: 3.5, orient: 'v', t: 'casement' }, { x: 9.5, y: 6.5, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'barrel', ux: 3.6, uy: 4.2, uw: 1.6, uh: 1.6 }, { type: 'crate', ux: 2.2, uy: 3.2, uw: 0.9, uh: 0.9 }, { type: 'crate', ux: 2.2, uy: 6, uw: 0.9, uh: 0.9 }, { type: 'barrel', ux: 5.4, uy: 6.2, uw: 0.8, uh: 0.8 },
    { type: 'crate', ux: 7.2, uy: 2.9, uw: 0.9, uh: 0.9 }, { type: 'crate', ux: 8.4, uy: 2.9, uw: 0.9, uh: 0.9 },
    { type: 'bed', ux: 7, uy: 5.7, uw: 1, uh: 1.4 }, { type: 'table', ux: 8.6, uy: 6.1, uw: 1, uh: 0.9 }
  ],
  tags: ['rural', 'industry'], hooks: []
};

// ── 18. SMITHY — stone, tier 2 (invented) ───────────────────────────────────
const smithy = {
  id: 'smithy_forge', type: 'smithy', name: 'Smithy', material: 'stone', tier: 2, entry: 'forge',
  rooms: [
    { id: 'forge', shape: 'rect', cx: 4, cy: 5, w: 5, h: 5, name: 'Forge', role: 'hall' },
    { id: 'store', shape: 'rect', cx: 8, cy: 5, w: 3, h: 3, name: 'Storeroom', role: 'store' }
  ],
  doors: [{ x: 6.5, y: 5, orient: 'v' }],
  mouths: [{ x: 4, y: 7.5, orient: 'h', len: 1.4 }],
  windows: [{ x: 2, y: 4, orient: 'v', t: 'casement' }, { x: 3, y: 2.5, orient: 'h', t: 'casement' }, { x: 9.5, y: 5, orient: 'v', t: 'casement' }],
  furniture: [
    { type: 'hearth', ux: 2.2, uy: 2.7, uw: 1.6, uh: 0.8 }, { type: 'table', ux: 4.2, uy: 4.2, uw: 1.6, uh: 1.2 }, { type: 'barrel', ux: 2.4, uy: 5.6, uw: 0.9, uh: 0.9 }, { type: 'brazier', ux: 5.4, uy: 6, uw: 0.9, uh: 0.9 },
    { type: 'shelf', ux: 7.2, uy: 3.8, uw: 0.6, uh: 2.4 }, { type: 'crate', ux: 8.2, uy: 4.2, uw: 0.9, uh: 0.9 }, { type: 'chest', ux: 8, uy: 5.6, uw: 1.3, uh: 0.8 }
  ],
  tags: ['town', 'craft'], hooks: []
};

// ── 19. MANOR — timber, tier 2 (invented) ───────────────────────────────────
const manor = {
  id: 'manor_house', type: 'manor', name: 'Manor House', material: 'timber', tier: 2, entry: 'hall',
  rooms: [
    { id: 'hall', shape: 'rect', cx: 5, cy: 5, w: 5, h: 4, name: 'Entry Hall', role: 'hall' },
    { id: 'parlour', shape: 'rect', cx: 9.5, cy: 4, w: 4, h: 3, name: 'Parlour', role: 'hall' },
    { id: 'kitchen', shape: 'rect', cx: 9.5, cy: 8, w: 4, h: 3, name: 'Kitchen', role: 'kitchen' },
    { id: 'bedchamber', shape: 'rect', cx: 3, cy: 8.5, w: 4, h: 3, name: 'Bedchamber', role: 'bedroom' },
    { id: 'study', shape: 'rect', cx: 6.5, cy: 9.5, w: 3, h: 2.5, name: 'Study', role: 'store' }
  ],
  doors: [{ x: 7.5, y: 4, orient: 'v' }, { x: 7.5, y: 6.5, orient: 'v' }, { x: 3, y: 7, orient: 'h' }, { x: 5, y: 9.5, orient: 'v' }],
  mouths: [{ x: 5, y: 3, orient: 'h', len: 1.2 }],
  windows: [{ x: 2.5, y: 5, orient: 'v', t: 'casement' }, { x: 11.5, y: 4, orient: 'v', t: 'casement' }, { x: 11.5, y: 8, orient: 'v', t: 'casement' }, { x: 1, y: 8.5, orient: 'v', t: 'casement' }, { x: 9.5, y: 2.5, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'rug', ux: 3.4, uy: 4.4, uw: 3.2, uh: 1.2 }, { type: 'column', ux: 3, uy: 3.4, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 6.3, uy: 3.4, uw: 0.7, uh: 0.7 },
    { type: 'hearth', ux: 8.6, uy: 2.8, uw: 1.4, uh: 0.6 }, { type: 'table', ux: 9, uy: 4, uw: 1.4, uh: 1.1 }, { type: 'rug', ux: 8.4, uy: 4.4, uw: 2, uh: 1 },
    { type: 'hearth', ux: 8.6, uy: 6.8, uw: 1.4, uh: 0.6 }, { type: 'table', ux: 9, uy: 8, uw: 1.4, uh: 1.1 }, { type: 'barrel', ux: 10.6, uy: 8.2, uw: 0.8, uh: 0.8 },
    { type: 'bed', ux: 1.6, uy: 7.7, uw: 1.2, uh: 1.6 }, { type: 'chest', ux: 3.4, uy: 7.7, uw: 1.3, uh: 0.8 },
    { type: 'shelf', ux: 5.4, uy: 8.5, uw: 0.5, uh: 1.8 }, { type: 'table', ux: 6.4, uy: 9.2, uw: 1.1, uh: 0.9 }
  ],
  tags: ['residence', 'noble'], hooks: ['hidden_will']
};

// ── 20. MAUSOLEUM — stone, tier 3 (invented) ────────────────────────────────
const mausoleum = {
  id: 'mausoleum_tomb', type: 'mausoleum', name: 'Mausoleum', material: 'stone', tier: 3, entry: 'antecham',
  rooms: [
    { id: 'antecham', shape: 'rect', cx: 4, cy: 4, w: 4, h: 3, name: 'Antechamber', role: 'nave' },
    { id: 'vault_l', shape: 'rect', cx: 2.5, cy: 8, w: 3, h: 3, name: 'Burial Vault', role: 'crypt' },
    { id: 'vault_r', shape: 'rect', cx: 5.5, cy: 8, w: 3, h: 3, name: 'Burial Vault', role: 'crypt' },
    { id: 'inner', shape: 'round', cx: 9.5, cy: 4, r: 2, name: 'Inner Tomb', role: 'vault' }
  ],
  doors: [{ x: 2.5, y: 5.5, orient: 'h' }, { x: 5.5, y: 5.5, orient: 'h' }],
  corridors: [{ pts: [[6, 4], [7.5, 4]], w: 0.7 }],
  mouths: [{ x: 4, y: 2.5, orient: 'h', len: 1 }, { x: 6, y: 4, orient: 'h', len: 0.7 }, { x: 7.5, y: 4, orient: 'h', len: 0.7 }],
  windows: [{ x: 2, y: 4, orient: 'v', t: 'slit' }],
  furniture: [
    { type: 'statue', ux: 2.6, uy: 2.8, uw: 1, uh: 1.4 }, { type: 'brazier', ux: 4.6, uy: 3.2, uw: 0.8, uh: 0.8 }, { type: 'altar', ux: 4.4, uy: 4.4, uw: 1.4, uh: 1.1 },
    { type: 'chest', ux: 1.4, uy: 7.4, uw: 1.4, uh: 0.9 }, { type: 'altar', ux: 1.6, uy: 8.6, uw: 1.6, uh: 1 },
    { type: 'chest', ux: 4.4, uy: 7.4, uw: 1.4, uh: 0.9 }, { type: 'altar', ux: 4.6, uy: 8.6, uw: 1.6, uh: 1 },
    { type: 'chest', ux: 8.6, uy: 3.6, uw: 1.6, uh: 0.9 }, { type: 'statue', ux: 10, uy: 3.4, uw: 1, uh: 1.4 }
  ],
  tags: ['funerary', 'sealed'], hooks: ['the_sealed_tomb']
};

// ── 21. BATHHOUSE — stone, tier 1 (invented) ────────────────────────────────
const bathhouse = {
  id: 'bathhouse_steam', type: 'bathhouse', name: 'Bathhouse', material: 'stone', tier: 1, entry: 'hall',
  rooms: [
    { id: 'hall', shape: 'rect', cx: 4, cy: 4, w: 4, h: 3, name: 'Entry Hall', role: 'hall' },
    { id: 'cold', shape: 'round', cx: 9, cy: 4, r: 1.8, name: 'Cold Pool', role: 'pool' },
    { id: 'warm', shape: 'round', cx: 4, cy: 8.5, r: 2, name: 'Warm Pool', role: 'pool' },
    { id: 'hot', shape: 'round', cx: 9, cy: 8.5, r: 2, name: 'Hot Pool', role: 'pool' }
  ],
  corridors: [{ pts: [[6, 4], [7.2, 4]], w: 0.8 }, { pts: [[4, 6], [4, 6.5]], w: 0.9 }, { pts: [[6, 8.5], [7, 8.5]], w: 0.9 }],
  mouths: [{ x: 4, y: 2.5, orient: 'h', len: 1.2 }, { x: 6, y: 4, orient: 'h', len: 0.8 }],
  windows: [{ x: 2, y: 4, orient: 'v', t: 'casement' }, { x: 4, y: 2.5, orient: 'h', t: 'casement' }],
  furniture: [
    { type: 'longtable', ux: 2.4, uy: 3.2, uw: 1, uh: 1.8 }, { type: 'shelf', ux: 5.2, uy: 2.8, uw: 0.5, uh: 2.2 }, { type: 'column', ux: 5.4, uy: 4.6, uw: 0.7, uh: 0.7 },
    { type: 'statue', ux: 8.5, uy: 3.3, uw: 1, uh: 1.3 },
    { type: 'column', ux: 2.6, uy: 8.2, uw: 0.7, uh: 0.7 }, { type: 'column', ux: 10.4, uy: 8.2, uw: 0.7, uh: 0.7 }
  ],
  tags: ['civic', 'leisure'], hooks: []
};

export const PLANS = [
  cottage, tavern, chapel, keep, market, longhouse, lair, tower, hive,
  prison, castle, farm, barn, shed, capital, courthouse,
  mill, smithy, manor, mausoleum, bathhouse
];
export const PLAN_TYPES = PLANS.map(p => p.type);
export function getPlan(idOrType) {
  const k = String(idOrType || '');
  return PLANS.find(p => p.id === k) || PLANS.find(p => p.type === k) || null;
}
