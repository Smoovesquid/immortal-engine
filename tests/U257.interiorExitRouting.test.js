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
