// U574 — JR-HUNT-1: THE NO-DOUBLE-TICK WALL (docs/briefs/JR-HUNT-1-roadside-reckoning.md).
//
// The fix makes a fast-travel (journey) turn run worldTick — but a journey turn must tick the world
// EXACTLY ONCE, never twice. worldTick is the sole clock for thread aging, heat decay, ecology, etc.
// (CONSEQ-1/U568: thread age advances exactly 1 per worldTick call). A journey that double-ticked
// would age threads 2/turn, decay heat twice, and desync the world.
//
// This wall asserts, on a journey turn:
//   (a) each living thread's `age` advances by EXACTLY 1 (U568's law — proves exactly one tick);
//   (b) the heat-decay clock (`heatCoolTicks`) advances by EXACTLY 1 (proves heat decayed once);
//   (c) the journey replays BYTE-IDENTICAL — worldHash equal across two independent runs;
//   (d) a plain (below-threshold) walk turn is unaffected by this change — no hunt, deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { HUNT_HEAT } from '../engine/morality/escalation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const packs = loadPacks();

function bootOutside(seed) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u574-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  return w;
}
function firstNeighbourName(w) {
  const here = w.map.currentNodeId;
  const id = (w.map.edges || [])
    .filter(e => e.a === here || e.b === here)
    .map(e => (e.a === here ? e.b : e.a))[0];
  return (w.map.nodes || []).find(n => n && n.id === id)?.name || '';
}
const threadAges = (w) => (w.instrument?.threads || []).map(t => ({ id: t.id, age: t.age }));

test('U574-01: a journey turn ages each thread by EXACTLY 1 (no double-tick — U568 law)', () => {
  let w = bootOutside('u573b');
  // Give heat + a couple of walked turns so a living thread exists and has an age to compare.
  w = applyDeltas(w, [{ op: 'adjustHeat', by: 10 }]);
  const beforeById = new Map(threadAges(w).map(t => [t.id, t.age]));
  assert.ok(beforeById.size >= 1, 'sanity: at least one living thread exists to age');

  const dest = firstNeighbourName(w);
  w = playerMove(w, packs, `I head to ${dest}`).world;

  const after = threadAges(w);
  for (const t of after) {
    if (beforeById.has(t.id)) {
      assert.equal(t.age, beforeById.get(t.id) + 1,
        `thread ${t.id}: age advanced by exactly 1 on the journey turn (was ${beforeById.get(t.id)}, now ${t.age}) — NOT double-ticked`);
    }
  }
  assertWorldInvariants(w);
});

test('U574-02: a journey turn decays heat EXACTLY once (heatCoolTicks advances by 1)', () => {
  let w = bootOutside('u573b');
  // Some heat, but BELOW the line so the hunt does not fire (we are isolating the decay clock).
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT - 8 }]);
  const coolBefore = Number(w.party[0].morality.heatCoolTicks ?? 0);

  const dest = firstNeighbourName(w);
  w = playerMove(w, packs, `I head to ${dest}`).world;

  const coolAfter = Number(w.party[0].morality.heatCoolTicks ?? 0);
  assert.equal(coolAfter, coolBefore + 1,
    `the heat-decay clock advanced by exactly 1 (${coolBefore} → ${coolAfter}) — the world ticked once, not twice`);
  assertWorldInvariants(w);
});

test('U574-03: the journey turn replays BYTE-IDENTICAL (worldHash equal across two runs)', () => {
  function run(seed) {
    let w = bootOutside(seed);
    w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 7 }]); // over the line → hunt fires
    const dest = firstNeighbourName(w);
    w = playerMove(w, packs, `I head to ${dest}`).world;
    return w;
  }
  const a = run('u573b');
  const b = run('u573b');
  assert.equal(worldHash(a), worldHash(b), 'two identical over-threshold journeys → identical worldHash');
  // Prove the run genuinely ticked + hunted (else the determinism check is vacuous).
  assert.ok(a.party[0].morality.huntedT > 0, 'the run actually dispatched the hunt');
  assertWorldInvariants(a);
});

test('U574-04: a plain below-threshold walk turn is unchanged by this fix (no hunt, deterministic)', () => {
  // A bare-cardinal overworld step is a DIFFERENT path from the fast-travel journey. This fix only
  // touches the journey branch; a walk turn must be untouched: no hunt below the line, replay-stable.
  function walk(seed) {
    let w = bootOutside(seed);
    w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT - 8 }]);
    const before = w.map.currentNodeId;
    // Step one cell in a cardinal direction (free-roam step, not a named journey).
    w = playerMove(w, packs, 'north').world;
    return w;
  }
  const a = walk('u573b');
  const b = walk('u573b');
  assert.equal(worldHash(a), worldHash(b), 'a plain walk turn is deterministic');
  assert.equal(a.party[0].morality.huntedT, 0, 'a below-threshold walk brings no hunt');
  assertWorldInvariants(a);
});
