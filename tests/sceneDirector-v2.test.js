import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { ensureInstrumentLayer } from '../engine/instrument.js';
import { generateSceneFrame } from '../engine/sceneDirector.js';

const pack = {
  locations: ['A','B','C','D'],
  objectives: ['O1','O2','O3','O4'],
  sensoryMotifs: ['m1','m2','m3'],
  omens: ['o1','o2','o3'],
  prices: ['time','blood']
};

function applyFrame(world, frame) {
  // minimal deterministic update for test: advance scene + beat memory.
  const w = { ...world };
  w.scene = { ...w.scene, location: frame.location, objective: frame.objective, promptSeed: String(Number(w.scene.promptSeed) + 1) };
  const inst = ensureInstrumentLayer(w.instrument);
  w.instrument = { ...inst, lastBeats: [frame.beatType, ...(inst.lastBeats || [])].slice(0, 5) };
  return w;
}

test('same seed → same scene sequence', () => {
  let w1 = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let w2 = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w1.scene = { location: 'A', objective: 'O1', time: 'start', promptSeed: '1', tags: [], thread: '' };
  w2.scene = { location: 'A', objective: 'O1', time: 'start', promptSeed: '1', tags: [], thread: '' };

  const beats1 = [];
  const beats2 = [];
  for (let i = 0; i < 6; i++) {
    const f1 = generateSceneFrame(w1, pack);
    const f2 = generateSceneFrame(w2, pack);
    beats1.push(f1.beatType);
    beats2.push(f2.beatType);
    w1 = applyFrame(w1, f1);
    w2 = applyFrame(w2, f2);
  }
  assert.deepEqual(beats1, beats2);
});

test('escalation increases as inevitability rises (deterministic)', () => {
  let wLo = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let wHi = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  wLo.scene = { location: 'A', objective: 'O1', time: 'start', promptSeed: '1', tags: [], thread: '' };
  wHi.scene = { location: 'A', objective: 'O1', time: 'start', promptSeed: '1', tags: [], thread: '' };
  wLo.instrument = { ...wLo.instrument, inevitability: 0 };
  wHi.instrument = { ...wHi.instrument, inevitability: 12 };

  const a = generateSceneFrame(wLo, pack).beatType;
  const b = generateSceneFrame(wHi, pack).beatType;
  // High inevitability should not be quieter than low.
  assert.ok(!(b === 'quiet' && a !== 'quiet'));
});

test('beat repetition constrained: no 3 identical beats in a row', () => {
  let w = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'A', objective: 'O1', time: 'start', promptSeed: '1', tags: [], thread: '' };
  w.instrument = { ...w.instrument, lastBeats: ['quiet','quiet'] };

  const f = generateSceneFrame(w, pack);
  assert.notEqual(f.beatType, 'quiet');
});
