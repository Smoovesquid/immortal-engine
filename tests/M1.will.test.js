import test from 'node:test';
import assert from 'node:assert/strict';
import { willProfile, castAffinity, applyWillToCast, classifyDeed } from '../engine/magic/will.js';

const mkWorld = (deeds, seed = 'w') => ({ meta: { seed }, timeline: deeds.map((text, i) => ({ t: i, kind: 'resolution', data: { text } })) });

test('M1: deeds shape Will — a life of violence becomes the Flame', () => {
  const w = mkWorld(Array(40).fill('You burn the bandits and slay the last where he kneels.'));
  assert.equal(willProfile(w).dominant, 'evocation');
});

test('M1: a life of mercy becomes the Mender; curiosity becomes the Eye', () => {
  assert.equal(willProfile(mkWorld(Array(40).fill('You tend the wounded and help the frightened.'))).dominant, 'restoration');
  assert.equal(willProfile(mkWorld(Array(40).fill('You investigate the ruin and study the strange markings.'))).dominant, 'divination');
});

test('M1: Will drifts — sustained change turns the self', () => {
  const deeds = [...Array(30).fill('You burn and destroy.'), ...Array(60).fill('You heal and mend the hurt.')];
  assert.equal(willProfile(mkWorld(deeds)).dominant, 'restoration', 'recent sustained mercy overtakes old wrath');
});

test('M1: aligned magic is strong; a contrary school recoils and can backfire', () => {
  const wrath = willProfile(mkWorld(Array(50).fill('You burn, you blast, you slay.')));
  const evo = castAffinity(wrath, 'evocation');
  const heal = castAffinity(wrath, 'restoration');
  assert.ok(evo.affinity > heal.affinity, 'the destroyer casts fire better than mending');
  assert.ok(evo.mod > 0 && heal.mod < 0);
  assert.ok(heal.backfireChance > 0, 'forcing mending against a wrathful will can backfire');
  assert.equal(evo.backfireChance, 0, 'aligned magic never backfires');
  assert.equal(evo.feel, 'eager');
});

test('M1: applyWillToCast — aligned succeeds more than dissonant; deterministic; backfire only on a dissonant miss', () => {
  const w = mkWorld(Array(50).fill('You burn and slay.'));
  let alignedHits = 0, dissonHits = 0, backfires = 0;
  for (let n = 0; n < 300; n++) {
    if (applyWillToCast({ world: w, school: 'evocation', nonce: n }).cast) alignedHits++;
    const r = applyWillToCast({ world: w, school: 'restoration', nonce: n });
    if (r.cast) dissonHits++; if (r.backfired) { backfires++; assert.equal(r.cast, false, 'backfire only on a miss'); }
  }
  assert.ok(alignedHits > dissonHits, `aligned ${alignedHits} should beat dissonant ${dissonHits}`);
  assert.ok(backfires > 0, 'dissonant casting sometimes backfires');
  assert.deepEqual(applyWillToCast({ world: w, school: 'evocation', nonce: 5 }), applyWillToCast({ world: w, school: 'evocation', nonce: 5 }));
});

test('M1: classifyDeed reads keywords and explicit tags; empty history => no will', () => {
  assert.ok(classifyDeed({ data: { text: 'you sneak past and hide in the dark' } }).illusion > 0);
  assert.ok(classifyDeed({ tags: ['necromancy'], data: {} }).necromancy >= 2);
  assert.equal(willProfile({ meta: { seed: 's' }, timeline: [] }).dominant, null, 'a blank slate has no shaped will');
});
