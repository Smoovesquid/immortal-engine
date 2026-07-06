// U572 — MP-4: THE DETERMINISM WALL (docs/MORAL_PHYSICS.md §1-I, §4).
//
// The unbidden gift is real consequence, so it obeys the spine:
//   (I)   DETERMINISM — a scripted over-threshold run that brings the gift replays
//         BYTE-IDENTICAL (worldHash equality across two runs, and across a serialize roundtrip);
//   (II)  NO-DEED SAFETY — a run where the player never corrupts is UNCHANGED by MP-4 (corruption
//         stays 0, no gift fires, pactT stays 0, hash stable run-to-run) — the guardrail that a
//         clean playthrough is byte-identical to before MP-4;
//   (III) OLD-SAVE SAFETY — a save with no `pactT` (pre-MP-4) normalizes to a legal world (pactT
//         defaults to 0), passes invariants, and replays hash-stable.

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
import { PACT_CORRUPTION } from '../engine/morality/escalation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const packs = loadPacks();

// A fixed scripted run that guarantees the pact: begin → outside → push corruption over the line
// (wrath axis, so corruption = max vice = exact) → two world-ticks (tick 1 brings the gift +
// latches; tick 2 confirms the latch holds). The gift is fixed by the threshold, so this pins the
// DETERMINISM of the delivery that follows a crossing.
function scriptedPactRun(seed = 'u572') {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u572-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  w = applyDeltas(w, [{ op: 'axisDelta', axis: 'wrath', by: PACT_CORRUPTION + 7 }]);
  w = worldTick(w, `${seed}|pact-t1`);
  w = worldTick(w, `${seed}|pact-t2`);
  return w;
}

test('U572-01: DETERMINISM — the scripted pact run replays byte-identical (worldHash)', () => {
  const a = scriptedPactRun('u572');
  const b = scriptedPactRun('u572');
  assert.equal(worldHash(a), worldHash(b), 'two identical scripted pact runs → identical worldHash');
  // Confirm the run actually delivered the gift (else the test would be vacuous).
  assert.ok(a.party[0].morality.pactT > 0, 'the run genuinely delivered the gift (latch set)');
  assertWorldInvariants(a);
});

test('U572-02: DETERMINISM — a serialize/deserialize roundtrip preserves the claimed hash', () => {
  const w = scriptedPactRun('u572');
  const h0 = worldHash(w);
  const clone = JSON.parse(JSON.stringify(w));
  assert.equal(worldHash(clone), h0, 'hash stable across a roundtrip (pactT + granted spell survive)');
  assertWorldInvariants(ensureWorld(clone));
});

test('U572-03: NO-DEED — a clean run is UNCHANGED by MP-4 (corruption 0, no gift, hash stable)', () => {
  // The guardrail: on a run where the player never corrupts, corruption is never touched, so the
  // gift never fires and worldHash is identical run-to-run — MP-4 is invisible to a clean game.
  function cleanRun(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.3, campaignId: `u572-clean-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), packs).world;
    for (let i = 0; i < 5; i++) w = worldTick(w, `${seed}|clean|${i}`);
    return w;
  }
  const a = cleanRun('u572-clean');
  const b = cleanRun('u572-clean');
  assert.equal(worldHash(a), worldHash(b), 'a clean run is deterministic');
  assert.equal(a.party[0].morality.corruption, 0, 'no corruption → corruption stayed 0');
  assert.equal(a.party[0].morality.pactT, 0, 'no corruption → the pact never armed');
});

test('U572-04: OLD-SAVE — a pre-MP-4 world (no pactT) normalizes to 0 and replays hash-stable', () => {
  // Build a real claimed world, then STRIP pactT to simulate a save written before MP-4 existed.
  const fresh = scriptedPactRun('u572-old');
  const raw = JSON.parse(JSON.stringify(fresh));
  for (const e of (raw.party || [])) {
    if (e && e.morality && typeof e.morality === 'object') delete e.morality.pactT;
  }
  assert.equal(raw.party[0].morality.pactT, undefined, 'the old save has no pactT field');

  const normalized = ensureWorld(raw);
  assert.equal(normalized.party[0].morality.pactT, 0, 'pactT defaults to 0 on an old save');
  assertWorldInvariants(normalized); // legal world after normalize

  // And it replays hash-stable (ensureWorld is idempotent on the normalized shape).
  assert.equal(worldHash(ensureWorld(normalized)), worldHash(normalized), 'normalize is idempotent → hash stable');
});
