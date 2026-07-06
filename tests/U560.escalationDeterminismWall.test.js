// U560 — MP-2: the determinism wall + the T3/T4 no-act guarantee (docs/MORAL_PHYSICS.md §4).
//
//   (I)  DETERMINISM — a scripted deed run replays byte-identical (worldHash equality)
//        after the ladder started stamping a tier on every deed. Adding the tier is a
//        deterministic derivation, so replay-equality holds.
//   (II) COMPUTED, NOT ACTED — the ladder is a ROUTER (§4). Tagging a deed T3 (the hunt)
//        or T4 (the pact-gift) must NOT, by itself, spawn an encounter or grant a spell —
//        those are MP-3 / MP-4. MP-2 only records the number.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { HUNT_HEAT, PACT_CORRUPTION, DEED_SEV } from '../engine/morality/escalation.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// A fixed script: begin → outside → a witnessed atrocity → a second cruelty → talk.
const SCRIPT = [
  'go outside',
  'I execute the kneeling captive who begs for mercy',
  'I torture the bound prisoner for information',
];

function scriptedRun(seed = 'u560') {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u560-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  for (const line of SCRIPT) w = playerMove(w, packs, line).world;
  return w;
}

test('U560-01: DETERMINISM — a scripted deed run replays byte-identical (worldHash)', () => {
  const a = scriptedRun('u560');
  const b = scriptedRun('u560');
  assert.equal(worldHash(a), worldHash(b), 'two identical scripted runs → identical worldHash');
  assertWorldInvariants(a);
  // Every recorded deed carries a valid ladder rung (the tier field is present + in range).
  for (const d of (a.deeds || [])) {
    assert.ok(Number.isInteger(d.tier) && d.tier >= 0 && d.tier <= 4, `deed tier in range: ${d.tier}`);
  }
});

test('U560-02: DETERMINISM — export/import roundtrip preserves the hash (tier survives)', () => {
  const w = scriptedRun('u560');
  const h0 = worldHash(w);
  // A structural clone is the cheapest faithful roundtrip of the canonical state.
  const clone = JSON.parse(JSON.stringify(w));
  assert.equal(worldHash(clone), h0, 'hash stable across a serialize/deserialize roundtrip');
});

test('U560-03: COMPUTED-NOT-ACTED — a T3 (hunt) tier spawns NO encounter by itself', () => {
  // Give the actor accumulated heat >= HUNT_HEAT, then record a witnessed HEAVY deed. The
  // deed grades T3, but MP-2 must not start a fight — spawnEncounter is MP-3.
  let w = beginAdventure(newWorld({
    seed: 'u560h', fate: 0.2, campaignId: 'u560-hunt',
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 5 }]);
  const combatBefore = !!w.combat?.active;
  const enemiesBefore = (w.combat?.enemies || []).length;
  const nid = String(w.map.currentNodeId || '');

  w = applyDeltas(w, [
    { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'the hunted one kills again', nodeId: nid, witnesses: ['w1'], t: 0 },
  ]);
  const deed = (w.deeds || []).find(d => d.summary === 'the hunted one kills again');
  assert.ok(deed, 'the deed recorded');
  assert.ok(deed.tier >= 3, `heat >= HUNT_HEAT grades the deed to at least Tier 3 (got ${deed.tier})`);
  // The guarantee: no fight was started, no enemy added, by the act of tagging.
  assert.equal(!!w.combat?.active, combatBefore, 'tagging T3 did not start combat');
  assert.equal((w.combat?.enemies || []).length, enemiesBefore, 'tagging T3 spawned no enemies');
  assertWorldInvariants(w);
});

test('U560-04: COMPUTED-NOT-ACTED — a T4 (pact) tier grants NO spell by itself', () => {
  // Accumulated corruption >= PACT_CORRUPTION, then a witnessed deed grades T4. MP-2 must
  // not hand out a forbidden gift — darkGiftForThreshold is MP-4's to route.
  let w = beginAdventure(newWorld({
    seed: 'u560p', fate: 0.2, campaignId: 'u560-pact',
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  // Push a vice axis to the pact threshold so standing corruption >= PACT_CORRUPTION.
  w = applyDeltas(w, [{ op: 'axisDelta', axis: 'wrath', by: PACT_CORRUPTION }]);
  const spellsBefore = new Set((w.party?.[0]?.spells?.known || []).map(String));
  assert.ok(Number(w.party?.[0]?.morality?.corruption ?? 0) >= PACT_CORRUPTION, 'standing corruption reached the pact threshold');
  const nid = String(w.map.currentNodeId || '');

  w = applyDeltas(w, [
    { op: 'recordDeed', deedKind: 'cruelty', severity: DEED_SEV.HEAVY, summary: 'the claimed one strikes', nodeId: nid, witnesses: ['w1'], t: 0 },
  ]);
  const deed = (w.deeds || []).find(d => d.summary === 'the claimed one strikes');
  assert.ok(deed, 'the deed recorded');
  assert.equal(deed.tier, 4, `corruption >= PACT_CORRUPTION grades the deed to Tier 4 (got ${deed.tier})`);
  // The guarantee: the known-spell set is unchanged — no gift was granted by tagging.
  const spellsAfter = new Set((w.party?.[0]?.spells?.known || []).map(String));
  assert.equal(spellsAfter.size, spellsBefore.size, 'tagging T4 granted no new spell');
  for (const s of spellsAfter) assert.ok(spellsBefore.has(s), `no new spell appeared: ${s}`);
  assertWorldInvariants(w);
});
