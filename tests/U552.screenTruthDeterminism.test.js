// U552 — VIS-ORACLE: the oracle is deterministic.
//
// The screen-truth run is a pure function of the seeded, LLM-off boot: two runs
// must emit BYTE-IDENTICAL findings, and every scene's golden raster must be
// stable across two renders (the property the golden lock depends on — a golden
// that drifted on a re-run would be worthless). Mirrors U497's determinism proof
// for the position probe.
//
// docs/briefs/VIS-ORACLE.md. Siblings: U551 (the oracle sees), U553 (live RED).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runScreenTruth } from '../scripts/screenTruth.mjs';
import { buildScenes, drawnModel } from '../scripts/screenTruth.scenes.mjs';
import { rasterizeScene, toPGM } from '../scripts/screenTruth.goldens.mjs';

test('U552: two runs produce byte-identical findings', () => {
  const a = runScreenTruth();
  const b = runScreenTruth();
  assert.equal(JSON.stringify(a.findings), JSON.stringify(b.findings), 'findings identical across runs');
});

test('U552: two runs produce byte-identical scene summaries (counts, findings, expected/unexpected split)', () => {
  const a = runScreenTruth();
  const b = runScreenTruth();
  // Strip nothing — the whole scene report must be reproducible.
  assert.equal(JSON.stringify(a.scenes), JSON.stringify(b.scenes), 'scene reports identical across runs');
});

test('U552: exactly one expected-red finding (the wake bug) and zero unexpected', () => {
  const r = runScreenTruth();
  const expected = r.findings.filter(f => f.expected);
  const unexpected = r.findings.filter(f => !f.expected);
  assert.equal(expected.length, 1, `exactly one expected-red finding; got ${JSON.stringify(expected)}`);
  assert.equal(expected[0].class, 'PROJECTION_EQUALITY', 'the expected red is a projection-equality finding');
  assert.equal(expected[0].step, 'wake_interior', 'the expected red is the wake scene');
  assert.equal(unexpected.length, 0, `no UNEXPECTED findings (regressions); got ${JSON.stringify(unexpected)}`);
});

test('U552: every scene golden raster is stable across two renders (the golden-lock invariant)', () => {
  // Two independent scene boots → two rasters per scene → identical PGM text.
  const build = () => {
    const out = new Map();
    for (const sc of buildScenes()) {
      const m = drawnModel(sc.world, sc.nodeId); m.__world = sc.world;
      out.set(sc.id, toPGM(rasterizeScene(m), sc.id));
    }
    return out;
  };
  const a = build(), b = build();
  assert.equal(a.size, b.size, 'same scene set both times');
  for (const [id, pgmA] of a) {
    assert.equal(pgmA, b.get(id), `golden raster for "${id}" is identical across renders`);
  }
});

test('U552: the seven canonical scenes are present and named', () => {
  const r = runScreenTruth();
  assert.deepEqual(
    r.scenes.map(s => s.id),
    ['wake_interior', 'cottage_exterior', 'settlement_square_morning', 'settlement_square_evening', 'wild_road_walking', 'deep_wild_fog_edge', 'combat_one_defeated'],
    'all seven canonical scenes, in order',
  );
});
