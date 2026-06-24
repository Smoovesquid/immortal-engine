// U257 — interior exit routing (first-room playtest #2+#3, FIRST_ROOM_FINDINGS.md).
//
// On seed `tallow` the player boots inside a structure interior. Turn 10 of the
// harness log: "I step out through the way to the open air." The engine (a) rolled
// a DC check — free movement must NEVER roll — AND (b) narrated going outside while
// scene.interior stayed SET (the DM lied about the player's location). Both the
// free-action and state-desync oracles fired. They are ONE bug: inferInteriorAction
// failed to classify the compound "step out ... <purpose clause>" as kind:'exit',
// so it fell through to resolve() — which both rolls and skips the interior=null
// commit. The exit path (playloop ~1047) already resolves with no roll and clears
// the interior, so fixing the classification fixes both symptoms.
//
// Source: docs/playtests/harness/FIRST_ROOM_FINDINGS.md (#2, #3).

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
const ROLL_RE = /\broll:\s*\d+\s*vs\s*DC/i;

test('U257: tallow boots inside a structure interior (precondition)', () => {
  assert.ok(boot().scene?.interior, 'seed tallow should start the player indoors');
});

// The headline regression: the compound step-out from the harness log.
test('U257-A: "step out through the way to the open air" exits — no roll, interior cleared', () => {
  const r = playerMove(boot(), PACKS, 'I step out through the way to the open air.');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `free movement must not roll: ${r.output.mechanics}`);
  assert.equal(Boolean(r.world.scene?.interior), false, 'scene.interior must be committed null after exit');
});

// Every compound / bare step-out phrasing routes to exit (no roll, interior null).
test('U257-B: every step-out phrasing routes to exit, no roll, interior cleared', () => {
  const exits = [
    'I step out through the way to the open air.',
    'I step out to explore the rest.',
    'step out',
    'step outside',
    'leave the room',
    'out the door',
    'into the open',
  ];
  for (const phrase of exits) {
    const r = playerMove(boot(), PACKS, phrase);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] must not roll: ${r.output.mechanics}`);
    assert.equal(Boolean(r.world.scene?.interior), false, `[${phrase}] interior must be cleared`);
  }
});

// The over-match guard: "step out of line/turn" are idioms, NOT a leave. They must
// stay inside (fall through to normal resolution), not teleport the player outside.
test('U257-C: "step out of line / turn" do NOT exit (idiom guard)', () => {
  for (const phrase of ['I step out of line', 'I stepped out of turn']) {
    const r = playerMove(boot(), PACKS, phrase);
    assert.equal(Boolean(r.world.scene?.interior), true, `[${phrase}] must NOT be read as an exit`);
  }
});

// RISE FROM FURNITURE is standing up, NOT leaving the building — the player wakes
// in bed on tallow, so "step/get out of bed" must NOT teleport them outside (an
// over-match caught verifying the original #2 fix).
test('U257-D: "step/get out of bed / a chair" do NOT exit (rise-from-furniture guard)', () => {
  for (const phrase of ['I step out of bed', 'I get out of bed', 'I step out of the chair']) {
    const r = playerMove(boot(), PACKS, phrase);
    assert.equal(Boolean(r.world.scene?.interior), true, `[${phrase}] is rising, not a building exit`);
  }
});

// ...but rise-from-furniture WITH a standalone exit cue still exits (intent to leave).
test('U257-E: "get out of bed and step outside" still exits (cue overrides the rise guard)', () => {
  const r = playerMove(boot(), PACKS, 'I get out of bed and step outside.');
  assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `must not roll: ${r.output.mechanics}`);
  assert.equal(Boolean(r.world.scene?.interior), false, 'the explicit "step outside" makes it an exit');
});

// Rising is a FREE action — a DM never calls a check to stand up or get out of bed
// (the player wakes in bed on tallow). It resolves trivially, no roll. (Free-action
// follow-up to #2: the rise cases stayed inside but still rolled before this.)
test('U257-F: rising (get out of bed / get up / stand up) resolves FREE — no roll', () => {
  for (const phrase of ['I get out of bed', 'I step out of bed', 'I get up', 'I rise', 'I stand up', 'I wake up']) {
    const r = playerMove(boot(), PACKS, phrase);
    assert.equal(ROLL_RE.test(r.output.mechanics || ''), false, `[${phrase}] must resolve free, no roll: ${r.output.mechanics}`);
    assert.equal(Boolean(r.world.scene?.interior), true, `[${phrase}] stays inside (rising is not leaving)`);
  }
});
