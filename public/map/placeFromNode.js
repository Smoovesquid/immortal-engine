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

  // M7-S3 — 2-D town layout: buildings fill rows straddling the main east-west
  // road, alternating above/below and expanding outward, so a town reads as a
  // cluster (not a single-file street). Row width ~sqrt(count) for a squarish
  // footprint. rowGap clears the tallest plans so footprints never overlap.
  const colGap = 3.2, rowGap = 8.5;
  const perRow = Math.max(3, Math.round(Math.sqrt(entries.length * 1.7)));
  const rowCursorX = [];
  let maxX = 8, minRowY = pathY, maxRowY = pathY;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const ext = planExtent(e.plan);
    const row = Math.floor(i / perRow);
    const band = Math.ceil((row + 1) / 2);            // 1,1,2,2,3,3…
    const side = (row % 2 === 0) ? -1 : 1;            // even rows above the road, odd below
    const rowCenterY = pathY + side * rowGap * band;
    if (rowCursorX[row] == null) rowCursorX[row] = 2;
    const ox = rowCursorX[row] - ext.minX;
    const oy = rowCenterY - (ext.minY + ext.maxY) / 2; // centre the plan on its row
    buildings.push({ plan: e.plan, ox, oy, ...e.meta });
    rowCursorX[row] += ext.w + colGap;
    maxX = Math.max(maxX, rowCursorX[row]);
    minRowY = Math.min(minRowY, rowCenterY - ext.h / 2);
    maxRowY = Math.max(maxRowY, rowCenterY + ext.h / 2);
  }

  const endX = Math.max(8, maxX);
  const midX = Math.round(endX / 2);

  // Roads reach the map edge wherever a neighbor lies, so you can walk onward; a
  // cross street stitches the rows together when the town spreads beyond one band.
  const exits = exitsFrom(ensureMap(world && world.map), id);
  const mainRoadX0 = exits.west ? -3 : 0;
  const mainRoadX1 = exits.east ? endX + 3 : endX;
  const paths = [{ pts: [[mainRoadX0, pathY], [mainRoadX1, pathY]], w: 1.4 }];
  if (maxRowY - minRowY > rowGap * 1.5) paths.push({ pts: [[midX, minRowY - 2], [midX, maxRowY + 2]], w: 1.1 });
  if (exits.north) paths.push({ pts: [[midX, pathY], [midX, minRowY - 6]], w: 1.1 });
  if (exits.south) paths.push({ pts: [[midX, pathY], [midX, maxRowY + 6]], w: 1.1 });

  const terrain = {
    paths,
    groves: [{ cx: 3, cy: maxRowY + 2.5, r: 2.2, n: 9 }, { cx: endX - 3, cy: minRowY - 2, r: 1.8, n: 6 }],
    props: [{ type: 'well', ux: midX, uy: pathY + 1.4 }]
  };

  tokens.push({ type: 'player', ux: 1.5, uy: pathY });
  // Neighbors get their initial; a lurking hostile reads as '?' at the edge.
  const shown = npcs.filter(n => n && !n.hostile).slice(0, 12).concat(npcs.filter(n => n && n.hostile).slice(0, 2).map(n => ({ ...n, name: '?' })));
  shown.forEach((n, i) => { tokens.push({ type: 'npc', ux: 2 + (i + 1) * (endX - 3) / (shown.length + 1), uy: pathY - 0.7, label: String(n.name || 'V').trim().charAt(0).toUpperCase() || 'V', npc: { id: n.id || ('npc' + i), name: n.name, role: n.role } }); });

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
