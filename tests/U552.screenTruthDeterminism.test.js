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

// PLAN-SPLIT-1 — the wake bug (place-unit token off its own building) is fixed;
// EXPECTED_RED is now empty and the run carries zero findings of any kind.
test('U552: zero expected-red findings and zero unexpected — the run is fully green', () => {
  const r = runScreenTruth();
  const expected = r.findings.filter(f => f.expected);
  const unexpected = r.findings.filter(f => !f.expected);
  assert.equal(expected.length, 0, `no expected-red findings remain (PLAN-SPLIT-1 fixed the wake bug); got ${JSON.stringify(expected)}`);
  assert.equal(unexpected.length, 0, `no UNEXPECTED findings (regressions); got ${JSON.stringify(unexpected)}`);
  assert.equal(r.findings.length, 0, `the run is fully green; got ${JSON.stringify(r.findings)}`);
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
