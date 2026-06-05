/**
 * Seeded place generation — composes a walkable place from the catalog.
 *
 * Given a seed, a node type (hamlet / town / keep / wild / ruin), and a tier, it
 * lays catalog buildings along a path, generates terrain (path, groves, well),
 * and dresses each building with tiered enemies (placed in their rooms, carrying
 * the data the renderer needs to draw the right creature icon — many tucked
 * inside walls for the fog to hide). Deterministic; output feeds handDrawnPlace.
 */

import { makeRng, seedFromString } from '../../engine/rng.js';
import { dressStructure } from '../../engine/tactical/dresser.js';
import { getMonsterDef } from '../../engine/ruleset/core/bestiary/index.js';
import { getPlan } from './plans/index.js';
import { getLair } from './plans/lairs.js';
import { getRacePlan } from './plans/races.js';

const POOLS = {
  hamlet: ['cottage', 'cottage', 'smithy', 'shed', 'barn', 'mill'],
  town: ['tavern', 'market', 'chapel', 'smithy', 'manor', 'cottage', 'bathhouse'],
  keep: ['keep'],
  fort: ['castle'],
  wild: ['__lair'],
  ruin: ['chapel', '__lair']
};
const COUNT = { hamlet: [2, 4], town: [3, 5], keep: [1, 1], fort: [1, 1], wild: [1, 1], ruin: [1, 2] };
const LAIRS = ['cave_den', 'burrow', 'web_nest', 'warren', 'bone_pit', 'ruin_haunt', 'nest_cluster', 'thicket_den'];

function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of plan.rooms) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw); minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function tokenForSpawn(sp, ox, oy) {
  const def = getMonsterDef(sp.ref) || {};
  return { type: 'mon', ux: sp.x + ox, uy: sp.y + oy, info: { ref: sp.ref, name: def.name || sp.ref, tags: def.tags || ['beast'] } };
}

export function generatePlace({ seed = 'place', nodeType = 'hamlet', tier = 1 } = {}) {
  const rng = makeRng(seedFromString(`${seed}|place|${nodeType}|${tier}`));
  const pool = POOLS[nodeType] || POOLS.hamlet;
  const [lo, hi] = COUNT[nodeType] || [2, 3];
  const n = rng.int(lo, hi);

  const buildings = [], tokens = [];
  const pathY = 12; const gap = 3; let cursor = 1;

  for (let i = 0; i < n; i++) {
    let type = pool[rng.int(0, pool.length - 1)];
    let plan;
    if (type === '__lair') plan = getLair(LAIRS[rng.int(0, LAIRS.length - 1)]);
    else plan = getPlan(type);
    if (!plan) continue;
    const ext = planExtent(plan);
    const ox = cursor - ext.minX;
    const oy = pathY - ext.maxY - 0.8;     // building bottom sits just above the path
    buildings.push({ plan, ox, oy });

    // dress it — enemies of this tier, the lair's own resident first when applicable
    const ownerRef = (plan.type === 'lair' && plan.archetype) ? null : null;
    const dressed = dressStructure({ seed: `${seed}|${i}`, plan, tier, ownerRef });
    for (const sp of dressed.spawns) tokens.push(tokenForSpawn(sp, ox, oy));

    cursor += ext.w + gap;
  }

  const endX = Math.max(8, cursor);
  const terrain = {
    paths: [{ pts: [[0, pathY], [endX, pathY]], w: 1.3 }],
    groves: [{ cx: rng.int(2, 6), cy: pathY + 3.5, r: 2.4, n: 10 }, { cx: rng.int(endX - 6, endX - 2), cy: pathY + 3, r: 2, n: 7 }],
    props: [{ type: 'well', ux: Math.round(endX / 2), uy: pathY + 1.4 }, { type: 'tree', ux: rng.int(3, endX - 3), uy: 4, r: 0.8 }],
    fields: nodeType === 'hamlet' || nodeType === 'town' ? [{ cx: endX - 3, cy: 4, w: 4, h: 3 }] : []
  };

  tokens.unshift({ type: 'player', ux: 1.5, uy: pathY });
  // a friendly villager in settlements
  if (nodeType === 'hamlet' || nodeType === 'town') tokens.push({ type: 'npc', ux: Math.round(endX / 2) + 1, uy: pathY - 0.6, label: 'V' });

  return { nodeType, tier, seed, terrain, buildings, tokens, footprintW: endX };
}

// Coarse region model (for the zoom-out travel view): places on a small grid,
// joined by roads. Deterministic. (Rendered minimally; full region renderer TBD.)
export function generateRegion({ seed = 'region', count = 6 } = {}) {
  const rng = makeRng(seedFromString(`${seed}|region`));
  const types = ['hamlet', 'town', 'keep', 'wild', 'ruin'];
  const places = [];
  for (let i = 0; i < count; i++) {
    const nodeType = i === 0 ? 'hamlet' : types[rng.int(0, types.length - 1)];
    places.push({ id: 'p' + i, nodeType, x: rng.int(1, 18), y: rng.int(1, 12), tier: Math.min(4, 1 + Math.floor(i / 2)), name: nodeType + ' ' + i });
  }
  // roads: connect each place to its nearest unconnected neighbor (a simple spanning-ish net)
  const roads = [];
  for (let i = 1; i < places.length; i++) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < i; j++) { const d = Math.hypot(places[i].x - places[j].x, places[i].y - places[j].y); if (d < bd) { bd = d; best = j; } }
    roads.push({ a: places[i].id, b: places[best].id });
  }
  return { seed, places, roads };
}
