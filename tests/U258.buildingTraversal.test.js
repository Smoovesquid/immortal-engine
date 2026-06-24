// U258 — whole-building traversal (FIRST_ROOM follow-up: "work through the entire
// building"). On seed `tallow` the player wakes in the MIDDLE room of a 3-room
// cottage (entry — bedchamber — back room, a line). Movement BY COMPASS already
// works (go east/west); the bug is that the natural language a person actually uses
// to walk through a house does NOT:
//
//   • "go through the doorway into the next room" → `go <word>` grabbed "through"
//     as a room id → no match → "That way is blocked from here."
//   • "go back the way I came"                    → "back" is an excluded prep →
//     inferInteriorAction returned 'none' → fell to resolve() → ROLLED a d20.
//   • "head to the front room"                    → matched no interior branch →
//     fell to the exterior travel path → EJECTED the player outside the building.
//
// All three are interior MOVEMENT — a real DM walks you to the room, never rolls,
// never throws you out of the house. inferInteriorAction now classifies these as
// kind:'move' with a topology-resolved room hint (toward-entry / deeper-or-new).
//
// Source: the deterministic room-walk probe in the whole-building playthrough.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { getGoal, buildingCoverage } from '../engine/harness/goals.js';
import { buildLocationSurvey, isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const ROLL_RE = /\broll:\s*\d+\s*vs\s*DC/i;
const roomOf = (w) => String(w.scene?.interior?.roomId || '');
const inside = (w) => Boolean(w.scene?.interior);
const move = (w, text) => playerMove(w, PACKS, text);

test('U258: tallow boots in a multi-room building (precondition: ≥2 rooms, inside)', () => {
  const w = boot();
  assert.ok(inside(w), 'starts indoors');
  const st = w.structures?.byId?.[String(w.scene.interior.structureKey)];
  assert.ok((st?.topology?.rooms?.length || 0) >= 2, 'the starting structure has multiple rooms');
});

// "next room" family — moves to an adjacent room, no roll, stays inside.
test('U258-A: "go through the doorway into the next room" moves rooms (no roll, stays inside)', () => {
  const w0 = boot();
  const r = move(w0, 'I go through the doorway into the next room.');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `interior move must not roll: ${r.output.mechanics}`);
  assert.ok(inside(r.world), 'still inside the building (a room move is not an exit)');
  assert.notEqual(roomOf(r.world), roomOf(w0), 'the room actually changed');
});

test('U258-B: bare "into the next room" / "the other room" / "further in" all move rooms', () => {
  for (const phrase of ['into the next room', 'I head to the other room', 'I go further in', 'I explore deeper into the house']) {
    const w0 = boot();
    const r = move(w0, phrase);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] must not roll: ${r.output.mechanics}`);
    assert.ok(inside(r.world), `[${phrase}] stays inside`);
    assert.notEqual(roomOf(r.world), roomOf(w0), `[${phrase}] changed room`);
  }
});

// "back the way I came" — returns toward the entry, no roll (was rolling a d20).
test('U258-C: "go back the way I came" returns toward the entry — no roll, stays inside', () => {
  // First step deeper so there's somewhere to go back to.
  const deep = move(boot(), 'I go through the doorway into the next room.').world;
  const r = move(deep, 'I go back the way I came.');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `going back must not roll: ${r.output.mechanics}`);
  assert.ok(inside(r.world), 'going back keeps you inside');
  assert.notEqual(roomOf(r.world), roomOf(deep), 'the room changed (you moved back)');
});

// "front room" — an interior room (the entry), NOT a building exit (was ejecting outside).
test('U258-D: "head to the front room" moves toward the entry and STAYS INSIDE (not an exit)', () => {
  const w0 = boot();
  const r = move(w0, 'I head to the front room.');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `must not roll: ${r.output.mechanics}`);
  assert.ok(inside(r.world), 'the front room is INSIDE — this must not eject the player outdoors');
  assert.notEqual(roomOf(r.world), roomOf(w0), 'moved to the front room');
});

// Over-match guards: leave/idiom phrasings must keep their meaning.
test('U258-E: "go outside" still EXITS; "go for it" is not a room move', () => {
  const out = move(boot(), 'I go outside.');
  assert.equal(inside(out.world), false, '"go outside" still exits the building');
  // "go for it" is the attack/commit idiom, never a spatial room move → must not
  // teleport or claim a blocked wall as the resolved action.
  const forIt = move(boot(), 'go for it');
  assert.ok(inside(forIt.world), '"go for it" does not exit');
});

// The integration: tour-building completes by walking the house AND looking at what's
// in it, in plain language — and no MOVE in the tour rolls a die. (The goal now spans
// both axes: room-coverage + object-probing.)
test('U258-F: tour-building completes by walking + examining the house in plain language', () => {
  const goal = getGoal('tour-building');
  let w = boot();
  const actionsLog = [];
  assert.equal(goal.satisfied(w, { actionsLog }), false, 'not yet toured at boot');
  // Examine the room's objects (builds probe coverage)…
  for (const phrase of ['I examine the straw pallet', 'I look at the oil lantern', 'I inspect the iron-bound chest', 'I examine the stone basin']) {
    w = move(w, phrase).world; actionsLog.push(phrase);
  }
  // …and walk every room in plain language — these moves must never roll.
  for (const phrase of ['I go through the doorway into the next room.', 'I go back the way I came.', 'I head to the front room.']) {
    const r = move(w, phrase);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] a walk through the house must not roll: ${r.output.mechanics}`);
    w = r.world; actionsLog.push(phrase);
  }
  const cov = buildingCoverage(w);
  assert.equal(goal.satisfied(w, { actionsLog }), true, `every room visited (${cov.visited}/${cov.total}) and objects probed`);
});

// Look-around must REVEAL the interior doorways — a flat "the way out leads back to
// the open air" hid every other room, so a player could never discover them. (FIX 2.)
test('U258-H: look-around reveals interior doorways, not just the exit', () => {
  const w = boot(); // middle bedchamber: doorways to the entry AND the back room
  const survey = buildLocationSurvey(w);
  assert.match(survey, /doorway|doorways/i, 'the survey names interior doorways');
  assert.match(survey, /deeper in|further in/i, 'reveals a room deeper in, so the player can discover it');
  // A dead-end room points back — and must NOT invent a deeper room that isn't there.
  const back = move(w, 'go east').world;
  const backSurvey = buildLocationSurvey(back);
  assert.match(backSurvey, /back toward the front/i, 'the dead-end back room points toward the front');
  assert.doesNotMatch(backSurvey, /deeper in/i, 'no phantom deeper room from a dead end');
});

// A movement intent that TRAILS a perception clause ("...to see what's out there") is
// an ACTION, not a location survey — the meta-gate must not swallow it (it did, returning
// a static bearings recap so the player never moved: a soft-lock in the playthrough).
test('U258-I: a move trailing a perception clause is an action, not a static survey', () => {
  assert.equal(isMetaQuestion("I get out of bed and head toward the front doorway to see what's out there"), false, 'movement intent, not meta');
  assert.equal(isMetaQuestion('I head back through the doorway and look for the passage that goes deeper'), false, 'movement intent, not meta');
  // Bare surveys stay meta — they must still route to the look-around survey.
  assert.equal(isMetaQuestion('look around'), true);
  assert.equal(isMetaQuestion('where am I'), true);
  assert.equal(isMetaQuestion("who's here"), true);
  // End-to-end: the move actually happens (front doorway → another room), stays inside.
  const w0 = boot();
  const r = move(w0, "I head toward the front doorway to see what's out there.");
  assert.ok(inside(r.world), 'still inside the building');
  assert.notEqual(roomOf(r.world), roomOf(w0), 'the move happened — the room changed');
});

// Regression: compass movement (the path that already worked) must still work.
test('U258-G: compass movement still works (go east → room change, no roll)', () => {
  const w0 = boot();
  const r = move(w0, 'go east');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, 'compass move is free');
  assert.notEqual(roomOf(r.world), roomOf(w0), 'go east changed room');
});
