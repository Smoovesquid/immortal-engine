import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { adjudicate } from '../engine/adjudication/adjudicate.js';
import { findRuling, applyRuling, getRulingNarration } from '../engine/adjudication/rulings.js';
import { RULINGS } from '../engine/adjudication/rulings.js';

// ── U88 — Rulings Library (Core 7 Adjudications) ──────────────────────

// Setup: create a world with various objects for testing
function makeWorldWithObjects() {
  return ensureWorld({
    meta: { version: 21, seed: 'u88-rulings', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Hero',
      stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 }
    }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        currentNodeId: 'n0',
        furniture: [
          {
            name: 'wooden barrel',
            parts: ['staves', 'hoops', 'bottom'],
            state: 'intact',
            bulk: 4,
            weight: 3,
            tags: ['wood', 'container', 'furniture'],
            breakability: 0
          },
          {
            name: 'wooden chair',
            parts: ['legs', 'back', 'seat'],
            state: 'intact',
            bulk: 2,
            weight: 2,
            tags: ['wood', 'furniture'],
            breakability: 0
          },
          {
            name: 'torch',
            state: 'intact',
            bulk: 1,
            weight: 1,
            tags: ['wood', 'metal', 'light', 'flammable'],
            flammable: 3
          },
          {
            name: 'wooden door',
            state: 'intact',
            bulk: 5,
            weight: 4,
            tags: ['wood', 'entrance'],
            flammable: 2
          }
        ]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });
}

test('U88-01: findRuling detects BREAK for smash action', () => {
  const w = makeWorldWithObjects();
  const barrel = w.map.nodes[0].furniture[0];
  const ruling = findRuling('smash the barrel', barrel);
  assert.ok(ruling);
  assert.equal(ruling.name, 'BREAK');
});

test('U88-02: findRuling detects LIGHT_FIRE for fire action', () => {
  const w = makeWorldWithObjects();
  const door = w.map.nodes[0].furniture[3];
  const ruling = findRuling('light the wooden door on fire', door);
  assert.ok(ruling);
  assert.equal(ruling.name, 'LIGHT_FIRE');
});

test('U88-03: findRuling detects IMPROVISED_WEAPON for use action', () => {
  const w = makeWorldWithObjects();
  const chair = w.map.nodes[0].furniture[1];
  const ruling = findRuling('use the chair as a club', chair);
  assert.ok(ruling);
  assert.equal(ruling.name, 'IMPROVISED_WEAPON');
});

test('U88-04: findRuling returns null for non-matching action', () => {
  const w = makeWorldWithObjects();
  const barrel = w.map.nodes[0].furniture[0];
  const ruling = findRuling('talk to the barrel', barrel);
  assert.equal(ruling, null);
});

test('U88-05: BREAK ruling has correct properties', () => {
  const breakRuling = RULINGS.BREAK;
  assert.equal(breakRuling.approach, 'force');
  assert.equal(breakRuling.stat, 'MIGHT');
  assert.equal(breakRuling.dcBase, 10);
  assert.ok(breakRuling.outcomes.success);
  assert.ok(breakRuling.outcomes.mixed);
  assert.ok(breakRuling.outcomes.failure);
});

test('U88-06: LIGHT_FIRE ruling has correct properties', () => {
  const fireRuling = RULINGS.LIGHT_FIRE;
  assert.equal(fireRuling.approach, 'finesse');
  assert.equal(fireRuling.stat, 'AGILITY');
  assert.equal(fireRuling.dcBase, 9);
});

test('U88-07: IMPROVISED_WEAPON ruling has correct properties', () => {
  const weaponRuling = RULINGS.IMPROVISED_WEAPON;
  assert.equal(weaponRuling.approach, 'force');
  assert.equal(weaponRuling.stat, 'MIGHT');
  assert.equal(weaponRuling.dcBase, 11);
});

test('U88-08: FALL ruling has distance-based DC modifier', () => {
  const fallRuling = RULINGS.FALL;
  const dc1 = fallRuling.dcBase + fallRuling.dcModifier(1); // 1 increment = 10+1=11
  const dc3 = fallRuling.dcBase + fallRuling.dcModifier(3); // 3 increments = 10+3=13
  assert.equal(dc1, 11);
  assert.equal(dc3, 13);
});

test('U88-09: NOISE ruling is automatic (no roll)', () => {
  const noiseRuling = RULINGS.NOISE;
  assert.equal(noiseRuling.isAutomatic, true);
});

test('U88-10: HIDE_BEHIND ruling gives AC bonus on success', () => {
  const hidingRuling = RULINGS.HIDE_BEHIND;
  const deltas = hidingRuling.outcomes.success();
  assert.ok(deltas);
  assert.ok(deltas.length > 0);
  assert.ok(deltas[0].acBonus);
});

test('U88-11: adjudicate with BREAK ruling generates narration', () => {
  const w = makeWorldWithObjects();
  const result = adjudicate(w, 'smash the wooden barrel');
  assert.ok(result.narration);
  assert.ok(result.narration.length > 0);
  assert.ok(result.world.timeline.length > 0);
});

test('U88-12: adjudicate with BREAK ruling logs ruling name', () => {
  const w = makeWorldWithObjects();
  const result = adjudicate(w, 'smash the wooden barrel');
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  assert.equal(lastEntry.kind, 'ruling');
  assert.ok(lastEntry.data.rulingName || lastEntry.data.approach === 'force');
});

test('U88-13: adjudicate with LIGHT_FIRE ruling works end-to-end', () => {
  const w = makeWorldWithObjects();
  const result = adjudicate(w, 'light the wooden door on fire');
  assert.ok(result.narration);
  assert.ok(result.world.timeline.length > 0);
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  assert.ok(['success', 'mixed', 'failure'].includes(lastEntry.data.outcome));
});

test('U88-14: adjudicate with IMPROVISED_WEAPON works end-to-end', () => {
  const w = makeWorldWithObjects();
  const result = adjudicate(w, 'use the wooden chair as a weapon');
  assert.ok(result.narration);
  assert.ok(result.world.timeline.length > 0);
});

test('U88-15: rulings are deterministic (same seed = same outcome)', () => {
  const seed = 'u88-det';

  const w1 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 } }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        furniture: [{ name: 'wooden barrel', parts: ['staves'], state: 'intact', bulk: 4, weight: 3, tags: ['wood'], breakability: 0 }]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const w2 = ensureWorld({
    meta: { version: 21, seed, fate: 0.2 },
    party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 12, AGILITY: 11, WITS: 10, GRIT: 13, CHARM: 10 } }],
    map: {
      nodes: [{
        id: 'n0',
        name: 'cellar',
        furniture: [{ name: 'wooden barrel', parts: ['staves'], state: 'intact', bulk: 4, weight: 3, tags: ['wood'], breakability: 0 }]
      }],
      currentNodeId: 'n0',
      edges: []
    },
    timeline: []
  });

  const r1 = adjudicate(w1, 'smash the barrel');
  const r2 = adjudicate(w2, 'smash the barrel');

  const e1 = r1.world.timeline[r1.world.timeline.length - 1].data;
  const e2 = r2.world.timeline[r2.world.timeline.length - 1].data;

  assert.equal(e1.roll, e2.roll, 'same seed should produce same roll');
  assert.equal(e1.outcome, e2.outcome, 'same seed should produce same outcome');
});
