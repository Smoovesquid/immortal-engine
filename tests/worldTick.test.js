import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldTick } from '../engine/worldTick.js';
import { planNextScene } from '../engine/sceneDirector.js';

const pack = {
  locations: ['L1', 'L2'],
  objectives: ['O1', 'O2'],
  complications: ['C1'],
  npcArchetypes: ['N1'],
  sensoryMotifs: ['m1', 'm2']
};

test('worldTick deterministic given same seed + world', () => {
  let w = newWorld({ seed: 'seed', fate: 0.9, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.threads = [{ id: 't1', objective: 'Stop the leak', tension: 3, trajectory: 'static', factionId: 'shadow', active: true, age: 0 }];

  const a = worldTick(w, 'S');
  const b = worldTick(w, 'S');
  assert.deepEqual(a, b);
});

test('thread escalation occurs at deterministic tension thresholds', () => {
  let w = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.threads = [{ id: 't1', objective: 'Stop the leak', tension: 3, trajectory: 'static', factionId: 'shadow', active: true, age: 0 }];
  const w2 = worldTick(w, 'S');
  assert.ok(w2.threads[0].tension >= 4);
  const hit = w2.timeline.find(e => e.kind === 'worldTick' && String(e.data.text).includes('thread escalates'));
  assert.ok(hit);
});

test('irreversible corruption threshold forms a scar', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.ecology = { corruption: 71, instability: 0, scarcity: 0 };
  const w2 = worldTick(w, 'S');
  assert.ok(w2.scars.some(s => s.id === 'corruption_shift'));
});

test('scars accumulate and never disappear', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.ecology = { corruption: 71, instability: 0, scarcity: 0 };
  const a = worldTick(w, 'S1');
  const b = worldTick(a, 'S2');
  assert.ok(b.scars.length >= a.scars.length);
  for (const s of a.scars) assert.ok(b.scars.some(x => x.id === s.id));
});

test('ecology shifts alter sceneDirector tone deterministically', () => {
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.ecology = { corruption: 80, instability: 0, scarcity: 0 };
  const plan = planNextScene(w, pack, { allowSameLocation: true });
  assert.ok(['blighted', 'soured', 'ashen'].includes(plan.emotionalTone));
});

test('fate slider modifies severity curve deterministically (blood increases ecology drift)', () => {
  let coop = newWorld({ seed: 'seed', fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let blood = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  coop.scene.promptSeed = 'p';
  blood.scene.promptSeed = 'p';
  coop.threads = [{ id: 't1', objective: 'Stop the leak', tension: 4, trajectory: 'static', factionId: 'shadow', active: true, age: 0 }];
  blood.threads = [{ id: 't1', objective: 'Stop the leak', tension: 4, trajectory: 'static', factionId: 'shadow', active: true, age: 0 }];

  const a = worldTick(coop, 'S').ecology.corruption;
  const b = worldTick(blood, 'S').ecology.corruption;
  assert.ok(b >= a);
});
