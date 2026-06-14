// The Underworld — the dungeon generator (docs/WORLD_AND_DUNGEONS.md Part B).
//
// One author of the schema (schema.js). Deterministic from seed + entranceNodeId
// (+ the surface biome it sits under), so the same descent yields the same place
// forever — and a lazily-generated 40th floor of Moria (D4) is stable too.
// makeRng(seedFromString(...)) only; no Math.random.
//
// D0 fills the smallest scale — `shrine`: one level, one room, one feature. The
// other scales (small/site/mega) land in D1→D4; until then they fall back to a
// shrine so the spine never breaks. `dungeonLevelToStructure` is the runtime
// bridge: it projects a level into the {id,tags}+edges structure the existing
// interior crawl (engine/structures/interiors.js) already navigates.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeDungeon } from './schema.js';

// Surface biome → the dungeon themes that fit beneath it. The mountains are the
// natural home of mines and holds; marshes drain into sewers; the cold keeps crypts.
const THEME_BY_BIOME = {
  mountains: ['mine', 'hold'], arctic: ['crypt', 'hold'], marsh: ['sewer', 'crypt'],
  desert: ['crypt', 'shrine'], forest: ['shrine', 'lair'], coastal: ['sewer', 'lair'],
  plains: ['crypt', 'shrine'], wilderness: ['shrine', 'crypt']
};

// A shrine's single feature, flavoured by theme. Read-only at D0 — a DM moment,
// not a mechanic yet (boons/curses come with the object model).
const SHRINE_FEATURE = {
  shrine: { name: 'a cracked altar', look: 'A low altar of weathered stone, its god long forgotten', detail: 'Old offerings have rotted to nothing in the basin; the carved name is worn past reading.' },
  crypt: { name: 'a sealed sarcophagus', look: 'A single stone coffin, lid grey with dust', detail: 'The seam is mortared shut. Something was meant to stay in — or stay out.' },
  mine: { name: 'a glittering seam', look: 'A vein of strange ore threads the rock face', detail: 'It catches your light and holds it a half-second too long, as if reluctant to give it back.' },
  hold: { name: 'a war-banner', look: 'A rotted banner hangs over a captain\'s empty chair', detail: 'The sigil is unfamiliar; whoever held this hall did not leave by choice.' },
  sewer: { name: 'a votive grate', look: 'A bronze grate set in the floor, ringed with tallow stubs', detail: 'People came down here to wish for things. The water below gives nothing back but the smell.' },
  lair: { name: 'a bone-strewn nest', look: 'A hollow lined with gnawed bones and matted nesting', detail: 'It is cold now. Whatever denned here has not fed in some time — or has only just left.' },
  infernal: { name: 'a scorched sigil', look: 'A circle burned black into the floor', detail: 'The stone is warm. The lines were drawn to summon something, or to keep a bargain.' }
};

function pick(rng, arr) { return arr[Math.floor(rng.nextFloat() * arr.length)] || arr[0]; }

function themeFor(rng, biome) {
  const bank = THEME_BY_BIOME[biome] || THEME_BY_BIOME.wilderness;
  return pick(rng, bank);
}

// Build the one-room shrine level. The room is dark, holds the feature, and has
// no exits (the entry IS the shrine) — the smallest valid dungeon.
function buildShrine(rng, theme) {
  const feat = SHRINE_FEATURE[theme] || SHRINE_FEATURE.shrine;
  const room = {
    id: 'r:shrine',
    role: 'shrine',
    exits: [],
    contents: [{ kind: 'feature', name: feat.name, look: feat.look, detail: feat.detail }],
    dressing: ['dust', 'cold stone', 'still air'],
    light: 'dark'
  };
  return [{ depth: 0, entryRoomId: room.id, rooms: { [room.id]: room }, downStairsRoomId: null, upStairsRoomId: null }];
}

// Themed dressing for an ordinary chamber's feature line.
const CHAMBER_DRESSING = {
  shrine: 'broken votive candles and a cracked flagstone underfoot',
  crypt: 'rows of bone-niches, most of them empty',
  mine: 'abandoned tools and the splintered ribs of an ore-cart',
  hold: 'a toppled table and sconces eaten through with rust',
  sewer: 'a slick of black water and a drain choked with rot',
  lair: 'gnawed bones and the close animal reek of a den',
  infernal: 'scorch-marks fanned across the walls and a faint sulphur tang'
};

// A room's feature (D1: descriptive — a DM moment per room). Vaults hold the
// theme's centerpiece; caches a forgotten stash; chambers their dressing; bare
// corridors and the entry get nothing but cold stone. (Encounters + real
// treasure are populated in D1b.)
function roomContents(role, theme) {
  if (role === 'vault') {
    const f = SHRINE_FEATURE[theme] || SHRINE_FEATURE.shrine;
    return [{ kind: 'feature', name: f.name, look: f.look, detail: f.detail }];
  }
  if (role === 'cache') {
    return [{ kind: 'feature', name: 'a forgotten stash', look: 'A niche cut into the stone, half-hidden behind fallen rubble', detail: 'Someone hid something here and never came back for it.' }];
  }
  if (role === 'chamber') {
    const d = CHAMBER_DRESSING[theme] || CHAMBER_DRESSING.crypt;
    return [{ kind: 'feature', name: 'the chamber', look: `A low chamber: ${d}`, detail: 'Whatever passed through here is long gone.' }];
  }
  return [];
}

// Build a small dungeon: 5–12 rooms, one level, a real D&D room graph (a branching
// tree off the entry with a loop or two), the deepest room its vault. Deterministic.
function buildSmall(rng, theme) {
  const n = 5 + rng.int(0, 7);                          // 5–12 rooms
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(i === 0 ? 'r:entry' : `r:r${i}`);
  // spanning tree: each new room hangs off an existing one (branching, not a line).
  const pairs = [];
  for (let i = 1; i < n; i++) pairs.push([ids[i], ids[rng.int(0, i - 1)]]);
  // a loop or two so the crawl isn't a pure tree.
  const loops = rng.int(0, 2);
  for (let k = 0; k < loops; k++) {
    const a = rng.int(1, n - 1), b = rng.int(1, n - 1);
    if (a !== b) pairs.push([ids[a], ids[b]]);
  }
  const adj = new Map(ids.map(id => [id, new Set()]));
  for (const [a, b] of pairs) { adj.get(a).add(b); adj.get(b).add(a); }
  // BFS depth from the entry — the deepest room becomes the vault (the heart).
  const depth = new Map([['r:entry', 0]]);
  const q = ['r:entry'];
  while (q.length) { const x = q.shift(); for (const nb of adj.get(x)) if (!depth.has(nb)) { depth.set(nb, depth.get(x) + 1); q.push(nb); } }
  let vault = 'r:entry', vd = -1;
  for (const id of ids) { const d = depth.get(id) ?? 0; if (d > vd) { vd = d; vault = id; } }
  const rooms = {};
  for (const id of ids) {
    const deg = adj.get(id).size;
    const role = id === 'r:entry' ? 'entry' : id === vault ? 'vault' : deg === 1 ? 'cache' : deg >= 3 ? 'chamber' : 'corridor';
    rooms[id] = {
      id, role,
      exits: [...adj.get(id)].sort((a, b) => a.localeCompare(b)),
      contents: roomContents(role, theme),
      dressing: ['cold stone', 'dust', 'still air'],
      light: 'dark'
    };
  }
  return [{ depth: 0, entryRoomId: 'r:entry', rooms, downStairsRoomId: null, upStairsRoomId: null }];
}

/**
 * generateDungeon(seed, entranceNodeId, opts) -> Dungeon (normalized, deterministic).
 * opts: { scale='shrine', biome='wilderness', theme? }. The caller passes the
 * LIVE biome (biomeForNode(seed, node)) so the dungeon matches its surroundings
 * and regenerates identically anywhere it's needed.
 */
export function generateDungeon(seed, entranceNodeId, opts = {}) {
  const nodeId = String(entranceNodeId || '');
  const biome = String(opts.biome || 'wilderness');
  // A dungeon_entrance is a real (small) dungeon by default; the 1-room shrine is
  // for basements/roadside crypts (an explicit scale). site/mega arrive in D3/D4.
  const scale = ['shrine', 'small', 'site', 'mega'].includes(opts.scale) ? opts.scale : 'small';
  const rng = makeRng(seedFromString(`${seed}|dungeon|${nodeId}`));
  const theme = opts.theme || themeFor(rng, biome);

  const levels = (scale === 'shrine') ? buildShrine(rng, theme) : buildSmall(rng, theme);

  return normalizeDungeon({ id: `dungeon:${nodeId}`, seed: String(seed), entranceNodeId: nodeId, scale, theme, biome, levels });
}

/** Deterministic structure id for a dungeon level (the runtime crawl artifact). */
export function dungeonStructureId(entranceNodeId, depth = 0) {
  const n = String(entranceNodeId || '');
  return depth ? `dungeon:${n}:d${depth}` : `dungeon:${n}`;
}

/** True if a structure id names a dungeon (so the crawl/render can branch). */
export function isDungeonStructureId(id) {
  return /^dungeon:/.test(String(id || ''));
}

/**
 * dungeonLevelToStructure(dungeon, depth) -> a structure {id, kind:'dungeon',
 * nodeId, topology, tags} the existing interior crawl navigates. Only the
 * navigable graph (room ids + role tags + edges) is projected — rich contents
 * stay in the schema, re-derived on demand (engine topology keeps only id+tags).
 */
export function dungeonLevelToStructure(dungeon, depth = 0) {
  const level = dungeon?.levels?.[depth];
  if (!level) return null;
  const rooms = [];
  const edgeSet = new Set();
  const edges = [];
  for (const r of Object.values(level.rooms)) {
    const tags = [r.role];
    if (r.id === level.entryRoomId) tags.push('entry');
    if (level.downStairsRoomId === r.id) tags.push('stairs-down');
    if (level.upStairsRoomId === r.id) tags.push('stairs-up');
    rooms.push({ id: r.id, tags });
    for (const ex of r.exits) {
      const key = r.id < ex ? `${r.id}|${ex}` : `${ex}|${r.id}`;
      if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ a: r.id, b: ex }); }
    }
  }
  return {
    id: dungeonStructureId(dungeon.entranceNodeId, depth),
    kind: 'dungeon',
    nodeId: String(dungeon.entranceNodeId),
    topology: { kind: 'rooms', rooms, edges },
    tags: ['dungeon', `scale:${dungeon.scale}`, `theme:${dungeon.theme}`, `depth:${depth}`]
  };
}

/** Re-derive a room's rich data (contents/light/dressing) on demand. */
export function dungeonRoomAt(seed, entranceNodeId, roomId, opts = {}) {
  const d = generateDungeon(seed, entranceNodeId, opts);
  const depth = Number.isFinite(+opts.depth) ? +opts.depth : 0;
  return d.levels[depth]?.rooms[String(roomId)] || null;
}
