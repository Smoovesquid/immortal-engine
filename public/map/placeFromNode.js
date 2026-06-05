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
  const pathY = 12, gap = 3; let cursor = 1;
  const place = (plan, meta) => { if (!plan || !plan.rooms) return; const ext = planExtent(plan); buildings.push({ plan, ox: cursor - ext.minX, oy: pathY - ext.maxY - 0.8, ...meta }); cursor += ext.w + gap; };

  // Real structures first (your home is a real, enterable structure).
  for (const st of structs) {
    const type = st.buildingType || buildingTypeFor(String(st.id || ''));
    place(getPlan(type) || getPlan('cottage'), { structureKey: st.id, name: type });
  }
  // The settlement's other buildings (by name) — drawn from the catalog. Try the
  // name as a plan type directly (a "smithy" IS a smithy), then a fallback map.
  for (const b of sbld) {
    place(planForBuildingName(String(b && b.name || '').toLowerCase()), { buildingName: b.name });
  }
  if (!buildings.length) return generatePlace({ seed, nodeType: nodeTypeFor(node), tier: tierForNode(world, node) });

  const endX = Math.max(8, cursor);
  const terrain = {
    paths: [{ pts: [[0, pathY], [endX, pathY]], w: 1.3 }],
    groves: [{ cx: 3, cy: pathY + 3.5, r: 2.2, n: 9 }, { cx: endX - 3, cy: pathY + 3, r: 1.8, n: 6 }],
    props: [{ type: 'well', ux: Math.round(endX / 2), uy: pathY + 1.4 }]
  };

  tokens.push({ type: 'player', ux: 1.5, uy: pathY });
  const shown = npcs.slice(0, 8);
  shown.forEach((n, i) => { tokens.push({ type: 'npc', ux: 2 + (i + 1) * (endX - 3) / (shown.length + 1), uy: pathY - 0.7, label: 'V', npc: { id: n.id || ('npc' + i), name: n.name, role: n.role } }); });

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
