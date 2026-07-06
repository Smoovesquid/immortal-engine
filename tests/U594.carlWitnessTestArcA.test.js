// U594 — THE CARL WITNESS TEST · ARC A (the §7 falsifier).
//
//   "Green = the constitution is law, not vision." — docs/MORAL_PHYSICS.md §7
//
// §7 Arc A — the world grinds Carl (NPC track): "Over N deterministic world-ticks: his deeds mint
// claims that propagate → Aldermere faction disposition toward Carl craters → help-gates close to
// him → at the heat threshold, the hunt reaches *him* (avengers / social collapse). The player,
// doing nothing, watches a vile man be slowly answered by a legible cosmos."
//
// This test runs the WHOLE grind with the player idle and asserts the chain THROUGH THE LANDED
// ORGANS — nothing scripted, no meter ever read:
//   (A1) HIS DEEDS LAND, attributed to Carl, with his co-located witnesses (the world reads him).
//   (A2) THIRD-PERSON REPUTATION reaches a NEIGHBOUR node, garbled by tier — the world's read of
//        Carl changes from "nothing heard" to "heard of him," and it is HIS name on it, never the
//        player's.
//   (A3) HIS HEAT CLIMBS MONOTONICALLY and crosses HUNT_HEAT (his own accumulator — the substrate).
//   (A4) THE HUNT REACHES HIM — avengers arrive at Carl's node (MP-6 deliverable 1), latched on his
//        own record; the player's record is NEVER touched by any of it.
//   (A5) THE WHOLE GRIND IS DETERMINISTIC ×2 — byte-identical worldHash across two independent runs.
//
// "Disposition craters" is asserted via the LANDED representation — Carl's climbing heat + the
// travelling third-person reputation + (in U595) the third-person greeting. A dedicated
// faction-toward-NPC scalar is NOT in scope (U591 footer documents there is no per-NPC faction store;
// his souring is represented by heat + reputation). Flagged as future taste, per the MP-6 brief.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldTick } from '../engine/worldTick.js';
import { worldHash } from '../engine/worldHash.js';
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
const packs = loadPacks();
const CARL = 'figure_carl';
const GRIND_TICKS = 40; // long enough for Carl to escalate, travel, cross HUNT_HEAT, and draw the hunt.

function bootSlice(seed = 'aldermere') {
  return beginAdventure(newWorld({
    seed, fate: 0.3, campaignId: `u594-${seed}`, mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
}
function carlNodeId(w) {
  for (const n of (w.map?.nodes || [])) {
    if ((n.settlement?.npcs || []).some(x => x && String(x.id) === CARL)) return String(n.id);
  }
  return null;
}
function carlNode(w) {
  return (w.map?.nodes || []).find(n => (n.settlement?.npcs || []).some(x => x && String(x.id) === CARL)) || null;
}
function carlNpc(w) {
  return (carlNode(w)?.settlement?.npcs || []).find(x => x && String(x.id) === CARL) || null;
}
function someOtherNodeId(w, here) {
  return (w.map?.nodes || []).map(n => String(n.id)).find(id => id && id !== here) || null;
}
// The avengers land in settlement.npcs with a 'moral-hunt'-reason id; count the ones NOT there at boot
// by tagging on the encounter marker the spawn organ stamps.
function hostileHuntersAt(node) {
  return (node?.settlement?.npcs || []).filter(n => n && /encounter/.test(String(n.id))).length;
}
function grind(w, seedPrefix, n = GRIND_TICKS) {
  for (let i = 0; i < n; i++) w = worldTick(w, `${seedPrefix}|${i}`);
  return w;
}

test('U594-A1: the world reads Carl — his deeds LAND, attributed to him, witnessed (§7 Arc A)', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  assert.ok(here, 'fixture: Carl is placed on the slice seed');
  assert.equal((w.deeds || []).filter(d => String(d.actorId) === CARL).length, 0, 'no Carl deeds at boot');

  w = grind(w, 'u594-a1');
  assertWorldInvariants(w);

  const carlDeeds = (w.deeds || []).filter(d => String(d.actorId) === CARL);
  assert.ok(carlDeeds.length >= 3, `Carl's cadence fired repeatedly over the grind (got ${carlDeeds.length})`);
  assert.ok(carlDeeds.every(d => d.kind === 'cruelty'), 'every act is cruelty');
  assert.ok(carlDeeds.every(d => Array.isArray(d.witnesses) && d.witnesses.length >= 1), 'each act is witnessed (so it can travel)');
  assert.ok(carlDeeds.every(d => !d.witnesses.includes(CARL)), 'Carl never witnesses his own deed');
});

test('U594-A2: third-person reputation reaches a neighbour, garbled — and it is HIS name, not the player\'s (§7 Arc A)', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  const elsewhere = someOtherNodeId(w, here);
  assert.ok(elsewhere, 'fixture: a neighbour node exists for the tale to reach');
  assert.equal(notorietyReachingAbout(w, elsewhere, CARL).heard, false, 'baseline: the neighbour has heard nothing of Carl');

  w = grind(w, 'u594-a2');

  const about = notorietyReachingAbout(w, elsewhere, CARL);
  assert.equal(about.heard, true, 'the neighbour has now heard of Carl (reputation travelled)');
  assert.ok(about.worst && about.worst.tier >= 1, 'what reached them is secondhand — garbled by distance');
  assert.ok(about.worst.body.length > 0, 'and carries a body — the tale as the locals tell it');
  // The travelling rumor names CARL — never the idle player.
  const reaching = rumorsReaching(w, elsewhere, { subjectPrefix: 'deed:' });
  assert.ok(reaching.some(r => String(r.actorId) === CARL), 'the travelling rumor is attributed to Carl');
  assert.ok(!reaching.some(r => String(r.actorId) === 'party'), 'none of it lands on the player');
  // The player is not notorious anywhere for Carl's deeds.
  assert.equal(notorietyReaching(w, elsewhere).heard, false, 'the player is never notorious for what Carl did');
});

test('U594-A3: Carl\'s own heat climbs monotonically and crosses HUNT_HEAT; the player stays inert (§7 Arc A)', () => {
  const player0 = bootSlice().party[0].morality.heat;
  const wMid = grind(bootSlice(), 'u594-a3', 18);
  const wLate = grind(bootSlice(), 'u594-a3', GRIND_TICKS);

  const carlMid = carlNpc(wMid);
  const carlLate = carlNpc(wLate);
  assert.ok(carlMid?.morality?.heat > 0, 'Carl has accrued heat by mid-run');
  assert.ok(carlLate.morality.heat > carlMid.morality.heat, 'his heat climbs further over more ticks (monotone accrual)');
  assert.ok(carlLate.morality.heat >= HUNT_HEAT, `Carl's heat (${carlLate.morality.heat}) crossed HUNT_HEAT (${HUNT_HEAT})`);

  // The player, doing nothing, is completely inert.
  assert.equal(wLate.party[0].morality.heat, player0, 'the player accrued NO heat — Arc A grinds Carl, not the player');
  assert.equal((wLate.deeds || []).filter(d => String(d.actorId) === 'party').length, 0, 'the player committed no deeds');
});

test('U594-A4: THE HUNT REACHES CARL — avengers arrive at his node, latched on HIS record; the player untouched (§7 Arc A · MP-6 deliverable 1)', () => {
  let w = bootSlice();
  const here = carlNodeId(w);
  const huntersBefore = hostileHuntersAt(carlNode(w));

  w = grind(w, 'u594-a4');
  assertWorldInvariants(w);

  const carl = carlNpc(w);
  assert.ok(carl?.morality, 'Carl carries his morality-lite accumulator');
  assert.ok(carl.morality.heat >= HUNT_HEAT, 'his heat is over the hunt threshold');
  // THE BEAT MP-6 OWNS: the hunt actually arrived at Carl.
  assert.ok(carl.morality.huntedT > 0, 'the hunt latch is set on CARL — the reckoning reached him');
  const huntersAfter = hostileHuntersAt(carlNode(w));
  assert.ok(huntersAfter > huntersBefore, `avengers stand at Carl's node (${huntersBefore} → ${huntersAfter})`);

  // The player, doing nothing, is never touched by the reckoning.
  assert.equal(w.party[0].morality.heat, 0, 'the player has no heat');
  assert.equal(w.party[0].morality.huntedT, 0, 'the player was never hunted — the hunt reached CARL, not the witness');
  const anyNode = String(w.map.currentNodeId);
  assert.equal(notorietyReaching(w, anyNode).heard, false, 'the player is not notorious anywhere');
});

test('U594-A5: THE WHOLE GRIND IS DETERMINISTIC ×2 — byte-identical worldHash across two independent runs', () => {
  const a = grind(bootSlice(), 'u594-a5');
  const b = grind(bootSlice(), 'u594-a5');
  assert.equal(worldHash(a), worldHash(b), 'two identical idle-player Carl grinds → identical worldHash (law, not luck)');
  // Sanity: the run genuinely exercised the whole chain, so the wall is not vacuous.
  assert.ok((a.deeds || []).filter(d => String(d.actorId) === CARL).length >= 3, 'the grind fired Carl\'s cadence');
  assert.ok(carlNpc(a)?.morality?.huntedT > 0, 'and the hunt reached him inside the graded run');
  assertWorldInvariants(a);
});
