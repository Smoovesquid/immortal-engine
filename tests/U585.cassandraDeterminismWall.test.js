// U585 — MP-5b: THE CASSANDRA DETERMINISM WALL (docs/MORAL_PHYSICS.md §1-I, §5).
//
// The warning is real consequence, so it obeys the spine (mirrors U572's structure for
// MP-4's pact, and U565's for MP-3's hunt):
//   (I)   WARNED-THEN-COOLED replays byte-identical (worldHash equality across two runs, and
//         across a serialize roundtrip) — the player is warned, heeds it, cools below the
//         band floor, and the latch cleanly re-arms;
//   (II)  WARNED-THEN-HUNTED replays byte-identical — the player is warned, ignores it, and
//         crosses into the hunt (both latches set, composing on the SAME or a later tick);
//   (III) NO-DEED SAFETY — a clean run is byte-identical run-to-run, heat/cassandraArmed/
//         cassandraT all stay at their neutral defaults;
//   (IV)  OLD-SAVE SAFETY — a save with neither cassandraArmed nor cassandraT (pre-MP-5b)
//         normalizes to a legal world and replays hash-stable.
//
// The default-boot anchor itself (U454-E) is NOT re-derived here — it is owned entirely by
// U454-E, and re-pinning it a second time in this file would duplicate a literal that isn't
// this packet's own scripted scenario to assert (U579-01's lesson: assert what YOUR packet
// owns, not another test's pin). This file only proves REPLAY EQUALITY of scripted runs that
// exercise the Cassandra, exactly as U572/U572-02 do for the pact.

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
import { HUNT_HEAT, cassandraBandFloor } from '../engine/morality/escalation.js';
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
    seed, fate: 0.2, campaignId: `u585-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  return w;
}

// Scripted run (I): warned, then heeds it — cools all the way back below the band floor.
function scriptedWarnedThenCooled(seed) {
  const floor = cassandraBandFloor();
  let w = bootOutside(seed);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor }]);
  w = worldTick(w, `${seed}|warn`);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: -(floor + 10) }]); // clamped at 0 by adjustHeat
  w = worldTick(w, `${seed}|cool`);
  return w;
}

// Scripted run (II): warned, then ignored — heat is driven on into the hunt.
function scriptedWarnedThenHunted(seed) {
  const floor = cassandraBandFloor();
  let w = bootOutside(seed);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor }]);
  w = worldTick(w, `${seed}|warn`);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: (HUNT_HEAT - floor) + 5 }]);
  w = worldTick(w, `${seed}|hunt`);
  return w;
}

test('U585-01: WARNED-THEN-COOLED — replays byte-identical (worldHash equality across two runs)', () => {
  const a = scriptedWarnedThenCooled('u585-cool');
  const b = scriptedWarnedThenCooled('u585-cool');
  assert.equal(worldHash(a), worldHash(b), 'two identical warned-then-cooled scripted runs → identical worldHash');
  // Confirm the run genuinely exercised the beat (else the test would be vacuous).
  assert.ok(a.party[0].morality.cassandraT === 0, 'the run cooled all the way and RE-ARMED (latch cleared)');
  assert.equal(a.party[0].morality.cassandraArmed, false, 're-armed cleanly, ready for a fresh crossing');
  assert.equal(a.party[0].morality.huntedT, 0, 'heeding the warning kept the player out of the hunt entirely');
  assertWorldInvariants(a);
});

test('U585-02: WARNED-THEN-COOLED — a serialize/deserialize roundtrip preserves the claimed hash', () => {
  const w = scriptedWarnedThenCooled('u585-cool-rt');
  const h0 = worldHash(w);
  const clone = JSON.parse(JSON.stringify(w));
  assert.equal(worldHash(clone), h0, 'hash stable across a roundtrip (cassandraArmed/cassandraT survive)');
  assertWorldInvariants(ensureWorld(clone));
});

test('U585-03: WARNED-THEN-HUNTED — replays byte-identical (worldHash equality across two runs)', () => {
  const a = scriptedWarnedThenHunted('u585-hunt');
  const b = scriptedWarnedThenHunted('u585-hunt');
  assert.equal(worldHash(a), worldHash(b), 'two identical warned-then-hunted scripted runs → identical worldHash');
  assert.ok(a.party[0].morality.cassandraT > 0, 'the warning was delivered on the way in');
  assert.ok(a.party[0].morality.huntedT > 0, 'ignoring the warning let the hunt catch the player');
  assertWorldInvariants(a);
});

test('U585-04: WARNED-THEN-HUNTED — a serialize/deserialize roundtrip preserves the claimed hash', () => {
  const w = scriptedWarnedThenHunted('u585-hunt-rt');
  const h0 = worldHash(w);
  const clone = JSON.parse(JSON.stringify(w));
  assert.equal(worldHash(clone), h0, 'hash stable across a roundtrip (both latches survive together)');
  assertWorldInvariants(ensureWorld(clone));
});

test('U585-05: BLOW-THROUGH COMPOSITION — Cassandra + hunt landing on the SAME tick also replays byte-identical', () => {
  function scriptedBlowThrough(seed) {
    let w = bootOutside(seed);
    w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 10 }]); // skips the band floor entirely, straight past HUNT_HEAT
    w = worldTick(w, `${seed}|blow-through`);
    return w;
  }
  const a = scriptedBlowThrough('u585-blow');
  const b = scriptedBlowThrough('u585-blow');
  assert.equal(worldHash(a), worldHash(b), 'a same-tick Cassandra+hunt composition replays byte-identical');
  assert.ok(a.party[0].morality.cassandraT > 0, 'the Cassandra fired on the blow-through tick');
  assert.ok(a.party[0].morality.huntedT > 0, 'the hunt ALSO fired on the same tick');
  assertWorldInvariants(a);
});

test('U585-06: NO-DEED SAFETY — a clean run is UNCHANGED by MP-5b (no arming, no delivery, hash stable)', () => {
  function cleanRun(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.3, campaignId: `u585-clean-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), packs).world;
    for (let i = 0; i < 5; i++) w = worldTick(w, `${seed}|clean|${i}`);
    return w;
  }
  const a = cleanRun('u585-clean');
  const b = cleanRun('u585-clean');
  assert.equal(worldHash(a), worldHash(b), 'a clean run is deterministic');
  assert.equal(a.party[0].morality.heat, 0, 'no heat accrued → heat stayed 0');
  assert.equal(a.party[0].morality.cassandraArmed, false, 'no heat accrued → the Cassandra never armed');
  assert.equal(a.party[0].morality.cassandraT, 0, 'no heat accrued → the Cassandra never delivered');
});

test('U585-07: OLD-SAVE — a pre-MP-5b world (no cassandraArmed/cassandraT) normalizes to defaults and replays hash-stable', () => {
  const fresh = scriptedWarnedThenHunted('u585-old');
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

  assert.equal(worldHash(ensureWorld(normalized)), worldHash(normalized), 'normalize is idempotent → hash stable');
});
