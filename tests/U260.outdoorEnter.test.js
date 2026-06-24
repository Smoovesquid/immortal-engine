// U260 — entering a building from outdoors, in plain language ("On to the town").
//
// The town playtest surfaced a HIGH state-desync: the player said
//   "I step inside the inn and catch Dalla's eye, asking her what happened…"
// and the LIVE DM narrated stepping into the inn's interior — but the engine kept
// `scene.interior` null (still outdoors). The enter-classifier only fired for
// "inside/in" at END-OF-LINE, so "step INTO the inn AND <trailing clause>" fell
// through to the dialogue path: narration said inside, canon said outside.
//
// inferInteriorAction now classifies a motion-verb + inward-particle as kind:'enter'
// even with a trailing clause and with "into" — and the handler enters the (single)
// structure, so canon matches the narration. Over-match is guarded: "into <non-
// building>" (a rage, the water, town) and "inside the <non-building>" (the ring)
// must NOT teleport the player indoors.
//
// Source: docs/playtests/harness/harness-2026-06-24-17-02-52.md (turn 7).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const inside = (w) => Boolean(w?.scene?.interior && typeof w.scene.interior === 'object');
const ROLL_RE = /\broll:\s*\d+\s*vs\s*DC/i;
// A fresh OUTDOORS world (the player wakes inside; step out first).
const outside = () => playerMove(boot(), PACKS, 'I step outside.').world;

test('U260: precondition — stepping out of the cottage puts the player outdoors', () => {
  assert.equal(inside(outside()), false, 'outside the building after exiting');
});

// THE DESYNC REPRO — the exact turn-7 line must now put the player INSIDE (so the
// engine agrees with the DM's "you step into the inn" narration), with no roll.
test('U260: "step inside the inn and ask Dalla…" enters the building (kills the desync)', () => {
  const r = playerMove(outside(), PACKS, "I step inside the inn and catch Dalla's eye, asking her what happened to the founding family.");
  assert.ok(inside(r.world), 'the engine now puts the player indoors — canon matches the narration');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `entering is not a dice roll: ${r.output.mechanics}`);
});

// "into" + trailing clause, and the bare-into forms the legacy rule missed.
test('U260: "into the <building>" phrasings enter (no roll, now indoors)', () => {
  for (const phrase of [
    'I go into the tavern.',
    'I head into the shop across the way.',
    'I step into the cottage and look around.',
    'I duck into the smithy to get out of the rain.',
  ]) {
    const r = playerMove(outside(), PACKS, phrase);
    assert.ok(inside(r.world), `[${phrase}] should enter the building`);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] enter must not roll: ${r.output.mechanics}`);
  }
});

// "through the <building> door" — naming the building's threshold (town playtest: this
// was misread as forcing a stuck door). Requires BOTH a building noun and a door noun.
test('U260: "push through the inn door" enters (not a forced/stuck door)', () => {
  for (const phrase of [
    'I push through the inn door and head over to the bar where Dalla is working.',
    'I go through the door of the tavern.',
    'I step through the cottage doorway.',
  ]) {
    const r = playerMove(outside(), PACKS, phrase);
    assert.ok(inside(r.world), `[${phrase}] should enter the building`);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] enter must not roll: ${r.output.mechanics}`);
  }
});

test('U260: "through" with no building noun does NOT enter (over-match guard)', () => {
  for (const phrase of ['I push through the crowd', 'I press through the pain', 'I push through the gate of the fence']) {
    const r = playerMove(outside(), PACKS, phrase);
    assert.equal(inside(r.world), false, `[${phrase}] must NOT enter (no building named)`);
  }
});

// The classic forms still work (regression guard for what already worked).
test('U260: "go inside", "step inside", "enter the inn" still enter', () => {
  for (const phrase of ['I go inside the inn', 'I step inside', 'I duck inside to warm up', 'I enter the inn', 'go indoors']) {
    const r = playerMove(outside(), PACKS, phrase);
    assert.ok(inside(r.world), `[${phrase}] should enter`);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] must not roll`);
  }
});

// OVER-MATCH GUARDS — an "into"/"inside" phrase that is NOT a building entry must
// keep the player OUTDOORS (no teleport indoors).
test('U260: non-building "into"/"inside" phrases do NOT enter (over-match guard)', () => {
  for (const phrase of [
    'I head into town',
    'I wade into the water',
    'I move into position',
    'I fly into a rage',
    'I step inside the ring and raise my fists',
    'I walk into the square to look around',
  ]) {
    const r = playerMove(outside(), PACKS, phrase);
    assert.equal(inside(r.world), false, `[${phrase}] must NOT teleport the player indoors`);
  }
});

// EXIT-vocabulary sibling (WB-Q9 "move/exit fidelity"): a leave verb with an adverb
// wedged in ("step BACK outside", "walk back out") must exit — the old rules needed
// verb+out adjacency, so these rolled a free move while the DM narrated leaving.
test('U260: "<verb> back outside" exits the building (no roll, now outdoors)', () => {
  for (const phrase of ['I step back outside', 'I go back outside', 'I walk back outside', 'I go back outdoors']) {
    const r = playerMove(boot(), PACKS, phrase); // boot() wakes INSIDE the cottage
    assert.equal(inside(r.world), false, `[${phrase}] should exit the building`);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] exit must not roll: ${r.output.mechanics}`);
  }
});

// IT-1: a BARE "<motion> outside" (no adverb) now exits — but a trailing presence/
// survey question wins, so "head outside, who do I see?" still answers the roster.
test('U260: bare "head outside" / "walk outside" exits the building (IT-1)', () => {
  for (const phrase of ['I head outside', 'I walk outside', 'I head outside to get some air', 'I go outside']) {
    const r = playerMove(boot(), PACKS, phrase);
    assert.equal(inside(r.world), false, `[${phrase}] should exit`);
  }
});

test('U260: "head outside, who do I see?" answers (does NOT exit-and-stop) — presence wins', () => {
  const r = playerMove(boot(), PACKS, 'I head outside, who do I see?');
  assert.equal(inside(r.world), true, 'the presence question wins — not a bare exit');
  // It delivers the roster (names present folk), not "you step back outside".
  assert.doesNotMatch(r.output.narration || '', /you step back outside/i);
  // "head outside and look around" yields to the survey too (isExploreIntent guard).
  const r2 = playerMove(boot(), PACKS, 'I head outside and look around');
  assert.equal(inside(r2.world), true, 'survey intent wins over the bare exit');
});

// The rise-from-furniture guard must survive the broadened exit rule: standing up out
// of bed/covers is NOT leaving the building.
test('U260: "out of bed / out of the covers" still does NOT exit (rise guard holds)', () => {
  for (const phrase of ['I get out of bed', 'I swing my legs out of bed and stand', 'I step back out of bed', 'I climb out of the covers']) {
    const r = playerMove(boot(), PACKS, phrase);
    assert.equal(inside(r.world), true, `[${phrase}] rising from furniture keeps the player indoors`);
  }
});

// Round-trip: enter from outdoors, then leave with the natural "step back outside".
test('U260: enter → exit round-trips (enter indoors, then step back out)', () => {
  const entered = playerMove(outside(), PACKS, 'I go into the inn.').world;
  assert.ok(inside(entered), 'entered');
  const back = playerMove(entered, PACKS, 'I step back outside.').world;
  assert.equal(inside(back), false, 'stepped back out');
});
