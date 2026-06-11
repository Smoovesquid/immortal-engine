// U124 — P-72 building (docs/SALVAGE_AND_BUILD.md, rung three).
// Build plans are data; one check gates QUALITY (never possibility); DAYS
// always pass and the world ticks while you work; materials are always
// consumed; the structure persists, joins worldHash, and improves rest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { getBuildPlans, validateBuildPlan, matchBuildPlan, laborPlan, makePlayerStructure, shelterAt } from '../engine/structures/playerBuilt.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u124-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

function withMats(w, items) {
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
}
function atWild(w) {
  const wild = (w.map?.nodes || []).find(n => n.nodeType !== 'settlement');
  return { ...w, map: { ...w.map, currentNodeId: wild.id } };
}
const STOCK = [
  { id: 'b1', defRef: 'board', qty: 8, equipped: null },
  { id: 'c1', defRef: 'cordage', qty: 4, equipped: null },
  { id: 't1', defRef: 'timber', qty: 8, equipped: null }
];
const leanTo = (over = {}) => makePlayerStructure({
  plan: getBuildPlans().find(p => p.id === 'lean-to'),
  quality: 'sound', restBand: 'long', labor: 'solo', builtDay: 1,
  materials: { board: 4, cordage: 1 }, nodeId: over.nodeId, ...over
});

test('U124-01: every build plan validates and its material refs resolve', () => {
  const plans = getBuildPlans();
  assert.ok(plans.length >= 1);
  for (const p of plans) {
    assert.deepEqual(validateBuildPlan(p), [], p.id);
    for (const inp of p.inputs) assert.ok(getItemDef(inp.defRef), `${p.id} input ${inp.defRef}`);
  }
  assert.equal(matchBuildPlan('I spend two days building a lean-to')?.id, 'lean-to');
  assert.equal(matchBuildPlan('raise a shelter against the rain')?.id, 'lean-to');
  assert.equal(matchBuildPlan('construct a palisade around the camp')?.id, 'palisade');
  assert.equal(matchBuildPlan('build a cathedral'), null);
});

test('U124-02: building consumes materials, jumps the clock by days, and writes a persistent structure', () => {
  const w = withMats(begin('u124a'), STOCK.map(m => ({ ...m })));
  const h0 = w.time.hours;
  const before = Object.keys(w.structures.byId).length;
  const r = playerMove(w, packs, 'I spend two days building a lean-to');
  assert.match(r.output.mechanics, /build \| Lean-To/);
  const items = r.world.party[0].inventory.items;
  const qty = (ref) => items.filter(i => i.defRef === ref).reduce((s, i) => s + (i.qty || 1), 0);
  assert.equal(qty('board'), 4, '4 of 8 boards went in');
  assert.equal(qty('cordage'), 3, '1 of 4 cordage went in');
  assert.equal(r.world.time.hours, h0 + 48, 'two days passed');
  const ids = Object.keys(r.world.structures.byId);
  assert.equal(ids.length, before + 1, 'one new structure');
  const st = r.world.structures.byId[ids.find(id => id.startsWith('pb:'))];
  assert.equal(st.kind, 'playerBuilt');
  assert.equal(st.buildingType, 'lean-to');
  assert.ok(['poor', 'sound', 'fine'].includes(st.build.quality));
  assert.equal(st.build.materials.board, 4);
  assert.ok(r.world.timeline.some(e => e.kind === 'build'), 'building is canon');
  assertWorldInvariants(r.world);
});

test('U124-03: missing materials get an honest itemized answer, not a roll or lost days', () => {
  const w = withMats(begin('u124b'), [{ id: 'b1', defRef: 'board', qty: 1, equipped: null }]);
  const r = playerMove(w, packs, 'I build a lean-to');
  assert.match(r.output.mechanics, /build:missing \| lean-to/);
  assert.match(r.output.narration, /board/);
  assert.match(r.output.narration, /cordage/);
  assert.equal(r.world.time.hours, w.time.hours, 'no days wasted on a stockpile check');
  assert.equal(Object.keys(r.world.structures.byId).length, Object.keys(w.structures.byId).length, 'nothing built');
});

test('U124-04: the check gates quality, not possibility — a rough build still stands', () => {
  for (let i = 0; i < 40; i++) {
    const w = withMats(begin(`u124q${i}`), STOCK.map(m => ({ ...m })));
    const r = playerMove(w, packs, 'I build a lean-to');
    if (!/build \| Lean-To/.test(r.output.mechanics)) continue;
    if (/\| poor \|/.test(r.output.mechanics)) {
      const ids = Object.keys(r.world.structures.byId).filter(id => id.startsWith('pb:'));
      assert.equal(ids.length, 1, 'poor work still raises it');
      assert.match(r.output.narration, /stands/i, 'and the prose says so');
      return;
    }
  }
  assert.fail('no poor build observed over 40 seeds');
});

test('U124-05: a sound shelter gives a true long rest in the wild; bare ground gives only a breather', () => {
  let w = atWild(begin('u124r'));
  w = { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 40 } };
  const built = applyDeltas(w, [{ op: 'buildStructure', structure: leanTo({ nodeId: w.map.currentNodeId }) }]);
  assert.ok(shelterAt(built, built.map.currentNodeId), 'shelter is found at the node');
  const slept = playerMove(built, packs, 'I sleep for the night');
  assert.match(slept.output.mechanics, /rest:long/);
  assert.equal(slept.world.meta.escapeHp, 40, 'a true night = full HP');
  // Control: same wild node, no shelter built
  const bare = playerMove(w, packs, 'I sleep for the night');
  assert.match(bare.output.mechanics, /rest:breather/);
  assert.ok(bare.world.meta.escapeHp < 40, 'bare ground is not a full night');
});

test('U124-06: a rough shelter beats bare ground but is not a full night', () => {
  let w = atWild(begin('u124p'));
  w = { ...w, meta: { ...w.meta, escapeHp: 3, escapeMaxHp: 40 } };
  const built = applyDeltas(w, [{ op: 'buildStructure', structure: leanTo({ nodeId: w.map.currentNodeId, quality: 'poor', restBand: 'good' }) }]);
  const r = playerMove(built, packs, 'I rest for the night');
  assert.match(r.output.mechanics, /rest:breather/);
  assert.ok(r.world.meta.escapeHp > 3, 'it helps');
  assert.ok(r.world.meta.escapeHp < 40, 'but it is not a full long rest');
});

test('U124-07: the structure survives a save/reload round-trip and still shelters', () => {
  const w = atWild(begin('u124s'));
  const built = applyDeltas(w, [{ op: 'buildStructure', structure: leanTo({ nodeId: w.map.currentNodeId, quality: 'fine' }) }]);
  const reloaded = importWorld(exportWorld(built));
  const sh = shelterAt(reloaded, reloaded.map.currentNodeId);
  assert.ok(sh, 'still standing after reload');
  assert.equal(sh.build.quality, 'fine');
  assert.equal(sh.build.restBand, 'long');
  assert.equal(sh.build.materials.board, 4);
  assertWorldInvariants(reloaded);
});

test('U124-08: hired labor is faster, costs gold, and adds +2 — solo when there is no crew', () => {
  const plan = getBuildPlans().find(p => p.id === 'lean-to');
  const solo = laborPlan(plan, 'solo');
  const hired = laborPlan(plan, 'hired');
  assert.equal(solo.days, 2);
  assert.equal(hired.days, 1, 'a crew halves it');
  assert.equal(hired.costCopper, 400, '2gp/day of the full job');
  assert.equal(hired.checkBonus, 2);
  // out in the wild there is no crew to hire — falls to solo, full days
  const w = withMats(atWild(begin('u124h')), STOCK.map(m => ({ ...m })));
  const r = playerMove(w, packs, 'I hire a crew to build a lean-to');
  assert.match(r.output.mechanics, /build \| Lean-To \| \w+ \| solo 2d/);
  assert.match(r.output.narration, /No crew to hire/);
});

test('U124-09: building is deterministic and worldHash is stable across save/reload', () => {
  const w = withMats(begin('u124d'), STOCK.map(m => ({ ...m })));
  const a = playerMove(w, packs, 'I build a lean-to');
  const b = playerMove(w, packs, 'I build a lean-to');
  assert.equal(a.output.mechanics, b.output.mechanics);
  assert.equal(a.output.narration, b.output.narration);
  assert.equal(worldHash(a.world), worldHash(importWorld(exportWorld(a.world))), 'hash stable across save/reload');
});
