// U664 — FUNC-MINIS-1: replay/worldHash determinism, explicitly proven.
//
// Tim's acceptance #7 (2026-07-09). Three claims, each load-bearing:
//   1. Same seed → same world, furniture included (fresh boots hash equal).
//   2. Same seed + same actions → same world THROUGH a destruction (the smash
//      mutation path is replay-stable).
//   3. Furniture state is INSIDE the hash: destroying a placed piece changes the
//      hash (worldHash projects w.map whole — node.furniture and the
//      furnitureSeeded marker ride with it). A determinism guard that ignored
//      furniture would let renders drift from canon silently.
// Plus the procgen sanity: a world with no authored structures boots hash-equal
// too (the packet's paths are all authored-gated). U19/21/22/27/30 assert the
// deeper replay laws suite-wide; this file pins the furniture seam by name.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootDemo() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

test('U664: fresh boots of the authored world hash identically — seeded furniture is deterministic', () => {
  assert.equal(worldHash(bootDemo()), worldHash(bootDemo()));
});

test('U664: the smash path is replay-stable — same seed, same action, same world', () => {
  const run = () => {
    let w = bootDemo();
    w = playerMove(w, PACKS, 'I smash the barrel.').world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});

test('U664: furniture destruction is INSIDE the hash — canon cannot drift silently', () => {
  const before = bootDemo();
  const after = playerMove(before, PACKS, 'I smash the barrel.').world;
  assert.notEqual(worldHash(before), worldHash(after),
    'destroying a placed piece must change the world fingerprint');
});

test('U664: a procgen world (no authored structures) still boots hash-equal', () => {
  const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  assert.equal(worldHash(boot()), worldHash(boot()));
});
