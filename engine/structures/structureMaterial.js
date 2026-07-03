// Structure Material — the ONE canonical answer to "what is this building made of."
// (ROM-0, docs/briefs/ROOM_OCCUPANCY_MODEL.md — the C2 seam: "wooden wall" → "stone
// wall" → "it was always stone". The renderer always knew the shell (floorPlan's
// BUILDING_SHELL); the prose stack was never told, so narration free-associated.)
//
// Like roomOccupancy/roomObjects/roomWindows this is DERIVED state: a fixed table
// keyed by the structure's effective building type — the SAME type resolution
// floorPlan uses, so the drawn map and the spoken prose can never disagree about
// what a wall is made of (the map-fidelity rule). No RNG beyond the shared
// buildingTypeFor id-hash, nothing stored, no WORLD_VERSION bump, worldHash
// byte-identical.
//
// Consumers (per the ROM plan):
//   ROM-0  getRoomState().material            (landed with this module)
//   ROM-2  interiorLayoutFact material line + validateNarrationCandidate, via
//          `line` (the prompt-ready fact) and `forbidden` (the contradiction
//          lexicon — wall-material phrases this structure's narration must never
//          contain). The lexicon lives HERE so prompt and validator import one
//          truth instead of re-deriving two.

import { buildingTypeFor } from './roomDetail.js';

// Wall-material word families. `forbidden` for a structure = the OTHER families'
// words composed into wall phrases — deliberately wall-scoped ("stone wall",
// "walls of stone"), never bare words, so a real stone basin or wooden chair in
// the room can still be narrated freely.
const WALL_FAMILY_WORDS = {
  timber: ['wooden', 'wood', 'timber', 'plank', 'log', 'wattle'],
  stone: ['stone', 'rock', 'masonry', 'brick', 'granite', 'marble'],
  chitin: ['chitin', 'chitinous', 'resin'],
};

function wallPhrases(words) {
  const out = [];
  for (const w of words) {
    out.push(`${w} wall`, `${w} walls`, `wall of ${w}`, `walls of ${w}`);
  }
  return out;
}

function forbiddenFor(family) {
  if (family === 'open') return []; // a market hall barely has walls — don't police it
  const out = [];
  for (const [fam, words] of Object.entries(WALL_FAMILY_WORDS)) {
    if (fam === family) continue;
    out.push(...wallPhrases(words));
  }
  return out;
}

function line(family, walls, floor) {
  if (family === 'open') return `This building stands open — ${walls}, a ${floor}.`;
  return `This building is ${family}-built — ${walls}, a ${floor}.`;
}

// shell values MUST stay byte-identical to what floorPlan historically drew
// (chapel:'stone', tavern/cottage/longhouse:'timber', market:'open',
// keep:'fortified', lair:'cave', tower:'round', hive:'chitin') — floorPlan now
// imports SHELL_BY_TYPE from here, so the renderer output cannot drift.
function mat(shell, family, walls, floor) {
  return Object.freeze({
    shell,
    family,
    walls,
    floor,
    line: line(family, walls, floor),
    forbidden: Object.freeze(forbiddenFor(family)),
  });
}

const MATERIALS = Object.freeze({
  chapel: mat('stone', 'stone', 'cold masonry walls', 'flagstone floor'),
  tavern: mat('timber', 'timber', 'timber-framed walls', 'plank floor'),
  market: mat('open', 'open', 'post-and-canvas sides', 'packed-earth floor'),
  keep: mat('fortified', 'stone', 'thick fortified stone walls', 'flagstone floor'),
  cottage: mat('timber', 'timber', 'timber-framed, wattle-and-daub walls', 'plank-and-earth floor'),
  longhouse: mat('timber', 'timber', 'long timber-plank walls', 'packed-earth floor'),
  lair: mat('cave', 'stone', 'raw rock walls', 'uneven stone floor'),
  tower: mat('round', 'stone', 'curved stone walls', 'stone floor'),
  hive: mat('chitin', 'chitin', 'ridged chitin walls', 'resin-slick floor'),
});

// floorPlan's shell lookup — one table, two surfaces (map + prose).
export const SHELL_BY_TYPE = Object.freeze(
  Object.fromEntries(Object.entries(MATERIALS).map(([t, m]) => [t, m.shell]))
);

// floorPlan's historical fallback for an unknown/underived type was 'stone';
// the material fact must describe the same building the map draws.
const DEFAULT_MATERIAL = mat('stone', 'stone', 'stone walls', 'stone floor');

/**
 * effectiveBuildingType(structure) -> string
 * The SAME resolution floorPlan applies (floorPlan.js: forcedType || derived):
 * a declared, KNOWN buildingType wins; otherwise the type is derived from the
 * structure id hash. Deterministic; never throws.
 */
export function effectiveBuildingType(structure) {
  const declared = String(structure?.buildingType || '');
  if (declared && MATERIALS[declared]) return declared;
  return buildingTypeFor(String(structure?.id || structure?.key || 'structure'));
}

/**
 * materialForType(type) -> { shell, family, walls, floor, line, forbidden }
 * The material identity for a building type. Frozen shared objects — treat as
 * immutable. Unknown type -> the map's own 'stone' fallback.
 */
export function materialForType(type) {
  return MATERIALS[String(type || '')] || DEFAULT_MATERIAL;
}

/**
 * structureMaterial(world, structureId) -> material | null
 * The material identity of a structure in this world, resolved exactly the way
 * the floor-plan renderer resolves it. null when the structure doesn't exist.
 * Pure read over an already-ensured world.
 */
export function structureMaterial(world, structureId) {
  const st = world?.structures?.byId?.[String(structureId || '')];
  if (!st) return null;
  return materialForType(effectiveBuildingType(st));
}
