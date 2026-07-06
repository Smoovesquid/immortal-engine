// U614 — SP-2: the faction-ethos ALGEBRA (the pure sign-flip table).
//
// SP-2 gives each faction an `ethos` ('lawful'|'outlaw'|'neutral'). A lawful or neutral
// institution reacts with the base reaction-table value (SP-1's behavior, unchanged). An
// OUTLAW faction — the thieves' den, the cutthroat lodge — reads the SAME table with the
// sign FLIPPED at HALF magnitude: "the thieves' den warms when the watch curses your
// name." The magnitude is still wholly table-owned (Biblioteca Vol 11 — the LLM never
// sets a number); ethos only selects the sign and the halving.
//
// This file pins the ARITHMETIC directly on deedFactionDeltas (pure, witness-gated): the
// exact flipped value at every severity band for both deed families, the neutral/lawful
// identity, the half-magnitude boundary edges, and the differential in a single world.
// The LIVE differential through the playloop is U615; the WORLD_VERSION bump wall is U616.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { deedFactionDeltas, FACTION_REP } from '../engine/social/reactionTable.js';

// A minimal world with three factions, one of each ethos, and a settlement whose NPCs
// are each affiliated with one of them. Every deed below witnesses all three at once, so a
// single call returns the differential across the whole stance spectrum.
const world = {
  factions: [
    { id: 'watch', ethos: 'lawful' },
    { id: 'guild', ethos: 'neutral' },
    { id: 'thieves', ethos: 'outlaw' },
  ],
  map: {
    nodes: [{
      id: 'n1',
      settlement: {
        npcs: [
          { id: 'wL', factionId: 'watch' },
          { id: 'wN', factionId: 'guild' },
          { id: 'wO', factionId: 'thieves' },
        ],
      },
    }],
  },
};

const ALL = ['wL', 'wN', 'wO'];
// deedFactionDeltas sorts output by factionId: guild < thieves < watch.
const byFaction = (deltas) => Object.fromEntries(deltas.map(d => [d.factionId, d.by]));

describe('U614-A: outlaw flips the DARK table sign at half magnitude; lawful/neutral are identity', () => {
  for (const [band, sev] of [['grave', 20], ['moderate', 12], ['light', 5]]) {
    it(`grave/moderate/light cruelty — ${band} (sev ${sev})`, () => {
      const deltas = deedFactionDeltas(world, { kind: 'cruelty', severity: sev, witnesses: ALL, nodeId: 'n1' });
      const m = byFaction(deltas);
      const base = FACTION_REP.dark[band];               // negative
      const flipped = Math.round(Math.abs(base) / 2);    // positive, half magnitude
      assert.equal(m.watch, base, 'lawful = base (unchanged from SP-1)');
      assert.equal(m.guild, base, 'neutral = base (identity)');
      assert.equal(m.thieves, flipped, 'outlaw = +half (the den warms)');
      // Sign really flipped, magnitude really halved.
      assert.ok(m.thieves > 0 && base < 0, 'sign inverted');
      assert.equal(m.thieves, Math.abs(base) - Math.floor(Math.abs(base) / 2), 'exactly half (ceil on odd)');
    });
  }

  it('the canonical anchor: grave cruelty → lawful −10, outlaw +5 in the same world', () => {
    const m = byFaction(deedFactionDeltas(world, { kind: 'cruelty', severity: 20, witnesses: ALL, nodeId: 'n1' }));
    assert.deepEqual(m, { watch: -10, guild: -10, thieves: 5 });
  });
});

describe('U614-B: outlaw flips the BRIGHT table too — a public good deed cools the den', () => {
  for (const [band, sev] of [['grave', 20], ['moderate', 12], ['light', 5]]) {
    it(`aid — ${band} (sev ${sev})`, () => {
      const m = byFaction(deedFactionDeltas(world, { kind: 'aid', severity: sev, witnesses: ALL, nodeId: 'n1' }));
      const base = FACTION_REP.bright[band];             // positive
      const flipped = -Math.round(Math.abs(base) / 2);   // negative, half magnitude
      assert.equal(m.watch, base, 'lawful = base');
      assert.equal(m.guild, base, 'neutral = identity');
      assert.equal(m.thieves, flipped, 'outlaw = −half (the den sours on a do-gooder)');
    });
  }

  it('bright grave: lawful +6, outlaw −3', () => {
    const m = byFaction(deedFactionDeltas(world, { kind: 'aid', severity: 20, witnesses: ALL, nodeId: 'n1' }));
    assert.deepEqual(m, { watch: 6, guild: 6, thieves: -3 });
  });
});

describe('U614-C: the half-magnitude boundary edges (odd values round up, never to zero)', () => {
  it('dark: 10→5, 5→3, 2→1 (magnitude taken from |base|, ceil on the odd 5)', () => {
    // Sweep the three dark bands; assert the exact flipped magnitude table.
    const expect = { grave: 5, moderate: 3, light: 1 };
    for (const [band, sev] of [['grave', 20], ['moderate', 12], ['light', 5]]) {
      const m = byFaction(deedFactionDeltas(world, { kind: 'cruelty', severity: sev, witnesses: ['wO'], nodeId: 'n1' }));
      assert.equal(m.thieves, expect[band], `dark ${band} flips to +${expect[band]}`);
    }
  });

  it('bright: 6→3, 3→2, 1→1 — the smallest deed still moves the den (never a 0 no-op)', () => {
    const expect = { grave: -3, moderate: -2, light: -1 };
    for (const [band, sev] of [['grave', 20], ['moderate', 12], ['light', 5]]) {
      const m = byFaction(deedFactionDeltas(world, { kind: 'aid', severity: sev, witnesses: ['wO'], nodeId: 'n1' }));
      assert.equal(m.thieves, expect[band], `bright ${band} flips to ${expect[band]}`);
      assert.notEqual(m.thieves, 0, 'flip never zeroes out (the op treats 0 as a no-op)');
    }
  });
});

describe('U614-D: neutral is byte-identical to no-ethos (old-save safety) and to lawful direction', () => {
  it('a faction with a missing/blank ethos is treated as neutral (identity)', () => {
    const w2 = {
      factions: [{ id: 'a' }, { id: 'b', ethos: '' }, { id: 'c', ethos: 'neutral' }],
      map: { nodes: [{ id: 'n1', settlement: { npcs: [
        { id: 'x', factionId: 'a' }, { id: 'y', factionId: 'b' }, { id: 'z', factionId: 'c' },
      ] } }] },
    };
    const m = byFaction(deedFactionDeltas(w2, { kind: 'cruelty', severity: 20, witnesses: ['x', 'y', 'z'], nodeId: 'n1' }));
    assert.deepEqual(m, { a: FACTION_REP.dark.grave, b: FACTION_REP.dark.grave, c: FACTION_REP.dark.grave },
      'no-ethos, blank, and explicit neutral all take the base value');
  });

  it('an unknown ethos string is also identity (defensive — the invariant would have caught a stored one)', () => {
    const w3 = {
      factions: [{ id: 'a', ethos: 'chaotic-weird' }],
      map: { nodes: [{ id: 'n1', settlement: { npcs: [{ id: 'x', factionId: 'a' }] } }] },
    };
    const m = byFaction(deedFactionDeltas(w3, { kind: 'cruelty', severity: 20, witnesses: ['x'], nodeId: 'n1' }));
    assert.equal(m.a, FACTION_REP.dark.grave, 'only "outlaw" flips; anything else is identity');
  });

  it('purity: deedFactionDeltas mutates nothing and is referentially stable', () => {
    const deed = { kind: 'cruelty', severity: 20, witnesses: ALL, nodeId: 'n1' };
    const snapshot = JSON.stringify(world);
    const a = deedFactionDeltas(world, deed);
    const b = deedFactionDeltas(world, deed);
    assert.deepEqual(a, b, 'same (world, deed) → same deltas');
    assert.equal(JSON.stringify(world), snapshot, 'the world object is untouched');
  });
});
