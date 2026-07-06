// U555 — MP-1: the witness → rumor bridge (docs/MORAL_PHYSICS.md §3 · REPUTATION_UNIFICATION.md R5).
//
// THE BUG (contradiction-hunt F1): the deed→reputation path was fully built but calibrated
// DEAD. `rumorsReaching.js` gated player-deed reputation on `severity >= 25`, but a real deed
// recorded through `applyDeedCharges` stores `dominant.sev` whose ceiling is DEED_SEV.HEAVY = 20.
// 20 < 25 → the branch never fired: an atrocity witnessed by a room full of people produced ZERO
// travelling reputation in actual play. (U276 hid this by INJECTING deeds at severity 60 — above
// the ceiling no real deed reaches.) MP-1 recalibrates the gate to the real severity ceiling
// (DEED_GOSSIP_MIN = HEAVY) so a REAL witnessed deed travels.
//
// This test scripts the deed the ONLY honest way — a real player utterance through playerMove,
// with named NPC witnesses present (occupancy truth) — and asserts the read-sink lights up. It
// was RED before the calibration fix (rumorsReaching returned [] for the sev-20 deed).
//
// NOTE ON SUBSTRATE (flagged): the MP-1 dispatch brief asked to "assert a claim is minted on the
// witness." The constitution §3 and REPUTATION_UNIFICATION.md R2/R3 SUPERSEDE that framing — they
// forbid a parallel mintClaim-from-deeds path and rule `rumorsReaching` the sole read-sink, with
// `world.claims` the convergence target reached BEHIND the sink (not opened by this packet). The
// witness truth is therefore carried as the sink's `provenance` (the named witnesses), which is
// the epistemic side of the two-variance wall (§1-II). We assert THAT, per the constitution.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';
import { notorietyReaching } from '../engine/npc/reputation.js';
import { worldTick } from '../engine/worldTick.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// Arc-B fragment (MORAL_PHYSICS §7): a helpless-context kill → HEAVY cruelty (tryDarkDeed
// kill+helpless branch). The maximal deed a real utterance can produce — severity 20.
const ARC_B_ATROCITY = 'I stab the bound prisoner to death';

// Stand outside at the start settlement, where a crowd of named NPCs can witness the deed.
function atSettlement(seed = 'u555') {
  const begun = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u555-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  const w = playerMove(begun, packs, 'go outside').world;
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  assert.equal(here.nodeType, 'settlement', 'start-adjacent node is a settlement with witnesses');
  const witnesses = (here.settlement?.npcs || []).filter(n => n && n.id);
  assert.ok(witnesses.length > 0, 'named NPCs are present to witness (occupancy truth)');
  // A distinct node elsewhere on the map — where reputation must TRAVEL to.
  const distant = w.map.nodes.find(n => n.id !== here.id);
  return { w, here, distant };
}

test('U555-01: a REAL witnessed HEAVY deed becomes travelling reputation (was F1-dead)', () => {
  const { w, here } = atSettlement();

  // Precondition: nothing heard yet — a clean name.
  assert.equal(notorietyReaching(w, here.id).heard, false, 'clean name unheard before the deed');

  const r = playerMove(w, packs, ARC_B_ATROCITY);

  // The deed landed as a real HEAVY cruelty with the room as witnesses (occupancy truth).
  const deeds = r.world.deeds || [];
  assert.equal(deeds.length, 1, 'exactly one deed recorded');
  const deed = deeds[0];
  assert.equal(deed.kind, 'cruelty', 'kind = cruelty (helpless-context kill)');
  assert.equal(deed.severity, 20, 'severity = DEED_SEV.HEAVY = 20 — the real ceiling (NOT the injected 60)');
  assert.ok(deed.witnesses.length > 0, `witnesses resolved from live occupancy (got ${deed.witnesses.length})`);

  // THE FIX: the read-sink now surfaces the deed at the scene. Pre-fix this was [] (20 < 25).
  const atScene = rumorsReaching(r.world, here.id, { subjectPrefix: 'deed:' });
  assert.ok(atScene.length > 0,
    `rumorsReaching lights up for a sev-20 deed (F1 fix). Pre-fix it returned []. Got ${atScene.length}`);

  // The witnesses ARE the epistemic provenance (belief carried by named people — §1-II wall).
  assert.deepEqual(atScene[0].provenance, deed.witnesses,
    'the read-sink carries the named witnesses as provenance (the belief side of the wall)');

  const notor = notorietyReaching(r.world, here.id);
  assert.equal(notor.heard, true, 'notorietyReaching reports the atrocity is now heard');
  assert.ok(notor.score > 0, `with nonzero notoriety (got ${notor.score})`);
});

test('U555-02: reputation TRAVELS — a distant stranger has heard, garbled to travel tier', () => {
  const { w, here, distant } = atSettlement();
  const r = playerMove(w, packs, ARC_B_ATROCITY);

  // At the scene: firsthand, tier 0, undistorted.
  const local = rumorsReaching(r.world, here.id, { subjectPrefix: 'deed:' })[0];
  assert.equal(local.tier, 0, 'at the scene the deed is firsthand (tier 0)');
  assert.equal(local.distortion, 0, 'firsthand → no distortion');

  // At a distant node: heard secondhand, tier 2, the body garbled to its travel fidelity.
  const far = rumorsReaching(r.world, distant.id, { subjectPrefix: 'deed:' });
  assert.ok(far.length > 0, 'the deed reached a distant node (reputation travels)');
  assert.equal(far[0].tier, 2, 'elsewhere it is heard secondhand (tier 2)');
  assert.ok(far[0].distortion > local.distortion, 'the distant telling is more distorted than the scene');
  assert.notEqual(far[0].body, local.body, 'the distant body is garbled — not the verbatim deed');

  const notorFar = notorietyReaching(r.world, distant.id);
  assert.equal(notorFar.heard, true, 'the distant stranger has heard of the player');
  assert.ok(notorFar.score > 0 && notorFar.score < 1, `distant notoriety is real but dimmer (got ${notorFar.score})`);
});

test('U555-03: reputation persists across world-ticks (travel is durable, not a flicker)', () => {
  const { w, distant } = atSettlement();
  let r = playerMove(w, packs, ARC_B_ATROCITY).world;

  const before = notorietyReaching(r, distant.id);
  assert.equal(before.heard, true, 'heard immediately after the deed');

  // Advance several world-ticks — the deed ledger is durable; reputation does not evaporate.
  for (let i = 0; i < 5; i++) r = worldTick(r, `u555|tick${i}`);
  assertWorldInvariants(r);

  const after = notorietyReaching(r, distant.id);
  assert.equal(after.heard, true, 'still heard after 5 world-ticks — reputation is durable');
});

test('U555-04: a witnessed deed only travels once severity reaches the gossip floor', () => {
  // A MODERATE deed (theft from the poor → greed/cruelty MOD, severity 12) is witnessed and
  // remembered LOCALLY (trust craters) but stays below the gossip floor — it does NOT travel.
  // This pins the calibration: HEAVY travels, MOD/LIGHT stay local (constitution §3, §4 Tier-1).
  const { w, here, distant } = atSettlement();
  const r = playerMove(w, packs, 'I rob the starving beggar of his last coin');
  const deeds = r.world.deeds || [];
  assert.equal(deeds.length, 1, 'the moderate deed was recorded');
  assert.ok(deeds[0].severity < 20, `moderate deed is below HEAVY (got sev ${deeds[0].severity})`);

  // Below the floor → no travelling reputation anywhere.
  assert.equal(notorietyReaching(r.world, here.id).heard, false, 'a MOD deed does not become gossip at the scene');
  assert.equal(notorietyReaching(r.world, distant.id).heard, false, 'nor does it travel to a distant node');
});
