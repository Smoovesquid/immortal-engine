/**
 * placeFromNode — the bridge from the engine's world to a walkable place.
 *
 * Turns an overworld node into the seed/type/tier for generatePlace, so the live
 * game can render the node as a walkable fog-of-war place instead of an abstract
 * dot. Tier is GEOGRAPHIC: the further a node sits from your home, the more
 * dangerous (and rewarding) — your "islands of safety, danger at the edges" rule,
 * deterministic so the same node always generates the same place.
 *
 * The app shell calls renderPlace(placeModelFromNode(world, nodeId)); wiring that
 * into v1.js is the one step that needs the running game to verify.
 */

import { generatePlace } from './generatePlace.js';
import { getPlan } from './plans/index.js';
import { buildingTypeFor } from '../../engine/structures/roomDetail.js';
import { exitsFrom, ensureMap } from '../../engine/map/mapState.js';
import { makeRng, seedFromString } from '../../engine/rng.js';

const TIER_STEP = 5; // grid-distance per danger rung

// Settlement "building" names (engine data) → an authored catalog plan type.
// Settlement building names are descriptive ("meeting hall", "workshop", "stable").
// Map them to a catalog plan type by substring. (Many — smithy, barn, mill, manor,
// bathhouse, farm, shed, market, tavern, chapel — also resolve directly by name.)
const NAME_TO_TYPE = [
  ['smith', 'smithy'], ['forge', 'smithy'], ['workshop', 'smithy'], ['work', 'smithy'],
  ['stable', 'barn'], ['granary', 'barn'], ['barn', 'barn'], ['warehouse', 'barn'],
  ['meeting', 'longhouse'], ['hall', 'longhouse'], ['moot', 'longhouse'],
  ['tavern', 'tavern'], ['inn', 'tavern'], ['alehouse', 'tavern'], ['brew', 'tavern'],
  ['temple', 'chapel'], ['shrine', 'chapel'], ['church', 'chapel'], ['chapel', 'chapel'],
  ['market', 'market'], ['store', 'market'], ['shop', 'market'], ['stall', 'market'],
  ['mill', 'mill'], ['manor', 'manor'], ['bath', 'bathhouse'], ['keep', 'keep'],
  ['tower', 'tower'], ['shed', 'shed'], ['shack', 'shed'], ['farm', 'farm']
];
function planForBuildingName(nm) {
  const direct = getPlan(nm); if (direct) return direct;
  for (const [k, t] of NAME_TO_TYPE) if (nm.includes(k)) { const p = getPlan(t); if (p) return p; }
  return getPlan('cottage');
}

function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of (plan.rooms || [])) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw); minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// placeFromWorldNode — build a walkable place from the node's ACTUAL contents:
// the real structures (your home cottage), the settlement's buildings, and its
// people. So the village you see IS the village that's there. Deterministic.
export function placeFromWorldNode(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;

  const structs = Object.values((world && world.structures && world.structures.byId) || {}).filter(s => String(s && s.nodeId || '') === id);
  const sbld = Array.isArray(node.settlement && node.settlement.buildings) ? node.settlement.buildings : [];
  const npcs = Array.isArray(node.settlement && node.settlement.npcs) ? node.settlement.npcs : [];

  const buildings = [], tokens = [];
  const pathY = 12;

  // Collect every building (the player's real structures first, then the
  // settlement's). Count varies by size tier now (M7-S3), so a hamlet is a couple
  // of roofs and the city seat is dozens.
  const entries = [];
  for (const st of structs) {
    const type = st.buildingType || buildingTypeFor(String(st.id || ''));
    const plan = getPlan(type) || getPlan('cottage');
    if (plan && plan.rooms) entries.push({ plan, meta: { structureKey: st.id, name: type } });
  }
  for (const b of sbld) {
    const plan = planForBuildingName(String(b && b.name || '').toLowerCase());
    if (plan && plan.rooms) entries.push({ plan, meta: { buildingName: b.name } });
  }
  if (!entries.length) return generatePlace({ seed, nodeType: nodeTypeFor(node), tier: tierForNode(world, node) });

  // P-81b — ORGANIC town layout: buildings scatter along a gently CURVED road,
  // clustered and irregular (terrain-following), never a lattice. Deterministic:
  // a seeded RNG places each building near the road by rejection-sampling against
  // already-placed footprints, so the same node always yields the same village.
  const rng = makeRng(seedFromString(`${seed}|placelayout`));
  const span = Math.max(16, 8 + entries.length * 2.4);   // road length grows with size

  // The road spine: a gentle seeded curve about pathY (a lane that bends, not a
  // ruler-straight street). roadY(x) is reused to seat buildings and the well.
  const amp = 2.2 + rng.nextFloat() * 3.2;
  const phase = rng.nextFloat() * Math.PI * 2;
  const freq = 0.16 + rng.nextFloat() * 0.12;
  const roadY = (x) => pathY + amp * Math.sin(x * freq + phase);

  // Scatter the buildings: along the road, offset to one side, clustered near it,
  // rejecting overlaps. Each footprint is an AABB (+1u breathing gap).
  const placed = [];
  const hits = (a) => placed.some(b => !(a.maxX + 1 < b.minX || a.minX - 1 > b.maxX || a.maxY + 1 < b.minY || a.minY - 1 > b.maxY));
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const e of entries) {
    const ext = planExtent(e.plan);
    let cxp = span / 2, cyp = pathY, aabb = null;
    for (let tries = 0; tries < 48; tries++) {
      const along = 2 + rng.nextFloat() * (span - 4);              // position down the lane
      const side = rng.nextFloat() < 0.5 ? -1 : 1;
      const off = (2 + rng.nextFloat() * rng.nextFloat() * 8) * side; // clustered near the road, tail outward
      cxp = along + (rng.nextFloat() - 0.5) * 1.6;
      cyp = roadY(along) + off;
      aabb = { minX: cxp + ext.minX, minY: cyp + ext.minY, maxX: cxp + ext.maxX, maxY: cyp + ext.maxY };
      if (!hits(aabb)) break;                                       // found a clear spot
    }
    placed.push(aabb);
    minX = Math.min(minX, aabb.minX); maxX = Math.max(maxX, aabb.maxX);
    minY = Math.min(minY, aabb.minY); maxY = Math.max(maxY, aabb.maxY);
    const ox = cxp - (ext.minX + ext.maxX) / 2, oy = cyp - (ext.minY + ext.maxY) / 2; // seat plan centre at (cxp,cyp)
    buildings.push({ plan: e.plan, ox, oy, ...e.meta });
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = span; minY = pathY - 6; maxY = pathY + 6; }
  const endX = Math.max(8, maxX + 2);

  // The curved road as a polyline, reaching the map edge wherever a neighbor lies
  // so you can walk onward; short spurs bend off to the north/south exits.
  const exits = exitsFrom(ensureMap(world && world.map), id);
  const x0 = exits.west ? minX - 4 : Math.max(0, minX - 1);
  const x1 = exits.east ? endX + 3 : endX;
  const roadPts = [];
  for (let x = x0; x <= x1; x += 2) roadPts.push([x, roadY(x)]);
  roadPts.push([x1, roadY(x1)]);
  const midX = (x0 + x1) / 2;
  const paths = [{ pts: roadPts, w: 1.4 }];
  if (exits.north) paths.push({ pts: [[midX, roadY(midX)], [midX + (rng.nextFloat() - 0.5) * 4, minY - 6]], w: 1.1 });
  if (exits.south) paths.push({ pts: [[midX, roadY(midX)], [midX + (rng.nextFloat() - 0.5) * 4, maxY + 6]], w: 1.1 });

  const terrain = {
    paths,
    // Groves tuck into the open corners, not on a grid.
    groves: [{ cx: minX - 1.5, cy: maxY + 2, r: 2.2, n: 9 }, { cx: endX - 2, cy: minY - 1.5, r: 1.8, n: 6 }],
    props: [{ type: 'well', ux: midX, uy: roadY(midX) + 1.4 }]
  };

  // The player enters from the lane's west end; neighbours stand scattered near
  // the road through the village, not in a tidy row.
  tokens.push({ type: 'player', ux: x0 + 1.5, uy: roadY(x0 + 1.5) });
  const shown = npcs.filter(n => n && !n.hostile).slice(0, 12).concat(npcs.filter(n => n && n.hostile).slice(0, 2).map(n => ({ ...n, name: '?' })));
  shown.forEach((n, i) => {
    const ax = minX + ((i + 1) / (shown.length + 1)) * (maxX - minX) + (rng.nextFloat() - 0.5) * 2;
    const ay = roadY(ax) + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.8 + rng.nextFloat() * 1.4);
    tokens.push({ type: 'npc', ux: ax, uy: ay, label: String(n.name || 'V').trim().charAt(0).toUpperCase() || 'V', npc: { id: n.id || ('npc' + i), name: n.name, role: n.role } });
  });

  return { nodeType: node.nodeType || 'settlement', tier: tierForNode(world, node), seed, terrain, buildings, tokens, footprintW: endX };
}

function nodeTypeFor(node) {
  const st = node && node.settlement;
  if (st) {
    const pop = Number(st.population || 0);
    const npcs = Array.isArray(st.npcs) ? st.npcs.length : 0;
    if (pop >= 300 || npcs >= 6) return 'town';
    return 'hamlet';
  }
  const t = String(node && node.nodeType || '').toLowerCase();
  if (t.includes('ruin')) return 'ruin';
  if (t.includes('keep') || t.includes('fort')) return 'keep';
  return 'wild';
}

export function tierForNode(world, node) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const homeId = String((world && world.meta && world.meta.homeNodeId) || (world && world.map && world.map.currentNodeId) || '');
  const home = nodes.find(n => String(n.id) === homeId);
  if (!home || !Number.isFinite(node.x) || !Number.isFinite(home.x)) return 1;
  const d = Math.abs(node.x - home.x) + Math.abs(node.y - home.y);
  return Math.max(1, Math.min(4, 1 + Math.floor(d / TIER_STEP)));
}

// placeModelFromNode(world, nodeId) -> a generatePlace() model for that node, or null.
export function placeModelFromNode(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;
  const nodeType = nodeTypeFor(node);
  const tier = tierForNode(world, node);
  return generatePlace({ seed, nodeType, tier });
}
