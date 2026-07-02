// U311 — DTD-B: "can I go outside and look around?" LEAVES the room, it is not a
// location survey. From the 2026-07-02 Opus gate (Confused-newbie, seed `tallow`):
//
//   player: "Huh, D... maybe I'll figure it out. Can I go outside and look around?"
//   DM:     "Your eyes move slow across the room. Here: a straw pallet, an oil
//            lantern, an iron-bound chest..."   ← surveyed the INTERIOR
//
// The player asked to go OUTSIDE; the DM re-described the room they were standing
// in, and they had to repeat "I said I want to go outside" the next turn.
//
// Two seams produced it:
//   1. The QUESTION form ("can I …?") contains "look around", so the META_LOCATION
//      detector fired and `doSubmitMove` / the gate harness answered it as a room
//      survey via handleMetaQuestion — BEFORE playerMove ever ran. playerMove itself
//      already resolves the exit; the caller's meta pre-check was pre-empting it.
//      Fixed by `carriesInteriorMovementIntent(world, text)` (exported from playloop):
//      the caller skips the survey when the text carries a real exit/move gesture.
//   2. The STATEMENT form ("head outside and look around", "go out and look around")
//      reached playerMove but the trailing "…and look around" made inferInteriorAction
//      yield to the survey. Fixed positionally: a survey clause that TRAILS the exit
//      gesture is a follow-on to arriving outside — the exit wins.
//
// Over-match guard (WB-F4, critical): a bare "look around" / "what's around here?"
// with NO exit verb must STILL survey (never leave); "look around outside the window"
// (looking AT the outside) and "look around then maybe head outside" (survey leads)
// stay inside. Only genuine exit-movement wins.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, carriesInteriorMovementIntent } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const inside = (w) => Boolean(w.scene?.interior);

// Mirror the LIVE routing (public/v1.js doSubmitMove + scripts/dm-playtest.mjs
// playTurn): the meta pre-check answers a META_LOCATION question BEFORE playerMove —
// UNLESS the text carries a movement the DM should resolve. This is the exact seam
// the gate exercised, so the test asserts against it, not against playerMove alone.
function route(w, text) {
  const inCombat = Boolean(w.combat?.active);
  const inDialogue = Boolean(w.scene?.dialogue?.npcId);
  if (!inCombat && !inDialogue && isMetaQuestion(text) && !carriesInteriorMovementIntent(w, text)) {
    const answer = handleMetaQuestion(text, w);
    if (answer) return { route: 'meta', narration: String(answer), world: w };
  }
  const r = playerMove(w, PACKS, text);
  return { route: 'move', narration: String(r.output?.narration || ''), world: r.world, mechanics: r.output?.mechanics || '' };
}

test('U311: tallow boots inside a building (precondition)', () => {
  assert.ok(inside(boot()), 'starts indoors');
});

// (1) The gate repro — the QUESTION form. Must LEAVE, not survey the interior.
test('U311-A: "Can I go outside and look around?" exits — not intercepted as a room survey', () => {
  const w0 = boot();
  const r = route(w0, 'Can I go outside and look around?');
  assert.equal(r.route, 'move', 'must NOT be answered by the meta survey pre-check');
  assert.equal(inside(r.world), false, 'the player is now outside the building');
});

test('U311-B: the verbatim gate line (with preamble) exits', () => {
  const r = route(boot(), "Huh, D... maybe I'll figure it out. Can I go outside and look around?");
  assert.equal(r.route, 'move', 'the "look around" tail must not steal the exit into a survey');
  assert.equal(inside(r.world), false, 'left the building');
});

// (2) Plain exit still leaves (regression floor).
test('U311-C: plain "go outside" still leaves', () => {
  assert.equal(inside(route(boot(), 'go outside').world), false, '"go outside" leaves');
});

// (2b) STATEMENT variants that reach playerMove — the trailing "and look around"
// must not defeat a genuine outside-exit gesture.
test('U311-D: exit-gesture + trailing survey clause exits (statement forms)', () => {
  for (const phrase of [
    'head outside and look around',
    'go out and look around',
    'walk outside and have a look',
    'I step outside and take a look around',
  ]) {
    const r = route(boot(), phrase);
    assert.equal(inside(r.world), false, `[${phrase}] must leave the building`);
  }
});

// (3) Over-match guard — bare survey intents with NO exit verb still survey (stay in).
test('U311-E: bare "look around" / "what\'s around here?" still survey — never leave', () => {
  for (const phrase of ['look around', "what's around here?", 'what do I see?', 'where am I?']) {
    const r = route(boot(), phrase);
    assert.equal(inside(r.world), true, `[${phrase}] must stay inside (survey, not exit)`);
  }
});

test('U311-F: a survey that LEADS, or looks AT the outside, does not leave', () => {
  for (const phrase of ['look around outside the window', 'look around then maybe head outside']) {
    const r = route(boot(), phrase);
    assert.equal(inside(r.world), true, `[${phrase}] must stay inside`);
  }
});

// The predicate itself: exit/move gestures report true; bare surveys report false.
test('U311-G: carriesInteriorMovementIntent flags exits, not bare surveys', () => {
  const w = boot();
  assert.equal(carriesInteriorMovementIntent(w, 'Can I go outside and look around?'), true);
  assert.equal(carriesInteriorMovementIntent(w, 'go outside'), true);
  assert.equal(carriesInteriorMovementIntent(w, 'look around'), false);
  assert.equal(carriesInteriorMovementIntent(w, "what's around here?"), false);
  assert.equal(carriesInteriorMovementIntent(w, 'look around outside the window'), false);
});
