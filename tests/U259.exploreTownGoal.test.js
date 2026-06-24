// U259 — the explore-town harness goal ("On to the surrounding town").
//
// The building-scoped goals certify the room you wake in. explore-town pushes the
// player OUT into the settlement and scores on MEETING THE TOWNSFOLK — the reachable,
// latchable signal that drives the dialogue / NPC-presence / movement paths where the
// settlement-layer coherence bugs live. This pins the goal's contract:
//   • townsfolkEngaged counts distinct present non-hostile NPCs named in a talk action
//     (history-aware, like probeCoverage) AND whoever you're mid-dialogue with now;
//   • a stopword ("the" in "the Lingerer") never inflates the count;
//   • satisfied at ≥2; progress climbs as you get outside and work the room.
//
// Hermetic: pure reads over a booted world + a synthetic actionsLog. No network/key.
// Read-only like every goal — it cannot touch the worldHash determinism gates.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { getGoal, presentTownsfolk, townsfolkEngaged } from '../engine/harness/goals.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U259: the tallow settlement has multiple non-hostile townsfolk to meet (precondition)', () => {
  const folk = presentTownsfolk(boot());
  assert.ok(folk.length >= 2, `expected ≥2 townsfolk, got ${folk.length}`);
  assert.ok(folk.every(n => !n.hostile), 'townsfolk excludes hostiles (the bandit is not someone to befriend)');
});

test('U259: explore-town is registered and reachable via getGoal', () => {
  const goal = getGoal('explore-town');
  assert.equal(goal.id, 'explore-town');
  assert.equal(typeof goal.satisfied, 'function');
  assert.equal(typeof goal.progressMetric, 'function');
});

test('U259: townsfolkEngaged counts distinct people named in talk actions', () => {
  const w = boot();
  // Names drawn from the live roster: Elske Nightherd, Dalla, Asha, the Lingerer.
  assert.equal(townsfolkEngaged(w, { actionsLog: [] }), 0, 'nobody met yet');
  assert.equal(townsfolkEngaged(w, { actionsLog: ['I talk to Dalla'] }), 1, 'one person');
  assert.equal(
    townsfolkEngaged(w, { actionsLog: ['I greet Dalla', 'I ask Asha about the road'] }), 2,
    'two distinct people'
  );
  // Repeating the same person does NOT double-count.
  assert.equal(townsfolkEngaged(w, { actionsLog: ['I talk to Dalla', 'I talk to Dalla again'] }), 1, 'distinct only');
});

test('U259: a stopword ("the") does not inflate the count', () => {
  const w = boot();
  // "the Lingerer" — a bare action mentioning "the" but no real name/talk must NOT
  // count anyone. Only a talk verb aimed at a real address-token does.
  assert.equal(townsfolkEngaged(w, { actionsLog: ['I look at the wall', 'I open the door'] }), 0, 'no false hits from "the"');
  // …but naming the Lingerer in a talk action DOES count them.
  assert.equal(townsfolkEngaged(w, { actionsLog: ['I speak to the Lingerer'] }), 1, 'real name token hits');
});

test('U259: role-based address ("the innkeeper") counts the matching townsperson', () => {
  const w = boot();
  // Dalla's role is innkeeper — addressing the role engages her even without the name.
  assert.equal(townsfolkEngaged(w, { actionsLog: ['I talk to the innkeeper'] }), 1, 'role head-noun matches');
});

test('U259: a live dialogue frame counts the person youre mid-exchange with', () => {
  const w = boot();
  const folk = presentTownsfolk(w);
  // Simulate being in dialogue with the first townsperson (no talk action logged yet).
  const id = String(folk[0].id);
  const w2 = { ...w, scene: { ...(w.scene || {}), dialogue: { npcId: id } } };
  assert.equal(townsfolkEngaged(w2, { actionsLog: [] }), 1, 'the live dialogue partner counts');
});

test('U259: satisfied at ≥2 townsfolk met; progress climbs with getting-out + meeting', () => {
  const goal = getGoal('explore-town');
  const w = boot(); // starts INSIDE the cottage
  assert.equal(goal.satisfied(w, { actionsLog: [] }), false, 'not satisfied at boot');
  const insideProg = goal.progressMetric(w, { actionsLog: [] });

  // Step outside → progress must rise (the "got outside" term).
  const out = playerMove(w, PACKS, 'I step outside.').world;
  const outProg = goal.progressMetric(out, { actionsLog: [] });
  assert.ok(outProg > insideProg, `getting outside raises progress (${insideProg} -> ${outProg})`);

  // Meet two townsfolk → satisfied, progress maxes.
  const ctx2 = { actionsLog: ['I greet Dalla', 'I ask Asha about the bandit'] };
  assert.equal(goal.satisfied(out, ctx2), true, 'two townsfolk met → satisfied');
  assert.equal(goal.progressMetric(out, ctx2), 1, 'outside + 2 met = full progress');

  // Meeting one is partial, not done.
  assert.equal(goal.satisfied(out, { actionsLog: ['I greet Dalla'] }), false, 'one is not enough');
});
