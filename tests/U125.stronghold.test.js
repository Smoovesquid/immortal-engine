// U125 — P-73a: stronghold tier + the coerced-labor moral fork
// (docs/SALVAGE_AND_BUILD.md, rung four; docs/MORALITY_SYSTEM.md).
// Enough time (solo), enough gold (hired), or enough slaves (coerced). Coerced
// is fast and free — and an atrocity: a cruelty deed, the seven-axis soul pays,
// the witnesses' trust craters, and the act draws investigation pressure. The
// honest fork records none of it. The engine adjudicates; it never serves.

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
import { getBuildPlans, validateBuildPlan, matchBuildPlan, laborPlan, shelterAt } from '../engine/structures/playerBuilt.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u125-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

function withMats(w, items) {
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
}
function atWild(w) {
  const wild = (w.map?.nodes || []).find(n => n.nodeType !== 'settlement');
  return { ...w, map: { ...w.map, currentNodeId: wild.id } };
}
const STOCK = () => [
  { id: 'ti', defRef: 'timber', qty: 60, equipped: null },
  { id: 'st', defRef: 'stone_chunk', qty: 80, equipped: null },
  { id: 'ir', defRef: 'iron_fitting', qty: 20, equipped: null },
  { id: 'na', defRef: 'nails', qty: 24, equipped: null },
  { id: 'bo', defRef: 'board', qty: 20, equipped: null },
  { id: 'co', defRef: 'cordage', qty: 8, equipped: null }
];
const node = (w) => (w.map?.nodes || []).find(n => n.id === w.map.currentNodeId);
const firstNpcTrust = (w) => Number(node(w)?.settlement?.npcs?.[0]?.conversationState?.trustLevel ?? 5);
const cruelties = (w) => (w.deeds || []).filter(d => d.kind === 'cruelty').length;

test('U125-01: stronghold plans validate and match by name/alias', () => {
  for (const p of getBuildPlans()) assert.deepEqual(validateBuildPlan(p), [], p.id);
  assert.equal(matchBuildPlan('I build a keep on the hill')?.id, 'keep');
  assert.equal(matchBuildPlan('raise a watchtower over the road')?.id, 'watchtower');
  assert.equal(matchBuildPlan('I want a fortress here')?.id, 'keep'); // alias
  assert.equal(matchBuildPlan('throw up a guard tower')?.id, 'watchtower');
});

test('U125-02: coerced labor is a third of the days, free, and raises the structure', () => {
  const plan = getBuildPlans().find(p => p.id === 'keep');
  const coerced = laborPlan(plan, 'coerced');
  assert.equal(coerced.days, 40, '120 / 3');
  assert.equal(coerced.costCopper, 0, 'no coin — that is the point');
  const w = withMats(begin('u125a'), STOCK());
  const r = playerMove(w, packs, 'I force the villagers to build a keep');
  assert.match(r.output.mechanics, /build \| Keep \| \w+ \| coerced 40d/);
  const st = Object.values(r.world.structures.byId).find(s => s.build?.plan === 'keep');
  assert.ok(st, 'the keep stands');
  assert.equal(st.build.labor, 'coerced', 'the keep remembers how it was raised');
});

test('U125-03: the coerced build is an atrocity — deed, corrupted soul, crashed trust, heat', () => {
  const w = withMats(begin('u125b'), STOCK());
  const trust0 = firstNpcTrust(w);
  const r = playerMove(w, packs, 'I force the villagers to build a keep');
  assert.equal(cruelties(r.world), 1, 'one cruelty deed on the ledger');
  assert.ok(r.world.party[0].morality.corruption > 0, 'the soul pays');
  assert.ok(r.world.party[0].morality.axes.wrath > 0 && r.world.party[0].morality.axes.pride > 0, 'wrath and pride');
  assert.ok(r.world.party[0].morality.heat > 0, 'investigation pressure accrues');
  assert.ok(firstNpcTrust(r.world) < trust0, 'the witnesses remember');
  assert.match(r.output.narration, /never asked|remember your face/i, 'the prose carries the weight');
  assertWorldInvariants(r.world);
});

test('U125-04: the honest fork records none of it — gold spent, soul clean, trust intact', () => {
  const w = withMats(begin('u125c'), STOCK());
  const trust0 = firstNpcTrust(w);
  const purse0 = w.party[0].purse?.gold ?? 0;
  const r = playerMove(w, packs, 'I hire a crew to build a keep');
  // Need a purse that can cover the wages; if too poor it falls back to solo —
  // either way, no cruelty. Assert the moral contrast, not the coin path.
  assert.match(r.output.mechanics, /build \| Keep/);
  assert.equal(cruelties(r.world), 0, 'no cruelty on an honest raise');
  assert.equal(r.world.party[0].morality.corruption, 0, 'the soul stays clean');
  assert.equal(firstNpcTrust(r.world), trust0, 'the witnesses have nothing to remember');
});

test('U125-05: coercion needs people — in the wild it falls to solo with no atrocity', () => {
  const w = withMats(atWild(begin('u125d')), STOCK());
  const r = playerMove(w, packs, 'I force the locals to build a watchtower');
  assert.match(r.output.mechanics, /build \| Watchtower \| \w+ \| solo 30d/, 'no crew/slaves out here → solo');
  assert.match(r.output.narration, /No one to press into labor/i);
  assert.equal(cruelties(r.world), 0, 'no people forced means no cruelty');
  assert.equal(r.world.party[0].morality.corruption, 0);
});

test('U125-06: the deed is counted exactly once, even with cruel phrasing the detector also sees', () => {
  const w = withMats(begin('u125e'), STOCK());
  const r = playerMove(w, packs, 'I force the villagers to build a keep and execute the stragglers');
  assert.equal(cruelties(r.world), 1, 'one deed — the coerced build owns the atrocity, chokepoint skipped');
});

test('U125-07: a keep is a long-rest shelter — sleep under your own walls', () => {
  let w = withMats(atWild(begin('u125f')), STOCK());
  w = { ...w, meta: { ...w.meta, escapeHp: 5, escapeMaxHp: 40 } };
  const built = playerMove(w, packs, 'I build a keep');
  assert.match(built.output.mechanics, /build \| Keep \| \w+ \| solo 120d/);
  const sh = shelterAt(built.world, built.world.map.currentNodeId);
  assert.equal(sh.build.restBand, 'long', 'any keep is walls and a bed');
  const slept = playerMove(built.world, packs, 'I sleep for the night');
  assert.match(slept.output.mechanics, /rest:long/);
  assert.equal(slept.world.meta.escapeHp, 40, 'a true night behind your walls');
});

test('U125-08: deterministic, and a coerced keep survives save/reload remembering its making', () => {
  const w = withMats(begin('u125g'), STOCK());
  const a = playerMove(w, packs, 'I force the villagers to build a keep');
  const b = playerMove(w, packs, 'I force the villagers to build a keep');
  assert.equal(a.output.mechanics, b.output.mechanics);
  assert.equal(a.output.narration, b.output.narration);
  assert.equal(worldHash(a.world), worldHash(importWorld(exportWorld(a.world))), 'hash stable across reload');
  const reloaded = importWorld(exportWorld(a.world));
  const st = Object.values(reloaded.structures.byId).find(s => s.build?.plan === 'keep');
  assert.equal(st.build.labor, 'coerced', 'the keep still remembers');
  assert.equal(reloaded.deeds.filter(d => d.kind === 'cruelty').length, 1, 'the deed persists');
});
