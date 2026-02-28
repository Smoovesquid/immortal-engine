import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldTick } from '../engine/worldTick.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';

test('env: resolveMove emits env deltas and they apply/clamp deterministically', () => {
  let w = newWorld({ seed: 'seed', fate: 0.7, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.party = [{ id: 'p1', name: 'P1', stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }, inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] } }];

  const move = { actorId: 'p1', intentText: 'Kick the door in', approachTag: 'force', stakeTag: 'time', risk: 0.7 };
  const r = resolveMove(w, move).result;
  const envOps = r.deltas.filter(d => d.op === 'env');
  assert.ok(envOps.length >= 1);

  const w2 = applyDeltas(w, r.deltas);
  assert.ok(w2.env);
  assert.ok(w2.env.noise >= 0 && w2.env.noise <= 6);
});

test('env: high noise residue increases pressure on worldTick, then decays', () => {
  let w = newWorld({ seed: 'seed', fate: 0.9, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.env = { noise: 6, heat: 0, scent: 0, light: 3 };
  w.clocks.pressure = 0;

  const w2 = worldTick(w, 'S');
  assert.ok(w2.clocks.pressure >= 1);
  assert.ok(w2.env.noise < 6);
});

test('env: low light + high dread increases dread deterministically', () => {
  let w = newWorld({ seed: 'seed', fate: 0.6, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.env = { noise: 0, heat: 0, scent: 0, light: 0 };
  w.clocks.dread = 6;

  const w2 = worldTick(w, 'S');
  assert.ok(w2.clocks.dread >= 7);
});
