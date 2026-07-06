// U595 — THE CARL WITNESS TEST · ARC B (the §7 falsifier, the player joins the atrocity).
//
//   "Green = the constitution is law, not vision." — docs/MORAL_PHYSICS.md §7
//
// §7 Arc B — "The player aids Carl's purge or kills a helpless villager Carl named." And the Witness
// Test itself: "fix a seed; script Arc B's exact utterances; assert
//   (a) the deed lands with the right witnesses,
//   (b) a claim reaches node X by tick T,
//   (c) the stranger's opening disposition is lower than the control run,
//   (d) worldHash is byte-identical across two replays,
//   (e) no numeric moral value ever appears in any player-facing string."
//
// This test scripts the atrocity the ONE honest way — a real player utterance through playerMove,
// standing where a crowd of named NPCs witnesses it (occupancy truth) — and drives the LANDED organs:
// the deed chokepoint (recordDeed), claim propagation (the rumor engine), and the greeting path
// (dialogue's wary-opening branch, which reads the ONE sink notorietyReaching). Every magnitude is
// engine-owned; the player is shown only omens and colder rooms.

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
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// Arc B's exact utterance: the player kills a helpless villager (a bound captive Carl would have
// named) → tryDarkDeed's kill+helpless branch → HEAVY cruelty, witnessed. The maximal deed a real
// utterance produces (severity 20 = DEED_SEV.HEAVY). This is the "player joins the atrocity" script.
const ARC_B_ATROCITY = 'I stab the bound prisoner to death';
// The control run does the OPPOSITE at the same beat — spares the captive. A fair/merciful act
// records NO cruelty deed (U556) → no travelling reputation → the ordinary greeting. This is the
// baseline letter (c) compares against.
const CONTROL_MERCY = 'I cut the prisoner\'s bonds and set him free';

// The full scripted Arc-B run: begin → step outside among witnesses → the atrocity → let the tale
// travel a few ticks → walk over and greet a local. Returns the world + the greeting narration + the
// witnesses present + EVERY player-facing narration string produced along the way (for letter e).
function arcBRun(seed, utterance) {
  const narrations = []; // every player-facing string across the whole run (letter e sweep)
  const record = (res) => {
    if (res?.output?.narration) narrations.push(String(res.output.narration));
    if (res?.output?.mechanics) narrations.push(String(res.output.mechanics));
    return res;
  };
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u595-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;

  const outside = record(playerMove(w, packs, 'go outside'));
  w = outside.world;
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const distant = w.map.nodes.find(n => n.id !== here.id);
  const witnesses = (here.settlement?.npcs || []).filter(n => n && n.id).map(n => String(n.id));

  const deedRes = record(playerMove(w, packs, utterance));
  w = deedRes.world;

  // Let the tale travel a few world-ticks (durable propagation; the claim reaches node X by tick T).
  let travelTicks = 0;
  for (let i = 0; i < 5; i++) { w = worldTick(w, `${seed}|travel|${i}`); travelTicks++; }

  // Walk over to a local and greet — the wary-opening branch reads notorietyReaching here.
  const npc = (w.map.nodes.find(n => n.id === here.id)?.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  let greetNarration = '';
  if (npc) {
    const talked = record(playerMove(w, packs, `talk to ${npc.name}`)).world;
    const g = record(playerMove(talked, packs, 'hello'));
    greetNarration = String(g.output?.narration || '');
    w = g.world;
  }
  return { w, here, distant, witnesses, greetNarration, narrations, travelTicks };
}

test('U595 (a): the deed LANDS with the right witnesses (occupancy truth)', () => {
  const { w, witnesses } = arcBRun('u595-a', ARC_B_ATROCITY);
  const deeds = (w.deeds || []).filter(d => d.kind === 'cruelty' && String(d.actorId || 'party') === 'party');
  assert.ok(deeds.length >= 1, 'the atrocity recorded a cruelty deed attributed to the player');
  const deed = deeds[0];
  assert.equal(deed.severity, 20, 'severity = DEED_SEV.HEAVY = 20 (the real ceiling for a helpless-context kill)');
  assert.ok(deed.witnesses.length > 0, `witnesses resolved from live occupancy (got ${deed.witnesses.length})`);
  // The witnesses recorded on the deed are drawn from the named people who were actually present.
  assert.ok(deed.witnesses.every(id => witnesses.includes(String(id))),
    'every recorded witness was a named person actually at the scene (no invented witnesses)');
  assertWorldInvariants(w);
});

test('U595 (b): a claim reaches node X by tick T (the tale travels, garbled, attributed to the player)', () => {
  const { w, here, distant, travelTicks } = arcBRun('u595-b', ARC_B_ATROCITY);
  // At the scene: firsthand.
  const local = rumorsReaching(w, here.id, { subjectPrefix: 'deed:' });
  assert.ok(local.length > 0, 'the deed is known at the scene');
  // At node X (a distinct node): the claim reached it within the travel ticks, garbled by distance.
  const far = rumorsReaching(w, distant.id, { subjectPrefix: 'deed:' });
  assert.ok(far.length > 0, `the claim reached node X (${distant.id}) within ${travelTicks} ticks`);
  assert.ok(far[0].tier >= 1, 'what reached node X is secondhand — garbled by distance, not the verbatim deed');
  assert.notEqual(far[0].body, local[0].body, 'the distant telling differs from the scene (epistemic variance)');
  const notorFar = notorietyReaching(w, distant.id);
  assert.equal(notorFar.heard, true, 'a stranger at node X has heard of the player');
});

test('U595 (c): the stranger\'s opening is measurably WARIER than the control run (DIRECTION; the engine owns magnitude)', () => {
  const atrocity = arcBRun('u595-c', ARC_B_ATROCITY);
  const control = arcBRun('u595-c', CONTROL_MERCY); // same seed, same beats — but sparing, not killing

  // The control player is a clean name: the town has heard nothing, so the greeting is ordinary.
  assert.equal(notorietyReaching(control.w, control.here.id).heard, false, 'control (mercy): the town has heard nothing — a clean name');
  // The atrocity player is heard: the greeting turns wary and knowing. This IS the disposition drop,
  // expressed as the landed representation (the wary greeting), not a number.
  assert.equal(notorietyReaching(atrocity.w, atrocity.here.id).heard, true, 'atrocity: the town has heard — reputation preceded the player');

  assert.ok(atrocity.greetNarration.length > 0 && control.greetNarration.length > 0, 'both runs produced a greeting');
  // The two openings DIFFER — the atrocity opening is the knowing/wary one, the control is the ordinary one.
  assert.notEqual(atrocity.greetNarration, control.greetNarration,
    'the notorious player is greeted differently than the clean control');
  assert.match(atrocity.greetNarration, /heard about you|word (?:came|travels|reached)|know (?:who you are|your name)|so you're the one|we heard|watching|mind yourself/i,
    `the atrocity greeting is the wary/knowing one; got: ${atrocity.greetNarration}`);
  // And the control opening is NOT that wary line (it is an ordinary greeting).
  assert.doesNotMatch(control.greetNarration, /heard about you|word came ahead of you|know who you are and how you earned it|so you're the one/i,
    `the control greeting is ordinary, not the reputation-precedes-you line; got: ${control.greetNarration}`);
});

test('U595 (d): worldHash is BYTE-IDENTICAL across two replays of the full scripted run', () => {
  const a = arcBRun('u595-d', ARC_B_ATROCITY);
  const b = arcBRun('u595-d', ARC_B_ATROCITY);
  assert.equal(worldHash(a.w), worldHash(b.w), 'the whole scripted atrocity run replays byte-identical (law, not luck)');
  assertWorldInvariants(a.w);
});

// Letter (e) — the hard wall, run-wide (U578's pattern applied to EVERY player-facing string).
// A moral-numeric leak is (i) a moral word adjacent to a digit ("corruption: 73", "notoriety -2",
// "reputation 40%"), (ii) a bracketed stat tag, or (iii) a bare percentage. The world is the readout;
// a number attached to morality never is.
const METER_RE = /\b(?:reputation|notoriety|corruption|virtue|karma|morality|infamy|standing|heat|sin|penance)\b\s*[:=\-−]?\s*[-−]?\d|\b\d{1,3}\s*%|[\[(]\s*(?:reputation|corruption|virtue|karma|notoriety|heat)\b/i;

test('U595 (e): NO numeric moral value appears in ANY player-facing string across the whole run', () => {
  const { narrations, greetNarration } = arcBRun('u595-e', ARC_B_ATROCITY);
  assert.ok(narrations.length > 0, 'the run produced player-facing strings to check');
  // Sweep EVERY narration/mechanics string the run emitted — the atrocity turn, the travel, the greeting.
  for (const s of narrations) {
    assert.doesNotMatch(s, METER_RE, `a player-facing string leaked a moral meter; got: ${s}`);
  }
  // The wary greeting specifically must read as a person speaking, never a stat line.
  if (greetNarration) {
    assert.doesNotMatch(greetNarration, METER_RE, `the wary greeting leaked a meter; got: ${greetNarration}`);
    assert.doesNotMatch(greetNarration, /\b(?:orb|substrate|cataclysm|the fade|corruption axis|tier \d)\b/i, 'no hidden-why / tier scaffolding leaks into the greeting');
  }
  // Also sweep the garbled rumor bodies the world would surface at the scene and afar — they too are
  // player-facing readouts and must read as gossip, not numbers.
  const { w, here, distant } = arcBRun('u595-e2', ARC_B_ATROCITY);
  const bodies = [
    ...rumorsReaching(w, here.id, { subjectPrefix: 'deed:' }),
    ...rumorsReaching(w, distant.id, { subjectPrefix: 'deed:' })
  ].map(r => String(r.body || ''));
  assert.ok(bodies.length > 0, 'there were rumor bodies to check');
  for (const body of bodies) {
    assert.doesNotMatch(body, METER_RE, `a rumor body read as a stat line, not gossip; got: ${body}`);
  }
});
