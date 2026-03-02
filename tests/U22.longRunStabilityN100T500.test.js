import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { simulateTurns } from '../engine/simulate.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

function isInt(n) {
  return Number.isInteger(n) && Number.isFinite(n);
}

function inRangeInt(n, lo, hi) {
  return isInt(n) && n >= lo && n <= hi;
}

function inRangeNum(n, lo, hi) {
  return Number.isFinite(n) && n >= lo && n <= hi;
}

function assertArrayCap(arr, cap, label) {
  if (arr == null) return;
  assert.ok(Array.isArray(arr), `${label} must be an array`);
  assert.ok(arr.length <= cap, `${label} length ${arr.length} exceeds cap ${cap}`);
}

function assertWorldBounded(w, turns) {
  // clocks
  const clocks = (w && typeof w === 'object' && w.clocks && typeof w.clocks === 'object') ? w.clocks : {};
  assert.ok(inRangeInt(Math.trunc(Number(clocks.pressure ?? 0)), 0, 12), 'clocks.pressure out of range');
  assert.ok(inRangeInt(Math.trunc(Number(clocks.dread ?? 0)), 0, 12), 'clocks.dread out of range');
  assert.ok(inRangeInt(Math.trunc(Number(clocks.revelation ?? 0)), 0, 12), 'clocks.revelation out of range');

  // env
  const env = (w && typeof w === 'object' && w.env && typeof w.env === 'object') ? w.env : {};
  for (const k of ['noise', 'heat', 'scent', 'light']) {
    if (k in env) {
      assert.ok(inRangeInt(Math.trunc(Number(env[k])), 0, 6), `env.${k} out of range`);
    }
  }

  // ecology
  const eco = (w && typeof w === 'object' && w.ecology && typeof w.ecology === 'object') ? w.ecology : {};
  for (const k of ['corruption', 'scarcity', 'instability']) {
    if (k in eco) {
      assert.ok(inRangeInt(Math.trunc(Number(eco[k])), 0, 100), `ecology.${k} out of range`);
    }
  }

  // meta
  const meta = (w && typeof w === 'object' && w.meta && typeof w.meta === 'object') ? w.meta : {};
  if ('fate' in meta) {
    assert.ok(inRangeNum(Number(meta.fate), 0, 1), 'meta.fate out of range');
  }
  const adv = (meta.advantageTokens && typeof meta.advantageTokens === 'object') ? meta.advantageTokens : {};
  for (const v of Object.values(adv)) {
    assert.ok(inRangeInt(Math.trunc(Number(v)), 0, 2), 'meta.advantageTokens value out of range');
  }

  // ledger caps
  const ledger = (w && typeof w === 'object' && w.ledger && typeof w.ledger === 'object') ? w.ledger : {};
  assertArrayCap(ledger.facts, 8, 'ledger.facts');
  assertArrayCap(ledger.threats, 8, 'ledger.threats');
  assertArrayCap(ledger.questions, 8, 'ledger.questions');

  // instrument bounds (threads/inevitability are high-risk for drift)
  const inst = (w && typeof w === 'object' && w.instrument && typeof w.instrument === 'object') ? w.instrument : {};
  if ('inevitability' in inst) {
    assert.ok(inRangeInt(Math.trunc(Number(inst.inevitability)), 0, 12), 'instrument.inevitability out of range');
  }
  if (Array.isArray(inst.active)) assertArrayCap(inst.active, 4, 'instrument.active');
  if (Array.isArray(inst.threads)) assertArrayCap(inst.threads, 12, 'instrument.threads');
  if (Array.isArray(inst.threads)) {
    for (const t of inst.threads) {
      const tension = Math.trunc(Number(t?.tension ?? 0));
      assert.ok(inRangeInt(tension, 0, 5), 'thread.tension out of range');
      const age = Math.trunc(Number(t?.age ?? 0));
      assert.ok(inRangeInt(age, 0, 999), 'thread.age out of range');
    }
  }

  // factions bounds
  if (Array.isArray(w.factions)) {
    for (const f of w.factions) {
      if (f && typeof f === 'object') {
        if ('pressure' in f) assert.ok(inRangeInt(Math.trunc(Number(f.pressure)), 0, 100), 'faction.pressure out of range');
        if ('hostility' in f) assert.ok(inRangeInt(Math.trunc(Number(f.hostility)), 0, 100), 'faction.hostility out of range');
      }
    }
  }
  if (w.factionDrift && typeof w.factionDrift === 'object') {
    for (const v of Object.values(w.factionDrift)) {
      assert.ok(inRangeInt(Math.trunc(Number(v)), -100, 100), 'factionDrift value out of range');
    }
  }

  // conditions cap per entity (effectsCore enforces 12)
  if (Array.isArray(w.party)) {
    for (const e of w.party) {
      if (e && typeof e === 'object' && 'conditions' in e) {
        assertArrayCap(e.conditions, 12, 'entity.conditions');
      }
      if (e && typeof e === 'object') {
        if ('wounds' in e) assert.ok(inRangeInt(Math.trunc(Number(e.wounds)), 0, 6), 'entity.wounds out of range');
        if ('stress' in e) assert.ok(inRangeInt(Math.trunc(Number(e.stress)), 0, 6), 'entity.stress out of range');
      }
    }
  }

  // map caps
  const map = (w && typeof w === 'object' && w.map && typeof w.map === 'object') ? w.map : {};
  if (Array.isArray(map.nodes)) assertArrayCap(map.nodes, 200, 'map.nodes');

  // time caps
  const time = (w && typeof w === 'object' && w.time && typeof w.time === 'object') ? w.time : {};
  if ('turn' in time) assert.ok(inRangeInt(Math.trunc(Number(time.turn)), 0, 999999), 'time.turn out of range');
  if ('scene' in time) assert.ok(inRangeInt(Math.trunc(Number(time.scene)), 0, 999999), 'time.scene out of range');

  // bounded growth heuristic: timeline should be O(turns), not runaway
  if (Array.isArray(w.timeline)) {
    const max = (turns * 10) + 100; // conservative constant-factor bound
    assert.ok(w.timeline.length <= max, `timeline runaway: ${w.timeline.length} > ${max}`);
  }
}

test('U22: Gate VI Long-Run Stability (N>=100, turns>=500) + bounded invariants', () => {
  const N = 100;
  const TURNS = 500;

  for (let i = 0; i < N; i++) {
    const seed = `u22-seed-${i}`;
    const w0 = newWorld({
      seed,
      fate: 0.2,
      campaignId: 'u22',
      pack: { primaryId: 'fantasy', mixerId: null }
    });

    const { world: simulated } = simulateTurns(w0, packsById, TURNS);
    assertWorldBounded(simulated, TURNS);

    const h0 = worldHash(simulated);

    const exported = exportWorld(simulated);
    const imported = importWorld(exported);
    assertWorldBounded(imported, TURNS);

    const h1 = worldHash(imported);
    assert.equal(h1, h0);
  }
});
