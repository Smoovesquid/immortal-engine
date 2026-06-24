// U263 — journey from bed out into the world, to ANOTHER town (the travel layer).
//
// "Take the playtester from bed out into the world and into another town." The
// journey-to-town harness goal drives the biggest surface yet: leave the building,
// leave the home settlement, and travel the road graph to a DIFFERENT settlement.
// On seed `tallow` the nearest other town is Crossway Village, two hops out:
//   Wayfarers' Outpost → Old Shrine → Crossway Village.
//
// This also pins the travel-vocabulary fix the drive surfaced: "take the road to X"
// and "continue on to X" are travel (they fell to the action floor before), while
// "take the road MAP" is not (over-match guard).
//
// Determinism note: the goal is READ-ONLY over the world; the legs run the real seeded
// travel path (encounters included), so the drive is replay-stable.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { getGoal } from '../engine/harness/goals.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const ROLL_RE = /\broll:\s*\d+\s*vs\s*DC/i;
const nodeName = (w) => (w.map.nodes || []).find(n => n.id === w.map.currentNodeId)?.name || '';
const goal = getGoal('journey-to-town');

test('U263: journey-to-town is registered and reachable via getGoal', () => {
  assert.equal(goal.id, 'journey-to-town');
  assert.equal(typeof goal.satisfied, 'function');
  assert.equal(typeof goal.progressMetric, 'function');
});

test('U263: at home you are NOT at another town; progress is 0 in bed, rises once outside', () => {
  const w = boot();
  const start = w.map.currentNodeId;
  const ctx = { actionsLog: [], startNodeId: start };
  assert.equal(goal.satisfied(w, ctx), false, 'in bed, not at another town');
  assert.equal(goal.progressMetric(w, ctx), 0, 'inside the home building → 0');
  const out = playerMove(w, PACKS, 'I get out of bed and step outside.').world;
  assert.ok(goal.progressMetric(out, ctx) > 0, 'outside at home → progress > 0');
  assert.equal(goal.satisfied(out, ctx), false, 'still home, not another town');
});

test('U263: the journey completes — bed → Old Shrine → Crossway Village (progress climbs to 1)', () => {
  let w = boot();
  const start = w.map.currentNodeId;
  const ctx = { actionsLog: [], startNodeId: start };
  const legs = [
    'I get out of bed and step outside.',
    'I travel west to Old Shrine.',
    'I take the road to Crossway Village.',
  ];
  let prev = goal.progressMetric(w, ctx);
  for (const leg of legs) {
    w = playerMove(w, PACKS, leg).world;
    ctx.actionsLog.push(leg);
    const p = goal.progressMetric(w, ctx);
    assert.ok(p >= prev, `progress is monotone across the journey (${prev} -> ${p} after "${leg}")`);
    prev = p;
  }
  assert.equal(nodeName(w), 'Crossway Village', 'arrived at the other town');
  assert.equal(goal.satisfied(w, ctx), true, 'satisfied: standing in a settlement that is not home');
  assert.equal(goal.progressMetric(w, ctx), 1, 'full progress on arrival');
});

test('U263: travel vocabulary — "take the road to X" / "continue on to X" travel (no roll)', () => {
  // Get to Old Shrine first (Crossway is its neighbor).
  const atShrine = playerMove(playerMove(boot(), PACKS, 'I get out of bed and step outside.').world, PACKS, 'I travel west to Old Shrine.').world;
  const here = atShrine.map.currentNodeId;
  for (const phrase of ['I take the road to Crossway Village.', 'I continue on to Crossway Village.']) {
    const r = playerMove(atShrine, PACKS, phrase);
    assert.equal(r.world.map.currentNodeId !== here, true, `[${phrase}] should travel to Crossway`);
    assert.equal(nodeName(r.world), 'Crossway Village', `[${phrase}] arrives at Crossway`);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] travel is not a die roll`);
  }
});

test('U263: over-match guard — "take the road MAP" / "take the lantern" do NOT travel', () => {
  const out = playerMove(boot(), PACKS, 'I get out of bed and step outside.').world;
  const here = out.map.currentNodeId;
  for (const phrase of ['I take the road map from the table', 'take the lantern', 'I take a seat by the fire']) {
    const r = playerMove(out, PACKS, phrase);
    assert.equal(r.world.map.currentNodeId, here, `[${phrase}] must NOT travel to another node`);
  }
});
