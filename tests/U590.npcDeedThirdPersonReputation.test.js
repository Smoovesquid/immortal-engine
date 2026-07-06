// U590 — NPC-DEED-1: a WITNESSED NPC DEED TRAVELS AS THIRD-PERSON REPUTATION
// (docs/MORAL_PHYSICS.md §7 Arc A · docs/REPUTATION_UNIFICATION.md R2).
//
// The load-bearing behavior this packet exists to enable, and the trap it closes:
//   (1) HONEST ATTRIBUTION — a deed committed by an NPC (Carl) is recorded with actorId = the NPC,
//       never silently misattributed to the player (before this packet, an unknown actor id fell
//       back to party[0]).
//   (2) IT REACHES THE SINK — the deed becomes travelling reputation through the ONE read-sink
//       (rumorsReaching), garbled by travel tier at a neighbouring node — no parallel read path.
//   (3) THIRD-PERSON, NOT SECOND — the player is NEVER the subject of an NPC's deed:
//       notorietyReaching (the PLAYER's second-person greeting source) stays heard:false, while
//       notorietyReachingAbout(Carl) surfaces it. Feeding an NPC deed to the player's greeting
//       would make a townsperson accuse the player of Carl's crime — actively wrong.
//   (4) PLAYER DEEDS BYTE-IDENTICAL — a player's own deed still attributes to the player, accrues
//       heat on the player entity, and touches no NPC morality (the additive change is strictly
//       NPC-side; the player path is unchanged).
//
// The deed is recorded directly through effectsCore's recordDeed chokepoint (the same op Carl's
// worldTick cadence emits) so this test isolates attribution + surfacing from the cadence's timing.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';
import { notorietyReaching, notorietyReachingAbout } from '../engine/npc/reputation.js';
import { commonKnowledgeAnswer } from '../engine/npc/dialogue.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

const CARL = 'figure_carl';

// Boot the slice (seed 'aldermere') — the authored region where Carl is placed at Aldermere.
function bootSlice() {
  return beginAdventure(newWorld({
    seed: 'aldermere', fate: 0.3, campaignId: 'u590', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
}
function carlNodeId(w) {
  for (const n of (w.map?.nodes || [])) {
    if ((n.settlement?.npcs || []).some(x => x && String(x.id) === CARL)) return String(n.id);
  }
  return null;
}
// Any OTHER node than `here` (a place the deed did NOT happen — where the rumor arrives secondhand).
function someOtherNodeId(w, here) {
  return (w.map?.nodes || []).map(n => String(n.id)).find(id => id && id !== here) || null;
}
// Some real NPC id at Carl's node other than Carl (his witness).
function aWitnessAtCarlNode(w, carlNode) {
  const node = (w.map?.nodes || []).find(n => String(n.id) === carlNode);
  const other = (node?.settlement?.npcs || []).find(x => x && String(x.id) !== CARL);
  return other ? String(other.id) : null;
}

test('U590-01: a witnessed NPC (Carl) deed is recorded with HONEST attribution — actorId is the NPC, not the player', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  assert.ok(here, 'fixture: Carl must be placed at some node on the slice seed');
  const witness = aWitnessAtCarlNode(w, here);
  assert.ok(witness, 'fixture: Carl must have at least one co-located witness');

  const playerHeatBefore = w.party[0].morality.heat;

  w = applyDeltas(w, [{
    op: 'recordDeed', deedKind: 'cruelty', severity: 20, actorId: CARL,
    nodeId: here, witnesses: [witness], summary: 'Carl drove a neighbour from the square', t: w.timeline.length
  }]);
  assertWorldInvariants(w);

  const rec = w.deeds[w.deeds.length - 1];
  assert.equal(rec.actorId, CARL, 'the deed is attributed to Carl (honest), not defaulted to the player');

  // Carl accrued the heat; the PLAYER did not move at all.
  const carlNode = (w.map.nodes).find(n => String(n.id) === here);
  const carl = carlNode.settlement.npcs.find(x => String(x.id) === CARL);
  assert.ok(carl.morality && carl.morality.heat > 0, 'Carl accrued his OWN heat (morality-lite stamped on first deed)');
  assert.equal(w.party[0].morality.heat, playerHeatBefore, 'the player accrued NOTHING — this was not their deed');
});

test('U590-02: the NPC deed REACHES the sink at a neighbouring node, garbled by travel tier (third person)', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  const witness = aWitnessAtCarlNode(w, here);
  w = applyDeltas(w, [{
    op: 'recordDeed', deedKind: 'cruelty', severity: 20, actorId: CARL,
    nodeId: here, witnesses: [witness], summary: 'Carl set upon a beggar with a cudgel', t: w.timeline.length
  }]);

  const elsewhere = someOtherNodeId(w, here);
  assert.ok(elsewhere, 'fixture: the region has a second node the rumor can reach');

  // Read through the ONE sink. The NPC deed is present, tagged with its honest actor, garbled to
  // the secondhand travel tier (2) because it happened elsewhere.
  const reaching = rumorsReaching(w, elsewhere, { subjectPrefix: 'deed:' });
  const carlRumor = reaching.find(r => String(r.actorId) === CARL);
  assert.ok(carlRumor, "Carl's deed surfaces through rumorsReaching at the neighbouring node");
  assert.equal(carlRumor.tier, 2, 'heard secondhand elsewhere → travel tier 2 (garbled)');
  assert.ok(carlRumor.deedRef && carlRumor.deedRef.startsWith('deed:'), 'carries a stable deed ref');
  assert.ok(typeof carlRumor.body === 'string' && carlRumor.body.length > 0, 'carries the garbled body the locals heard');
});

test('U590-03: THIRD-PERSON, NOT SECOND — the player is never the subject of Carl\'s deed', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  const witness = aWitnessAtCarlNode(w, here);
  w = applyDeltas(w, [{
    op: 'recordDeed', deedKind: 'cruelty', severity: 20, actorId: CARL,
    nodeId: here, witnesses: [witness], summary: 'Carl penned a starving man in a coop', t: w.timeline.length
  }]);

  const elsewhere = someOtherNodeId(w, here);

  // The PLAYER's notoriety (the second-person greeting source in dialogue.js) must NOT fire —
  // the player committed nothing. This is the trap the audit named: blaming the PC for Carl's crime.
  const playerNotor = notorietyReaching(w, elsewhere);
  assert.equal(playerNotor.heard, false, 'the player is NOT notorious — an NPC deed never becomes the player\'s reputation');
  assert.equal(playerNotor.worst, null, 'nothing about the player reaches the town');

  // Carl's third-person notoriety DOES fire — the world has heard about HIM.
  const carlNotor = notorietyReachingAbout(w, elsewhere, CARL);
  assert.equal(carlNotor.heard, true, 'the world has heard about Carl specifically (third person)');
  assert.ok(carlNotor.worst && carlNotor.worst.body.length > 0, 'the worst-heard rumor about Carl carries a body');

  // And notorietyReachingAbout with the player sentinel is inert (the player is never a "subject").
  assert.equal(notorietyReachingAbout(w, elsewhere, 'party').heard, false, 'the player is never a third-person subject');
});

test('U590-04: PLAYER DEEDS BYTE-IDENTICAL — a player deed still attributes to the player and touches no NPC morality', () => {
  // A clean world (no Carl needed) — assert the player path is unchanged by this packet.
  let w = beginAdventure(newWorld({
    seed: 'u590-player', fate: 0.3, campaignId: 'u590p', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;

  const here = String(w.map.currentNodeId);
  w = applyDeltas(w, [{
    op: 'recordDeed', deedKind: 'cruelty', severity: 20,
    nodeId: here, witnesses: [], summary: 'the player did a cruel thing', t: w.timeline.length
  }]);
  assertWorldInvariants(w);

  const rec = w.deeds[w.deeds.length - 1];
  assert.equal(rec.actorId, 'party', 'a player deed (no actorId) still records as the player');
  assert.ok(w.party[0].morality.heat > 0, 'the player accrued their own heat, exactly as before');

  // No NPC anywhere gained a morality field from a PLAYER deed — the additive change is NPC-side only.
  const anyNpcMorality = (w.map?.nodes || []).some(n =>
    (n.settlement?.npcs || []).some(x => x && x.morality)
  );
  assert.equal(anyNpcMorality, false, 'a player deed leaves every NPC byte-identical (no morality stamped)');

  // The player's own grave deed surfaces as the PLAYER's reputation (heard:true about the player) —
  // read at its own node (tier 0), the second-person greeting source. notorietyReaching reads
  // world.deeds by proximity, so a local grave deed registers whether or not it had NPC witnesses.
  assert.equal(notorietyReaching(w, here).heard, true, 'the player\'s own grave deed is the PLAYER\'s reputation (second person)');
  // ...and it is NOT surfaced as a third-person subject (the player is never an "other").
  assert.equal(notorietyReachingAbout(w, here, 'party').heard, false, 'the player is never a third-person subject, even for their own deed');
});

test('U590-06: a stranger SPEAKS of Carl in the third person when greeted; Carl never gossips about himself; the player is never accused', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  const node = (w.map.nodes).find(n => String(n.id) === here);
  // A plain co-located stranger (not Carl, not the hostile, not the special lingerer) who witnessed him.
  const stranger = (node.settlement.npcs || []).find(x =>
    x && String(x.id) !== CARL && !String(x.id).includes('hostile') && String(x.id) !== 'npc_lingerer'
  );
  assert.ok(stranger, 'fixture: a plain stranger stands with Carl');
  const witness = String(stranger.id);

  // Carl commits a grave, witnessed act.
  w = applyDeltas(w, [{
    op: 'recordDeed', deedKind: 'cruelty', severity: 20, actorId: CARL,
    nodeId: here, witnesses: [witness], summary: 'Carl torched a neighbour\'s dovecote and made them watch', t: w.timeline.length
  }]);

  // Greeting the stranger surfaces the third-person talk about Carl — his NAME, not "you".
  const greet = commonKnowledgeAnswer(w, stranger, 'hello');
  assert.ok(greet && greet.mode === 'smalltalk', 'the greeting resolves to smalltalk');
  assert.match(greet.body, /Carl/, 'the stranger names Carl (third person)');
  assert.ok(!/\byou (did|are the one|earned)\b/i.test(greet.body), 'the stranger does NOT accuse the player ("you did…")');

  // Greeting CARL HIMSELF does not make him gossip about himself in the third person.
  const carl = node.settlement.npcs.find(x => String(x.id) === CARL);
  const carlGreet = commonKnowledgeAnswer(w, carl, 'hello');
  assert.ok(!carlGreet || !/Carl (torched|drove|set upon|penned|defaced)/.test(String(carlGreet.body || '')),
    'Carl does not narrate his own crimes in the third person when greeted');
});

test('U590-05: a stray/unknown actorId is a no-op on the actor side — never blamed on the player', () => {
  let w = beginAdventure(newWorld({
    seed: 'u590-stray', fate: 0.3, campaignId: 'u590s', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const here = String(w.map.currentNodeId);
  const playerHeatBefore = w.party[0].morality.heat;

  w = applyDeltas(w, [{
    op: 'recordDeed', deedKind: 'cruelty', severity: 20, actorId: 'ghost_who_is_nowhere',
    nodeId: here, witnesses: [], summary: 'a phantom deed', t: w.timeline.length
  }]);
  assertWorldInvariants(w);

  const rec = w.deeds[w.deeds.length - 1];
  assert.equal(rec.actorId, 'ghost_who_is_nowhere', 'recorded honestly with the given id (not rewritten to the player)');
  assert.equal(w.party[0].morality.heat, playerHeatBefore, 'the player accrued nothing from a deed that is not theirs');
});
