// U583 — MP-5b: THE CASSANDRA LATCH ALGEBRA (docs/MORAL_PHYSICS.md §5, docs/briefs/
// MP-5b-the-cassandra.md).
//
// "A person who sees you clearly and says the hard thing once, plainly, and can be waved
// off." The pinned interpretation: the Cassandra fires ONCE when the actor's heat ENTERS the
// APPROACH BAND `[HUNT_HEAT - CASSANDRA_MARGIN, HUNT_HEAT)` — BEFORE the hunt, so heeding
// (cooling off, making amends, leaving) can still matter. This file pins the PURE LATCH
// ALGEBRA in engine/worldTick.js's tickCassandra + engine/morality/escalation.js's
// cassandraBandFloor, independent of the surfacing layer (U584) and the full determinism
// wall (U585):
//   (a) fires ONCE on entering the band (armed + delivered when a witness is present);
//   (b) HOLDS (armed, undelivered) while nobody is present at the node, and delivers the
//       instant someone real is;
//   (c) clears (never re-delivers) while heat stays in or above the band;
//   (d) re-arms ONLY after heat cools back below the band FLOOR (not merely below HUNT_HEAT);
//   (e) a single deed that blows straight through the band AND past HUNT_HEAT in one turn is
//       acceptable fiction — Cassandra + hunt latch both set on the same tick.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldTick } from '../engine/worldTick.js';
import { worldHash } from '../engine/worldHash.js';
import { HUNT_HEAT, CASSANDRA_MARGIN, cassandraBandFloor } from '../engine/morality/escalation.js';
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
    seed, fate: 0.2, campaignId: `u583-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  return w;
}

// Clear every NPC from the player's CURRENT node — simulates "nobody is here" without
// touching procgen. A structural mutation on the already-normalized world; ensureWorld's
// own defaults keep the rest of the shape legal.
function clearNpcsHere(w) {
  const nodeId = String(w.map.currentNodeId);
  const nodes = w.map.nodes.map(n => {
    if (String(n.id) !== nodeId) return n;
    if (!n.settlement) return n;
    return { ...n, settlement: { ...n.settlement, npcs: [] } };
  });
  return { ...w, map: { ...w.map, nodes } };
}

test('U583-01: BAND FLOOR — cassandraBandFloor() === HUNT_HEAT - CASSANDRA_MARGIN, never forked', () => {
  assert.equal(cassandraBandFloor(), HUNT_HEAT - CASSANDRA_MARGIN);
  assert.ok(CASSANDRA_MARGIN > 0, 'the margin is a real positive width, not a zero-width band');
  assert.ok(CASSANDRA_MARGIN < HUNT_HEAT, 'the margin never pushes the floor to or below zero for this calibration');
});

test('U583-02: FIRES ONCE — heat entering the band with a witness present arms AND delivers on the same tick', () => {
  let w = bootOutside('u583-fire');
  const floor = cassandraBandFloor();
  assert.equal(w.party[0].morality.cassandraArmed, false, 'precondition: not armed at boot');
  assert.equal(w.party[0].morality.cassandraT, 0, 'precondition: never delivered at boot');

  // Push heat to exactly the band floor (a witness IS present — the default tallow
  // settlement roster is outdoors after "go outside", per U573's own boot idiom).
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor }]);
  assert.equal(w.party[0].morality.heat, floor, 'heat sits exactly at the band floor');

  w = worldTick(w, 'u583-fire-t1');
  assert.equal(w.party[0].morality.cassandraArmed, false, 'delivered immediately → HOLD flag clears (not left armed)');
  assert.ok(w.party[0].morality.cassandraT > 0, 'the beat was delivered (latch set) — a witness was present');
  assertWorldInvariants(w);

  // A second tick while heat stays in-band: no re-delivery (the latch value doesn't change).
  const deliveredAt = w.party[0].morality.cassandraT;
  w = worldTick(w, 'u583-fire-t2');
  assert.equal(w.party[0].morality.cassandraT, deliveredAt, 'no second delivery while heat stays in-band (same latch value)');
});

test('U583-03: ONE UNDER the band floor — no arming, no delivery', () => {
  let w = bootOutside('u583-under');
  const floor = cassandraBandFloor();
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor - 1 }]);
  w = worldTick(w, 'u583-under-tick');
  assert.equal(w.party[0].morality.cassandraArmed, false, 'one under the floor → never arms');
  assert.equal(w.party[0].morality.cassandraT, 0, 'one under the floor → never delivers');
  assertWorldInvariants(w);
});

test('U583-04: HOLDS — heat enters the band with NOBODY present: armed, but undelivered, across ticks', () => {
  let w = bootOutside('u583-hold');
  w = clearNpcsHere(w);
  const floor = cassandraBandFloor();
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor }]);

  w = worldTick(w, 'u583-hold-t1');
  assert.equal(w.party[0].morality.cassandraArmed, true, 'nobody present → armed, HOLDING');
  assert.equal(w.party[0].morality.cassandraT, 0, 'nobody present → not yet delivered');
  assertWorldInvariants(w);

  // A second tick with STILL nobody present: still holding, no change, no throw.
  w = worldTick(w, 'u583-hold-t2');
  assert.equal(w.party[0].morality.cassandraArmed, true, 'still holding on tick 2');
  assert.equal(w.party[0].morality.cassandraT, 0, 'still undelivered on tick 2');
  assertWorldInvariants(w);
});

test('U583-05: HOLD RESOLVES — a witness later arrives (settlement.npcs populated again) and the beat delivers', () => {
  let w = bootOutside('u583-resolve');
  const originalNode = w.map.nodes.find(n => String(n.id) === String(w.map.currentNodeId));
  const originalNpcs = originalNode.settlement.npcs;
  w = clearNpcsHere(w);
  const floor = cassandraBandFloor();
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor }]);
  w = worldTick(w, 'u583-resolve-hold');
  assert.equal(w.party[0].morality.cassandraArmed, true, 'holds with nobody present');
  assert.equal(w.party[0].morality.cassandraT, 0, 'undelivered while holding');

  // A witness arrives — restore the roster at this node.
  const nodeId = String(w.map.currentNodeId);
  w = { ...w, map: { ...w.map, nodes: w.map.nodes.map(n => String(n.id) === nodeId ? { ...n, settlement: { ...n.settlement, npcs: originalNpcs } } : n) } };

  w = worldTick(w, 'u583-resolve-deliver');
  assert.equal(w.party[0].morality.cassandraArmed, false, 'delivered — HOLD flag clears');
  assert.ok(w.party[0].morality.cassandraT > 0, 'delivered — latch set now that a witness is present');
  assertWorldInvariants(w);
});

test('U583-06: RE-ARM — only after heat cools back BELOW THE BAND FLOOR (not merely below HUNT_HEAT)', () => {
  let w = bootOutside('u583-rearm');
  const floor = cassandraBandFloor();
  // Start a few points INTO the band (not exactly at the floor) so a small -1 nudge below
  // still lands at/above the floor, not under it.
  const margin = Math.min(3, HUNT_HEAT - floor - 1);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor + margin }]);
  w = worldTick(w, 'u583-rearm-fire');
  assert.ok(w.party[0].morality.cassandraT > 0, 'precondition: delivered once');
  const deliveredAt = w.party[0].morality.cassandraT;

  // Nudge heat down but STILL inside the band (still >= floor, < HUNT_HEAT) — must NOT re-arm.
  if (margin >= 1) {
    let stillInBand = applyDeltas(w, [{ op: 'adjustHeat', by: -1 }]);
    assert.ok(stillInBand.party[0].morality.heat >= floor, 'still at/above the floor after the nudge');
    stillInBand = worldTick(stillInBand, 'u583-rearm-nudge');
    assert.equal(stillInBand.party[0].morality.cassandraT, deliveredAt, 'staying in-band after a small cool does NOT re-arm (latch value unchanged)');
    assert.equal(stillInBand.party[0].morality.cassandraArmed, false, 'staying in-band after a small cool does NOT re-arm the HOLD flag either');
  }

  // Now cool all the way below the FLOOR — this DOES re-arm (clears the latch).
  let cooled = applyDeltas(w, [{ op: 'adjustHeat', by: -(floor + 5) }]);
  assert.ok(cooled.party[0].morality.heat < floor, 'heat now genuinely below the band floor');
  cooled = worldTick(cooled, 'u583-rearm-cool');
  assert.equal(cooled.party[0].morality.cassandraT, 0, 'cooling below the FLOOR re-arms the latch (cleared to 0)');
  assert.equal(cooled.party[0].morality.cassandraArmed, false, 're-armed cleanly (HOLD flag also false, ready for a fresh crossing)');
  assertWorldInvariants(cooled);

  // Relapse back into the band → the world can warn AGAIN (a genuinely fresh crossing).
  let relapsed = applyDeltas(cooled, [{ op: 'adjustHeat', by: floor - cooled.party[0].morality.heat }]);
  assert.ok(relapsed.party[0].morality.heat >= floor, 'relapsed back into the band');
  relapsed = worldTick(relapsed, 'u583-rearm-relapse');
  assert.ok(relapsed.party[0].morality.cassandraT > 0, 'a re-armed actor who relapses is warned again (latch re-set)');
  assertWorldInvariants(relapsed);
});

test('U583-07: BLOW-THROUGH — a single deed that crosses the WHOLE band and HUNT_HEAT in one turn fires BOTH latches the same tick', () => {
  let w = bootOutside('u583-blowthrough');
  // Push heat from 0 straight past HUNT_HEAT in one shot — skips the band's lower edge
  // entirely (never sat "in the band" on any earlier tick).
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 10 }]);
  assert.ok(w.party[0].morality.heat >= HUNT_HEAT, 'heat is over HUNT_HEAT already');

  w = worldTick(w, 'u583-blowthrough-tick');
  assert.ok(w.party[0].morality.cassandraT > 0,
    'the Cassandra still fires — heat is >= the band floor by construction (HUNT_HEAT itself is inside the "at or above the floor" test), acceptable fiction: the warning came as the hounds slipped the leash');
  assert.ok(w.party[0].morality.huntedT > 0, 'the hunt ALSO fires on the same tick');
  assertWorldInvariants(w);
});

test('U583-08: NO-DEED SAFETY — a clean run never arms, never delivers, hash-stable run-to-run', () => {
  function cleanRun(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.3, campaignId: `u583-clean-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), packs).world;
    for (let i = 0; i < 5; i++) w = worldTick(w, `${seed}|clean|${i}`);
    return w;
  }
  const a = cleanRun('u583-clean');
  assert.equal(a.party[0].morality.cassandraArmed, false, 'a clean run never arms the Cassandra');
  assert.equal(a.party[0].morality.cassandraT, 0, 'a clean run never delivers the Cassandra');
  assert.equal(a.party[0].morality.heat, 0, 'no heat accrued at all');
});

test('U583-09: OLD-SAVE SAFETY — a pre-MP-5b world (no cassandraArmed/cassandraT) normalizes cleanly', () => {
  const fresh = bootOutside('u583-old');
  const raw = JSON.parse(JSON.stringify(fresh));
  for (const e of (raw.party || [])) {
    if (e && e.morality && typeof e.morality === 'object') {
      delete e.morality.cassandraArmed;
      delete e.morality.cassandraT;
    }
  }
  assert.equal(raw.party[0].morality.cassandraArmed, undefined, 'the old save has no cassandraArmed field');
  assert.equal(raw.party[0].morality.cassandraT, undefined, 'the old save has no cassandraT field');

  const normalized = ensureWorld(raw);
  assert.equal(normalized.party[0].morality.cassandraArmed, false, 'cassandraArmed defaults to false on an old save');
  assert.equal(normalized.party[0].morality.cassandraT, 0, 'cassandraT defaults to 0 on an old save');
  assertWorldInvariants(normalized); // legal world after normalize

  // Idempotent normalize → hash-stable (same idiom U572-04 uses for pactT).
  assert.equal(worldHash(ensureWorld(normalized)), worldHash(normalized), 'normalize is idempotent → hash stable');
});
