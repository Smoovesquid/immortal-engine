// U591 — NPC-DEED-1: ARC A's SPINE — the world grinds Carl over deterministic ticks
// (docs/MORAL_PHYSICS.md §7 Arc A).
//
// Arc A: "over N deterministic world-ticks, [Carl's] deeds mint claims that propagate → the world
// reads a vile man and answers him," the player only a witness. This test drives the REAL cadence
// (engine/worldTick.tickCarlDeeds) — nothing scripted — and asserts the spine at the depth the
// LANDED organs support:
//   (§7a) the deeds LAND, attributed to Carl, with his co-located witnesses;
//   (§7b) they escalate to HEAVY and TRAVEL — the world's read of Carl at a neighbour changes
//         from "nothing heard" to "heard of him," garbled by distance;
//   (§7c) Carl's OWN standing moves — his heat climbs monotonically toward the hunt threshold
//         (his morality-lite accumulator), the substrate on which the rest of Arc A rests.
// The player, meanwhile, is inert: zero player deeds, zero player heat, and the player is never the
// subject of any of it.
//
// WHAT MP-6 STILL NEEDS (documented, not asserted here — see the file footer): the hunt actually
// ARRIVING at Carl (avengers spawned at his node) and Aldermere's faction disposition toward Carl
// as a distinct scalar are BEYOND the organs this packet lands — worldTick's hunt reads the PLAYER's
// heat only, and there is no per-NPC faction-standing store. This packet delivers the accumulator +
// the travelling third-person read; MP-6's falsifier can build its disposition/hunt assertions on
// top, or extend the hunt organ to read an NPC actor.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldTick } from '../engine/worldTick.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';
import { notorietyReaching, notorietyReachingAbout } from '../engine/npc/reputation.js';
import { HUNT_HEAT } from '../engine/morality/escalation.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const CARL = 'figure_carl';

function bootSlice(seed = 'aldermere') {
  return beginAdventure(newWorld({
    seed, fate: 0.3, campaignId: `u591-${seed}`, mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
}
function carlNodeId(w) {
  for (const n of (w.map?.nodes || [])) {
    if ((n.settlement?.npcs || []).some(x => x && String(x.id) === CARL)) return String(n.id);
  }
  return null;
}
function carlNpc(w) {
  for (const n of (w.map?.nodes || [])) {
    const c = (n.settlement?.npcs || []).find(x => x && String(x.id) === CARL);
    if (c) return c;
  }
  return null;
}
function someOtherNodeId(w, here) {
  return (w.map?.nodes || []).map(n => String(n.id)).find(id => id && id !== here) || null;
}
// Grind N deterministic world-ticks with a fixed seed prefix.
function grind(w, seedPrefix, n) {
  for (let i = 0; i < n; i++) w = worldTick(w, `${seedPrefix}|${i}`);
  return w;
}

test('U591-01: over deterministic ticks, Carl commits witnessed cruelty attributed to HIM (§7a)', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  assert.ok(here, 'fixture: Carl is placed on the slice seed');

  // Baseline: no deeds yet.
  assert.equal((w.deeds || []).filter(d => String(d.actorId) === CARL).length, 0, 'no Carl deeds at boot');

  w = grind(w, 'u591-a', 40);
  assertWorldInvariants(w);

  const carlDeeds = (w.deeds || []).filter(d => String(d.actorId) === CARL);
  assert.ok(carlDeeds.length >= 3, `Carl's cadence fired several times over 40 ticks (got ${carlDeeds.length})`);
  assert.ok(carlDeeds.every(d => d.kind === 'cruelty'), 'every Carl deed is cruelty');
  assert.ok(carlDeeds.every(d => Array.isArray(d.witnesses) && d.witnesses.length >= 1),
    'each act is witnessed by his co-located neighbours (so it travels)');
  assert.ok(carlDeeds.every(d => !d.witnesses.includes(CARL)), 'Carl never witnesses his own deed');
});

test('U591-02: the deeds escalate to HEAVY and TRAVEL — the world\'s read of Carl at a neighbour changes (§7b)', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  const elsewhere = someOtherNodeId(w, here);
  assert.ok(elsewhere, 'fixture: a second node exists for the rumor to reach');

  // Before any ticks: the neighbour has heard nothing about Carl.
  assert.equal(notorietyReachingAbout(w, elsewhere, CARL).heard, false, 'baseline: nothing heard about Carl');

  w = grind(w, 'u591-b', 40);
  assertWorldInvariants(w);

  const carlDeeds = (w.deeds || []).filter(d => String(d.actorId) === CARL);
  assert.ok(carlDeeds.some(d => d.severity >= 20), 'his project hardened — at least one HEAVY act');
  assert.ok(carlDeeds.some(d => d.tier >= 2), 'a witnessed HEAVY act reaches at least Tier 2 (reputation travels)');

  // The world's read of CARL at the neighbour has changed: heard, third-person, garbled.
  const about = notorietyReachingAbout(w, elsewhere, CARL);
  assert.equal(about.heard, true, 'the neighbour has now heard of Carl');
  assert.ok(about.worst && about.worst.tier >= 1, 'what reached them is garbled by distance (not first-hand)');
  assert.ok(about.worst.body.length > 0, 'and carries a body — the tale as the locals tell it');

  // The rumor at the neighbour is tagged with Carl as the actor (third-person, not the player).
  const reaching = rumorsReaching(w, elsewhere, { subjectPrefix: 'deed:' });
  assert.ok(reaching.some(r => String(r.actorId) === CARL), 'the travelling rumor is attributed to Carl');
  assert.ok(!reaching.some(r => String(r.actorId) === 'party'), 'none of it is attributed to the player');
});

test('U591-03: Carl\'s OWN standing moves — his heat climbs toward the hunt; the player stays inert (§7c)', () => {
  let w = bootSlice();

  const player0 = w.party[0].morality.heat;

  // Sample heat at two horizons to show a monotone climb (his accumulator, the Arc A substrate).
  let wMid = grind(bootSlice(), 'u591-c', 18);
  let wLate = grind(bootSlice(), 'u591-c', 40);

  const carlMid = carlNpc(wMid);
  const carlLate = carlNpc(wLate);
  assert.ok(carlMid && carlMid.morality, 'Carl carries a morality-lite accumulator once he has acted');
  assert.ok(carlMid.morality.heat > 0, 'Carl has accrued heat by mid-run');
  assert.ok(carlLate.morality.heat > carlMid.morality.heat, 'his heat climbs further over more ticks (monotone accrual)');

  // The player, doing nothing, is completely inert throughout.
  assert.equal(wLate.party[0].morality.heat, player0, 'the player accrued NO heat — Arc A grinds Carl, not the player');
  assert.equal((wLate.deeds || []).filter(d => String(d.actorId) === 'party').length, 0, 'the player committed no deeds');
  const anyNode = String(wLate.map.currentNodeId);
  assert.equal(notorietyReaching(wLate, anyNode).heard, false, 'the player is never notorious for Carl\'s deeds');
});

// ── WHAT MP-6 STILL NEEDS (the honest remainder this packet documents) ────────────────────────────
// This test proves the ACCUMULATOR + the travelling THIRD-PERSON read — the spine of Arc A. Two Arc-A
// beats live BEYOND the organs this packet lands, and MP-6's falsifier owns them:
//   • THE HUNT REACHING CARL. worldTick's tickHunt reads the PLAYER's heat only (party[0]); it does
//     not yet dispatch avengers at an NPC whose own heat crossed HUNT_HEAT. Carl's heat DOES cross it
//     here (assertable), but nothing spawns on him. Extending tickHunt to iterate NPC actors is the
//     natural MP-6 (or a follow-on) step — deliberately out of this packet's scope (it would touch the
//     hunt/spawn organ and the player-facing encounter path).
//   • "ALDERMERE'S DISPOSITION TOWARD CARL CRATERS" as a distinct scalar. There is no per-NPC
//     faction-standing store today (npc.disposition is used inconsistently as a string/bearing, and
//     world.reputation.factions is the PARTY's standing — which Carl's deeds correctly do NOT touch,
//     so his crimes never move the player's faction rep). His SOURING is represented here by his own
//     climbing heat + the travelling third-person reputation. A dedicated faction-toward-NPC scalar
//     is additive future work MP-6 can add if its falsifier needs that exact number.
test('U591-04: Carl\'s heat crosses HUNT_HEAT — the hook MP-6 can hang the hunt-reaches-Carl assertion on', () => {
  let w = grind(bootSlice(), 'u591-d', 40);
  assertWorldInvariants(w);
  const carl = carlNpc(w);
  assert.ok(carl && carl.morality, 'Carl carries his accumulator');
  // His own heat has crossed the hunt threshold — everything the hunt would need to fire on HIM is
  // present in state; the only missing piece is the hunt organ iterating NPC actors (MP-6 / follow-on).
  assert.ok(carl.morality.heat >= HUNT_HEAT,
    `Carl's heat (${carl.morality.heat}) has crossed HUNT_HEAT (${HUNT_HEAT}) — the substrate for the hunt reaching him exists`);
  // The player, by contrast, is nowhere near it (they did nothing).
  assert.ok(w.party[0].morality.heat < HUNT_HEAT, 'the player never approaches the hunt threshold');
});
