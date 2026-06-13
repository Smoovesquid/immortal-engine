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

/**
 * generateDungeon(seed, entranceNodeId, opts) -> Dungeon (normalized, deterministic).
 * opts: { scale='shrine', biome='wilderness', theme? }. The caller passes the
 * LIVE biome (biomeForNode(seed, node)) so the dungeon matches its surroundings
 * and regenerates identically anywhere it's needed.
 */
export function generateDungeon(seed, entranceNodeId, opts = {}) {
  const nodeId = String(entranceNodeId || '');
  const biome = String(opts.biome || 'wilderness');
  const scale = ['shrine', 'small', 'site', 'mega'].includes(opts.scale) ? opts.scale : 'shrine';
  const rng = makeRng(seedFromString(`${seed}|dungeon|${nodeId}`));
  const theme = opts.theme || themeFor(rng, biome);

  // D0: every scale builds a shrine for now; D1→D4 grow `small`/`site`/`mega`.
  const levels = buildShrine(rng, theme);

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
