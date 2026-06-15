import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-15): deliberate self-harm was hand-waved to no effect
// ("trivial action — no roll, auto-success", 0 wounds) or routed through a
// fail-able skill check. You cannot fail to cut yourself; it must deal a wound.

function freshWorld(seed = 'self-harm') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U143: deliberate self-cut deals a wound with no roll', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, 'I take my short sword and deliberately cut my own forearm');
  assert.equal(world.party[0].wounds, before + 1, 'one wound applied');
  assert.match(output.mechanics, /self-harm/);
  assert.doesNotMatch(output.mechanics, /vs DC/, 'no skill-check roll');
});

test('U143: "stab myself" also wounds', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world } = playerMove(w, byId, 'I stab myself in the leg');
  assert.equal(world.party[0].wounds, before + 1);
});

test('U143: harming an external target is NOT self-harm', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, 'I cut the rope');
  assert.equal(world.party[0].wounds, before, 'no self-wound');
  assert.doesNotMatch(output.mechanics, /self-harm/);
});

test('U143: threatened / hypothetical self-harm does not wound', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  let { world } = playerMove(w, byId, 'I threaten to cut myself');
  assert.equal(world.party[0].wounds, before);
  ({ world } = playerMove(world, byId, 'I almost cut my hand on the glass'));
  assert.equal(world.party[0].wounds, before);
});
