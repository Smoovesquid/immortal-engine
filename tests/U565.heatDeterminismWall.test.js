// U565 — MP-3: THE DETERMINISM WALL (docs/MORAL_PHYSICS.md §1-I, §4).
//
// The hunt is real consequence, so it must obey the spine:
//   (I)   DETERMINISM — a scripted over-threshold run that brings the hunt replays
//         BYTE-IDENTICAL (worldHash equality across two runs, and across a serialize
//         roundtrip);
//   (II)  HIDE-THE-MATH — no numeric moral value (heat / corruption / tier) ever appears in
//         ANY player-facing string the hunt turn emits (tick log, deed summaries, timeline,
//         the hunters' own names/text);
//   (III) OLD-SAVE SAFETY — a save with no `huntedT` (pre-MP-3) normalizes to a legal world
//         (huntedT defaults to 0), passes invariants, and replays hash-stable.

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

// A fixed scripted run that guarantees the hunt: begin → outside → push heat over the line →
// two world-ticks (tick 1 brings the hunt + latches; tick 2 confirms the latch holds). Uses
// adjustHeat so the crossing is exact and seed-independent — the ACCRUAL algebra is proven in
// U563/U564; here we only pin the DETERMINISM of the hunt that follows a crossing.
function scriptedHuntRun(seed = 'u565') {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u565-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 7 }]);
  w = worldTick(w, `${seed}|hunt-t1`);
  w = worldTick(w, `${seed}|hunt-t2`);
  return w;
}

test('U565-01: DETERMINISM — the scripted hunt run replays byte-identical (worldHash)', () => {
  const a = scriptedHuntRun('u565');
  const b = scriptedHuntRun('u565');
  assert.equal(worldHash(a), worldHash(b), 'two identical scripted hunt runs → identical worldHash');
  // Confirm the run actually brought the hunt (else the test would be vacuous).
  assert.ok(a.party[0].morality.huntedT > 0, 'the run genuinely dispatched the hunt (latch set)');
  assertWorldInvariants(a);
});

test('U565-02: DETERMINISM — a serialize/deserialize roundtrip preserves the hunted hash', () => {
  const w = scriptedHuntRun('u565');
  const h0 = worldHash(w);
  const clone = JSON.parse(JSON.stringify(w));
  assert.equal(worldHash(clone), h0, 'hash stable across a roundtrip (huntedT + heat survive)');
  assertWorldInvariants(ensureWorld(clone));
});

test('U565-03: HIDE-THE-MATH — no numeric moral value in any player-facing string of the hunt turn', () => {
  const w = scriptedHuntRun('u565');
  const heat = w.party[0].morality.heat;
  const corruption = w.party[0].morality.corruption;
  const huntedT = w.party[0].morality.huntedT;

  // Gather every player-facing string the hunt turn can surface: the tick log, timeline event
  // text/summaries, and the hunters' own names + descriptions at the current node.
  const strings = [];
  for (const line of (Array.isArray(w.tickLog) ? w.tickLog : [])) strings.push(String(line));
  for (const e of (Array.isArray(w.timeline) ? w.timeline : [])) {
    if (e?.data) for (const v of Object.values(e.data)) if (typeof v === 'string') strings.push(v);
  }
  const nid = String(w.map?.currentNodeId || '');
  const node = (w.map?.nodes || []).find(n => n && n.id === nid);
  for (const npc of (node?.settlement?.npcs || [])) {
    if (npc?.name) strings.push(String(npc.name));
    if (npc?.description) strings.push(String(npc.description));
    if (npc?.disposition) strings.push(String(npc.disposition));
  }

  // The heat value (and corruption, and the latch tick) must never appear as a standalone
  // number in any of these. Guard against false positives: only flag a value >= 2 digits or a
  // word-boundary match of a small number that could only be the meter leaking.
  const forbidden = [heat, corruption, huntedT].filter(n => Number.isFinite(n) && n >= 10);
  for (const s of strings) {
    for (const n of forbidden) {
      assert.ok(!new RegExp(`\\b${n}\\b`).test(s), `player-facing string leaks a moral number (${n}): ${JSON.stringify(s)}`);
    }
    // Belt-and-braces: no "heat" or "corruption" meter language surfaced to the player.
    assert.ok(!/\bheat\s*[:=]\s*\d/i.test(s), `string leaks a heat meter: ${JSON.stringify(s)}`);
    assert.ok(!/corruption\s*[:=]\s*\d/i.test(s), `string leaks a corruption meter: ${JSON.stringify(s)}`);
  }
});

test('U565-04: OLD-SAVE — a pre-MP-3 world (no huntedT) normalizes to 0 and replays hash-stable', () => {
  // Build a real hunted world, then STRIP huntedT (and, for good measure, present it as an old
  // save shape) to simulate a save written before MP-3 existed.
  const fresh = scriptedHuntRun('u565-old');
  const raw = JSON.parse(JSON.stringify(fresh));
  for (const e of (raw.party || [])) {
    if (e && e.morality && typeof e.morality === 'object') delete e.morality.huntedT;
  }
  assert.equal(raw.party[0].morality.huntedT, undefined, 'the old save has no huntedT field');

  const normalized = ensureWorld(raw);
  assert.equal(normalized.party[0].morality.huntedT, 0, 'huntedT defaults to 0 on an old save');
  assertWorldInvariants(normalized); // legal world after normalize

  // And it replays hash-stable (ensureWorld is idempotent on the normalized shape).
  assert.equal(worldHash(ensureWorld(normalized)), worldHash(normalized), 'normalize is idempotent → hash stable');
});

test('U565-05: DETERMINISM — a no-deed default run is unchanged by MP-3 (heat stays 0, no hunt)', () => {
  // The guardrail the brief calls out: on a run where the player commits no cruelty, heat is
  // never touched, so the hunt never fires and worldHash is identical run-to-run.
  function cleanRun(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.3, campaignId: `u565-clean-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), packs).world;
    for (let i = 0; i < 5; i++) w = worldTick(w, `${seed}|clean|${i}`);
    return w;
  }
  const a = cleanRun('u565-clean');
  const b = cleanRun('u565-clean');
  assert.equal(worldHash(a), worldHash(b), 'a clean run is deterministic');
  assert.equal(a.party[0].morality.heat, 0, 'no cruelty → heat stayed 0');
  assert.equal(a.party[0].morality.huntedT, 0, 'no cruelty → the hunt never armed');
});
