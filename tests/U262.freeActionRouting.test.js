// U262 — free actions resolve WITHOUT a die roll (IT-3).
//
// THE_TABLE_TEST: a DM does not call a check to look around, take stock, or walk up to
// people. The free-action oracle (engine/harness/oracles.js FREE_INTENT) flagged two
// real seams on the town runs:
//   • "take stock" rolled a d20 (it wasn't in isExploreIntent's survey list).
//   • "…look for someone to talk to" rolled a CHARM check (a social SEARCH read as a
//     persuasion attempt) — town run #3 turn 17.
// Both now route to the roll-free survey path. Contested actions (rob/fight/persuade/
// pick a lock) must STILL roll — the fix must not free-pass a contested action.

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
const outside = () => playerMove(boot(), PACKS, 'I step outside.').world;
const rolled = (w, text) => ROLL_RE.test(playerMove(w, PACKS, text).output.mechanics || '');

test('U262: "take stock" is a free survey — no roll (inside or outside)', () => {
  assert.equal(rolled(boot(), 'I take stock'), false, 'take stock (inside) is free');
  assert.equal(rolled(outside(), 'I take stock'), false, 'take stock (outside) is free');
  assert.equal(rolled(outside(), 'I take stock of my surroundings'), false, 'take stock of surroundings is free');
});

test('U262: "step outside" when already outdoors is a free no-op — never a roll (map-sweep finding)', () => {
  const w = outside(); // already outside
  for (const a of ['I step outside', 'step outside', 'go outside', 'leave the building', 'head out']) {
    assert.equal(rolled(w, a), false, `"${a}" when already outside must not roll`);
  }
  const r = playerMove(w, PACKS, 'step outside');
  assert.equal(r.world.scene?.interior ?? null, null, 'you stay outside (no state change)');
  assert.match(r.output.narration, /already.*(open|outside)/i, r.output.narration);
  // a COMPOUND ("head outside, then who do I see?") must NOT be swallowed by the bare no-op (U235).
  assert.doesNotMatch(playerMove(w, PACKS, 'head outside and tell me who I see').output.narration, /already out in the open/i);
});

test('U262: a social SEARCH ("look for someone to talk to") surveys, never a charm roll', () => {
  assert.equal(rolled(outside(), 'I look for anyone to talk to'), false);
  assert.equal(rolled(outside(), 'I look for someone to speak with'), false);
  // The authentic town-run #3 t17 line.
  assert.equal(
    rolled(outside(), 'I head back to the main road and look for someone actually living here to talk to'),
    false,
    'the t17 compound (movement + social search) must not roll a check'
  );
});

test('U262: contested actions STILL roll (the fix must not free-pass them)', () => {
  for (const phrase of [
    'I look for someone to rob',
    'I look for the guard to fight',
    'I persuade the merchant to lower his price',
    'I pick the lock',
  ]) {
    assert.equal(rolled(outside(), phrase), true, `[${phrase}] is contested — must still roll`);
  }
});
