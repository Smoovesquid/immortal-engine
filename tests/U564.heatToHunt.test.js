// U564 — MP-3: THE HUNT FIRES (docs/MORAL_PHYSICS.md §4, T3 row).
//
// When accumulated heat crosses HUNT_HEAT, the world-tick sends the hunt through the EXISTING
// spawnEncounter organ (a router to a live organ — no new effect code). This test drives the
// real engine paths and asserts:
//   (a) a scripted over-threshold run → worldTick spawns hunters at the current node;
//   (b) same seed → same tick → same hunters (deterministic-by-seed);
//   (c) below the threshold → NO hunt;
//   (d) the hunt fires ONCE per crossing (a latch stops it re-spawning every tick), and
//       RE-ARMS after heat decays back below the line;
//   (e) a fair-combat-only run accrues ZERO heat (helplessness is the gate — U556);
//   (f) heat accrued through the real recordDeed chokepoint climbs the ladder and, once over
//       the line, the next tick brings the hunt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldTick } from '../engine/worldTick.js';
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

function begin(seed = 'u564') {
  return beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u564-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
}

// NPC count at a node (the hunters land in settlement.npcs when ambush:false).
function npcCount(w, nodeId) {
  const node = (w.map?.nodes || []).find(n => n && n.id === nodeId);
  return (node?.settlement?.npcs || []).length;
}
// The hunters added since a baseline (names, for readability + a sanity check).
function huntersAdded(w, nodeId, base) {
  const node = (w.map?.nodes || []).find(n => n && n.id === nodeId);
  return (node?.settlement?.npcs || []).slice(base).map(n => n?.name);
}

test('U564-01: over-threshold heat → worldTick spawns the hunt at the current node', () => {
  let w = begin();
  const nid = String(w.map.currentNodeId);
  const before = npcCount(w, nid);
  // Set heat over the line directly (the accrual algebra is proven in U563).
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 5 }]);
  assert.ok(w.party[0].morality.heat >= HUNT_HEAT, 'heat is over HUNT_HEAT');

  const w2 = worldTick(w, 'hunt-fires');
  const after = npcCount(w2, nid);
  assert.ok(after > before, `the hunt arrived (npcs ${before} → ${after})`);
  const hunters = huntersAdded(w2, nid, before);
  assert.ok(hunters.length >= 1 && hunters.every(n => typeof n === 'string' && n.length > 0),
    `hunters have names: ${JSON.stringify(hunters)}`);
  assert.equal(w2.party[0].morality.huntedT > 0, true, 'the hunt latch was set');
  assertWorldInvariants(w2);
});

test('U564-02: the hunt is DETERMINISTIC — same seed, same tick → identical hunters', () => {
  let w = begin('u564-det');
  const nid = String(w.map.currentNodeId);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 12 }]);
  const before = npcCount(w, nid);
  const a = worldTick(w, 'same');
  const b = worldTick(w, 'same');
  assert.deepEqual(huntersAdded(a, nid, before), huntersAdded(b, nid, before),
    'two ticks of the same over-threshold world spawn the same hunters');
});

test('U564-03: BELOW the threshold → no hunt', () => {
  let w = begin('u564-below');
  const nid = String(w.map.currentNodeId);
  const before = npcCount(w, nid);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT - 5 }]);
  assert.ok(w.party[0].morality.heat < HUNT_HEAT, 'heat is below HUNT_HEAT');
  const w2 = worldTick(w, 'no-hunt');
  assert.equal(npcCount(w2, nid), before, 'no hunters arrived below the threshold');
  assert.equal(w2.party[0].morality.huntedT, 0, 'the hunt latch was never set');
  assertWorldInvariants(w2);
});

test('U564-04: the hunt fires ONCE per crossing (latch), then RE-ARMS after cooling', () => {
  let w = begin('u564-latch');
  const nid = String(w.map.currentNodeId);
  const before = npcCount(w, nid);
  // Set heat far over so it stays hot across several ticks.
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 20 }]);

  const t1 = worldTick(w, 'a');
  const afterFirst = npcCount(t1, nid);
  assert.ok(afterFirst > before, 'first tick: the hunt arrives');
  assert.ok(t1.party[0].morality.huntedT > 0, 'latch set');

  // Immediate next tick: still hot, latch set → NO new hunters.
  const t2 = worldTick(t1, 'b');
  assert.equal(npcCount(t2, nid), afterFirst, 'second tick while hot: no re-spawn (latch holds)');

  // Cool it down until heat < HUNT_HEAT → latch must re-arm to 0. Decay is GENTLE (one point
  // per HEAT_DECAY_INTERVAL ticks), so allow generous headroom in the guard.
  let cur = t2, guard = 0;
  while (cur.party[0].morality.heat >= HUNT_HEAT && guard < 600) { cur = worldTick(cur, 'cool' + guard); guard++; }
  assert.ok(cur.party[0].morality.heat < HUNT_HEAT, `heat decayed below the threshold (took ${guard} ticks)`);
  assert.equal(cur.party[0].morality.huntedT, 0, 'the latch re-armed once cooled');

  // Re-offend over the line → the hunt can come AGAIN.
  const beforeSecond = npcCount(cur, nid);
  const reheated = applyDeltas(cur, [{ op: 'adjustHeat', by: HUNT_HEAT + 5 }]);
  const t3 = worldTick(reheated, 'again');
  assert.ok(npcCount(t3, nid) > beforeSecond, 'a re-armed actor who climbs back over is hunted again');
});

test('U564-05: a FAIR-COMBAT-only run accrues ZERO heat → no hunt (helplessness is the gate)', () => {
  // A fair fight records NO cruelty deed (U556), so heat never accrues from it. We assert the
  // structural guarantee at the deed layer: aid/mercy/atonement/fair acts never add heat, and
  // therefore never bring the hunt. (Fair combat itself emits no recordDeed(cruelty) at all —
  // U556 pins that; here we pin that non-cruelty deeds add nothing even when witnessed.)
  let w = begin('u564-fair');
  const nid = String(w.map.currentNodeId);
  const before = npcCount(w, nid);
  for (const kind of ['aid', 'mercy', 'atonement']) {
    for (let k = 0; k < 5; k++) {
      w = applyDeltas(w, [{ op: 'recordDeed', deedKind: kind, severity: 20, witnesses: ['w1', 'w2'], nodeId: nid, summary: `${kind}-${k}`, t: k }]);
    }
  }
  assert.equal(w.party[0].morality.heat, 0, 'fair/good acts accrued ZERO heat');
  const w2 = worldTick(w, 'fair-tick');
  assert.equal(npcCount(w2, nid), before, 'no hunt from a fair run');
  assert.equal(w2.party[0].morality.huntedT, 0, 'no latch — never hunted');
});

test('U564-06: real recordDeed accrual climbs the ladder; over the line, the tick brings the hunt', () => {
  let w = begin('u564-climb');
  const nid = String(w.map.currentNodeId);
  const before = npcCount(w, nid);
  // Pin WITS so accrual is deterministic regardless of chargen roll (WITS 10 → no cover).
  w = { ...w, party: w.party.map((e, i) => i === 0 ? { ...e, stats: { ...e.stats, WITS: 10 } } : e) };

  let crossedAt = -1;
  for (let k = 0; k < 8; k++) {
    w = applyDeltas(w, [{ op: 'recordDeed', deedKind: 'cruelty', severity: 20, witnesses: ['w1', 'w2'], nodeId: nid, summary: `atrocity-${k}`, t: k }]);
    // The deed tier climbs; each recorded deed carries an authoritative tier.
    const last = w.deeds.at(-1);
    assert.equal(last.kind, 'cruelty');
    if (crossedAt < 0 && w.party[0].morality.heat >= HUNT_HEAT) crossedAt = k;
  }
  assert.ok(crossedAt >= 1, `it took more than one atrocity to cross HUNT_HEAT (crossed after deed #${crossedAt})`);
  assert.ok(w.party[0].morality.heat >= HUNT_HEAT, 'accumulated real heat is over the line');
  // Once genuinely accrued over the line, the next world-tick brings the hunt.
  const w2 = worldTick(w, 'climb-hunt');
  assert.ok(npcCount(w2, nid) > before, 'the hunt arrives after a real accrual crossing');
  assert.ok(w2.party[0].morality.huntedT > 0, 'latch set by the real-accrual hunt');
  assertWorldInvariants(w2);
});
