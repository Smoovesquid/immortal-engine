// U570 — MP-4: THE PACT ALGEBRA (docs/MORAL_PHYSICS.md §4, T4 row).
//
// Tier 4 goes live: once standing corruption reaches PACT_CORRUPTION, the world delivers the
// dark gift UNBIDDEN. This test pins the PURE algebra of the trigger — thresholds and latch
// boundaries — before the world-tick delivery (U571) and the determinism wall (U572):
//   (a) PACT_CORRUPTION is READ FROM forbiddenGates, never a forked literal (=== the lowest
//       darkGift threshold);
//   (b) darkGiftAtCorruption is LEVEL-triggered: null below the first threshold, the first
//       (lowest) gift at/above it — the shape the world-tick needs (vs the edge-triggered
//       darkGiftForThreshold the playloop uses);
//   (c) the latch boundary edges: exactly at the threshold fires; one under does not; the
//       latch (pactT) fires once per crossing and re-arms only after corruption falls back below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldTick } from '../engine/worldTick.js';
import { PACT_CORRUPTION } from '../engine/morality/escalation.js';
import { darkGiftThresholds, darkGiftAtCorruption, darkGiftForThreshold } from '../engine/magic/forbiddenGates.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed = 'u570') {
  return beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u570-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
}

// Push standing corruption to an exact value via a single vice axis (corruption = max vice pole).
// wrath is a vice axis; a fresh world has all axes at 0, so corruption becomes exactly `to`.
function setCorruption(w, to) {
  const w2 = applyDeltas(w, [{ op: 'axisDelta', axis: 'wrath', by: to }]);
  assert.equal(w2.party[0].morality.corruption, to, `corruption set to ${to}`);
  return w2;
}

test('U570-01: PACT_CORRUPTION is READ from forbiddenGates — the lowest darkGift threshold, never forked', () => {
  const thresholds = darkGiftThresholds();
  assert.ok(Array.isArray(thresholds) && thresholds.length > 0, 'forbiddenGates exposes gift thresholds');
  // The single source of the number. MP-2 derives PACT_CORRUPTION = min(thresholds); assert the
  // identity so a future edit to the gift table (e.g. the first threshold moving) MOVES the pact
  // trigger with it, and no literal has been forked into the ladder.
  assert.equal(PACT_CORRUPTION, Math.min(...thresholds),
    'PACT_CORRUPTION === the lowest forbiddenGates threshold (read, not forked)');
});

test('U570-02: darkGiftAtCorruption is LEVEL-triggered — null below the first threshold, the lowest gift at/above', () => {
  // Below the first threshold → nothing owed.
  assert.equal(darkGiftAtCorruption(PACT_CORRUPTION - 1), null, 'one under the threshold → no gift');
  assert.equal(darkGiftAtCorruption(0), null, 'zero corruption → no gift');
  // Exactly at, and above → the first (lowest-tier) gift, deterministically.
  const at = darkGiftAtCorruption(PACT_CORRUPTION);
  assert.ok(at && typeof at.ref === 'string' && at.ref.length > 0, 'at the threshold → a concrete gift with a spell ref');
  assert.ok(typeof at.text === 'string' && at.text.length > 0, 'the gift carries diegetic text');
  const higher = darkGiftAtCorruption(PACT_CORRUPTION + 40);
  // The world-tick delivers the FIRST claiming (lowest qualifying tier) — deeper gifts arrive as
  // corruption climbs further (the playloop edge-hook grants those). So far above the first line,
  // the level organ still returns the first gift; it is the "you are owed at least this" answer.
  assert.equal(higher.ref, at.ref, 'darkGiftAtCorruption returns the lowest qualifying gift (first claiming)');
});

test('U570-03: the level organ differs from the edge organ — it answers standing state, not a delta', () => {
  // darkGiftForThreshold (playloop) needs a delta STRADDLING a boundary; a static over-threshold
  // corruption returns null from it (old==new). darkGiftAtCorruption returns the gift regardless.
  const c = PACT_CORRUPTION + 5;
  assert.equal(darkGiftForThreshold(c, c), null, 'edge organ: no crossing (old==new) → null even while over the line');
  assert.ok(darkGiftAtCorruption(c), 'level organ: over the line → a gift, no delta required (this is the tick gap MP-4 fills)');
});

test('U570-04: BOUNDARY — exactly at the threshold the tick fires; one under, nothing', () => {
  // One under: no gift, no latch.
  let under = setCorruption(begin('u570-under'), PACT_CORRUPTION - 1);
  const knownU = (under.party[0].spells?.known || []).slice();
  under = worldTick(under, 'under-tick');
  assert.equal(under.party[0].morality.pactT, 0, 'one under the threshold → latch never set');
  assert.deepEqual((under.party[0].spells?.known || []), knownU, 'one under → no gift granted');
  assertWorldInvariants(under);

  // Exactly at: the gift fires, latch sets.
  let at = setCorruption(begin('u570-at'), PACT_CORRUPTION);
  const knownA = (at.party[0].spells?.known || []).slice();
  at = worldTick(at, 'at-tick');
  assert.ok(at.party[0].morality.pactT > 0, 'exactly at the threshold → the gift arrives (latch set)');
  const addedA = (at.party[0].spells?.known || []).filter(s => !knownA.includes(s));
  assert.ok(addedA.length >= 1, `exactly at → a gift was granted (${JSON.stringify(addedA)})`);
  assertWorldInvariants(at);
});

test('U570-05: LATCH — fires ONCE per crossing, then RE-ARMS only after corruption falls back below', () => {
  let w = setCorruption(begin('u570-latch'), PACT_CORRUPTION + 10);
  const knownBefore = (w.party[0].spells?.known || []).slice();

  // First tick: the gift arrives, latch sets.
  const t1 = worldTick(w, 'a');
  assert.ok(t1.party[0].morality.pactT > 0, 'first tick: claimed (latch set)');
  const grantedFirst = (t1.party[0].spells?.known || []).filter(s => !knownBefore.includes(s));
  assert.ok(grantedFirst.length >= 1, 'first tick granted the gift');

  // Second tick while still over the line, latch set → nothing new (no double-grant, no re-fire).
  const t2 = worldTick(t1, 'b');
  assert.deepEqual((t2.party[0].spells?.known || []), (t1.party[0].spells?.known || []),
    'second tick while claimed: no new gift (latch holds)');
  assert.equal(t2.party[0].morality.pactT, t1.party[0].morality.pactT, 'latch tick unchanged while over the line');

  // Corruption falls back below the threshold → the latch re-arms to 0 (a repented actor is no
  // longer marked as claimed). Drop the wrath axis under the line.
  let cooled = applyDeltas(t2, [{ op: 'axisDelta', axis: 'wrath', by: -(PACT_CORRUPTION + 10 - (PACT_CORRUPTION - 3)) }]);
  assert.ok(cooled.party[0].morality.corruption < PACT_CORRUPTION, 'corruption dropped below the threshold');
  cooled = worldTick(cooled, 'cool');
  assert.equal(cooled.party[0].morality.pactT, 0, 'the pact latch re-armed once corruption fell below');

  // Relapse back over the line → the world can claim AGAIN (the gift, if already known, at least
  // re-latches; if a deeper gift is now owed via a fresh crossing it would arrive through the
  // edge-hook — here we assert the latch mechanic re-engages).
  let relapsed = applyDeltas(cooled, [{ op: 'axisDelta', axis: 'wrath', by: (PACT_CORRUPTION + 5) - cooled.party[0].morality.corruption }]);
  assert.ok(relapsed.party[0].morality.corruption >= PACT_CORRUPTION, 'relapsed over the line');
  relapsed = worldTick(relapsed, 'again');
  assert.ok(relapsed.party[0].morality.pactT > 0, 'a re-armed actor who relapses is claimed again (latch re-set)');
  assertWorldInvariants(relapsed);
});
