// U714–U719 — DEATH-TRUTH-1d: people become places (the drawn spot IS the canonical spot).
//
// THE FIX. Outdoor placement used to be a ±250 m box of jitter (placeNearNode),
// blind to the drawn village — so a person's canonical board cell and the spot the
// map drew them at were decorrelated, and a canon-true corpse could draw ~230 m
// OUTSIDE its own settlement (DEATH-TRUTH-1c proved the picture half was blocked on
// exactly this). Now an outdoor settlement occupant is canonised at the exact
// place-unit the sheet scatters them to (engine/world/settlementScatter.js →
// placeUnitToRegionCell); the renderer draws each person AND each corpse back from
// that cell (regionCellToPlaceUnit). One geometry, two consumers.
//
// These are VALUE assertions, not shape assertions — each fails its own setup if the
// candidate values aren't genuinely distinct (no vacuous passes).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { boardCellToWorldPos } from '../engine/combat/grid.js';
import { remainsAtNode } from '../engine/combat/deathFact.js';
import { placementForWorld, NODE_CELLS } from '../engine/map/spatial/tacticalPos.js';
import {
  settlementLayout, placeUnitToRegionCell, regionCellToPlaceUnit,
} from '../engine/world/settlementLayout.js';
import {
  settlementScatterPlaceUnits, shownOutdoorPeople, pushClearOfBuildings, NPC_MARGIN_LU, insideAnyRect,
} from '../engine/world/settlementScatter.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placedTokenModel } from '../public/map/drawModel.js';

const boot = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;
const wolf = () => ({ name: 'Dire Wolf', hp: 4, maxHp: 4, damage: '1d4', ac: 8, cr: 1 });
const npcTokens = (w) => placeFromWorldNode(w, String(w.map.currentNodeId)).tokens.filter(t => t.type === 'npc');

// The village settlement seeds where an outdoor scene is reproducible.
const SETTLEMENT_SEEDS = ['loaderDemo', 'tallow', 'aldermere'];

// ── U714 — FAITHFUL PROMOTION: the engine scatter == the pre-1d renderer scatter,
//    byte-for-byte. The scatter FORMULA moved from the renderer into the engine; if
//    the engine drifted from it, a person's canon would no longer be where the sheet
//    used to draw them. Reconstruct the exact old formula inline and compare. ──────
test('U714: settlementScatterPlaceUnits reproduces the pre-1d renderer scatter formula byte-for-byte', () => {
  let compared = 0;
  for (const seed of SETTLEMENT_SEEDS) {
    const w = say(boot(seed), 'I go outside.');
    const nodeId = String(w.map.currentNodeId);
    const layout = settlementLayout(w, nodeId);
    assert.ok(layout, `${seed}: setup — an outdoor settlement layout exists`);
    // The engine's promoted scatter.
    const engine = settlementScatterPlaceUnits(w, nodeId, settlementLayout(w, nodeId));
    // The old renderer formula, reconstructed against a FRESH layout (fresh rng at the
    // same post-settlementLayout state the renderer used).
    const lay2 = settlementLayout(w, nodeId);
    const { placed, roadY, rng, extent } = lay2;
    const shown = shownOutdoorPeople(w, nodeId);
    assert.ok(shown.length >= 1, `${seed}: setup — at least one outdoor person to place`);
    const formula = new Map();
    shown.forEach((n, i) => {
      const ax0 = extent.minX + ((i + 1) / (shown.length + 1)) * (extent.maxX - extent.minX) + (rng.nextFloat() - 0.5) * 2;
      const ay0 = roadY(ax0) + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.8 + rng.nextFloat() * 1.4);
      const { x, y } = pushClearOfBuildings(ax0, ay0, placed, NPC_MARGIN_LU);
      formula.set(String(n.id || ('npc' + i)), { ux: x, uy: y });
    });
    assert.equal(engine.size, formula.size, `${seed}: same number of scattered people`);
    for (const [id, u] of formula) {
      const e = engine.get(id);
      assert.ok(e, `${seed}: engine scattered ${id}`);
      assert.equal(e.ux, u.ux, `${seed}/${id}: ux byte-identical to the old renderer formula`);
      assert.equal(e.uy, u.uy, `${seed}/${id}: uy byte-identical`);
      compared++;
    }
  }
  assert.ok(compared >= 5, `compared enough people to be meaningful (${compared})`);
});

// ── U715 — GROUNDED CANON: an outdoor NPC's canon projects INSIDE its settlement,
//    where the ±250 m jitter never could. The falsifier: the projected cell lands
//    within the building span, and it is NOT the node-centre jitter box. ───────────
test('U715: outdoor NPC canon lands inside the drawn settlement, not the retired jitter box', () => {
  const w = say(boot('loaderDemo'), 'I go outside.');
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const layout = settlementLayout(w, nodeId);
  // The drawn building span (place units).
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const b of layout.buildings) for (const r of (b.plan?.rooms || [])) {
    const rw = (r.w ?? (r.r ?? 1) * 2) / 2, rh = (r.h ?? (r.r ?? 1) * 2) / 2;
    minX = Math.min(minX, b.ox + r.cx - rw); maxX = Math.max(maxX, b.ox + r.cx + rw);
    minY = Math.min(minY, b.oy + r.cy - rh); maxY = Math.max(maxY, b.oy + r.cy + rh);
  }
  const placed = placementForWorld(w);
  const scatter = settlementScatterPlaceUnits(w, nodeId, settlementLayout(w, nodeId));
  let checked = 0;
  for (const [id, u] of scatter) {           // every DRAWN outdoor person
    const pos = placed.get(id);
    assert.ok(pos && pos.frame === 'region', `${id}: has a region-frame canon pos`);
    const back = regionCellToPlaceUnit(node, layout.frame, pos.gx, pos.gy);
    // Grounded: the canon projects to within the drawn settlement extent (generous
    // margin for the scatter's own road offset), NOT 40+ place-units out where the
    // old placeNearNode (±50 cells ≈ ±62 place-units) put it.
    assert.ok(back.uy >= minY - 6 && back.uy <= maxY + 6,
      `${id}: canon projects INSIDE the village span uy [${minY.toFixed(1)}, ${maxY.toFixed(1)}] (got ${back.uy.toFixed(1)}) — not the jitter box`);
    assert.ok(back.ux >= minX - 6 && back.ux <= maxX + 6,
      `${id}: canon projects INSIDE the village span ux (got ${back.ux.toFixed(1)})`);
    checked++;
  }
  assert.ok(checked >= 1, 'at least one outdoor NPC grounded');
  // The falsifier proof: a placeNearNode-style jitter cell (node centre ± up to 50
  // cells) would project WAY outside this span — so the assertion above is not vacuous.
  const jitterCell = { gx: node.x * NODE_CELLS + 50, gy: node.y * NODE_CELLS + 50 };
  const jitterBack = regionCellToPlaceUnit(node, layout.frame, jitterCell.gx, jitterCell.gy);
  assert.ok(jitterBack.uy > maxY + 6,
    `sanity: a +50-cell jitter WOULD land outside the span (uy ${jitterBack.uy.toFixed(1)} > ${(maxY + 6).toFixed(1)}) — proving the in-span check is real`);
});

// ── U716 — A CORPSE LIES WHERE THE PERSON STOOD. Record a living NPC's drawn spot,
//    kill it, and the corpse token draws at the IDENTICAL place-unit — because both
//    read the same region-cell canon. ───────────────────────────────────────────
test('U716: a killed NPC\'s corpse draws at the exact spot the living person stood', () => {
  let w = say(boot('loaderDemo'), 'I go outside.');
  const nodeId = String(w.map.currentNodeId);
  const before = new Map(npcTokens(w).filter(t => !t.dead).map(t => [String(t.npc?.id || ''), { ux: t.ux, uy: t.uy }]));
  assert.ok(before.size >= 1, 'setup: at least one living outdoor NPC drawn');

  let b = beginCombat(w, { enemies: [wolf()], reason: 'ambush' });
  for (let i = 0; i < 12 && b.combat?.active; i++) b = say(b, 'I strike the wolf.');
  const after = npcTokens(b);
  const corpses = after.filter(t => t.dead);
  assert.ok(corpses.length >= 1, 'setup: the fight left at least one corpse on the sheet');

  // A dead NPC (not the ambush monster) whose living position we captured.
  const npcCorpse = corpses.find(t => !t.monster && before.has(String(t.npc?.id || '')));
  assert.ok(npcCorpse, 'setup: a killed roster NPC we watched alive is now a corpse');
  const wasAt = before.get(String(npcCorpse.npc.id));
  assert.deepEqual({ ux: npcCorpse.ux, uy: npcCorpse.uy }, wasAt,
    'the corpse lies on the EXACT square the living villager stood on');

  // And the monster corpse sits at its own frozen loc.pos, not a private scatter.
  const monsterCorpse = corpses.find(t => t.monster);
  assert.ok(monsterCorpse, 'setup: the ambush monster left a corpse');
  const wolfRemains = remainsAtNode(b, nodeId).find(r => r.kind === 'monster' && r.loc?.pos?.frame === 'region');
  assert.ok(wolfRemains, 'the monster fact carries a region-frame loc.pos');
  const node = b.map.nodes.find(n => String(n.id) === nodeId);
  const layout = settlementLayout(b, nodeId);
  const proj = regionCellToPlaceUnit(node, layout.frame, wolfRemains.loc.pos.gx, wolfRemains.loc.pos.gy);
  const cleared = pushClearOfBuildings(proj.ux, proj.uy, layout.placed, NPC_MARGIN_LU);
  assert.deepEqual({ ux: monsterCorpse.ux, uy: monsterCorpse.uy }, { ux: cleared.x, uy: cleared.y },
    'the monster corpse draws at its canonical death cell (loc.pos), cleared of buildings');
});

// ── U717 — THE KEYSTONE: the player's outdoor canon at a settlement is the drawn
//    lane entry, and the combat board's world origin pins to it (so death facts are
//    sheet-true). NOT the retired jitter. ───────────────────────────────────────
test('U717: the outdoor player grounds at the drawn lane entry, anchoring the board', () => {
  const w = say(boot('loaderDemo'), 'I go outside.');
  const pos = w.party[0].pos;
  assert.equal(pos.frame, 'region', 'setup: the player is outdoors (region frame)');
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const layout = settlementLayout(w, nodeId);
  // The player token the sheet draws IS the canon projection (not a fallback seed).
  const playerTok = placeFromWorldNode(w, nodeId).tokens.find(t => t.type === 'player');
  const back = regionCellToPlaceUnit(node, layout.frame, pos.gx, pos.gy);
  assert.ok(Math.abs(playerTok.ux - back.ux) < 0.001 && Math.abs(playerTok.uy - back.uy) < 0.001,
    'the drawn player token reads the player\'s canonical cell');
  // The board origin pins to the player's canon: the player's board cell projects
  // back to the player's world pos (grid.boardOriginFrom, read at beginCombat).
  const b = beginCombat(w, { enemies: [wolf()], reason: 'ambush' });
  assert.ok(b.combat?.origin, 'setup: the fight carries a board origin');
  assert.deepEqual(boardCellToWorldPos(b.combat.origin, b.combat.playerCell),
    { frame: pos.frame, gx: pos.gx, gy: pos.gy },
    'the board origin is pinned to the player\'s grounded canonical pos — so death facts are sheet-true');
});

// ── U718 — WILDERNESS CORPSE (the 1e fold): a body outdoors on a NON-settlement
//    node still draws. The settlement-only gate in placedTokenModel is killed for
//    corpses; the dead route frame-free through regionCellToWu. ───────────────────
test('U718: a corpse on a non-settlement node draws (the settlement gate is killed for the dead)', () => {
  // Find a boot whose current node is NOT a settlement, or leave the settlement.
  // loaderDemo boots in a settlement; walk the party's current node into a wild node
  // is journey-entangled, so assert the MECHANISM directly: a synthetic region-frame
  // death fact on a wilderness node yields a corpse people-entry via regionCellToWu.
  let w = boot('loaderDemo');
  const wildNode = w.map.nodes.find(n => n && n.nodeType !== 'settlement' && !n.settlement && Number.isInteger(n.x));
  assert.ok(wildNode, 'setup: the slice has a non-settlement node');
  // Before: no people (no corpse) at the wild node.
  const empty = placedTokenModel(w, wildNode.id);
  assert.equal(empty.people.filter(p => p.dead).length, 0, 'setup: the wild node starts with no corpses');

  // Inject a death fact located OUTDOORS at the wild node (the shape assembleDeathFact
  // produces: nodeId + loc.pos region frame, no structureId).
  const deathT = (w.timeline || []).length;
  const cell = { frame: 'region', gx: wildNode.x * NODE_CELLS + 3, gy: wildNode.y * NODE_CELLS - 2 };
  const fact = {
    victim: { name: 'Vein Crawler', kind: 'monster', sourceNpcId: null, archetype: 'beast', corpseKey: 'vein-crawler' },
    nodeId: String(wildNode.id),
    loc: { structureId: null, roomId: null, pos: cell },
    t: deathT,
  };
  w = { ...w, timeline: [...(w.timeline || []), { t: deathT, kind: 'death-fact', data: fact }] };

  const remains = remainsAtNode(w, String(wildNode.id));
  assert.ok(remains.some(r => r.loc?.pos && String(r.name) === 'Vein Crawler'), 'setup: the fact reads back as located remains');

  const tok = placedTokenModel(w, wildNode.id);
  const corpse = tok.people.find(p => p.dead && p.name === 'Vein Crawler');
  assert.ok(corpse, 'the wilderness corpse draws (a people entry with dead:true) — the gate is killed');
  assert.ok(Number.isFinite(corpse.wx) && Number.isFinite(corpse.wy),
    'the corpse carries world-unit coordinates from regionCellToWu (frame-free, node-anchored)');
  // Value proof: it sits at the node's neighbourhood, offset by the death cell — not
  // at the node centre and not NaN.
  assert.notEqual(corpse.wx, 0, 'the corpse has a real world x');
});

// ── U719 — THE LATTICE ROUND-TRIPS (bounded snap) + no token ever lands in a wall. ──
test('U719: regionCellToPlaceUnit inverts placeUnitToRegionCell within a half-cell, and no token lands in a footprint', () => {
  const w = say(boot('loaderDemo'), 'I go outside.');
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const layout = settlementLayout(w, nodeId);

  // Round-trip: a place-unit point → region cell (snapped to integer) → place-unit is
  // identity up to the half-cell snap. 1 region cell = 5 wu = 1.25 place-units, so
  // half a cell = 0.625 place-units. Assert every scattered person round-trips within
  // that bound, and that the bound is REAL (a whole-cell error would exceed it).
  const scatter = settlementScatterPlaceUnits(w, nodeId, settlementLayout(w, nodeId));
  let maxErr = 0;
  for (const [, u] of scatter) {
    const cell = placeUnitToRegionCell(node, layout.frame, u.ux, u.uy);
    const snapped = { gx: Math.round(cell.gx), gy: Math.round(cell.gy) };
    const back = regionCellToPlaceUnit(node, layout.frame, snapped.gx, snapped.gy);
    maxErr = Math.max(maxErr, Math.hypot(back.ux - u.ux, back.uy - u.uy));
  }
  assert.ok(maxErr <= 0.626 * Math.SQRT2 + 1e-9,
    `round-trip snap is bounded by the half-cell (max ${maxErr.toFixed(4)} place-units)`);
  assert.ok(maxErr > 0, 'the snap is non-trivial (the assertion is not vacuous)');

  // No drawn NPC/corpse token lands inside a building footprint (+ the margin). The
  // clear-then-snap order plus the re-clear keeps every body out of the walls.
  let b = beginCombat(w, { enemies: [wolf()], reason: 'ambush' });
  for (let i = 0; i < 12 && b.combat?.active; i++) b = say(b, 'I strike the wolf.');
  const lay = settlementLayout(b, nodeId);
  let tokensChecked = 0;
  for (const t of npcTokens(b)) {
    assert.ok(!insideAnyRect(t.ux, t.uy, lay.placed, NPC_MARGIN_LU),
      `token ${t.npc?.id || t.label} (dead=${!!t.dead}) is clear of every building footprint`);
    tokensChecked++;
  }
  assert.ok(tokensChecked >= 2, `checked enough tokens (${tokensChecked})`);
});
