// U107 — Morality foundation (M0 + M0.5 of the Dark Path).
//
// First-class morality state on each party member, the deeds index on the world, the
// invariants that bound them, and the deterministic delta plumbing that mutates them.
// No detection, no consequences, no prose yet — this is the safe, defaulted shape and
// the pure mutations later milestones will emit. See docs/MORALITY_SYSTEM.md.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';

const mk = (over = {}) => ensureWorld({ meta: { seed: 'u107', fate: 0.2, campaignId: 'u107' }, party: [{ id: 'party', name: 'Test' }], ...over });

const ZERO_AXES = { pride: 0, greed: 0, wrath: 0, envy: 0, lust: 0, gluttony: 0, sloth: 0, humility: 0, charity: 0, patience: 0, kindness: 0, chastity: 0, temperance: 0, diligence: 0 };

describe('U107-A: state shape & safe defaults', () => {
  it('WORLD_VERSION is 27', () => assert.equal(WORLD_VERSION, 27));
  it('a fresh party member has neutral morality', () => {
    const m = mk().party[0].morality;
    assert.deepEqual(m, { corruption: 0, virtue: 0, heat: 0, locked: false, patrons: {}, axes: ZERO_AXES, lastDeedT: 0 });
  });
  it('the world has an empty deeds index', () => assert.deepEqual(mk().deeds, []));
  it('an old save with no morality upgrades to a clean neutral slate', () => {
    const w = ensureWorld({ meta: { version: 5, seed: 'old', fate: 0.3 }, party: [{ id: 'party', name: 'X' }] });
    assert.equal(w.meta.version, 27);
    assert.equal(w.party[0].morality.corruption, 0);
    assert.equal(w.party[0].morality.locked, false);
    assert.doesNotThrow(() => assertWorldInvariants(w));
  });
});

describe('U107-B: invariants bound the state', () => {
  it('defaults pass invariants', () => assert.doesNotThrow(() => assertWorldInvariants(mk())));
  it('out-of-range corruption is rejected', () => {
    const w = mk();
    w.party[0].morality.corruption = 200; // bypass ensure, force-break
    assert.throws(() => assertWorldInvariants(w), /corruption must be integer 0\.\.100/);
  });
  it('negative heat is rejected', () => {
    const w = mk(); w.party[0].morality.heat = -1;
    assert.throws(() => assertWorldInvariants(w), /heat must be non-negative/);
  });
  it('a malformed deed kind is rejected', () => {
    const w = mk(); w.deeds = [{ kind: 'jaywalking', severity: 1 }];
    assert.throws(() => assertWorldInvariants(w), /not a valid deed kind/);
  });
});

describe('U107-C: delta plumbing mutates correctly and clamps', () => {
  it('corruption/virtue/heat/patron/lock all apply', () => {
    const w = applyDeltas(mk(), [
      { op: 'corruptionDelta', by: 30 },
      { op: 'virtueDelta', by: 5 },
      { op: 'adjustHeat', by: 12 },
      { op: 'setPatron', patronId: 'yuggoth', by: 10 },
      { op: 'lockMorality' },
    ]);
    const m = w.party[0].morality;
    assert.equal(m.corruption, 30);
    assert.equal(m.virtue, 5);
    assert.equal(m.heat, 12);
    assert.equal(m.patrons.yuggoth, 10);
    assert.equal(m.locked, true);
    assert.doesNotThrow(() => assertWorldInvariants(w));
  });
  it('corruption clamps to [0,100] and heat floors at 0', () => {
    const hi = applyDeltas(mk(), [{ op: 'corruptionDelta', by: 999 }]);
    assert.equal(hi.party[0].morality.corruption, 100);
    const lo = applyDeltas(applyDeltas(mk(), [{ op: 'adjustHeat', by: 5 }]), [{ op: 'adjustHeat', by: -999 }]);
    assert.equal(lo.party[0].morality.heat, 0);
  });
  it('recordDeed appends a deed and stamps lastDeedT', () => {
    const w = applyDeltas(mk(), [{ op: 'recordDeed', deedKind: 'forbidden', severity: 8, t: 3, nodeId: 'n1', summary: 'raised the dead', witnesses: ['npc1'] }]);
    assert.equal(w.deeds.length, 1);
    assert.equal(w.deeds[0].kind, 'forbidden');
    assert.equal(w.deeds[0].severity, 8);
    assert.equal(w.party[0].morality.lastDeedT, 3);
    assert.doesNotThrow(() => assertWorldInvariants(w));
  });
  it('recordDeed rejects an invalid kind (no-op)', () => {
    const w = applyDeltas(mk(), [{ op: 'recordDeed', deedKind: 'shoplifting', severity: 1 }]);
    assert.equal(w.deeds.length, 0);
  });
  it('the deeds index is capped at 64', () => {
    const ops = [];
    for (let i = 0; i < 80; i++) ops.push({ op: 'recordDeed', deedKind: 'cruelty', severity: 1, t: i });
    const w = applyDeltas(mk(), ops);
    assert.equal(w.deeds.length, 64);
    assert.doesNotThrow(() => assertWorldInvariants(w));
  });
});

describe('U107-D: deterministic (replay-safe, hashed)', () => {
  it('morality joins the world hash and is stable for identical inputs', () => {
    const run = () => worldHash(applyDeltas(mk(), [{ op: 'corruptionDelta', by: 7 }, { op: 'recordDeed', deedKind: 'cruelty', severity: 3, t: 1 }]));
    assert.equal(run(), run());
  });
  it('different corruption produces a different hash (it is in the projection)', () => {
    const a = worldHash(applyDeltas(mk(), [{ op: 'corruptionDelta', by: 1 }]));
    const b = worldHash(applyDeltas(mk(), [{ op: 'corruptionDelta', by: 2 }]));
    assert.notEqual(a, b);
  });
});
