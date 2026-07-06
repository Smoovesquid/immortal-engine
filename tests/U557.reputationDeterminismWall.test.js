// U557 — MP-1: determinism + the two-variance wall (docs/MORAL_PHYSICS.md §1-I, §1-II, §1-III).
//
// Three guarantees the calibration fix must not break:
//   (I)   DETERMINISM — a witnessed deed + N world-ticks replays byte-identical (worldHash equality).
//   (II)  THE WALL — a claim (belief) is NEVER silently promoted to a deed (ontological fact). The
//         reputation the sink surfaces at a distant node adds NO new deed to world.deeds; only the
//         actor's real act is canonical.
//   (III) NO METER — no numeric moral value appears in ANY player-facing string the touched paths
//         emit (the wary greeting AND the garbled rumor bodies). The world is the readout, never
//         "Corruption: 73%".

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

const ARC_B = 'I execute the kneeling captive who begs for mercy'; // HEAVY cruelty, witnessed

// One full run: begin → outside → atrocity → talk to a local → greet, then N world-ticks.
function fullRun(seed = 'u557') {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u557-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const distant = w.map.nodes.find(n => n.id !== here.id);
  w = playerMove(w, packs, ARC_B).world;
  const npc = (here.settlement?.npcs || []).find(n => n && n.name && !n.hostile);
  let greetNarration = '';
  if (npc) {
    const talked = playerMove(w, packs, `talk to ${npc.name}`).world;
    const g = playerMove(talked, packs, 'hello');
    greetNarration = String(g.output?.narration || '');
    w = g.world;
  }
  for (let i = 0; i < 4; i++) w = worldTick(w, `${seed}|tick${i}`);
  return { w, here, distant, greetNarration };
}

test('U557-01: DETERMINISM — a witnessed atrocity replays byte-identical (worldHash)', () => {
  const a = fullRun('u557');
  const b = fullRun('u557');
  assert.equal(worldHash(a.w), worldHash(b.w), 'two identical runs → identical worldHash');
  assertWorldInvariants(a.w);
});

test('U557-02: THE WALL — travelling reputation adds NO deed at the distant node', () => {
  const { w, here, distant } = fullRun('u557');

  // Exactly one deed exists — the ONE real act. Belief traveling to a distant node mints nothing.
  const deeds = w.deeds || [];
  assert.equal(deeds.length, 1, 'only the actor\'s real act is a canonical deed');
  assert.equal(deeds[0].nodeId, here.id, 'the deed is anchored where it happened, not where it was heard');

  // The distant node HEARS of it (belief present)…
  const far = notorietyReaching(w, distant.id);
  assert.equal(far.heard, true, 'the distant stranger holds the BELIEF (heard of it)');
  // …but reading that belief created no new ontological deed. Reads are pure.
  const hBefore = worldHash(w);
  rumorsReaching(w, distant.id, { subjectPrefix: 'deed:' });
  notorietyReaching(w, distant.id);
  assert.equal(worldHash(w), hBefore, 'reading reputation mutates nothing — belief never promotes to fact');
  assert.equal((w.deeds || []).length, 1, 'still exactly one deed after the reads');
});

// A number that would betray a hidden meter. We DON'T ban all digits (a rumor could say "three
// men"), only the meter shapes: "reputation -12", "corruption: 73", "72%", "[karma 3]", etc.
const METER_RE = /\b(?:reputation|notoriety|corruption|virtue|karma|morality|infamy|standing)\b\s*[:=\-−]?\s*[-−]?\d|\b\d{1,3}\s*%|[\[(]\s*(?:reputation|corruption|virtue|karma)\b/i;

test('U557-03: NO METER — the wary greeting carries no numeric moral value', () => {
  const { greetNarration } = fullRun('u557');
  assert.ok(greetNarration.length > 0, 'the notorious player got a greeting');
  // Sanity: it IS the knowing greeting (reputation reached this place).
  assert.match(greetNarration, /heard about you|word (?:came|travels|reached)|know (?:who you are|your name)|so you're the one|we heard/i,
    `the greeting is the knowing one (rep reached here); got: ${greetNarration}`);
  assert.doesNotMatch(greetNarration, METER_RE, `no meter leaks into the greeting; got: ${greetNarration}`);
  // §0 belt-and-suspenders: deed-reputation must never drag in cosmology.
  assert.doesNotMatch(greetNarration, /\b(?:orb|substrate|cataclysm|the fade|corruption axis)\b/i, 'no hidden-why leaks');
});

test('U557-04: NO METER — every garbled rumor body the sink emits is meter-free', () => {
  const { w, here, distant } = fullRun('u557');
  const bodies = [
    ...rumorsReaching(w, here.id, { subjectPrefix: 'deed:' }),
    ...rumorsReaching(w, distant.id, { subjectPrefix: 'deed:' }),
  ].map(r => String(r.body || ''));
  assert.ok(bodies.length > 0, 'the sink emitted at least one deed-rumor body');
  for (const body of bodies) {
    assert.doesNotMatch(body, METER_RE, `a rumor body must read as gossip, not a stat line; got: ${body}`);
  }
});
