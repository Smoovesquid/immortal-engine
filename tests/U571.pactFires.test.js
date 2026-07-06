// U571 — MP-4: THE GIFT FIRES (docs/MORAL_PHYSICS.md §4, T4 row).
//
// When standing corruption reaches PACT_CORRUPTION, the world-tick DELIVERS the dark gift
// unbidden through the EXISTING forbiddenGates organ (a router to the live learnSpell grant —
// no new effect content). This test drives the real engine paths and asserts:
//   (a) a scripted over-threshold run → worldTick grants the forbidden gift to the player;
//   (b) same seed → same tick → same gift (deterministic-by-seed; the gift is fixed by the
//       threshold, so it is stable without consuming RNG);
//   (c) below the threshold → NO gift;
//   (d) the gift fires ONCE per crossing (the pactT latch), and re-arms after corruption drops;
//   (e) HIDE-THE-MATH — no numeric moral value appears in any player-facing string of the turn;
//   (f) corruption accrued through the REAL axisDelta path climbs to the line and the tick
//       delivers the gift (the world claims the doer, they never asked).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldTick } from '../engine/worldTick.js';
import { PACT_CORRUPTION } from '../engine/morality/escalation.js';
import { darkGiftAtCorruption } from '../engine/magic/forbiddenGates.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed = 'u571') {
  return beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u571-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
}

const known = (w) => (w.party?.[0]?.spells?.known || []);
// The gift the actor is owed at a given corruption (the ref the tick will grant).
const owedRef = (c) => (darkGiftAtCorruption(c) || {}).ref;
// Set corruption to an exact value via wrath (a vice axis; fresh axes are 0 → corruption == to).
function setCorruption(w, to) {
  const w2 = applyDeltas(w, [{ op: 'axisDelta', axis: 'wrath', by: to }]);
  assert.equal(w2.party[0].morality.corruption, to, `corruption set to ${to}`);
  return w2;
}

test('U571-01: over-threshold corruption → worldTick grants the forbidden gift unbidden', () => {
  let w = setCorruption(begin(), PACT_CORRUPTION + 5);
  const before = known(w).slice();
  const expectRef = owedRef(w.party[0].morality.corruption);
  assert.ok(expectRef, 'a gift is owed at this corruption');
  assert.ok(!before.includes(expectRef), 'the gift is not already known (a genuine grant)');

  const w2 = worldTick(w, 'gift-fires');
  const after = known(w2);
  assert.ok(after.includes(expectRef), `the gift '${expectRef}' arrived unbidden (known ${before.length} → ${after.length})`);
  assert.ok(w2.party[0].morality.pactT > 0, 'the pact latch was set');
  assertWorldInvariants(w2);
});

test('U571-02: the gift is DETERMINISTIC — same seed, same tick → identical grant', () => {
  let w = setCorruption(begin('u571-det'), PACT_CORRUPTION + 12);
  const before = known(w).slice();
  const a = worldTick(w, 'same');
  const b = worldTick(w, 'same');
  const addedA = known(a).filter(s => !before.includes(s));
  const addedB = known(b).filter(s => !before.includes(s));
  assert.deepEqual(addedA, addedB, 'two ticks of the same over-threshold world grant the same gift');
  assert.ok(addedA.length >= 1, 'the run actually granted a gift (non-vacuous)');
});

test('U571-03: BELOW the threshold → no gift', () => {
  let w = setCorruption(begin('u571-below'), PACT_CORRUPTION - 4);
  const before = known(w).slice();
  assert.ok(w.party[0].morality.corruption < PACT_CORRUPTION, 'corruption is below PACT_CORRUPTION');
  const w2 = worldTick(w, 'no-gift');
  assert.deepEqual(known(w2), before, 'no gift arrived below the threshold');
  assert.equal(w2.party[0].morality.pactT, 0, 'the pact latch was never set');
  assertWorldInvariants(w2);
});

test('U571-04: the gift fires ONCE per crossing (latch), then RE-ARMS after corruption drops', () => {
  let w = setCorruption(begin('u571-latch'), PACT_CORRUPTION + 20);
  const before = known(w).slice();

  const t1 = worldTick(w, 'a');
  const addedFirst = known(t1).filter(s => !before.includes(s));
  assert.ok(addedFirst.length >= 1, 'first tick: the gift arrives');
  assert.ok(t1.party[0].morality.pactT > 0, 'latch set');

  // Immediate next tick: still over the line, latch set → NO new grant.
  const t2 = worldTick(t1, 'b');
  assert.deepEqual(known(t2), known(t1), 'second tick while claimed: no re-grant (latch holds)');

  // Drop corruption below the line → the latch re-arms to 0.
  let cur = applyDeltas(t2, [{ op: 'axisDelta', axis: 'wrath', by: -((PACT_CORRUPTION + 20) - (PACT_CORRUPTION - 5)) }]);
  assert.ok(cur.party[0].morality.corruption < PACT_CORRUPTION, 'corruption dropped below the threshold');
  cur = worldTick(cur, 'rearm');
  assert.equal(cur.party[0].morality.pactT, 0, 'the latch re-armed once corruption fell below');

  // Relapse over the line → the world claims again (latch re-engages).
  let reoffend = applyDeltas(cur, [{ op: 'axisDelta', axis: 'wrath', by: (PACT_CORRUPTION + 5) - cur.party[0].morality.corruption }]);
  const t3 = worldTick(reoffend, 'again');
  assert.ok(t3.party[0].morality.pactT > 0, 'a re-armed actor who relapses is claimed again');
});

test('U571-05: HIDE-THE-MATH — no numeric moral value in any player-facing string of the pact turn', () => {
  let w = setCorruption(begin('u571-hide'), PACT_CORRUPTION + 7);
  w = worldTick(w, 'pact-t1');

  const corruption = w.party[0].morality.corruption;
  const pactT = w.party[0].morality.pactT;
  const heat = w.party[0].morality.heat;

  // Gather every player-facing string the pact turn can surface: the tick log lives in the
  // timeline (pushTickLog writes a worldTick event with data.text), plus every timeline event's
  // string data, plus the granted spell's own ref/name if it were ever narrated here.
  const strings = [];
  for (const e of (Array.isArray(w.timeline) ? w.timeline : [])) {
    if (e?.data) for (const v of Object.values(e.data)) if (typeof v === 'string') strings.push(v);
  }
  // The gift's diegetic text is NOT surfaced by the tick (that is MP-5); but if it ever were,
  // confirm it too carries no moral number.
  const gift = darkGiftAtCorruption(corruption);
  if (gift?.text) strings.push(gift.text);

  const forbidden = [corruption, pactT, heat].filter(n => Number.isFinite(n) && n >= 10);
  for (const s of strings) {
    for (const n of forbidden) {
      assert.ok(!new RegExp(`\\b${n}\\b`).test(s), `player-facing string leaks a moral number (${n}): ${JSON.stringify(s)}`);
    }
    assert.ok(!/corruption\s*[:=]\s*\d/i.test(s), `string leaks a corruption meter: ${JSON.stringify(s)}`);
    assert.ok(!/\bpact\s*[:=]\s*\d/i.test(s), `string leaks a pact meter: ${JSON.stringify(s)}`);
  }
});

test('U571-06: REAL axisDelta accrual climbs to the line; over it, the tick delivers the gift', () => {
  let w = begin('u571-climb');
  const before = known(w).slice();
  // Corruption is the max vice pole; climb wrath in small steps until it reaches the line, the
  // way real deeds accumulate a sin over many turns without any single turn crossing.
  const step = Math.max(1, Math.ceil(PACT_CORRUPTION / 4));
  let crossedAt = -1;
  for (let k = 0; k < 8 && w.party[0].morality.corruption < PACT_CORRUPTION; k++) {
    w = applyDeltas(w, [{ op: 'axisDelta', axis: 'wrath', by: step }]);
    if (crossedAt < 0 && w.party[0].morality.corruption >= PACT_CORRUPTION) crossedAt = k;
  }
  assert.ok(crossedAt >= 1, `it took more than one step to reach PACT_CORRUPTION (crossed after step #${crossedAt})`);
  assert.ok(w.party[0].morality.corruption >= PACT_CORRUPTION, 'accumulated corruption is at/over the line');

  // The player never asked — the world claims them on the next tick.
  const w2 = worldTick(w, 'climb-gift');
  const added = known(w2).filter(s => !before.includes(s));
  assert.ok(added.length >= 1, `the gift arrived after a real accrual crossing (${JSON.stringify(added)})`);
  assert.ok(w2.party[0].morality.pactT > 0, 'latch set by the real-accrual claiming');
  assertWorldInvariants(w2);
});
